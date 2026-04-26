import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run, lastInsertedRow } from "../db";
import { insertTransactionSchema, updateTransactionSchema } from "@money-tracker/shared/schemas";

const tx = new Hono();

tx.use("*", authMiddleware);

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

  const orderCol = sortBy === "amount" ? "t.amount" : sortBy === "description" ? "t.description" : "t.date";
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
  const parsed = insertTransactionSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  run(
    "INSERT INTO transactions (amount, description, date, type, category_id) VALUES (?, ?, ?, ?, ?)",
    [data.amount, data.description || null, data.date, data.type, data.categoryId || null],
  );
  const result = lastInsertedRow("transactions");
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
    description: row.description,
    date: row.date,
    type: row.type,
    categoryId: row.category_id,
    createdAt: row.created_at,
    category: row.category_name ? {
      name: row.category_name,
      color: row.category_color,
      icon: row.category_icon,
    } : null,
  };
}

export default tx;
