const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:3001",
]);

export const corsMiddleware = (c: any, next: any) => {
  const origin = c.req.header("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin)
    ? origin
    : process.env.NODE_ENV === "production"
    ? ""
    : origin || "*";

  c.header("Access-Control-Allow-Origin", allowed);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Allow-Credentials", "true");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  return next();
};
