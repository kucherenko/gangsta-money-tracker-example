import { Database } from "bun:sqlite";

const DB_PATH = process.env.DB_PATH || import.meta.dir + "/data.sqlite";

// Open SQLite database file
export const client = new Database(DB_PATH, { create: true });
// Backward-compatible export for tests
export const db = client;

// Enable WAL mode
client.exec("PRAGMA journal_mode = WAL;");

export function initDb() {
  // Step 1: Create tables (if not exist)
  client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      token TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      icon TEXT,
      type TEXT NOT NULL,
      is_predefined INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      symbol TEXT,
      precision INTEGER NOT NULL DEFAULT 2,
      type TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL,
      target_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()),
      source TEXT NOT NULL DEFAULT 'frankfurter',
      UNIQUE(base_currency, target_currency)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      default_currency TEXT NOT NULL DEFAULT 'USD',
      fiat_fetch_interval INTEGER NOT NULL DEFAULT 60,
      crypto_fetch_interval INTEGER NOT NULL DEFAULT 5,
      auto_fetch_rates INTEGER NOT NULL DEFAULT 1,
      show_crypto_on_dashboard INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      amount_default REAL,
      exchange_rate REAL,
      description TEXT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      created_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Step 2: Migrate existing tables (add missing columns)
  migrateTransactionsTable();

  // Step 3: Create indexes (must be after migration adds columns)
  client.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
  `);

  // Step 4: Seed data
  seedCurrencies();

  // Step 5: Create default settings row if missing
  ensureSettingsRow();

  // Step 7: Remove legacy reverse-only rate pairs (created by old Frankfurter fetcher)
  // which stored both USD->EUR and EUR->USD explicitly and shadow proper reverse lookups
  // Also recalc old multi-currency transactions created with incorrect (inverted) rates
  migrateExchangeRates();
}

function migrateExchangeRates() {
  const cols = getTableColumns("exchange_rates");
  if (!cols.includes("updated_at")) return;

  // Clean up old reverse-only pairs for known legacy sources so that getRate()
  // reverse inversion works correctly off only base->target rows.
  // Legacy rows inserted by old code with source='frankfurter' that are reverse
  // direction of newer 'fawaz' base->target rows cause shadowing.
  // Since we cannot reliably tell which rows are reverse-only in the old data,
  // we drop ALL legacy source='frankfurter' rows because the new fetcher
  // only stores 'fawaz' and 'coingecko'.
  client.exec("DELETE FROM exchange_rates WHERE source = 'frankfurter'");

  // Recalculate any multi-currency transactions where exchange_rate looks like
  // an old inverted value (< 1 while currency is weaker than default).
  // Recompute rate = amount_default / amount for all non-default-currency transactions.
  const settings = getOne("SELECT * FROM settings LIMIT 1") as any;
  const defaultCurrency = settings?.default_currency || "USD";
  const txs = client.prepare(
    "SELECT id, amount, amount_default, currency, exchange_rate FROM transactions WHERE currency != ?"
  ).all(defaultCurrency) as any[];
  for (const tx of txs) {
    if (!tx.amount || tx.amount === 0) continue;
    const correctRate = (tx.amount_default ?? tx.amount) / tx.amount;
    if (correctRate !== tx.exchange_rate) {
      client.prepare("UPDATE transactions SET exchange_rate = ? WHERE id = ?")
        .run(correctRate, tx.id);
    }
  }
}

// Migration helpers
function migrateTransactionsTable() {
  const columns = getTableColumns("transactions");
  if (!columns.includes("amount_default")) {
    client.exec(`ALTER TABLE transactions ADD COLUMN amount_default REAL DEFAULT NULL`);
  }
  if (!columns.includes("exchange_rate")) {
    client.exec(`ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT NULL`);
  }
  if (!columns.includes("currency")) {
    client.exec(`ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`);
  }
  // Backfill: existing transactions without currency fields
  client.exec(`
    UPDATE transactions 
    SET currency = 'USD', 
        amount_default = amount,
        exchange_rate = 1.0
    WHERE amount_default IS NULL AND exchange_rate IS NULL
  `);
}

// Helper to check if table exists and get its columns
function getTableColumns(tableName: string): string[] {
  try {
    const result = client.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return result.map((col) => col.name);
  } catch {
    return [];
  }
}

// Seed currencies if table is empty
export function seedCurrencies() {
  const count = getOne("SELECT COUNT(*) as count FROM currencies") as any;
  if (count && count.count > 0) return;
  
  const fiatCurrencies = [
    { code: "USD", name: "US Dollar", symbol: "$", precision: 2, type: "fiat" },
    { code: "EUR", name: "Euro", symbol: "€", precision: 2, type: "fiat" },
    { code: "GBP", name: "British Pound", symbol: "£", precision: 2, type: "fiat" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥", precision: 0, type: "fiat" },
    { code: "CHF", name: "Swiss Franc", symbol: "Fr", precision: 2, type: "fiat" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$", precision: 2, type: "fiat" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", precision: 2, type: "fiat" },
    { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", precision: 2, type: "fiat" },
    { code: "SEK", name: "Swedish Krona", symbol: "kr", precision: 2, type: "fiat" },
    { code: "NOK", name: "Norwegian Krone", symbol: "kr", precision: 2, type: "fiat" },
    { code: "DKK", name: "Danish Krone", symbol: "kr", precision: 2, type: "fiat" },
    { code: "PLN", name: "Polish Zloty", symbol: "zł", precision: 2, type: "fiat" },
    { code: "CZK", name: "Czech Koruna", symbol: "Kč", precision: 2, type: "fiat" },
    { code: "HUF", name: "Hungarian Forint", symbol: "Ft", precision: 2, type: "fiat" },
    { code: "RON", name: "Romanian Leu", symbol: "lei", precision: 2, type: "fiat" },
    { code: "BGN", name: "Bulgarian Lev", symbol: "лв", precision: 2, type: "fiat" },
    { code: "HRK", name: "Croatian Kuna", symbol: "kn", precision: 2, type: "fiat" },
    { code: "TRY", name: "Turkish Lira", symbol: "₺", precision: 2, type: "fiat" },
    { code: "MXN", name: "Mexican Peso", symbol: "$", precision: 2, type: "fiat" },
    { code: "ZAR", name: "South African Rand", symbol: "R", precision: 2, type: "fiat" },
  ];
  
  const cryptoCurrencies = [
    { code: "BTC", name: "Bitcoin", symbol: "₿", precision: 8, type: "crypto" },
    { code: "ETH", name: "Ethereum", symbol: "Ξ", precision: 9, type: "crypto" },
    { code: "SOL", name: "Solana", symbol: "SOL", precision: 9, type: "crypto" },
    { code: "XRP", name: "XRP", symbol: "XRP", precision: 6, type: "crypto" },
    { code: "ADA", name: "Cardano", symbol: "ADA", precision: 6, type: "crypto" },
  ];
  
  const allCurrencies = [...fiatCurrencies, ...cryptoCurrencies];
  
  const stmt = client.prepare(`
    INSERT INTO currencies (code, name, symbol, precision, type) VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const c of allCurrencies) {
    stmt.run(c.code, c.name, c.symbol, c.precision, c.type);
  }
}

function migrateCurrenciesTable() {
  const columns = getTableColumns("currencies");
  if (!columns.includes("sort_order")) {
    client.exec(`ALTER TABLE currencies ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    // Seed sort_order from existing order: all active currencies first, then by type, then code
    const rows = client.prepare("SELECT id FROM currencies ORDER BY type, code").all() as any[];
    for (let i = 0; i < rows.length; i++) {
      client.prepare("UPDATE currencies SET sort_order = ? WHERE id = ?").run(i, rows[i].id);
    }
  }
}

export function ensureSettingsRow() {
  const count = getOne("SELECT COUNT(*) as count FROM settings") as any;
  if (!count || count.count === 0) {
    client.exec(`INSERT INTO settings (default_currency) VALUES ('USD')`);
  }
}

initDb();

// Helper to run SQL with parameters
export function query(sql: string, params?: any[]) {
  const stmt = client.prepare(sql);
  return params ? stmt.all(...params) : stmt.all();
}

export function run(sql: string, params?: any[]) {
  const stmt = client.prepare(sql);
  return params ? stmt.run(...params) : stmt.run();
}

export function getOne(sql: string, params?: any[]) {
  const stmt = client.prepare(sql);
  return params ? stmt.get(...params) : stmt.get();
}

// Helper for insert with returning
export function insert(sql: string, params?: any[]) {
  const stmt = client.prepare(sql);
  return params ? stmt.run(...params) : stmt.run();
}

// Helper to get last inserted row
export function lastInsertedRow(table: string) {
  return getOne(`SELECT * FROM ${table} WHERE id = last_insert_rowid()`);
}
