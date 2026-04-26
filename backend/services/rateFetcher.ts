import { run, getOne } from "../db";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

// Global state to track if a fetch is in progress
let isFetching = false;

export async function fetchFiatRates(): Promise<void> {
  
  try {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    if (!settings || !settings.auto_fetch_rates) return;

    // Get list of fiat currencies from DB
    const currencies = run("SELECT code FROM currencies WHERE type = 'fiat' AND code != ?", [settings.default_currency || "USD"]);
    const fiatCodes = (currencies as any[]).map(c => c.code).filter(Boolean);
    
    if (fiatCodes.length === 0) return;

    // Fetch from frankfurter (base = default currency)
    const base = settings.default_currency || "USD";
    const symbols = fiatCodes.filter(c => c !== base).join(",");
    
    if (!symbols) return;

    const url = `${FRANKFURTER_URL}?from=${base}&to=${symbols}`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    
    if (!response.ok) {
      console.warn(` frankfurter API returned ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data?.rates) {
      console.warn(" frankfurter: unexpected response format");
      return;
    }

    // Store rates in DB
    for (const [target, rate] of Object.entries(data.rates)) {
      if (typeof rate !== "number") continue;
      
      // Upsert: update if exists, insert if not
      const existing = getOne(
        "SELECT id FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
        [base, target]
      ) as any;
      
      const now = Math.floor(Date.now() / 1000);
      
      if (existing) {
        run(
          "UPDATE exchange_rates SET rate = ?, updated_at = ?, source = ? WHERE id = ?",
          [rate, now, "frankfurter", existing.id]
        );
      } else {
        run(
          "INSERT INTO exchange_rates (base_currency, target_currency, rate, updated_at, source) VALUES (?, ?, ?, ?, ?)",
          [base, target, rate, now, "frankfurter"]
        );
      }
    }
    
    console.log(`[rates] Fetched ${Object.keys(data.rates).length} fiat rates, base: ${base}`);
  } catch (err) {
    console.error("[rates] Failed to fetch fiat rates:", err);
  }
}

export async function fetchCryptoRates(): Promise<void> {
  try {
    const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
    if (!settings || !settings.auto_fetch_rates) return;

    // Get list of crypto currencies from DB
    const currencies = run("SELECT code FROM currencies WHERE type = 'crypto'") as any[];
    const cryptoCodes = currencies.map(c => c.code).filter(Boolean);
    
    if (cryptoCodes.length === 0) return;

    const vs_currency = settings.default_currency?.toLowerCase() || "usd";
    const ids = "bitcoin,ethereum,solana,ripple,cardano";
    
    const url = `${COINGECKO_URL}?ids=${ids}&vs_currencies=${vs_currency}`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    
    if (!response.ok) {
      console.warn(` CoinGecko API returned ${response.status}`);
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
    const base = settings.default_currency || "USD";
    
    let count = 0;
    for (const [coinId, prices] of Object.entries(data)) {
      const code = idToCode[coinId];
      if (!code || typeof prices !== "object" || !prices[vsKey]) continue;
      
      const rate = prices[vsKey] as number;
      const now = Math.floor(Date.now() / 1000);
      
      // Upsert
      const existing = getOne(
        "SELECT id FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
        [base, code]
      ) as any;
      
      if (existing) {
        run(
          "UPDATE exchange_rates SET rate = ?, updated_at = ?, source = ? WHERE id = ?",
          [rate, now, "coingecko", existing.id]
        );
      } else {
        run(
          "INSERT INTO exchange_rates (base_currency, target_currency, rate, updated_at, source) VALUES (?, ?, ?, ?, ?)",
          [base, code, rate, now, "coingecko"]
        );
      }
      count++;
    }
    
    console.log(`[rates] Fetched ${count} crypto rates, base: ${base}`);
  } catch (err) {
    console.error("[rates] Failed to fetch crypto rates:", err);
  }
}

export async function fetchAllRates(): Promise<void> {
  if (isFetching) return;
  isFetching = true;
  
  try {
    await Promise.all([
      fetchFiatRates(),
      fetchCryptoRates(),
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

  // Schedule periodic fetches
  const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
  const fiatInterval = (settings?.fiat_fetch_interval || 60) * 60 * 1000; // minutes to ms
  const cryptoInterval = (settings?.crypto_fetch_interval || 5) * 60 * 1000; // minutes to ms

  const fiatTimer = setInterval(() => {
    fetchFiatRates().catch(console.error);
  }, fiatInterval);

  const cryptoTimer = setInterval(() => {
    fetchCryptoRates().catch(console.error);
  }, cryptoInterval);

  // Return cleanup function
  return () => {
    clearInterval(fiatTimer);
    clearInterval(cryptoTimer);
  };
}

export function getRate(base: string, target: string): { rate: number; updatedAt: number } | null {
  const row = getOne(
    "SELECT rate, updated_at FROM exchange_rates WHERE base_currency = ? AND target_currency = ?",
    [base, target]
  ) as any;
  
  if (!row) return null;
  
  return {
    rate: row.rate,
    updatedAt: row.updated_at,
  };
}
