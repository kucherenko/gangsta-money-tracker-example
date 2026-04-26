import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run, lastInsertedRow } from "../db";
import { insertCurrencySchema } from "@money-tracker/shared/schemas";

const currencies = new Hono();

currencies.use("*", authMiddleware);

currencies.get("/", async (c) => {
  const { type } = c.req.query();
  let sql = "SELECT * FROM currencies WHERE is_active = 1";
  const params: any[] = [];
  
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  
  sql += " ORDER BY type, code";
  
  const items = query(sql, params);
  return c.json(items.map(transformCurrency));
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
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  run(
    "INSERT INTO currencies (code, name, symbol, precision, type) VALUES (?, ?, ?, ?, ?)",
    [data.code, data.name, data.symbol || null, data.precision, data.type],
  );
  const result = lastInsertedRow("currencies");
  return c.json(transformCurrency(result), 201);
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
  };
}

export default currencies;
