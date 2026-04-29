import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { hash } from "bcryptjs";
import { getOne, run, query, transaction, ensureSettingsRow } from "../db";
import { authMiddleware, adminMiddleware } from "../middleware/auth";
import { createUserSchema, cleanupTokenRequestSchema, cleanupExecuteSchema } from "@money-tracker/shared/schemas";
import { formatZodError } from "../lib/utils";
import { CONFIG_KEYS } from "../lib/config-constants";
import { readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const CLEANUP_RATE_LIMIT_SECONDS = 60;

const admin = new Hono();

admin.use("*", authMiddleware, adminMiddleware);

function auditLog(action: string, performedBy: number, scope?: string, details?: string, ipAddress?: string) {
  run(
    "INSERT INTO audit_log (performed_by, action, scope, details, ip_address) VALUES (?, ?, ?, ?, ?)",
    [performedBy, action, scope ?? null, details ?? null, ipAddress ?? null]
  );
}

admin.get("/stats", async (c) => {
  const users = (getOne("SELECT COUNT(*) as count FROM users") as any)?.count ?? 0;
  const txs = (getOne("SELECT COUNT(*) as count FROM transactions") as any)?.count ?? 0;
  const cats = (getOne("SELECT COUNT(*) as count FROM categories") as any)?.count ?? 0;
  const rates = (getOne("SELECT COUNT(*) as count FROM exchange_rates") as any)?.count ?? 0;
  return c.json({ users, transactions: txs, categories: cats, exchange_rates: rates });
});

admin.get("/users", async (c) => {
  const page = Number(c.req.query("page")) || 0;
  const limit = Number(c.req.query("limit")) || 0;

  if (page > 0 && limit > 0) {
    const offset = (page - 1) * limit;
    const users = query("SELECT id, username, role, email FROM users ORDER BY id LIMIT ? OFFSET ?", [limit, offset]) as any[];
    const total = (getOne("SELECT COUNT(*) as count FROM users") as any)?.count ?? 0;
    return c.json({ items: users, total, page, limit });
  }

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

  const result = transaction(() => {
    const txCount = (getOne("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?", [targetId]) as any)?.count ?? 0;
    const catCount = (getOne("SELECT COUNT(*) as count FROM categories WHERE user_id = ?", [targetId]) as any)?.count ?? 0;
    run("DELETE FROM transactions WHERE user_id = ?", [targetId]);
    run("DELETE FROM categories WHERE user_id = ?", [targetId]);
    run("DELETE FROM settings WHERE user_id = ?", [targetId]);
    run("DELETE FROM refresh_tokens WHERE user_id = ?", [targetId]);
    run("DELETE FROM users WHERE id = ?", [targetId]);
    return { txCount, catCount };
  });

  auditLog(
    "user_deletion",
    currentUserId,
    "user",
    JSON.stringify({ deleted_user_id: targetId, transactions_deleted: result.txCount, categories_deleted: result.catCount }),
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"
  );

  return c.json({ success: true });
});

admin.get("/config", async (c) => {
  const configs = query("SELECT key, value FROM system_config") as any[];
  const configMap: Record<string, string> = {};
  for (const cfg of configs) {
    configMap[cfg.key] = cfg.value;
  }
  return c.json(configMap);
});

admin.put("/config/:key", async (c) => {
  const key = c.req.param("key");
  const allowedKeys = [CONFIG_KEYS.ALLOW_REGISTRATION];
  if (!allowedKeys.includes(key)) {
    throw new HTTPException(400, { message: `Unknown config key: ${key}` });
  }
  const { value } = await c.req.json();
  if (value === undefined || value === null) {
    throw new HTTPException(400, { message: "Value is required" });
  }

  const oldValue = getOne("SELECT value FROM system_config WHERE key = ?", [key]) as any;
  run("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)", [key, String(value)]);

  if (key === CONFIG_KEYS.ALLOW_REGISTRATION) {
    const userId = c.get("userId") as number;
    auditLog(
      "config_change",
      userId,
      "config",
      JSON.stringify({ key, old_value: oldValue?.value ?? "false", new_value: String(value) }),
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"
    );
  }

  return c.json({ key, value: String(value) });
});

admin.post("/cleanup/token", async (c) => {
  const rawData = await c.req.json();
  const parsed = cleanupTokenRequestSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const userId = c.get("userId") as number;
  const { scope } = parsed.data;

  const recentToken = getOne(
    "SELECT created_at FROM cleanup_tokens WHERE user_id = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1",
    [userId]
  ) as any;

  if (recentToken) {
    const elapsed = Math.floor(Date.now() / 1000) - recentToken.created_at;
    if (elapsed < CLEANUP_RATE_LIMIT_SECONDS) {
      throw new HTTPException(429, { message: `Please wait ${CLEANUP_RATE_LIMIT_SECONDS - elapsed} seconds before requesting another cleanup token` });
    }
  }

  const rawToken = crypto.randomUUID();
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(rawToken);
  const tokenHash = hasher.digest("hex");

  const expiresAt = Math.floor(Date.now() / 1000) + 300;

  run("INSERT INTO cleanup_tokens (token_hash, user_id, scope, consumed, expires_at) VALUES (?, ?, ?, 0, ?)", [tokenHash, userId, scope, expiresAt]);

  run("DELETE FROM cleanup_tokens WHERE consumed = 1 OR expires_at < ?", [Math.floor(Date.now() / 1000)]);

  return c.json({ token: rawToken });
});

admin.post("/cleanup", async (c) => {
  const rawData = await c.req.json();
  const parsed = cleanupExecuteSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const userId = c.get("userId") as number;
  const { token, scope } = parsed.data;

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(token);
  const tokenHash = hasher.digest("hex");

  const tokenRecord = getOne(
    "SELECT id, user_id, scope, consumed, expires_at FROM cleanup_tokens WHERE token_hash = ?",
    [tokenHash]
  ) as any;

  if (!tokenRecord) {
    throw new HTTPException(400, { message: "Invalid or expired token" });
  }

  if (tokenRecord.consumed) {
    throw new HTTPException(400, { message: "Token already used" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (tokenRecord.expires_at < now) {
    throw new HTTPException(400, { message: "Token expired" });
  }

  if (tokenRecord.user_id !== userId) {
    throw new HTTPException(403, { message: "Token not issued to you" });
  }

  if (tokenRecord.scope !== scope) {
    throw new HTTPException(400, { message: `Token was issued for scope '${tokenRecord.scope}', not '${scope}'` });
  }

  run("UPDATE cleanup_tokens SET consumed = 1 WHERE id = ?", [tokenRecord.id]);

  let affectedRows = 0;

  if (scope === "transactions") {
    const result = transaction(() => {
      const count = (getOne("SELECT COUNT(*) as count FROM transactions") as any)?.count ?? 0;
      run("DELETE FROM transactions");
      return count;
    });
    affectedRows = result;

    auditLog(
      "cleanup",
      userId,
      "transactions",
      JSON.stringify({ scope: "transactions", rows_affected: affectedRows }),
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"
    );
  } else if (scope === "orphaned") {
    const result = transaction(() => {
      const staleTokens = (getOne("SELECT COUNT(*) as count FROM refresh_tokens WHERE consumed = 1 AND expires_at < ?", [now]) as any)?.count ?? 0;
      run("DELETE FROM refresh_tokens WHERE consumed = 1 AND expires_at < ?", [now]);

      const orphanedCats = (getOne("SELECT COUNT(*) as count FROM categories WHERE user_id IS NULL AND is_predefined = 0") as any)?.count ?? 0;
      run("DELETE FROM categories WHERE user_id IS NULL AND is_predefined = 0");

      return { staleTokens, orphanedCats };
    });

    affectedRows = result.staleTokens + result.orphanedCats;

    auditLog(
      "cleanup",
      userId,
      "orphaned",
      JSON.stringify({ scope: "orphaned", stale_tokens_deleted: result.staleTokens, orphaned_categories_deleted: result.orphanedCats }),
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"
    );
  }

  return c.json({ affected_rows: affectedRows, scope });
});

admin.get("/audit", async (c) => {
  const logs = query("SELECT id, performed_by, action, scope, details, ip_address, created_at FROM audit_log ORDER BY created_at DESC LIMIT 50") as any[];
  return c.json(logs);
});

export default admin;