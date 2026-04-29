import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query, getOne, run, ensureSettingsRow } from "../db";
import { updateSettingsSchema } from "@money-tracker/shared/schemas";
import { formatZodError } from "../lib/utils";

const settings = new Hono();

settings.use("*", authMiddleware);

settings.get("/", async (c) => {
  const userId = c.get("userId") as number;
  ensureSettingsRow(userId);
  const item = getOne("SELECT * FROM settings WHERE user_id = ?", [userId]);
  if (!item) throw new HTTPException(404, { message: "Settings not found" });
  return c.json(transformSettings(item));
});

settings.put("/", async (c) => {
  const userId = c.get("userId") as number;
  const rawData = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatZodError(parsed.error) });
  }

  const data = parsed.data;
  ensureSettingsRow(userId);
  const existing = getOne("SELECT * FROM settings WHERE user_id = ?", [userId]);
  if (!existing) throw new HTTPException(404, { message: "Settings not found" });

  const oldCurrency = (existing as any).default_currency;
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

  params.push(userId);
  run(`UPDATE settings SET ${updates.join(", ")} WHERE user_id = ?`, params);

  if (isChangingCurrency) {
    recalculateAllTransactions(newCurrency, userId);
  }

  const result = getOne("SELECT * FROM settings WHERE user_id = ?", [userId]);
  return c.json(transformSettings(result));
});

function recalculateAllTransactions(newDefaultCurrency: string, userId: number) {
  const transactions = query("SELECT id, amount, currency, exchange_rate FROM transactions WHERE user_id = ? AND exchange_rate IS NOT NULL", [userId]) as any[];

  for (const tx of transactions) {
    if (tx.currency === newDefaultCurrency) {
      run("UPDATE transactions SET amount_default = amount, exchange_rate = 1.0 WHERE id = ? AND user_id = ?", [tx.id, userId]);
    } else if (tx.exchange_rate && tx.exchange_rate > 0) {
      const amountDefault = tx.amount * tx.exchange_rate;
      run("UPDATE transactions SET amount_default = ? WHERE id = ? AND user_id = ?", [amountDefault, tx.id, userId]);
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