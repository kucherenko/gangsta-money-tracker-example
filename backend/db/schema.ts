import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email"),
  role: text("role").notNull().default("user"),
});

// ─── Refresh Tokens ───────────────────────────────────────────────────────────
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  isPredefined: integer("is_predefined", { mode: "boolean" }).notNull().default(false),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
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
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  fiatFetchInterval: integer("fiat_fetch_interval").notNull().default(60),
  cryptoFetchInterval: integer("crypto_fetch_interval").notNull().default(5),
  autoFetchRates: integer("auto_fetch_rates", { mode: "boolean" }).notNull().default(true),
  showCryptoOnDashboard: integer("show_crypto_on_dashboard", { mode: "boolean" }).notNull().default(true),
});

// ─── System Config ────────────────────────────────────────────────────────────
export const systemConfig = sqliteTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  amountDefault: integer("amount_default"),
  exchangeRate: real("exchange_rate"),
  description: text("description"),
  date: text("date").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Cleanup Tokens ───────────────────────────────────────────────────────────
export const cleanupTokens = sqliteTable("cleanup_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope", { enum: ["transactions", "orphaned"] }).notNull(),
  consumed: integer("consumed").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(new Date()),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  performedBy: integer("performed_by").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  scope: text("scope"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at").notNull().default(new Date()),
});

// ─── Relations ──────────────────────────────────────────────────────────────
export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const currenciesRelations = relations(currencies, ({ many }) => ({
  transactions: many(transactions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  settings: many(settings),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────
export type UserType = typeof users.$inferSelect;
export type InsertUserType = typeof users.$inferInsert;
export type CategoryType = typeof categories.$inferSelect;
export type InsertCategoryType = typeof categories.$inferInsert;
export type TransactionType = typeof transactions.$inferSelect;
export type InsertTransactionType = typeof transactions.$inferInsert;