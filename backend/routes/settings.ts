import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run } from "../db";
import { updateSettingsSchema } from "@money-tracker/shared/schemas";

const settings = new Hono();

settings.use("*", authMiddleware);

settings.get("/", async (c) => {
  const item = getOne("SELECT * FROM settings LIMIT 1");
  if (!item) throw new HTTPException(404, { message: "Settings not found" });
  return c.json(transformSettings(item));
});

settings.put("/", async (c) => {
  const rawData = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const data = parsed.data;
  const existing = getOne("SELECT * FROM settings LIMIT 1");
  if (!existing) throw new HTTPException(404, { message: "Settings not found" });

  // Check if default currency is changing
  const oldCurrency = existing.default_currency;
  const newCurrency = data.defaultCurrency || oldCurrency;
  const isChangingCurrency = newCurrency !== oldCurrency && data.defaultCurrency !== undefined;

  const updates: string[] = [];
  const params: any[] = [];

  if (data.defaultCurrency !== undefined) { updates.push("default_currency = ?"); params.push(data.defaultCurrency); }
  if (data.fiatFetchInterval !== undefined) { updates.push("fiat_fetch_interval = ?"); params.push(data.fiatFetchInterval); }
  if (data.cryptoFetchInterval !== undefined) { updates.push("crypto_fetch_interval = ?"); params.push(data.cryptoFetchInterval); }
  if (data.autoFetchRates !== undefined) { updates.push("auto_fetch_rates = ?"); params.push(data.autoFetchRates); }
  if (data.showCryptoOnDashboard !== undefined) { updates.push("show_crypto_on_dashboard = ?"); params.push(data.showCryptoOnDashboard); }

  if (updates.length === 0) {
    return c.json(transformSettings(existing));
  }

  params.push(existing.id);
  run(`UPDATE settings SET ${updates.join(", ")} WHERE id = ?`, params);

  // If currency changed, recalculate all transactions
  if (isChangingCurrency) {
    recalculateAllTransactions(newCurrency);
  }

  const result = getOne("SELECT * FROM settings WHERE id = ?", [existing.id]);
  return c.json(transformSettings(result));
});

function recalculateAllTransactions(newDefaultCurrency: string) {
  // Get all transactions with non-null exchange rates
  const transactions = query("SELECT id, amount, currency, exchange_rate FROM transactions WHERE exchange_rate IS NOT NULL");
  
  for (const tx of transactions) {
    if (tx.currency === newDefaultCurrency) {
      run("UPDATE transactions SET amount_default = amount, exchange_rate = 1.0 WHERE id = ?", [tx.id]);
    } else if (tx.exchange_rate && tx.exchange_rate > 0) {
      // Use stored rate to recalculate amount_default
      const amountDefault = tx.amount * tx.exchange_rate;
      run("UPDATE transactions SET amount_default = ? WHERE id = ?", [amountDefault, tx.id]);
    }
  }
}

function transformSettings(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    defaultCurrency: row.default_currency,
    fiatFetchInterval: row.fiat_fetch_interval,
    cryptoFetchInterval: row.crypto_fetch_interval,
    autoFetchRates: row.auto_fetch_rates,
    showCryptoOnDashboard: row.show_crypto_on_dashboard,
  };
}

export default settings;
