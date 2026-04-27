import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  token: text("token"),
});

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  isPredefined: integer("is_predefined", { mode: "boolean" }).notNull().default(false),
});

// ─── Currencies ──────────────────────────────────────────────────────────────
export const currencies = sqliteTable("currencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol"),
  precision: integer("precision").notNull().default(2),
  type: text("type", { enum: ["fiat", "crypto"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Exchange Rates ───────────────────────────────────────────────────────────
export const exchangeRates = sqliteTable("exchange_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  baseCurrency: text("base_currency").notNull(),
  targetCurrency: text("target_currency").notNull(),
  rate: real("rate").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  source: text("source", { enum: ["fawaz"] }).notNull(),
}, (table) => ({
  uniquePair: table.baseCurrency.append(table.targetCurrency).unique(),
}));

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  fiatFetchInterval: integer("fiat_fetch_interval").notNull().default(60),
  cryptoFetchInterval: integer("crypto_fetch_interval").notNull().default(5),
  autoFetchRates: integer("auto_fetch_rates", { mode: "boolean" }).notNull().default(true),
  showCryptoOnDashboard: integer("show_crypto_on_dashboard", { mode: "boolean" }).notNull().default(true),
});

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  amountDefault: integer("amount_default"),
  exchangeRate: real("exchange_rate"),
  description: text("description"),
  date: text("date").notNull(), // YYYY-MM-DD
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Relations ──────────────────────────────────────────────────────────────
export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const currenciesRelations = relations(currencies, ({ many }) => ({
  transactions: many(transactions),
}));

// ─── Categories ───────────────────────────────────────────────────────────────
export type UserType = typeof users.$inferSelect;
export type InsertUserType = typeof users.$inferInsert;
export type CategoryType = typeof categories.$inferSelect;
export type InsertCategoryType = typeof categories.$inferInsert;
export type TransactionType = typeof transactions.$inferSelect;
export type InsertTransactionType = typeof transactions.$inferInsert;
