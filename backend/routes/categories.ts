import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run, lastInsertedRow } from "../db";
import { insertCategorySchema } from "@money-tracker/shared/schemas";

import { formatZodError } from "../lib/utils";

const cat = new Hono();

cat.use("*", authMiddleware);

cat.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const items = query("SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY id", [userId]);
  return c.json(items.map(transformCategory));
});

cat.post("/", async (c) => {
  const userId = c.get("userId") as number;
  const rawData = await c.req.json();
  const parsed = insertCategorySchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const data = parsed.data;

  const predefined = getOne("SELECT id FROM categories WHERE name = ? AND type = ? AND user_id IS NULL", [data.name, data.type]) as any;
  if (predefined) {
    throw new HTTPException(409, { message: "A predefined category with this name and type already exists" });
  }

  const existing = getOne("SELECT id FROM categories WHERE name = ? AND type = ? AND user_id = ?", [data.name, data.type, userId]) as any;
  if (existing) {
    throw new HTTPException(409, { message: "You already have a category with this name and type" });
  }

  run(
    "INSERT INTO categories (name, color, icon, type, is_predefined, user_id) VALUES (?, ?, ?, ?, 0, ?)",
    [data.name, data.color, data.icon || null, data.type, userId],
  );
  const result = lastInsertedRow("categories");
  return c.json(transformCategory(result), 201);
});

cat.put("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = Number(c.req.param("id"));
  const rawData = await c.req.json();
  const parsed = insertCategorySchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const data = parsed.data;
  const existing = getOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [id, userId]) as any;
  if (!existing) throw new HTTPException(404, { message: "Category not found" });
  if (existing.is_predefined) throw new HTTPException(403, { message: "Cannot modify predefined category" });

  const duplicatePredefined = getOne("SELECT id FROM categories WHERE name = ? AND type = ? AND user_id IS NULL AND id != ?", [data.name, data.type, id]) as any;
  if (duplicatePredefined) {
    throw new HTTPException(409, { message: "A predefined category with this name and type already exists" });
  }

  run(
    "UPDATE categories SET name = ?, color = ?, icon = ?, type = ? WHERE id = ? AND user_id = ?",
    [data.name, data.color, data.icon || null, data.type, id, userId],
  );
  const result = getOne("SELECT * FROM categories WHERE id = ?", [id]);
  return c.json(transformCategory(result));
});

cat.delete("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = Number(c.req.param("id"));
  const existing = getOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [id, userId]) as any;
  if (!existing) throw new HTTPException(404, { message: "Category not found" });
  if (existing.is_predefined) throw new HTTPException(403, { message: "Cannot delete predefined category" });

  run("DELETE FROM categories WHERE id = ? AND user_id = ?", [id, userId]);
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