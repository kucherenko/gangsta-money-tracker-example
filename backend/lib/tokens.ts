import { sign } from "hono/jwt";
import { run } from "../db";
import { JWT_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_DAYS } from "../config";

export async function generateTokenPair(userId: number, role: string) {
  const accessToken = await sign({ sub: userId, role, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY }, JWT_SECRET);
  const refreshToken = crypto.randomUUID();
  const tokenHash = await hashToken(refreshToken);
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 3600;

  run("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
  run("INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [tokenHash, userId, expiresAt]);

  return { accessToken, refreshToken };
}

export function generateTokenPairSync(userId: number) {
  const refreshToken = crypto.randomUUID();
  const tokenHash = createHashSync(refreshToken);
  return { hash: tokenHash, raw: refreshToken };
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createHashSync(token: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(token);
  return hasher.digest("hex");
}