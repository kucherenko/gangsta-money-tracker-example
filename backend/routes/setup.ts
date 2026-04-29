import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { hash } from "bcryptjs";
import { getOne, run, transaction, ensureSettingsRow } from "../db";
import { setupSchema } from "@money-tracker/shared/schemas";
import { generateTokenPair } from "../lib/tokens";
import { rateLimit } from "../middleware/rateLimit";
import { formatZodError } from "../lib/utils";

const setup = new Hono();

const setupRateLimit = process.env.NODE_ENV === "test"
  ? rateLimit({ windowMs: 60 * 1000, max: 100 })
  : rateLimit({ windowMs: 60 * 60 * 1000, max: 3 });

setup.post("/", setupRateLimit, async (c) => {
  const rawData = await c.req.json();
  const parsed = setupSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(422, { message: formatZodError(parsed.error) });
  }

  const { username, password } = parsed.data;

  const passwordHash = await hash(password, 12);

  const result = transaction(() => {
    const adminCount = getOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'") as { count: number };
    if (adminCount.count > 0) {
      return { created: false as const };
    }

    const existing = getOne("SELECT id FROM users WHERE username = ?", [username]) as any;
    if (existing) {
      throw new HTTPException(409, { message: "Username already taken" });
    }

    run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", [username, passwordHash]);

    const newUser = getOne("SELECT id, username, role FROM users WHERE username = ?", [username]) as any;
    ensureSettingsRow(newUser.id);

    return { created: true as const, user: newUser };
  });

  if (typeof result === "object" && "created" in result && !result.created) {
    throw new HTTPException(409, { message: "Setup already completed" });
  }

  const createdResult = result as { created: true; user: { id: number; username: string; role: string } };
  const { accessToken, refreshToken } = await generateTokenPair(createdResult.user.id, createdResult.user.role);

  return c.json({
    token: accessToken,
    refreshToken,
    user: {
      id: createdResult.user.id,
      username: createdResult.user.username,
      role: createdResult.user.role,
    },
  }, 201);
});

export default setup;