import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run } from "../db";
import { insertCurrencySchema } from "@money-tracker/shared/schemas";
import { formatZodError } from "../lib/utils";
import {
  isIsoFiatCode,
  ALL_SUPPORTED_CODES,
} from "@money-tracker/shared/currencyData";

const currencies = new Hono();

currencies.use("*", authMiddleware);

currencies.get("/", async (c) => {
  const { type, all } = c.req.query();
  let sql = "SELECT * FROM currencies";
  const params: any[] = [];
  const conditions: string[] = [];

  if (!all) {
    conditions.push("is_active = 1");
  }

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY sort_order DESC, type, code";

  const items = query(sql, params);
  return c.json(items.map(transformCurrency));
});

currencies.get("/export", async (c) => {
  const items = query("SELECT * FROM currencies ORDER BY sort_order DESC, type, code");
  return c.json(
    items.map(transformCurrency).map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      precision: c.precision,
      type: c.type,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
    })),
  );
});

currencies.post("/import", async (c) => {
  const data = await c.req.json() as any[];
  if (!Array.isArray(data)) {
    throw new HTTPException(400, { message: "Expected JSON array of currencies" });
  }

  const results = { inserted: 0 as number, updated: 0 as number, failed: [] as string[] };

  for (const item of data) {
    const parsed = insertCurrencySchema.safeParse(item);
    if (!parsed.success) {
      results.failed.push(`${item.code || "?"}: ${formatZodError(parsed.error)}`);
      continue;
    }

    const existing = getOne("SELECT id FROM currencies WHERE code = ?", [parsed.data.code]);
    if (existing) {
      run(
        "UPDATE currencies SET name = ?, symbol = ?, precision = ?, type = ?, is_active = ?, sort_order = ? WHERE code = ?",
        [
          parsed.data.name,
          parsed.data.symbol || null,
          parsed.data.precision,
          parsed.data.type,
          item.isActive !== undefined ? Number(item.isActive) : 1,
          item.sortOrder !== undefined ? Number(item.sortOrder) : 0,
          parsed.data.code,
        ],
      );
      results.updated++;
    } else {
      run(
        "INSERT INTO currencies (code, name, symbol, precision, type, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          parsed.data.code,
          parsed.data.name,
          parsed.data.symbol || null,
          parsed.data.precision,
          parsed.data.type,
          item.isActive !== undefined ? Number(item.isActive) : 1,
          item.sortOrder !== undefined ? Number(item.sortOrder) : 0,
        ],
      );
      results.inserted++;
    }
  }

  return c.json(results, { status: results.failed.length > 0 ? 207 : 200 });
});

currencies.get("/:code", async (c) => {
  const code = c.req.param("code");
  const item = getOne("SELECT * FROM currencies WHERE code = ?", [code]);
  if (!item) throw new HTTPException(404, { message: "Currency not found" });
  return c.json(transformCurrency(item));
});

currencies.post("/", async (c) => {
  const rawData = await c.req.json();
  const parsed = insertCurrencySchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const data = parsed.data;

  // Warn if fiat code doesn't match ISO 4217
  if (data.type === "fiat" && !isIsoFiatCode(data.code) && !ALL_SUPPORTED_CODES.includes(data.code.toUpperCase())) {
    // Log but allow — user may know about a new currency
    console.warn(`[currencies] Non-ISO 4217 fiat code added: ${data.code}`);
  }

  // Validate crypto codes are uppercase A-Z, 2-8 chars (common convention)
  if (data.type === "crypto" && !/^[A-Z0-9]{2,8}$/.test(data.code)) {
    throw new HTTPException(400, { message: "Crypto code must be 2-8 uppercase alphanumeric characters" });
  }

  // Prevent duplicate
  const existing = getOne("SELECT id FROM currencies WHERE code = ?", [data.code]);
  if (existing) {
    throw new HTTPException(409, { message: `Currency ${data.code} already exists` });
  }

  // Compute next sort_order
  const maxSort = getOne("SELECT MAX(sort_order) as max FROM currencies") as any;
  const nextSort = (maxSort?.max || 0) + 100;

  run(
    "INSERT INTO currencies (code, name, symbol, precision, type, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [data.code, data.name, data.symbol || null, data.precision, data.type, 1, nextSort],
  );

  const result = getOne("SELECT * FROM currencies WHERE code = ?", [data.code]);
  return c.json(transformCurrency(result), 201);
});

currencies.put("/:code", async (c) => {
  const code = c.req.param("code");
  const rawData = await c.req.json();

  const item = getOne("SELECT * FROM currencies WHERE code = ?", [code]);
  if (!item) throw new HTTPException(404, { message: "Currency not found" });

  // Build dynamic update
  const updates: string[] = [];
  const params: any[] = [];

  if ("name" in rawData) {
    if (!String(rawData.name).trim()) {
      throw new HTTPException(400, { message: "Name cannot be empty" });
    }
    updates.push("name = ?");
    params.push(rawData.name);
  }

  if ("symbol" in rawData) {
    updates.push("symbol = ?");
    params.push(rawData.symbol || null);
  }

  if ("precision" in rawData) {
    const p = Number(rawData.precision);
    if (isNaN(p) || p < 0 || p > 18) {
      throw new HTTPException(400, { message: "Precision must be 0-18" });
    }
    updates.push("precision = ?");
    params.push(p);
  }

  if ("isActive" in rawData) {
    updates.push("is_active = ?");
    params.push(rawData.isActive ? 1 : 0);
  }

  if ("sortOrder" in rawData) {
    updates.push("sort_order = ?");
    params.push(Number(rawData.sortOrder));
  }

  if ("type" in rawData) {
    if (rawData.type !== "fiat" && rawData.type !== "crypto") {
      throw new HTTPException(400, { message: "Type must be fiat or crypto" });
    }
    updates.push("type = ?");
    params.push(rawData.type);
  }

  if (updates.length === 0) {
    throw new HTTPException(400, { message: "No fields to update" });
  }

  params.push(code);
  run(`UPDATE currencies SET ${updates.join(", ")} WHERE code = ?`, params);

  const result = getOne("SELECT * FROM currencies WHERE code = ?", [code]);
  return c.json(transformCurrency(result));
});

currencies.delete("/:code", async (c) => {
  const code = c.req.param("code");

  const item = getOne("SELECT * FROM currencies WHERE code = ?", [code]);
  if (!item) throw new HTTPException(404, { message: "Currency not found" });

  // Prevent deletion if currency is referenced by any transactions
  const txCount = getOne("SELECT COUNT(*) as count FROM transactions WHERE currency = ?", [code]);
  if (txCount && txCount.count > 0) {
    throw new HTTPException(409, { message: `Cannot delete: ${txCount.count} transaction(s) use this currency` });
  }

  run("DELETE FROM currencies WHERE code = ?", [code]);
  return c.json({ success: true });
});

function transformCurrency(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    precision: row.precision,
    type: row.type,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export default currencies;
