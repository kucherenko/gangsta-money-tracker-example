import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import { JWT_SECRET } from "../config";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verify(token, JWT_SECRET, "HS256") as any;
    c.set("userId", payload.sub as number);
    c.set("role", payload.role as string);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const role = c.get("role");
  if (role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
};