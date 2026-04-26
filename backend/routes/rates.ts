import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { query, getOne } from "../db";
import { fetchAllRates, getRate } from "../services/rateFetcher";

const rates = new Hono();

rates.use("*", authMiddleware);

rates.get("/", async (c) => {
  const { base } = c.req.query();
  const baseCurrency = base || getSettingsDefault();
  
  const items = query(
    "SELECT * FROM exchange_rates WHERE base_currency = ? ORDER BY target_currency",
    [baseCurrency]
  );
  
  return c.json(items.map(transformRate));
});

rates.get("/:base/:target", async (c) => {
  const base = c.req.param("base");
  const target = c.req.param("target");
  
  const row = getRate(base, target);
  if (!row) {
    return c.json({ error: "Rate not found" }, 404);
  }
  
  return c.json(transformRate({ ...row, base_currency: base, target_currency: target }));
});

rates.post("/refresh", async (c) => {
  // Trigger immediate rate fetch
  fetchAllRates().catch(console.error);
  return c.json({ message: "Rate fetch triggered" });
});

function getSettingsDefault(): string {
  const row = getOne("SELECT default_currency FROM settings LIMIT 1") as any;
  return row?.default_currency || "USD";
}

function transformRate(row: any) {
  return {
    id: row.id,
    baseCurrency: row.base_currency || row.base,
    targetCurrency: row.target_currency || row.target,
    rate: row.rate,
    updatedAt: row.updated_at || row.updatedAt,
    source: row.source,
  };
}

export default rates;
