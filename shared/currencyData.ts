/**
 * ISO 4217 Fiat Currency Registry + Crypto codes
 * This is a curated list of common currencies, not exhaustive.
 * For fiat: uses ISO 4217 codes
 * For crypto: uses common ticker symbols
 */

export interface IsoCurrency {
  code: string;
  name: string;
  symbol: string;
  emoji?: string;
}

// ISO 4217 fiat currencies
export const ISO_4217_CURRENCIES: IsoCurrency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", emoji: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", emoji: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", emoji: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", emoji: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", emoji: "🇨🇳" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", emoji: "🇨🇭" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", emoji: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", emoji: "🇦🇺" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", emoji: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", emoji: "🇳🇴" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", emoji: "🇩🇰" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", emoji: "🇵🇱" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", emoji: "🇨🇿" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", emoji: "🇭🇺" },
  { code: "RON", name: "Romanian Leu", symbol: "lei", emoji: "🇷🇴" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", emoji: "🇧🇬" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", emoji: "🇹🇷" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", emoji: "🇷🇺" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", emoji: "🇮🇳" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", emoji: "🇧🇷" },
  { code: "MXN", name: "Mexican Peso", symbol: "$", emoji: "🇲🇽" },
  { code: "ZAR", name: "South African Rand", symbol: "R", emoji: "🇿🇦" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", emoji: "🇸🇬" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", emoji: "🇳🇿" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", emoji: "🇰🇷" },
  { code: "THB", name: "Thai Baht", symbol: "฿", emoji: "🇹🇭" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", emoji: "🇲🇾" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", emoji: "🇮🇩" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", emoji: "🇵🇭" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", emoji: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", emoji: "🇸🇦" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", emoji: "🇭🇰" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", emoji: "🇮🇱" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn", emoji: "🇭🇷" },
];

// Common crypto currencies
export const COMMON_CRYPTOS: IsoCurrency[] = [
  { code: "BTC", name: "Bitcoin", symbol: "₿", emoji: "₿" },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", emoji: "Ξ" },
  { code: "SOL", name: "Solana", symbol: "SOL", emoji: "◎" },
  { code: "XRP", name: "XRP", symbol: "XRP", emoji: "✕" },
  { code: "ADA", name: "Cardano", symbol: "₳", emoji: "₳" },
  { code: "DOT", name: "Polkadot", symbol: "DOT", emoji: "●" },
  { code: "AVAX", name: "Avalanche", symbol: "AVAX", emoji: "🔺" },
  { code: "MATIC", name: "Polygon", symbol: "MATIC", emoji: "⬡" },
  { code: "LINK", name: "Chainlink", symbol: "LINK", emoji: "🔗" },
  { code: "UNI", name: "Uniswap", symbol: "UNI", emoji: "🦄" },
  { code: "DOGE", name: "Dogecoin", symbol: "Ð", emoji: "Ð" },
];

/**
 * Returns emoji flag/icon for a given currency code
 */
export function getCurrencyEmoji(code: string): string {
  const all = [...ISO_4217_CURRENCIES, ...COMMON_CRYPTOS];
  const found = all.find((c) => c.code === code.toUpperCase());
  return found?.emoji || "";
}

/**
 * Validate that a fiat code matches ISO 4217
 */
export function isIsoFiatCode(code: string): boolean {
  return ISO_4217_CURRENCIES.some((c) => c.code === code.toUpperCase());
}

/**
 * Get currency info by code
 */
export function getCurrencyInfo(
  code: string,
): IsoCurrency | undefined {
  const all = [...ISO_4217_CURRENCIES, ...COMMON_CRYPTOS];
  return all.find((c) => c.code === code.toUpperCase());
}

/**
 * All supported currency codes combined
 */
export const ALL_SUPPORTED_CODES: string[] = [
  ...ISO_4217_CURRENCIES.map((c) => c.code),
  ...COMMON_CRYPTOS.map((c) => c.code),
];
