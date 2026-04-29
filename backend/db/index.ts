import { Database } from "bun:sqlite";
import { CONFIG_KEYS } from "../lib/config-constants";

const DB_PATH = process.env.DB_PATH || import.meta.dir + "/data.sqlite";

export const client = new Database(DB_PATH, { create: true });
export const db = client;

client.exec("PRAGMA journal_mode = WAL;");

export function initDb() {
  // Step 1: Create tables (if not exist)
  client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      icon TEXT,
      type TEXT NOT NULL,
      is_predefined INTEGER NOT NULL DEFAULT 0,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS cleanup_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL CHECK(scope IN ('transactions', 'orphaned')),
      consumed INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      scope TEXT,
      details TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Step 2: Run migrations
  migrateUsersTable();
  migrateTransactionsTable();
  migrateCategoriesTable();
  migrateSettingsTable();
  migrateRefreshTokensTable();
  seedSystemConfig();
  cleanOrphanedData();
  migrateCleanupTokens();
  migrateAuditLog();

  // Step 3: Enable pragmas (after orphan cleanup)
  client.exec("PRAGMA foreign_keys = ON;");
  client.exec("PRAGMA busy_timeout = 5000;");

  // Step 4: Create indexes
  client.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type_user ON categories(name, type, COALESCE(user_id, -1));
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_cleanup_tokens_user_id ON cleanup_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON audit_log(performed_by);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
  `);

  // Step 5: Seed currencies (no user dependency)
  seedCurrencies();

  // Step 6: Migrate exchange rates
  migrateExchangeRates();
}

function migrateUsersTable() {
  const cols = getTableColumns("users");

  if (cols.includes("token") || !cols.includes("role")) {
    client.exec(`
      CREATE TABLE IF NOT EXISTS users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'user'
      );
    `);

    const existingUsers = client.prepare("SELECT id, username, password_hash FROM users").all() as any[];
    if (existingUsers.length > 0) {
      const stmt = client.prepare("INSERT INTO users_new (id, username, password_hash, role) VALUES (?, ?, ?, 'admin')");
      for (const u of existingUsers) {
        try { stmt.run(u.id, u.username, u.password_hash); } catch {}
      }
    }

    client.exec("DROP TABLE users;");
    client.exec("ALTER TABLE users_new RENAME TO users;");
  }
}

function migrateTransactionsTable() {
  const columns = getTableColumns("transactions");
  if (!columns.includes("amount_default")) {
    client.exec("ALTER TABLE transactions ADD COLUMN amount_default REAL DEFAULT NULL");
  }
  if (!columns.includes("exchange_rate")) {
    client.exec("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT NULL");
  }
  if (!columns.includes("currency")) {
    client.exec("ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  }
  if (!columns.includes("user_id")) {
    client.exec("ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
    const admin = getOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1") as any;
    if (admin) {
      client.exec("UPDATE transactions SET user_id = ? WHERE user_id IS NULL", [admin.id]);
    }
  }
  client.exec(`
    UPDATE transactions
    SET currency = 'USD',
        amount_default = amount,
        exchange_rate = 1.0
    WHERE amount_default IS NULL AND exchange_rate IS NULL
  `);
}

function migrateCategoriesTable() {
  const columns = getTableColumns("categories");
  if (!columns.includes("user_id")) {
    client.exec("ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  }
}

function migrateSettingsTable() {
  const columns = getTableColumns("settings");
  const hasUserId = columns.includes("user_id");

  if (hasUserId) {
    const nullRows = client.prepare("SELECT COUNT(*) as count FROM settings WHERE user_id IS NULL").get() as any;
    if (nullRows && nullRows.count > 0) {
      const admin = getOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1") as any;
      if (admin) {
        client.exec("UPDATE settings SET user_id = ? WHERE user_id IS NULL", [admin.id]);
      }
    }
  }
}

function seedSystemConfig() {
  client.exec(`INSERT OR IGNORE INTO system_config (key, value) VALUES ('${CONFIG_KEYS.ALLOW_REGISTRATION}', 'false')`);
}

function migrateRefreshTokensTable() {
  const columns = getTableColumns("refresh_tokens");
  if (!columns.includes("consumed")) {
    client.exec("ALTER TABLE refresh_tokens ADD COLUMN consumed INTEGER NOT NULL DEFAULT 0");
  }
}

function migrateCleanupTokens() {
  const cols = getTableColumns("cleanup_tokens");
  if (cols.length === 0) {
    client.exec(`
      CREATE TABLE IF NOT EXISTS cleanup_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope TEXT NOT NULL CHECK(scope IN ('transactions', 'orphaned')),
        consumed INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_cleanup_tokens_user_id ON cleanup_tokens(user_id);
    `);
  }
}

function migrateAuditLog() {
  const cols = getTableColumns("audit_log");
  if (cols.length === 0) {
    client.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        scope TEXT,
        details TEXT,
        ip_address TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON audit_log(performed_by);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    `);
  }
}

function cleanOrphanedData() {
  client.exec(`
    UPDATE transactions SET category_id = NULL
    WHERE category_id IS NOT NULL
    AND category_id NOT IN (SELECT id FROM categories)
  `);
  client.exec(`
    DELETE FROM refresh_tokens
    WHERE user_id NOT IN (SELECT id FROM users)
  `);
}

function migrateExchangeRates() {
  const cols = getTableColumns("exchange_rates");
  if (!cols.includes("updated_at")) return;

  client.exec("DELETE FROM exchange_rates WHERE source = 'frankfurter'");

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

function getTableColumns(tableName: string): string[] {
  try {
    const result = client.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return result.map((col) => col.name);
  } catch {
    return [];
  }
}

export function seedCurrencies() {
  const count = getOne("SELECT COUNT(*) as count FROM currencies") as any;
  if (count && count.count > 0) return;

  const fiatCurrencies = [
    { code: "USD", name: "US Dollar", symbol: "$", precision: 2, type: "fiat" },
    { code: "EUR", name: "Euro", symbol: "\u20ac", precision: 2, type: "fiat" },
    { code: "GBP", name: "British Pound", symbol: "\u00a3", precision: 2, type: "fiat" },
    { code: "JPY", name: "Japanese Yen", symbol: "\u00a5", precision: 0, type: "fiat" },
    { code: "CHF", name: "Swiss Franc", symbol: "Fr", precision: 2, type: "fiat" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$", precision: 2, type: "fiat" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", precision: 2, type: "fiat" },
    { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", precision: 2, type: "fiat" },
    { code: "SEK", name: "Swedish Krona", symbol: "kr", precision: 2, type: "fiat" },
    { code: "NOK", name: "Norwegian Krone", symbol: "kr", precision: 2, type: "fiat" },
    { code: "DKK", name: "Danish Krone", symbol: "kr", precision: 2, type: "fiat" },
    { code: "PLN", name: "Polish Zloty", symbol: "z\u0142", precision: 2, type: "fiat" },
    { code: "CZK", name: "Czech Koruna", symbol: "K\u010d", precision: 2, type: "fiat" },
    { code: "HUF", name: "Hungarian Forint", symbol: "Ft", precision: 2, type: "fiat" },
    { code: "RON", name: "Romanian Leu", symbol: "lei", precision: 2, type: "fiat" },
    { code: "BGN", name: "Bulgarian Lev", symbol: "\u043b\u0432", precision: 2, type: "fiat" },
    { code: "HRK", name: "Croatian Kuna", symbol: "kn", precision: 2, type: "fiat" },
    { code: "TRY", name: "Turkish Lira", symbol: "\u20ba", precision: 2, type: "fiat" },
    { code: "MXN", name: "Mexican Peso", symbol: "$", precision: 2, type: "fiat" },
    { code: "ZAR", name: "South African Rand", symbol: "R", precision: 2, type: "fiat" },
  ];

  const cryptoCurrencies = [
    { code: "BTC", name: "Bitcoin", symbol: "\u20bf", precision: 8, type: "crypto" },
    { code: "ETH", name: "Ethereum", symbol: "\u039e", precision: 9, type: "crypto" },
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

export function ensureSettingsRow(userId: number) {
  const existing = getOne("SELECT id FROM settings WHERE user_id = ?", [userId]);
  if (!existing) {
    client.prepare("INSERT INTO settings (user_id, default_currency) VALUES (?, 'USD')").run(userId);
  }
}

export function migrateReceiptFiles() {
  const flag = getOne("SELECT value FROM system_config WHERE key = 'receipt_migration_v2'") as any;
  if (flag) return;

  const fs = require("node:fs");
  const path = require("node:path");

  const receiptsDir = path.resolve("data/receipts");
  if (!fs.existsSync(receiptsDir)) return;

  const txs = query("SELECT id, user_id FROM transactions WHERE user_id IS NOT NULL") as any[];

  for (const tx of txs) {
    const exts = ["jpg", "jpeg", "png", "webp", "pdf"];
    for (const ext of exts) {
      const oldPath = path.join(receiptsDir, `${tx.id}.${ext}`);
      if (fs.existsSync(oldPath)) {
        const userDir = path.join(receiptsDir, String(tx.user_id));
        fs.mkdirSync(userDir, { recursive: true });
        const newPath = path.join(userDir, `${tx.id}.${ext}`);
        try { fs.renameSync(oldPath, newPath); } catch {}
        break;
      }
    }
  }

  run("INSERT OR REPLACE INTO system_config (key, value) VALUES ('receipt_migration_v2', 'done')");
}

initDb();

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

export function insert(sql: string, params?: any[]) {
  const stmt = client.prepare(sql);
  return params ? stmt.run(...params) : stmt.run();
}

export function lastInsertedRow(table: string) {
  return getOne(`SELECT * FROM ${table} WHERE id = last_insert_rowid()`);
}

export function transaction<T>(fn: () => T): T {
  client.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    client.exec("COMMIT");
    return result;
  } catch (e) {
    client.exec("ROLLBACK");
    throw e;
  }
}