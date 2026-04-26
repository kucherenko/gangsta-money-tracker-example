import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { loggerMiddleware } from "./middleware/logger";
import { errorHandler } from "./middleware/errorHandler";
import { initDb } from "./db";
import { seed } from "./db/seed";
import authRoutes from "./routes/auth";
import transactionRoutes from "./routes/transactions";
import categoryRoutes from "./routes/categories";
import dashboardRoutes from "./routes/dashboard";

// Initialize database tables
initDb();

const app = new Hono();

// Middleware
app.use("*", loggerMiddleware);
app.use("*", corsMiddleware);

// Routes
app.route("/auth", authRoutes);
app.route("/transactions", transactionRoutes);
app.route("/categories", categoryRoutes);
app.route("/dashboard", dashboardRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Global error handler
app.onError(errorHandler);

// Seed on startup
seed().catch(console.error);

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
console.log(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  hostname: "0.0.0.0",
};

export type App = typeof app;
