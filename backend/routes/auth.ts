import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import { compare, hash } from "bcryptjs";
import { client, getOne, run, query, transaction, ensureSettingsRow } from "../db";
import { loginSchema, registerSchema, changePasswordSchema, refreshTokenSchema } from "@money-tracker/shared/schemas";
import { JWT_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_DAYS } from "../config";
import { authMiddleware, adminMiddleware } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { generateTokenPair, generateTokenPairSync, hashToken } from "../lib/tokens";

import { formatZodError } from "../lib/utils";

const auth = new Hono();

auth.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (c) => {
  const rawData = await c.req.json();
  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const { username, password } = parsed.data;
  const user = getOne("SELECT * FROM users WHERE username = ?", [username]) as any;
  if (!user) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const isValid = await compare(password, user.password_hash);
  if (!isValid) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const { accessToken, refreshToken } = await generateTokenPair(user.id, user.role);

  return c.json({ token: accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
});

auth.post("/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), async (c) => {
  const regConfig = getOne("SELECT value FROM system_config WHERE key = 'allow_registration'") as any;
  if (!regConfig || regConfig.value !== "true") {
    throw new HTTPException(403, { message: "Registration is currently disabled" });
  }

  const rawData = await c.req.json();
  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const { username, email, password } = parsed.data;

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
  run("INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, 'user')", [username, passwordHash, email || null]);

  const newUser = getOne("SELECT * FROM users WHERE username = ?", [username]) as any;
  ensureSettingsRow(newUser.id);

  const { accessToken, refreshToken } = await generateTokenPair(newUser.id, newUser.role);

  return c.json({ token: accessToken, refreshToken, user: { id: newUser.id, username: newUser.username, role: newUser.role, email: newUser.email } }, 201);
});

auth.post("/refresh", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), async (c) => {
  const rawData = await c.req.json();
  const parsed = refreshTokenSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: "Refresh token required" });
  }

  const { refreshToken } = parsed.data;
  const tokenHash = await hashToken(refreshToken);

  let result: { userId: number; refreshToken: string; expired?: boolean; reuseDetected?: boolean } | null = null;

  try {
    result = transaction(() => {
      const existing = getOne("SELECT id, user_id, expires_at, consumed FROM refresh_tokens WHERE token_hash = ?", [tokenHash]) as any;

      if (!existing) {
        throw new Error("UNKNOWN_TOKEN");
      }

      if (existing.consumed) {
        run("DELETE FROM refresh_tokens WHERE user_id = ?", [existing.user_id]);
        return { userId: existing.user_id, refreshToken: "", reuseDetected: true };
      }

      if (new Date(existing.expires_at * 1000) < new Date()) {
        run("DELETE FROM refresh_tokens WHERE id = ?", [existing.id]);
        return { userId: existing.user_id, refreshToken: "", expired: true };
      }

      run("UPDATE refresh_tokens SET consumed = 1 WHERE id = ?", [existing.id]);

      const newRefresh = generateTokenPairSync(existing.user_id);
      const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 3600;
      run("INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [newRefresh.hash, existing.user_id, expiresAt]);

      return { userId: existing.user_id, refreshToken: newRefresh.raw };
    });
  } catch (e: any) {
    if (e.message === "UNKNOWN_TOKEN") {
      throw new HTTPException(401, { message: "Invalid refresh token" });
    }
    throw e;
  }

  if (!result) {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }

  if (result.reuseDetected) {
    throw new HTTPException(401, { message: "Token reuse detected. All sessions terminated." });
  }

  if (result.expired) {
    throw new HTTPException(401, { message: "Refresh token expired" });
  }

  const user = getOne("SELECT role FROM users WHERE id = ?", [result.userId]) as any;
  const accessToken = await sign({ sub: result.userId, role: user.role, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY }, JWT_SECRET);

  return c.json({ token: accessToken, refreshToken: result.refreshToken });
});

auth.post("/logout", authMiddleware, async (c) => {
  const rawData = await c.req.json().catch(() => ({}));
  if (rawData.refreshToken) {
    const tokenHash = await hashToken(rawData.refreshToken);
    run("DELETE FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);
  }
  return c.json({ success: true });
});

auth.post("/change-password", authMiddleware, async (c) => {
  const userId = c.get("userId") as number;
  const rawData = await c.req.json();
  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = getOne("SELECT * FROM users WHERE id = ?", [userId]) as any;
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const isValid = await compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new HTTPException(401, { message: "Current password is incorrect" });
  }

  const newPasswordHash = await hash(newPassword, 12);
  run("UPDATE users SET password_hash = ? WHERE id = ?", [newPasswordHash, userId]);
  run("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

  return c.json({ success: true });
});

auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId") as number;
  const user = getOne("SELECT id, username, role, email FROM users WHERE id = ?", [userId]) as any;
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return c.json({ id: user.id, username: user.username, role: user.role, email: user.email });
});

export default auth;