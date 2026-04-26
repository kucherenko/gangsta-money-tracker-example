---
heist: multi-currency
date: 2025-01-29
total-work-packages: 18
territories: 4
estimated-total-budget: 18000
---

# Execution Plan: Multi-Currency Transaction Tracking

## Git Isolation

- **Branch**: `heist/multi-currency` (created from `main`)
- **Worktrees**: Not needed for this scope (single workspace)

## Baseline Verification

| Check | Status | Notes |
|-------|--------|-------|
| Backend tests | ❌ FAIL | `Export named 'db' not found` in test import. Pre-existing bug in `backend/tests/api.test.ts` — test imports `{ db }` from `../db` but `db/index.ts` does not export `db`. |
| Frontend tests | ❌ No tests | 0 test files found — empty test suite |
| DB file | ✅ EXISTS | `backend/db/data.sqlite` exists with data |
| Dependencies | ✅ OK | `bun install` completes successfully |
| Branch | ✅ CREATED | `heist/multi-currency` active |

**Pre-existing test failure** is a non-blocker. The `api.test.ts` imports `{ db }` from `../db` but `db/index.ts` exports `client`, `query`, `run`, `getOne`, `insert`, `lastInsertedRow` — no `db`.

## Territories

### Territory: Infrastructure & Schema (DataCapo)
**Domain:** Database schema, migrations, shared Zod schemas, rates table, settings table, currencies table
**Files:**
- `backend/db/schema.ts`
- `backend/db/index.ts`
- `shared/schemas.ts`
- `backend/db/seed.ts`
**Workers:** 2 parallel
**Budget:** 4000 tokens

### Territory: Backend API (ApiCapo)
**Domain:** Settings API, rates API, rate fetcher service, updated transaction CRUD, dashboard aggregation, currencies API, scheduler
**Files:**
- `backend/routes/settings.ts`
- `backend/routes/rates.ts`
- `backend/routes/currencies.ts`
- `backend/services/rateFetcher.ts`
- `backend/routes/transactions.ts`
- `backend/routes/dashboard.ts`
- `backend/server.ts`
- `backend/middleware/auth.ts`
**Workers:** 3 parallel
**Budget:** 6000 tokens

### Territory: Frontend Components (UiCapo)
**Domain:** Currency formatting utility, currency select component, settings integration, dashboard rate display, updated transaction list display
**Files:**
- `frontend/src/lib/currency.ts`
- `frontend/src/components/CurrencySelect.svelte`
- `frontend/src/routes/Settings.svelte`
- `frontend/src/routes/Dashboard.svelte`
- `frontend/src/routes/Transactions.svelte`
- `frontend/src/components/BalanceCard.svelte`
- `frontend/src/lib/api.ts`
- `frontend/src/state/settings.svelte.ts`
- `frontend/src/state/rates.svelte.ts`
**Workers:** 3 parallel
**Budget:** 5000 tokens

### Territory: Transaction Form (FeatureCapo)
**Domain:** Currency selector on transaction form, rate display/edit, amount_default preview, create/edit with currency fields, validation
**Files:**
- `frontend/src/routes/TransactionForm.svelte`
**Workers:** 1-2 parallel
**Budget:** 3000 tokens

---

## Work Packages

### WP-001: Database Schema + Migration
**Territory:** Infrastructure & Schema
**Contract Clause:** Schema definition (DB section)
**Files:**
- Modify: `backend/db/schema.ts`
- Modify: `backend/db/index.ts`
**Acceptance Criteria:**
1. `currencies` table created with all columns from Contract schema
2. `transactions` table has new columns: `currency`, `amount_default`, `exchange_rate`
3. `exchange_rates` table created with `UNIQUE(base_currency, target_currency)`
4. `settings` table created with all columns
5. `initDb()` includes ALTER TABLE for existing DBs + backfill migration
6. Drizzle schema (`schema.ts`) matches raw SQL schema in `index.ts`
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/backend
rm -f db/data.sqlite db/data.sqlite-shm db/data.sqlite-wal
# Run to init fresh DB
bun run dev &
sleep 2
# Verify tables exist
sqlite3 db/data.sqlite ".tables" | grep -E "currencies|exchange_rates|settings|transactions"
# Verify columns
sqlite3 db/data.sqlite "PRAGMA table_info(transactions)" | grep -E "currency|amount_default|exchange_rate"
```
**Budget:** 800 tokens
**Dependencies:** None

---

### WP-002: Seed Data — Currencies Table
**Territory:** Infrastructure & Schema
**Contract Clause:** FR-013 (seed 20 fiat + 5 crypto)
**Files:**
- Modify: `backend/db/seed.ts`
**Acceptance Criteria:**
1. 20 fiat currencies seeded with correct code/name/symbol/precision/type
2. 5 crypto currencies seeded with correct precision
3. Seed is idempotent (running again doesn't duplicate)
4. "USD" is marked as the first/default currency
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/backend
sqlite3 db/data.sqlite "SELECT COUNT(*) FROM currencies" # should be 25
sqlite3 db/data.sqlite "SELECT code, precision, type FROM currencies WHERE code = 'USD'"
```
**Budget:** 400 tokens
**Dependencies:** WP-001

---

### WP-003: Shared Zod Schemas
**Territory:** Infrastructure & Schema
**Contract Clause:** FR-001 through FR-012 (input/output validation)
**Files:**
- Modify: `shared/schemas.ts`
**Acceptance Criteria:**
1. `currencySchema` — validates code (max 10 chars), name, symbol, precision, type
2. `insertCurrencySchema` — for admin creating custom currencies
3. `transactionSchema` updated with `currency`, `amountDefault`, `exchangeRate`
4. `insertTransactionSchema` updated with currency fields (optional with defaults)
5. `updateTransactionSchema` updated with currency fields
6. `settingsSchema` — for GET/PUT user settings
7. `exchangeRateSchema` — for rate data validation
8. All schemas imported successfully from both frontend and backend
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money
bun run --cwd frontend build
bun run --cwd backend dev &
```
**Budget:** 600 tokens
**Dependencies:** None

---

### WP-004: Currencies API Routes
**Territory:** Backend API
**Contract Clause:** FR-012 (admin adds currencies)
**Files:**
- Create: `backend/routes/currencies.ts`
**Acceptance Criteria:**
1. `GET /currencies` — returns all active currencies
2. `GET /currencies?type=fiat|crypto` — filtered by type
3. `POST /currencies` — admin creates custom currency (Zod validated)
4. `GET /currencies/:code` — returns single currency
5. Protected by auth middleware
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/backend
bun test
# Or manual:
curl -H "Authorization: Bearer <token>" http://localhost:3001/currencies
```
**Budget:** 500 tokens
**Dependencies:** WP-001, WP-002, WP-003

---

### WP-005: Settings API Routes
**Territory:** Backend API
**Contract Clause:** FR-017 (settings page)
**Files:**
- Create: `backend/routes/settings.ts`
**Acceptance Criteria:**
1. `GET /settings` — returns current user settings (default currency, intervals)
2. `PUT /settings` — updates settings, validates with Zod
3. On default currency change: triggers recalculation of ALL transactions
4. Settings row created on first login if missing
5. Protected by auth middleware
**Verification:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/settings
curl -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"defaultCurrency":"EUR"}' http://localhost:3001/settings
sqlite3 db/data.sqlite "SELECT default_currency FROM settings"
```
**Budget:** 600 tokens
**Dependencies:** WP-001, WP-002, WP-003

---

### WP-006: Rate Fetcher Service
**Territory:** Backend API
**Contract Clause:** FR-006, FR-007, FR-014 (rate fetching and caching)
**Files:**
- Create: `backend/services/rateFetcher.ts`
**Acceptance Criteria:**
1. Fetches frankfurter.app rates for all fiat seed currencies hourly
2. Fetches CoinGecko rates for crypto currencies every 5 minutes
3. Stores rates in `exchange_rates` (global cache, not per-user)
4. Validates API response before storing (shape check)
5. Gracefully degrades on API failure (logs error, keeps stale cache)
6. Non-blocking: fetch runs in background, doesn't block request handling
7. One global fetch loop, not per-user
**Verification:**
```bash
# After server starts, check rates are cached
sqlite3 /Users/apk/Workspace/lab/money/backend/db/data.sqlite \
  "SELECT base_currency, target_currency, rate, source FROM exchange_rates LIMIT 5"
```
**Budget:** 1000 tokens
**Dependencies:** WP-001, WP-002

---

### WP-007: Rates API Routes
**Territory:** Backend API
**Contract Clause:** FR-015, FR-016 (rate display + staleness warning)
**Files:**
- Create: `backend/routes/rates.ts`
**Acceptance Criteria:**
1. `GET /rates` — returns all cached rates
2. `GET /rates/:base/:target` — returns specific rate
3. Response includes `updatedAt` timestamp for staleness calculation
4. If rate doesn't exist, returns 404 — no auto-fetch on request
5. Protected by auth middleware
**Verification:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/rates
curl -H "Authorization: Bearer <token>" http://localhost:3001/rates/USD/EUR
```
**Budget:** 400 tokens
**Dependencies:** WP-005, WP-006

---

### WP-008: Updated Transaction CRUD
**Territory:** Backend API
**Contract Clause:** FR-001 through FR-011
**Files:**
- Modify: `backend/routes/transactions.ts`
**Acceptance Criteria:**
1. `POST /transactions` accepts new fields: `currency`, `amount`, `amountDefault`, `exchangeRate`
2. If `currency` is omitted, defaults to settings default currency
3. If `amountDefault` is omitted, backend computes from rate
4. `GET /transactions` returns `currency`, `amountDefault`, `exchangeRate` in response
5. `PUT /transactions/:id` updates currency fields
6. `transformTransaction` includes new fields
7. All financial aggregation in list endpoint unaffected (just added columns)
8. Zod validation via shared schemas
**Verification:**
```bash
# Create transaction in EUR
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"amount":10000,"currency":"EUR","description":"Test","date":"2025-01-29","type":"expense","exchangeRate":1.08}' \
  http://localhost:3001/transactions
```
**Budget:** 700 tokens
**Dependencies:** WP-001, WP-002, WP-003, WP-005

---

### WP-009: Updated Dashboard Aggregation
**Territory:** Backend API
**Contract Clause:** FR-010 (all totals use amount_default)
**Files:**
- Modify: `backend/routes/dashboard.ts`
**Acceptance Criteria:**
1. All `reduce(sum)` calls use `amount_default` instead of `amount`
2. `COALESCE(amount_default, amount)` safety net for un-migrated rows
3. Category breakdown uses `amount_default`
4. Monthly trend uses `amount_default`
5. Response shape unchanged (no breaking change for frontend)
**Verification:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/dashboard
# Verify totals are in default currency
```
**Budget:** 400 tokens
**Dependencies:** WP-001, WP-008

---

### WP-010: Backend Test Updates
**Territory:** Backend API
**Contract Clause:** FR test coverage
**Files:**
- Modify: `backend/tests/api.test.ts`
**Acceptance Criteria:**
1. Fix pre-existing `db` import error (change `import { db }` to `import { client }` or add `export const db = client`)
2. Test creates a transaction with `currency` field
3. Transaction list includes currency info
4. Dashboard totals are in default currency
5. All existing tests still pass
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/backend
bun test
```
**Budget:** 500 tokens
**Dependencies:** WP-008, WP-009 (can fix test import earlier)

---

### WP-011: Shared Currency Formatting Utility
**Territory:** Frontend Components
**Contract Clause:** AD-011 (formatCurrency utility)
**Files:**
- Create: `frontend/src/lib/currency.ts`
**Acceptance Criteria:**
1. `formatCurrency(amount: number, currencyCode: string): string` — divides by precision and formats
2. `convertAmount(amount: number, fromPrecision: number, toPrecision: number, rate: number): number` — conversion formula
3. `getCurrency(code: string)` — returns { code, name, symbol, precision, type }
4. Static currency list for offline use
5. Uses `Intl.NumberFormat` with correct currency code and symbol
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/frontend
# Import utility in a test or component, verify formatting:
# formatCurrency(1234, 'USD') → "$12.34"
# formatCurrency(5000000, 'BTC') → "₿0.05000000"
```
**Budget:** 400 tokens
**Dependencies:** WP-001, WP-002

---

### WP-012: Settings Store + API Client Updates
**Territory:** Frontend Components
**Contract Clause:** FR-017 (settings)
**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/state/settings.svelte.ts`
- Create: `frontend/src/state/rates.svelte.ts`
**Acceptance Criteria:**
1. API client has `getSettings()`, `updateSettings()`, `getCurrencies()`, `getRates()` methods
2. `settings.svelte.ts` — reactive store for default currency, intervals, auto-fetch
3. `rates.svelte.ts` — reactive store for cached exchange rates
4. Settings loaded on app init (after login)
5. Settings persist in localStorage as cache (load from server when online)
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/frontend
bun run --cwd . build
```
**Budget:** 500 tokens
**Dependencies:** WP-004, WP-005, WP-007

---

### WP-013: Updated Settings Page
**Territory:** Frontend Components
**Contract Clause:** FR-012, FR-017 (currency admin, default currency)
**Files:**
- Modify: `frontend/src/routes/Settings.svelte`
**Acceptance Criteria:**
1. Default currency selector (dropdown from `currencies` store)
2. Fiat fetch interval setting (minutes)
3. Crypto fetch interval setting (minutes)
4. Auto-fetch toggle
5. "Change default currency" button with confirmation dialog
6. Admin section for adding custom currencies (name, code, symbol, precision, type)
7. Visual warning if recalculation would happen (list of affected transaction count)
**Verification:**
```bash
# Manual browser test
# 1. Open Settings page
# 2. Change default currency from USD to EUR
# 3. Confirm popup shows recalculation warning
# 4. Verify backend re-calculates all transactions
```
**Budget:** 600 tokens
**Dependencies:** WP-012

---

### WP-014: Updated Dashboard
**Territory:** Frontend Components
**Contract Clause:** FR-018 (live rates section)
**Files:**
- Modify: `frontend/src/routes/Dashboard.svelte`
- Modify: `frontend/src/components/BalanceCard.svelte`
**Acceptance Criteria:**
1. BalanceCard formats with `formatCurrency` using default currency
2. Dashboard shows exchange rates section for used currencies
3. Rate section shows currency pair, current rate, and "updated X ago"
4. Visual warning (gray/orange badge) if rate is stale
5. All existing dashboard features preserved
**Verification:**
```bash
# Manual browser test
# 1. Open Dashboard
# 2. Verify amounts show default currency
# 3. Verify rates section appears for multi-currency transactions
```
**Budget:** 500 tokens
**Dependencies:** WP-009, WP-011, WP-012

---

### WP-015: Updated Transactions List
**Territory:** Frontend Components
**Contract Clause:** FR-011 (show both amounts)
**Files:**
- Modify: `frontend/src/routes/Transactions.svelte`
**Acceptance Criteria:**
1. Transaction row shows both original amount and default-currency amount
2. Original amount displayed with its currency symbol (e.g., "€100.00")
3. Default amount shown as primary, original amount as secondary (gray, smaller)
4. If currency == default, only show one amount
5. Currency selector added to filters
6. All existing filters and sorting preserved
**Verification:**
```bash
# Manual browser test
# 1. Open Transactions page
# 2. Verify EUR transaction shows "€100.00 ($108.00)"
# 3. Verify USD transaction shows "$50.00" only
```
**Budget:** 500 tokens
**Dependencies:** WP-008, WP-011, WP-012

---

### WP-016: Currency Select Component
**Territory:** Frontend Components
**Contract Clause:** FR-001 (currency selection)
**Files:**
- Create: `frontend/src/components/CurrencySelect.svelte`
**Acceptance Criteria:**
1. Dropdown showing all currencies with icon/symbol
2. Grouped by type (Fiat / Crypto)
3. Default currency pre-selected
4. Fires `onchange` event with selected currency code
5. Reusable for transaction form and settings
**Verification:**
```bash
# Manual browser test
# 1. Component renders with currency dropdown
# 2. Select EUR, verify event fires with "EUR"
```
**Budget:** 300 tokens
**Dependencies:** WP-012

---

### WP-017: Transaction Form with Currency
**Territory:** Transaction Form
**Contract Clause:** FR-002 through FR-011
**Files:**
- Modify: `frontend/src/routes/TransactionForm.svelte`
**Acceptance Criteria:**
1. Currency picker (dropdown from currencies)
2. Amount input in original currency (respects precision)
3. If currency ≠ default:
   - Show cached exchange rate from `rates` store
   - Show "updated X ago" timestamp
   - Rate is editable (number input, step=0.00001)
   - Show auto-calculated `amount_default` preview
   - Visual warning if rate is stale
4. If currency == default: hide rate section, `amount_default = amount`
5. Submit sends: `currency`, `amount`, `exchangeRate`, `amountDefault`
6. Edit mode pre-fills all currency fields
7. Validation via shared schemas
**Verification:**
```bash
# Manual browser test
# 1. Create transaction in EUR with rate 1.08
# 2. Verify amount_default = 10800 (in cents)
# 3. Edit transaction → change rate to 1.09
# 4. Verify amount_default updates
```
**Budget:** 1000 tokens
**Dependencies:** WP-008, WP-011, WP-012, WP-016

---

### WP-018: Server Integration + Route Mounting
**Territory:** Backend API
**Contract Clause:** Server wiring
**Files:**
- Modify: `backend/server.ts`
**Acceptance Criteria:**
1. New routes mounted: `/settings`, `/rates`, `/currencies`
2. Rate fetcher service started on server init (non-blocking)
3. Rate fetch loop runs at configured intervals
4. Server starts cleanly with all new routes
**Verification:**
```bash
cd /Users/apk/Workspace/lab/money/backend
bun run dev &
sleep 3
curl http://localhost:3001/health
# Verify routes are accessible
```
**Budget:** 200 tokens
**Dependencies:** WP-004, WP-005, WP-006, WP-007

---

## Execution Order

### Phase 1: Infrastructure (Sequential — 2 workers)
These provide foundation for everything else:
1. **WP-001** (schema + migration) — blocks all DB-dependent work
2. **WP-002** (seed data) — blocks any currency-dependent work
3. **WP-003** (shared schemas) — blocks all API routes
4. **WP-011** (format utility) — blocks all frontend display

### Phase 2: Backend API (Parallel — 3 workers after Phase 1)
Backend routes are independent once schema exists:
- **WP-004** (currencies API) — parallel
- **WP-005** (settings API) — parallel, depends on WP-002
- **WP-006** (rate fetcher) — parallel, depends on WP-002
- **WP-008** (transactions CRUD) — depends on WP-005 for default currency
- **WP-009** (dashboard) — depends on WP-008
- **WP-018** (server integration) — depends on all backend routes

### Phase 3: Frontend Stores + Utility (Parallel — 2 workers after Phase 2)
- **WP-012** (settings + rates stores) — depends on backend API being available
- **WP-016** (currency select component) — depends on WP-012

### Phase 4: Frontend Features (Parallel — 3 workers after Phase 3)
- **WP-013** (settings page) — depends on WP-012
- **WP-014** (dashboard) — depends on WP-012 + WP-009
- **WP-015** (transactions list) — depends on WP-012 + WP-008
- **WP-017** (transaction form) — depends on WP-012 + WP-016 + WP-008

### Phase 5: Integration + Tests (After Phase 2 and 4)
- **WP-010** (backend tests) — depends on WP-008 + WP-009, can be done any time after those
- End-to-end integration testing

---

## Critical Path
WP-001 → WP-002 → WP-003 → Phase 2 starts → Phase 3 → Phase 4 → Phase 5

Minimum sequential path: ~6 work packages before any UI appears with real data.

**Optimizations:**
- WP-011 (format utility) can start in Phase 1 (no backend dependency)
- WP-016 (currency select) can start in Phase 3 (needs API client, not backend per se)
- WP-013 (settings page) can start as soon as WP-012 has the store structure
