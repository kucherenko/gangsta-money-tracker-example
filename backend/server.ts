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

import currenciesRoutes from "./routes/currencies";
import settingsRoutes from "./routes/settings";
import ratesRoutes from "./routes/rates";
import { startRateFetcher } from "./services/rateFetcher";

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
app.route("/currencies", currenciesRoutes);
app.route("/settings", settingsRoutes);
app.route("/rates", ratesRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Global error handler
app.onError(errorHandler);

// Seed on startup
seed().catch(console.error);

// Start rate fetcher (non-blocking)
const stopRateFetcher = startRateFetcher();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// Export Hono app for tests
export default app;

// Server config for manual start
export const serverConfig = {
  port,
  fetch: app.fetch,
  hostname: "0.0.0.0",
};

// Auto-start when directly running (not imported as module)
const isMain = import.meta.main ?? false;
if (isMain) {
  Bun.serve(serverConfig);
  console.log(`Server starting on port ${port}`);
}

export type App = typeof app;
