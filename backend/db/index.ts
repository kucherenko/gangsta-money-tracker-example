import { Database } from "bun:sqlite";

const DB_PATH = import.meta.dir + "/data.sqlite";

// Open SQLite database file
export const client = new Database(DB_PATH, { create: true });

// Enable WAL mode
client.exec("PRAGMA journal_mode = WAL;");

// Initialize tables
export function initDb() {
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

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);
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
