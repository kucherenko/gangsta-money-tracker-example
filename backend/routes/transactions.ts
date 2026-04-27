import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run, lastInsertedRow } from "../db";
import { insertTransactionSchema, updateTransactionSchema } from "@money-tracker/shared/schemas";
import { mkdirSync, renameSync } from "node:fs";
import path from "node:path";

const tx = new Hono();

// Apply auth to all routes (must be first to cover all subsequent handlers)
tx.use("*", authMiddleware);

// ─── Receipt image serving — MUST come before /:id ──────────────────────────
tx.get("/:id/receipt", async (c) => {
  const paramId = c.req.param("id");
  const id = Number(paramId);
  if (isNaN(id) || String(id) !== String(paramId)) {
    throw new HTTPException(400, { message: "Invalid transaction ID" });
  }

  const exts = ["jpg", "jpeg", "png", "webp", "pdf"];
  let receiptPath: string | null = null;
  let foundExt: string | null = null;

  for (const e of exts) {
    const p = path.resolve(`data/receipts/${id}.${e}`);
    if (await Bun.file(p).exists()) {
      receiptPath = p;
      foundExt = e;
      break;
    }
  }

  if (!receiptPath) {
    throw new HTTPException(404, { message: "Receipt not found" });
  }

  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
  };

  const mime = mimeMap[foundExt!] ?? "application/octet-stream";

  c.header("Content-Type", mime);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "private, max-age=3600");

  if (foundExt === "pdf") {
    c.header("Content-Disposition", `attachment; filename="receipt-${id}.pdf"`);
  }

  return c.body(Bun.file(receiptPath));
});

// ─── Existing transaction routes ────────────────────────────────────────────

tx.get("/", async (c) => {
  const { page, limit, dateFrom, dateTo, categoryId, type, sortBy, sortOrder } = c.req.query();
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 25;

  let sql = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dateFrom) { sql += " AND t.date >= ?"; params.push(dateFrom); }
  if (dateTo) { sql += " AND t.date <= ?"; params.push(dateTo); }
  if (categoryId) { sql += " AND t.category_id = ?"; params.push(Number(categoryId)); }
  if (type) { sql += " AND t.type = ?"; params.push(type); }

  const orderCol = sortBy === "amount" ? "t.amount" : sortBy === "description" ? "t.description" : sortBy === "category" ? "c.name" : sortBy === "createdAt" ? "t.created_at" : "t.date";
  const orderDir = sortOrder === "asc" ? "ASC" : "DESC";
  sql += ` ORDER BY ${orderCol} ${orderDir}`;
  sql += " LIMIT ? OFFSET ?";
  params.push(limitNum, (pageNum - 1) * limitNum);

  const items = query(sql, params);

  return c.json({
    items: items.map(transformTransaction),
    page: pageNum,
    limit: limitNum,
  });
});

tx.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const item = getOne("SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?", [id]);
  if (!item) throw new HTTPException(404, { message: "Transaction not found" });
  return c.json(transformTransaction(item));
});

tx.post("/", async (c) => {
  const rawData = await c.req.json();
  const { receiptTempId, receiptTempExt, ...rest } = rawData as any;
  const parsed = insertTransactionSchema.safeParse(rest);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  run(
    "INSERT INTO transactions (amount, currency, amount_default, exchange_rate, description, date, type, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      data.amount,
      data.currency || "USD",
      data.amountDefault ?? data.amount,
      data.exchangeRate ?? 1.0,
      data.description || null,
      data.date,
      data.type,
      data.categoryId || null,
    ],
  );
  const result = lastInsertedRow("transactions");

  // Move receipt from temp to permanent if provided
  if (receiptTempId && receiptTempExt) {
    const safeTempId = String(receiptTempId).replace(/[^a-zA-Z0-9-]/g, "");
    const safeExt = String(receiptTempExt).replace(/[^a-z0-9]/gi, "");
    const tempPath = path.resolve(`data/temp_receipts/${safeTempId}.${safeExt}`);
    const permDir = path.resolve("data/receipts");
    mkdirSync(permDir, { recursive: true });
    const permPath = path.join(permDir, `${result.id}.${safeExt}`);
    try {
      renameSync(tempPath, permPath);
    } catch (err: any) {
      console.error("Failed to move receipt:", err.message);
    }
  }

  return c.json(transformTransaction(result), 201);
});

tx.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const rawData = await c.req.json();
  const parsed = updateTransactionSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  const existing = getOne("SELECT * FROM transactions WHERE id = ?", [id]);
  if (!existing) throw new HTTPException(404);

  const updates: string[] = [];
  const params: any[] = [];

  if (data.amount !== undefined) { updates.push("amount = ?"); params.push(data.amount); }
  if (data.currency !== undefined) { updates.push("currency = ?"); params.push(data.currency); }
  if (data.amountDefault !== undefined) { updates.push("amount_default = ?"); params.push(data.amountDefault); }
  if (data.exchangeRate !== undefined) { updates.push("exchange_rate = ?"); params.push(data.exchangeRate); }
  if (data.description !== undefined) { updates.push("description = ?"); params.push(data.description); }
  if (data.date !== undefined) { updates.push("date = ?"); params.push(data.date); }
  if (data.type !== undefined) { updates.push("type = ?"); params.push(data.type); }
  if (data.categoryId !== undefined) { updates.push("category_id = ?"); params.push(data.categoryId); }

  params.push(id);
  run(`UPDATE transactions SET ${updates.join(", ")} WHERE id = ?`, params);

  const result = getOne("SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?", [id]);
  return c.json(transformTransaction(result));
});

tx.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  run("DELETE FROM transactions WHERE id = ?", [id]);
  return c.json({ success: true });
});

function transformTransaction(row: any) {
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    amountDefault: row.amount_default,
    exchangeRate: row.exchange_rate,
    description: row.description,
    date: row.date,
    type: row.type,
    categoryId: row.category_id,
    createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
    category: row.category_name ? {
      name: row.category_name,
      color: row.category_color,
      icon: row.category_icon,
    } : null,
  };
}

export default tx;
