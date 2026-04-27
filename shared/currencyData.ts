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

// Well-known fiat currencies — displayed with richer metadata
export const ISO_4217_CURRENCIES: IsoCurrency[] = [
  { code: "USD", name: "US Dollar", symbol: "\u0024", emoji: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", emoji: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", emoji: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", emoji: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", emoji: "🇨🇳" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", emoji: "🇨🇭" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C\u0024", emoji: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A\u0024", emoji: "🇦🇺" },
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
  { code: "BRL", name: "Brazilian Real", symbol: "R\u0024", emoji: "🇧🇷" },
  { code: "MXN", name: "Mexican Peso", symbol: "\u0024", emoji: "🇲🇽" },
  { code: "ZAR", name: "South African Rand", symbol: "R", emoji: "🇿🇦" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S\u0024", emoji: "🇸🇬" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ\u0024", emoji: "🇳🇿" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", emoji: "🇰🇷" },
  { code: "THB", name: "Thai Baht", symbol: "฿", emoji: "🇹🇭" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", emoji: "🇲🇾" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", emoji: "🇮🇩" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", emoji: "🇵🇭" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", emoji: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", emoji: "🇸🇦" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK\u0024", emoji: "🇭🇰" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", emoji: "🇮🇱" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn", emoji: "🇭🇷" },
];

// Full set of fiat codes supported by the exchange-rate API (covers all ISO 4217 + some metals)
const ISO_4217_FIAT_CODES = new Set([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AWG", "AZN", "BAM", "BBD",
  "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP",
  "BYN", "BYR", "BZD", "CAD", "CDF", "CHF", "CLP", "CNH", "CNY", "COP", "CRC",
  "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR",
  "FJD", "FKP", "GBP", "GEL", "GGP", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD",
  "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "IMP", "INR", "IQD", "IRR",
  "ISK", "JEP", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW",
  "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LTL", "LVL", "LYD",
  "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK",
  "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB",
  "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF",
  "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD",
  "STD", "STN", "SVC", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY",
  "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV",
  "WST", "XAF", "XAG", "XAU", "XCD", "XDR", "XOF", "XPF", "YER", "ZAR", "ZMK",
  "ZMW", "ZWL",
]);

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
 * Validate that a fiat code is supported by the exchange-rate API
 * (covers all ISO 4217 currencies known by the rate provider)
 */
export function isIsoFiatCode(code: string): boolean {
  return ISO_4217_FIAT_CODES.has(code.toUpperCase());
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
