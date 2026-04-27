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
import ocrRoutes from "./routes/ocr";
import { startRateFetcher } from "./services/rateFetcher";
import { startTempCleanupScheduler } from "./services/tempCleanup";

// ─── Environment validation (fail-fast in production) ───
function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";
  const required: string[] = [];
  if (isProduction) {
    required.push("JWT_SECRET", "OLLAMA_HOST", "OLLAMA_MODEL");
  }
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`FATAL: Environment variable ${key} is required in production`);
      process.exit(1);
    }
  }
}

validateEnv();

// Initialize database tables
initDb();

const app = new Hono();

// Middleware
app.use("*", loggerMiddleware);
app.use("*", corsMiddleware);

// Routes
app.route("/auth", authRoutes);
app.route("/transactions", transactionRoutes);
app.route("/api/ocr", ocrRoutes);
app.route("/categories", categoryRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/currencies", currenciesRoutes);
app.route("/settings", settingsRoutes);
app.route("/rates", ratesRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Serve built frontend SPA — try exact file, otherwise fallback to index.html
const staticDir = process.env.STATIC_DIR || "../frontend/dist";
app.get("/*", async (c) => {
  const filePath = `${staticDir}${c.req.path}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file);
  }
  return new Response(Bun.file(`${staticDir}/index.html`));
});

// Global error handler
app.onError(errorHandler);

// Seed on startup
seed().catch(console.error);

// Start rate fetcher (non-blocking)
const stopRateFetcher = startRateFetcher();

// Start temp receipt cleanup scheduler
const stopTempCleanup = startTempCleanupScheduler();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// Named export for tests (Hono testClient needs the app object directly)
export { app };
export type App = typeof app;

// Default export is the server config — Bun auto-serves this when the file is
// run directly (bun run server.ts). Exporting as default avoids a second explicit
// Bun.serve call that would cause EADDRINUSE on every startup.
export default {
  port,
  fetch: app.fetch,
  hostname: "0.0.0.0",
  reusePort: true,
};
