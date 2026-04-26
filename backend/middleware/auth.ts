import type { MiddlewareHandler } from "hono";
import { getOne } from "../db";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  // Verify token exists in DB (simplified v1 - direct comparison)
  const user = getOne("SELECT * FROM users WHERE token = ?", [token]);
  if (!user) {
    return c.json({ error: "Invalid token" }, 401);
  }

  c.set("userId", user.id);
  c.set("user", user);
  await next();
};
