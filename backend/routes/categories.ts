import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run, lastInsertedRow } from "../db";
import { insertCategorySchema } from "@money-tracker/shared/schemas";

const cat = new Hono();

cat.use("*", authMiddleware);

cat.get("/", async (c) => {
  const items = query("SELECT * FROM categories ORDER BY id");
  return c.json(items.map(transformCategory));
});

cat.post("/", async (c) => {
  const rawData = await c.req.json();
  const parsed = insertCategorySchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  run(
    "INSERT INTO categories (name, color, icon, type, is_predefined) VALUES (?, ?, ?, ?, 0)",
    [data.name, data.color, data.icon || null, data.type],
  );
  const result = lastInsertedRow("categories");
  return c.json(transformCategory(result), 201);
});

cat.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const rawData = await c.req.json();
  const parsed = insertCategorySchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  const existing = getOne("SELECT * FROM categories WHERE id = ?", [id]);
  if (!existing) throw new HTTPException(404, { message: "Category not found" });
  if (existing.is_predefined) throw new HTTPException(403, { message: "Cannot modify predefined category" });

  run(
    "UPDATE categories SET name = ?, color = ?, icon = ?, type = ? WHERE id = ?",
    [data.name, data.color, data.icon || null, data.type, id],
  );
  const result = getOne("SELECT * FROM categories WHERE id = ?", [id]);
  return c.json(transformCategory(result));
});

cat.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const existing = getOne("SELECT * FROM categories WHERE id = ?", [id]);
  if (!existing) throw new HTTPException(404, { message: "Category not found" });
  if (existing.is_predefined) throw new HTTPException(403, { message: "Cannot delete predefined category" });

  run("DELETE FROM categories WHERE id = ?", [id]);
  return c.json({ success: true });
});

function transformCategory(row: any) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    type: row.type,
    isPredefined: !!row.is_predefined,
  };
}

export default cat;
