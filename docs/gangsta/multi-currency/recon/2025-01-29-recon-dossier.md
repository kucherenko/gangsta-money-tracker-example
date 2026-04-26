---
heist: multi-currency
date: 2025-01-29
status: pending-review
---

# Reconnaissance Dossier: Multi-Currency Transaction Tracking

## Objective
Add ability to track transactions in different currencies. Save amount in selected currency AND amount in default currency. All financial aggregation (dashboard, totals, charts) must work in the default currency.

## Codebase Overview

**Architecture:** Bun monorepo with workspace packages (`frontend`, `backend`, `shared`)

**Backend:**
- **Framework:** Hono 4.7, TypeScript
- **DB:** Bun SQLite via `drizzle-orm` (raw SQL queries mostly via helper functions, not Drizzle query builder)
- **Auth:** JWT-like token via password auth + bcrypt
- **Routes:** `auth`, `transactions`, `categories`, `dashboard`
- **Schema:** Drizzle SQLite schema (`backend/db/schema.ts`) + raw SQL table init (`backend/db/index.ts`)
- **Tests:** `bun test` using Hono testClient, SQLite reset per test suite

**Frontend:**
- **Framework:** Svelte 5 with runes (`$state`, `$derived`, `$props`)
- **Build:** Vite 6 + Tailwind + `vite-plugin-pwa`
- **State:** Class-based rune stores in `frontend/src/state/*.svelte.ts`
- **API:** Plain fetch wrapper (`frontend/src/lib/api.ts`)
- **Currency formatting:** Hardcoded `new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` in multiple places

**Shared:**
- **Zod schemas:** `shared/schemas.ts` — defines transaction, category, user, dashboard types

## Current Data Model

### Transactions table (`backend/db/schema.ts` line 23-31, `backend/db/index.ts` line 30-38):
```typescript
// Drizzle
transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amount: real("amount").notNull(),
  description: text("description"),
  date: text("date").notNull(),         // YYYY-MM-DD
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

// Raw SQL init (backend/db/index.ts)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  created_at INTEGER DEFAULT (unixepoch())
);
```

### Shared Zod schema (`shared/schemas.ts` line 47-72):
```typescript
export const transactionSchema = z.object({
  id: z.number().int(),
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  date: z.string().datetime(),
  type: transactionTypeSchema,
  categoryId: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
});

export const insertTransactionSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  type: transactionTypeSchema,
  categoryId: z.number().int().optional(),
});
```

### Dashboard schema (`shared/schemas.ts` line 76-98):
```typescript
export const dashboardSchema = z.object({
  currentBalance: z.number(),
  monthIncome: z.number(),
  monthExpense: z.number(),
  yearIncome: z.number(),
  yearExpense: z.number(),
  monthlyTrend: z.array(...),
  categoryBreakdown: z.array(...),
});
```

## Existing Test Coverage

- `backend/tests/api.test.ts` — covers health, auth login, transactions CRUD, dashboard, protected routes
- Frontend tests run via `vitest` (`frontend/package.json` line 10: `"test": "vitest"`)
- No frontend unit tests currently written (only infra configured)
- All backend tests currently pass

## Key Files to Modify

### Schema & DB
1. `backend/db/schema.ts` — Add `currency`, `amountDefault`, `exchangeRate` columns
2. `backend/db/index.ts` — Update raw SQL init + migration for existing DB

### Shared Schemas
3. `shared/schemas.ts` — Update transaction schemas to include currency fields

### Backend Routes
4. `backend/routes/transactions.ts` — CRUD with currency conversion logic
5. `backend/routes/dashboard.ts` — Use `amountDefault` for all aggregation
6. `backend/routes/categories.ts` — Likely no changes needed

### Frontend
7. `frontend/src/lib/api.ts` — No structural changes (pass-through data), possibly update types
8. `frontend/src/routes/TransactionForm.svelte` — Add currency selector, exchange rate display
9. `frontend/src/routes/Transactions.svelte` — Show both amounts or default currency amount
10. `frontend/src/routes/Dashboard.svelte` — No changes needed if backend returns defaults
11. `frontend/src/components/BalanceCard.svelte` — Currency formatting should use dynamic currency
12. `frontend/src/state/transactions.svelte.ts` — No changes needed

### Settings / Default Currency
13. `frontend/src/routes/Settings.svelte` — Add default currency setting
14. `backend/db/schema.ts` + SQL — Add `settings` table or extend `users` with `defaultCurrency`
15. `backend/routes/auth.ts` — Return default currency on login
16. `backend/routes/settings.ts` — New route for CRUD settings

### Tests
17. `backend/tests/api.test.ts` — Add currency tests

## Dependency Inventory
- `zod` (both packages) — schema validation
- `drizzle-orm` + `drizzle-kit` — ORM + migrations
- `hono` — backend framework
- `bun:sqlite` — SQLite driver
- No existing currency/exchange rate library

## Currency Handling Options

### Option A: Static default currency (stored per user)
- User picks default currency in settings
- Exchange rate is entered manually per transaction
- Both `amount` (in selected currency) and `amountDefault` (in default currency) stored
- Simple, no external API dependency

### Option B: Exchange rate auto-fetched
- Integrate a free exchange rate API (exchangerate-api.com, frankfurter.app)
- Real-time conversion at transaction creation
- More complex, introduces network dependency and external service failure risk

**Recommendation:** Option A — manual exchange rate per transaction. Matches Don's request: "save amount in selected currency and amount in default currency." Exchange rate can be auto-suggested from a cached API but user can override. This keeps the feature robust and offline-capable.

## Default Currency Candidates
EUR, USD, GBP, JPY, CAD, AUD, CHF, PLN, CZK, HUF, RON, BGN, SEK, NOK, DKK, HRK

## Risks and Unknowns
1. **Existing data migration:** Current `transactions` table has `amount` column. Need to decide:
   - Rename `amount` to `amountDefault` and add `amountLocal`? OR
   - Keep `amount` = amount in selected currency, add `amountDefault` for default currency
   - **Recommendation:** Keep `amount` = original amount, add `amountDefault` + `currency` + `exchangeRate`. Backfill existing: set `currency = "USD"`, `amountDefault = amount`, `exchangeRate = 1`.

2. **Database migration strategy:** Bun SQLite with no proper migration tool applied (drizzle-kit generates but code uses raw SQL init). Need a migration approach for adding columns to existing DBs.

3. **Dashboard aggregation:** All existing `.reduce(sum)` logic in `dashboard.ts` uses `t.amount`. Must switch to `t.amount_default`.

4. **Format currency globally:** Currently hardcoded USD everywhere. Need a shared utility function + reactive default currency from settings.

## Recommended Scope

1. **Backend:**
   - Add `currency` (text, default "USD"), `amountDefault` (real, same as amount), `exchangeRate` (real, default 1) to `transactions` table
   - Create `settings` table with `userId`, `defaultCurrency` (default "USD"), `defaultExchangeRateSource` (optional)
   - Update transaction CREATE/READ/UPDATE routes to handle currency fields
   - Update dashboard route to use `amountDefault` for aggregation
   - Add settings route (GET/PUT default currency)

2. **Shared:**
   - Update Zod schemas for transaction (insert, update, read) with currency fields
   - Add settings Zod schema

3. **Frontend:**
   - Add currency selector to TransactionForm
   - Display exchange rate field (auto-calculated from amount / amountDefault, editable)
   - Show currency in Transactions list
   - Add default currency setting to Settings page
   - Create shared currency formatter utility
   - Update BalanceCard and Dashboard to respect default currency

4. **Tests:**
   - Backend tests for currency fields on create/update
   - Dashboard tests verify aggregation uses amountDefault

## Ledger Entries
- No relevant prior insights or fails found for multi-currency features.
