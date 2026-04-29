import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { hash } from "bcryptjs";
import { getOne, run, query, ensureSettingsRow } from "../db";
import { authMiddleware, adminMiddleware } from "../middleware/auth";
import { createUserSchema } from "@money-tracker/shared/schemas";

import { formatZodError } from "../lib/utils";
import { readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const admin = new Hono();

admin.use("*", authMiddleware, adminMiddleware);

admin.get("/users", async (c) => {
  const users = query("SELECT id, username, role, email FROM users ORDER BY id") as any[];
  return c.json(users);
});

admin.post("/users", async (c) => {
  const rawData = await c.req.json();
  const parsed = createUserSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const { username, email, password, role } = parsed.data;

  const existing = getOne("SELECT id FROM users WHERE username = ?", [username]) as any;
  if (existing) {
    throw new HTTPException(409, { message: "Username already taken" });
  }

  if (email) {
    const existingEmail = getOne("SELECT id FROM users WHERE email = ?", [email]) as any;
    if (existingEmail) {
      throw new HTTPException(409, { message: "Email already registered" });
    }
  }

  const passwordHash = await hash(password, 12);
  run("INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)", [username, passwordHash, email || null, role || "user"]);

  const newUser = getOne("SELECT id, username, role, email FROM users WHERE username = ?", [username]) as any;
  ensureSettingsRow(newUser.id);

  return c.json(newUser, 201);
});

admin.delete("/users/:id", async (c) => {
  const currentUserId = c.get("userId") as number;
  const targetId = Number(c.req.param("id"));

  if (targetId === currentUserId) {
    throw new HTTPException(403, { message: "Cannot delete your own account" });
  }

  const user = getOne("SELECT id, role FROM users WHERE id = ?", [targetId]) as any;
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  if (user.role === "admin") {
    const adminCount = getOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'") as { count: number };
    if (adminCount.count <= 1) {
      throw new HTTPException(403, { message: "Cannot delete the last admin user" });
    }
  }

  const receiptsDir = path.resolve("data/receipts", String(targetId));
  if (existsSync(receiptsDir)) {
    try { rmSync(receiptsDir, { recursive: true }); } catch {}
  }

  run("DELETE FROM transactions WHERE user_id = ?", [targetId]);
  run("DELETE FROM categories WHERE user_id = ?", [targetId]);
  run("DELETE FROM settings WHERE user_id = ?", [targetId]);
  run("DELETE FROM refresh_tokens WHERE user_id = ?", [targetId]);
  run("DELETE FROM users WHERE id = ?", [targetId]);

  return c.json({ success: true });
});

admin.get("/config", async (c) => {
  const configs = query("SELECT key, value FROM system_config") as any[];
  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }
  return c.json(configMap);
});

admin.put("/config/:key", async (c) => {
  const key = c.req.param("key");
  const allowedKeys = ["allow_registration"];
  if (!allowedKeys.includes(key)) {
    throw new HTTPException(400, { message: `Unknown config key: ${key}` });
  }
  const { value } = await c.req.json();
  if (value === undefined || value === null) {
    throw new HTTPException(400, { message: "Value is required" });
  }
  run("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)", [key, String(value)]);
  return c.json({ key, value: String(value) });
});

export default admin;