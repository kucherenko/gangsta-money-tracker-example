export const corsMiddleware = (c: any, next: any) => {
  c.header("Access-Control-Allow-Origin", "http://localhost:5173");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Allow-Credentials", "true");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  return next();
};
