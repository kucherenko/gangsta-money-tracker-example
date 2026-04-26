import { run, getOne, query } from "../db";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

// Global state to track if a fetch is in progress
let isFetching = false;

/**
 * Fetch fiat rates for a specific base currency.
 * If no base is specified, uses the user's default currency from settings.
 */
export async function fetchFiatRates(baseCurrency?: string): Promise<void> {
  
  try {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    if (!settings || !settings.auto_fetch_rates) return;

    const base = baseCurrency || settings.default_currency || "USD";

    // Get list of fiat currencies from DB (all except base)
    const currencies = query("SELECT code FROM currencies WHERE type = 'fiat' AND code != ?", [base]) as any[];
    const fiatCodes = currencies.map(c => c.code).filter(Boolean);
    
    if (fiatCodes.length === 0) return;

    // Fetch from frankfurter
    const symbols = fiatCodes.filter((c: string) => c !== base).join(",");
    
    if (!symbols) return;

    const url = `${FRANKFURTER_URL}?from=${base}&to=${symbols}`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    
    if (!response.ok) {
      console.warn(`frankfurter API returned ${response.status} for ${base}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data?.rates) {
      console.warn("frankfurter: unexpected response format");
      return;
    }

    // Store rates in DB
    for (const [target, rate] of Object.entries(data.rates)) {
      if (typeof rate !== "number") continue;
      
      const now = Math.floor(Date.now() / 1000);
      
      // Upsert: update if exists, insert if not
      upsertRate(base, target, rate, now, "frankfurter");
      
      // Also store the reverse rate (useful for lookups)
      upsertRate(target, base, 1 / rate, now, "frankfurter");
    }
    
    console.log(`[rates] Fetched ${Object.keys(data.rates).length} fiat rates, base: ${base}`);
  } catch (err) {
    console.error("[rates] Failed to fetch fiat rates:", err);
  }
}

/**
 * Fetch crypto rates for a specific base currency.
 */
export async function fetchCryptoRates(baseCurrency?: string): Promise<void> {
  try {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    if (!settings || !settings.auto_fetch_rates) return;

    const base = baseCurrency || settings.default_currency || "USD";

    // Get list of crypto currencies from DB
    const currencies = query("SELECT code FROM currencies WHERE type = 'crypto'") as any[];
    const cryptoCodes = currencies.map(c => c.code).filter(Boolean);
    
    if (cryptoCodes.length === 0) return;

    // CoinGecko vs_currency must be lowercase, valid: btc, eth, usd, etc.
    // But fiat codes like EUR are also supported on free tier
    const vs_currency = base.toLowerCase();
    const ids = "bitcoin,ethereum,solana,ripple,cardano";
    
    const url = `${COINGECKO_URL}?ids=${ids}&vs_currencies=${vs_currency}`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    
    if (!response.ok) {
      console.warn(`CoinGecko API returned ${response.status}: ${await response.text()}`);
      return;
    }
    
    const data = await response.json();
    
    // Map CoinGecko IDs to currency codes
    const idToCode: Record<string, string> = {
      bitcoin: "BTC",
      ethereum: "ETH",
      solana: "SOL",
      ripple: "XRP",
      cardano: "ADA",
    };

    const vsKey = vs_currency;
    
    let count = 0;
    for (const [coinId, prices] of Object.entries(data)) {
      const code = idToCode[coinId];
      if (!code || typeof prices !== "object" || !prices[vsKey]) continue;
      
      const rate = prices[vsKey] as number;
      const now = Math.floor(Date.now() / 1000);
      
      // Store: base = EUR, target = BTC (how much BTC is 1 EUR worth?)
      // Actually, CoinGecko returns: 1 BTC = X EUR
      // So rate = X means: 1 BTC = X EUR
      // We want: EUR → BTC: 1 EUR = 1/X BTC
      // And: BTC → EUR: 1 BTC = X EUR
      
      if (rate > 0) {
        upsertRate(code, base, rate, now, "coingecko");         // BTC → EUR
        upsertRate(base, code, 1 / rate, now, "coingecko");     // EUR → BTC
        count++;
      }
    }
    
    console.log(`[rates] Fetched ${count} crypto rates, base: ${base}`);
  } catch (err) {
    console.error("[rates] Failed to fetch crypto rates:", err);
  }
}

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

export async function fetchAllRates(baseCurrency?: string): Promise<void> {
  if (isFetching) return;
  isFetching = true;
  
  try {
    await Promise.all([
      fetchFiatRates(baseCurrency),
      fetchCryptoRates(baseCurrency),
    ]);
  } finally {
    isFetching = false;
  }
}

export function startRateFetcher(): () => void {
  // Fetch immediately on startup (but not blocking)
  setTimeout(() => {
    fetchAllRates().catch(console.error);
  }, 1000);

  // Schedule periodic fetches using latest settings
  let fiatTimer: ReturnType<typeof setInterval>;
  let cryptoTimer: ReturnType<typeof setInterval>;

  function schedule() {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    const fiatInterval = (settings?.fiat_fetch_interval || 60) * 60 * 1000;
    const cryptoInterval = (settings?.crypto_fetch_interval || 5) * 60 * 1000;

    clearInterval(fiatTimer);
    clearInterval(cryptoTimer);

    fiatTimer = setInterval(() => {
      fetchFiatRates().catch(console.error);
    }, fiatInterval);

    cryptoTimer = setInterval(() => {
      fetchCryptoRates().catch(console.error);
    }, cryptoInterval);
  }

  schedule();

  // Return cleanup function
  return () => {
    clearInterval(fiatTimer);
    clearInterval(cryptoTimer);
  };
}

/**
 * Get cached rate between two currencies.
 * Supports reverse lookup if forward rate doesn't exist.
 */
export function getRate(base: string, target: string): { rate: number; updatedAt: number; source: string } | null {
  // First try: exact match
  const row = getOne(
    "SELECT rate, updated_at, source FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
    [base, target]
  ) as any;
  
  if (row) {
    return {
      rate: row.rate,
      updatedAt: row.updated_at,
      source: row.source,
    };
  }
  
  // Second try: reverse lookup
  const reverseRow = getOne(
    "SELECT rate, updated_at, source FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
    [target, base]
  ) as any;
  
  if (reverseRow && reverseRow.rate > 0) {
    return {
      rate: 1 / reverseRow.rate,
      updatedAt: reverseRow.updated_at,
      source: reverseRow.source,
    };
  }
  
  return null;
}

/**
 * Get all rates for a given base currency (or default)
 */
export function getRatesForBase(base?: string): any[] {
  const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
  const baseCurrency = base || settings?.default_currency || "USD";
  
  return query(
    "SELECT * FROM exchange_rates WHERE base_currency = ? ORDER BY target_currency",
    [baseCurrency]
  ) as any[];
}
