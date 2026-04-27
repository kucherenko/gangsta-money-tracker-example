import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { query } from "../db";
import { fetchAllRates, getRate, getRatesForBase } from "../services/rateFetcher";

const rates = new Hono();

rates.use("*", authMiddleware);

/**
 * GET /rates — Returns all cached rates for default/base currency
 * Query params: ?base=USD (optional)
 */
rates.get("/", async (c) => {
  const { base } = c.req.query();
  
  const items = getRatesForBase(base);
  
  return c.json(items.map(transformRate));
});

/**
 * GET /rates/:base/:target — Returns specific rate
 * Supports reverse lookup automatically
 */
rates.get("/:base/:target", async (c) => {
  const base = c.req.param("base");
  const target = c.req.param("target");
  
  const row = getRate(base, target);
  if (!row) {
    return c.json({ error: "Rate not found" }, 404);
  }
  
  return c.json(transformRate({
    ...row,
    id: 0,
    base_currency: base,
    target_currency: target,
    updated_at: row.updatedAt,
  }));
});

/**
 * POST /rates/refresh — Trigger immediate rate fetch
 */
rates.post("/refresh", async (c) => {
  const { base } = c.req.query();
  // Trigger async fetch (don't await, it may take seconds)
  fetchAllRates(base).catch((err) => {
    console.error("Rate refresh failed:", err);
  });
  return c.json({ message: "Rate fetch triggered", base: base || "default" });
});

function transformRate(row: any) {
  const rawUpdated = row.updated_at || row.updatedAt;
  // DB stores unix epoch in seconds; frontend expects milliseconds
  const updatedAt = rawUpdated && rawUpdated < 1e12 ? rawUpdated * 1000 : rawUpdated;
  return {
    id: row.id || 0,
    baseCurrency: row.base_currency || row.base,
    targetCurrency: row.target_currency || row.target,
    rate: row.rate,
    updatedAt: updatedAt || Date.now(),
    source: row.source,
  };
}

export default rates;
