import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import { compare } from "bcryptjs";
import { getOne, run } from "../db";
import { loginSchema } from "@money-tracker/shared/schemas";

const auth = new Hono();

auth.post("/login", async (c) => {
  const rawData = await c.req.json();
  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const { username, password } = parsed.data;

  const user = getOne("SELECT * FROM users WHERE username = ?", [username]);
  if (!user) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const isValid = await compare(password, user.password_hash);
  if (!isValid) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const jwtSecret = process.env.JWT_SECRET;
  if (isProduction && !jwtSecret) {
    throw new HTTPException(500, { message: "JWT_SECRET is not configured" });
  }
  const secret = jwtSecret || "money-tracker-secret-key";
  const token = await sign({ userId: user.id }, secret);

  run("UPDATE users SET token = ? WHERE id = ?", [token, user.id]);

  return c.json({ token });
});

export default auth;
