import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { loggerMiddleware } from "./middleware/logger";
import { errorHandler } from "./middleware/errorHandler";
import { initDb, migrateReceiptFiles, getOne } from "./db";
import { JWT_SECRET } from "./config";
import { CONFIG_KEYS } from "./lib/config-constants";
import { seed } from "./db/seed";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import transactionRoutes from "./routes/transactions";
import categoryRoutes from "./routes/categories";
import dashboardRoutes from "./routes/dashboard";

import currenciesRoutes from "./routes/currencies";
import settingsRoutes from "./routes/settings";
import ratesRoutes from "./routes/rates";
import ocrRoutes from "./routes/ocr";
import setupRoutes from "./routes/setup";
import { startRateFetcher } from "./services/rateFetcher";
import { startTempCleanupScheduler } from "./services/tempCleanup";

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

  if (JWT_SECRET.length < 32 && isProduction) {
    console.warn("WARNING: JWT_SECRET should be at least 32 characters in production");
  }
}

validateEnv();

initDb();

const app = new Hono();

app.use("*", loggerMiddleware);
app.use("*", corsMiddleware);

app.route("/auth", authRoutes);
app.route("/setup", setupRoutes);
app.route("/admin", adminRoutes);
app.route("/transactions", transactionRoutes);
app.route("/api/ocr", ocrRoutes);
app.route("/categories", categoryRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/currencies", currenciesRoutes);
app.route("/settings", settingsRoutes);
app.route("/rates", ratesRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/auth/config/register", (c) => {
  const regConfig = getOne(`SELECT value FROM system_config WHERE key = '${CONFIG_KEYS.ALLOW_REGISTRATION}'`) as any;
  const adminCount = getOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'") as { count: number };
  return c.json({ allowRegistration: regConfig?.value === "true" && adminCount.count > 0, needsSetup: adminCount.count === 0 });
});

const staticDir = process.env.STATIC_DIR || "../frontend/dist";
app.get("/*", async (c) => {
  const filePath = `${staticDir}${c.req.path}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file);
  }
  return new Response(Bun.file(`${staticDir}/index.html`));
});

app.onError(errorHandler);

seed().catch(console.error);

try {
  migrateReceiptFiles();
} catch (e) {
  console.error("Receipt migration error:", e);
}

const stopRateFetcher = startRateFetcher();
const stopTempCleanup = startTempCleanupScheduler();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;

export { app };
export type App = typeof app;

export default {
  port,
  fetch: app.fetch,
  hostname: "0.0.0.0",
  reusePort: true,
};