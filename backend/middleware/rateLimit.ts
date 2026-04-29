import type { MiddlewareHandler } from "hono";

export function rateLimit({ windowMs, max }: { windowMs: number; max: number }): MiddlewareHandler {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  const TRUST_PROXY = !!process.env.TRUST_PROXY;

  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts) {
      if (now > record.resetTime) {
        attempts.delete(key);
      }
    }
  }, 60 * 1000);

  return async (c, next) => {
    const directIp = c.req.header("x-real-ip") || "unknown";
    const key = TRUST_PROXY ? (c.req.header("x-forwarded-for") || directIp) : directIp;
    const now = Date.now();
    const record = attempts.get(key);

    if (!record || now > record.resetTime) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
    } else if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests" }, 429);
    } else {
      record.count++;
    }

    await next();
  };
}