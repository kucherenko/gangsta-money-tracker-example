import { run, getOne, query } from "../db";

const RATE_API_URL = process.env.RATE_API_URL || "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

let isFetching = false;

/** Fetch all rates from fawazahmed0/exchange-api for a given base.
 *  This covers both fiat and cryptocurrencies.
 *
 *  The API returns a flat map: { base.toLowerCase(): { target.toLowerCase(): rate } }
 *  Convention: rate = "1 base = rate target" (e.g. USD EUR 0.85 means 1 USD = 0.85 EUR)
 */
export async function fetchRates(baseCurrency?: string): Promise<void> {
  try {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    if (!settings || !settings.auto_fetch_rates) return;

    const base = baseCurrency || settings.default_currency || "USD";

    const url = `${RATE_API_URL}/${base.toLowerCase()}.json`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });

    if (!response.ok) {
      console.warn(`Fawaz API returned ${response.status} for ${base}`);
      return;
    }

    const data = await response.json();

    if (!data?.[base.toLowerCase()]) {
      console.warn("Fawaz API: unexpected response format");
      return;
    }

    const ratesMap = data[base.toLowerCase()] as Record<string, number>;
    const now = Math.floor(Date.now() / 1000);

    // Wipe old rates for this base to eliminate stale reverse-only pairs
    run("DELETE FROM exchange_rates WHERE base_currency = ?", [base]);

    let count = 0;
    for (const [target, rate] of Object.entries(ratesMap)) {
      if (typeof rate !== "number" || rate <= 0) continue;
      upsertRate(base, target.toUpperCase(), rate, now, "fawaz");
      count++;
    }

    console.log(`[rates] Fetched ${count} rates, base: ${base}`);
  } catch (err) {
    console.error("[rates] Failed to fetch rates:", err);
  }
}

// ─── Legacy forwarder for callers that still expect a combined fetch ───

export async function fetchAllRates(baseCurrency?: string): Promise<void> {
  if (isFetching) return;
  isFetching = true;
  try {
    await fetchRates(baseCurrency);
  } finally {
    isFetching = false;
  }
}

// ─── Schedule ───

export function startRateFetcher(): () => void {
  setTimeout(() => {
    fetchAllRates().catch(console.error);
  }, 1000);

  let timer: ReturnType<typeof setInterval>;

  function schedule() {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    const interval = (settings?.fiat_fetch_interval || 60) * 60 * 1000;

    clearInterval(timer);
    timer = setInterval(() => {
      fetchAllRates().catch(console.error);
    }, interval);
  }

  schedule();

  return () => {
    clearInterval(timer);
  };
}

// ─── Helpers ───

function upsertRate(
  base: string,
  target: string,
  rate: number,
  timestamp: number,
  source: string
): void {
  const existing = getOne(
    "SELECT id FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
    [base, target]
  ) as any;

  if (existing) {
    run(
      "UPDATE exchange_rates SET rate = ?, updated_at = ?, source = ? WHERE id = ?",
      [rate, timestamp, source, existing.id]
    );
  } else {
    run(
      "INSERT INTO exchange_rates (base_currency, target_currency, rate, updated_at, source) VALUES (?, ?, ?, ?, ?)",
      [base, target, rate, timestamp, source]
    );
  }
}

export function getRate(
  base: string,
  target: string
): { rate: number; updatedAt: number; source: string } | null {
  const row = getOne(
    "SELECT rate, updated_at, source FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
    [base, target]
  ) as any;

  if (row) {
    return { rate: row.rate, updatedAt: row.updated_at, source: row.source };
  }

  const reverse = getOne(
    "SELECT rate, updated_at, source FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
    [target, base]
  ) as any;

  if (reverse && reverse.rate > 0) {
    return { rate: 1 / reverse.rate, updatedAt: reverse.updated_at, source: reverse.source };
  }

  return null;
}

export function getRatesForBase(base?: string): any[] {
  const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
  const baseCurrency = base || settings?.default_currency || "USD";
  return query(
    "SELECT * FROM exchange_rates WHERE base_currency = ? ORDER BY target_currency",
    [baseCurrency]
  ) as any[];
}
