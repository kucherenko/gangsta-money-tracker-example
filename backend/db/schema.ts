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

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amount: real("amount").notNull(),
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

// ─── Categories ───────────────────────────────────────────────────────────────
export type UserType = typeof users.$inferSelect;
export type InsertUserType = typeof users.$inferInsert;
export type CategoryType = typeof categories.$inferSelect;
export type InsertCategoryType = typeof categories.$inferInsert;
export type TransactionType = typeof transactions.$inferSelect;
export type InsertTransactionType = typeof transactions.$inferInsert;
