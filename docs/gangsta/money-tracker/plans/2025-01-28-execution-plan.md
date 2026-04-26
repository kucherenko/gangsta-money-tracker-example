---
heist: money-tracker
date: 2025-01-28
total-work-packages: 27
territories: 4
estimated-total-budget: 15000
---

# Execution Plan: Money Tracker PWA

## Territories

### Territory: Infrastructure & Data (DataCapo)
**Domain:** Monorepo workspace setup, database schema, ORM config, shared schemas, migrations
**Files:**
- `package.json` (root)
- `shared/`
- `backend/db/`
- `backend/drizzle.config.ts`
**Work Packages:** WP-001, WP-002, WP-003, WP-004, WP-005
**Workers:** 2-3 parallel
**Budget:** 2500 tokens
**Crew Lead:** @DataCapo

### Territory: Backend API (ApiCapo)
**Domain:** Hono server setup, middleware, REST API routes, auth, business logic
**Files:**
- `backend/server.ts`
- `backend/middleware/`
- `backend/routes/`
- `backend/tests/`
**Work Packages:** WP-006, WP-007, WP-008, WP-009, WP-010, WP-015, WP-016
**Workers:** 3-4 parallel (after WP-001 completes)
**Budget:** 4500 tokens
**Crew Lead:** @ApiCapo

### Territory: Frontend Foundation (UiCapo)
**Domain:** Vite setup, Tailwind, shadcn-svelte, stores, API client, routing, auth pages
**Files:**
- `frontend/vite.config.ts`
- `frontend/index.html`
- `frontend/src/App.svelte`
- `frontend/src/lib/*.ts`
- `frontend/src/state/*.svelte.ts`
- `frontend/src/routes/Login.svelte`
- `frontend/src/style.css`
- `frontend/tailwind.config.{js,ts}`
**Work Packages:** WP-011, WP-012, WP-013, WP-014
**Workers:** 3 parallel (after WP-001 completes)
**Budget:** 3500 tokens
**Crew Lead:** @UiCapo

### Territory: Frontend Features (FeatureCapo)
**Domain:** Transaction pages, dashboard, categories, charts, settings, PWA
**Files:**
- `frontend/src/routes/Dashboard.svelte`
- `frontend/src/routes/Transactions.svelte`
- `frontend/src/routes/TransactionForm.svelte`
- `frontend/src/routes/Settings.svelte`
- `frontend/src/components/*.svelte`
**Work Packages:** WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-025, WP-026
**Workers:** 4-5 parallel (after WP-013 completes)
**Budget:** 4500 tokens
**Crew Lead:** @FeatureCapo

---

## Work Packages

### WP-001: Root Monorepo Workspace Setup
**Territory:** Infrastructure & Data
**Contract Clause:** Architectural Decision 1
**Files:**
- Create: `package.json` (root)
- Create: `README.md` (root)
**Acceptance Criteria:**
1. `bun install` completes successfully at root.
2. Workspace packages `@money-tracker/frontend`, `@money-tracker/backend`, `@money-tracker/shared` are hoisted.
3. `frontend/` and `backend/` and `shared/` directories exist.
**Verification:** `bun install && test -d node_modules/@money-tracker/frontend`
**Budget:** 500 tokens
**Dependencies:** None

### WP-002: Shared Zod Schemas
**Territory:** Infrastructure & Data
**Contract Clause:** FR-002, FR-005, FR-CAT-002
**Files:**
- Create: `shared/schemas.ts`
- Create: `shared/index.ts`
- Create: `shared/package.json`
**Acceptance Criteria:**
1. `insertTransactionSchema`, `insertCategorySchema`, `loginSchema`, `userSchema` are defined.
2. All schemas compile with TypeScript. No Drizzle imports.
3. `shared` exports are importable from both `frontend` and `backend`.
**Verification:** `bun run --cwd frontend build` (imports shared without error)
**Budget:** 500 tokens
**Dependencies:** WP-001

### WP-003: Drizzle Schema + DB Client
**Territory:** Infrastructure & Data
**Contract Clause:** FR-TX-001, FR-CAT-001, NFR-REL-002
**Files:**
- Create: `backend/db/schema.ts`
- Create: `backend/db/index.ts`
- Create: `backend/drizzle.config.ts`
**Acceptance Criteria:**
1. `transactions` table with columns: id, amount, description, date, type, categoryId (FK), createdAt.
2. `categories` table with columns: id, name, color, icon, type.
3. `users` table with columns: id, username, passwordHash, token (or token field).
4. Indexes defined: transactions.date, transactions.categoryId, transactions.type, categories.type.
5. `better-sqlite3` driver configured in Drizzle client using `bun:sqlite`.
6. Drizzle config points to SQLite file `backend/db/data.sqlite`.
**Verification:** `bun run --cwd backend db:generate` produces SQL migration file(s).
**Budget:** 800 tokens
**Dependencies:** WP-002

### WP-004: Drizzle Migrations
**Territory:** Infrastructure & Data
**Contract Clause:** NFR-REL-002, NFR-REL-003
**Files:**
- Create: `backend/db/migrations/0000_init.sql`
- Modify: `backend/drizzle.config.ts`
**Acceptance Criteria:**
1. `drizzle-kit migrate` applies migrations against an empty SQLite file.
2. After migration, all tables exist with correct columns.
3. If `data.sqlite` is deleted and server starts, migrations auto-run and create DB.
**Verification:** `rm -f backend/db/data.sqlite && bun run --cwd backend db:migrate && sqlite3 backend/db/data.sqlite ".tables"` shows tables.
**Budget:** 400 tokens
**Dependencies:** WP-003

### WP-005: Seed Data (Default Categories + Admin User)
**Territory:** Infrastructure & Data
**Contract Clause:** FR-CAT-001, FR-AUTH-001
**Files:**
- Create: `backend/db/seed.ts`
- Modify: `backend/db/index.ts` or server.ts to call seed on first run
**Acceptance Criteria:**
1. Default categories seeded: Salary, Freelance, Food, Transport, Utilities, Entertainment, Shopping, Health, Education, Other.
2. Each default category has name, color, type (income/expense accordingly), and icon.
3. Admin user created with username "admin" and password "admin" (hashed with bcrypt).
4. Seed is idempotent (running again doesn't duplicate).
**Verification:** `bun run --cwd backend dev` then `sqlite3 backend/db/data.sqlite "SELECT name FROM categories"` returns 10 rows.
**Budget:** 300 tokens
**Dependencies:** WP-004

### WP-006: Hono Server Bootstrap
**Territory:** Backend API
**Contract Clause:** NFR-PERF-002, NFR-REL-001
**Files:**
- Create: `backend/server.ts`
**Acceptance Criteria:**
1. Bun starts a Hono server on port 3001.
2. Health endpoint `GET /health` returns `{ status: "ok" }`.
3. Global error handler catches uncaught exceptions and returns JSON error response.
4. Graceful shutdown: server closes DB connection on SIGTERM.
**Verification:** `bun run --cwd backend dev` → `curl http://localhost:3001/health` returns 200 OK.
**Budget:** 400 tokens
**Dependencies:** WP-001, WP-004

### WP-007: Middleware Stack (CORS, Logger, Error Handler, Auth)
**Territory:** Backend API
**Contract Clause:** FR-AUTH-003, NFR-SEC-004, NFR-REL-001
**Files:**
- Create: `backend/middleware/cors.ts`
- Create: `backend/middleware/logger.ts`
- Create: `backend/middleware/errorHandler.ts`
- Create: `backend/middleware/auth.ts`
**Acceptance Criteria:**
1. CORS allows the frontend origin (configurable, default `http://localhost:5173`).
2. Logger middleware logs request method, path, status, duration.
3. Error handler catches Zod validation errors and returns structured JSON with field-level messages.
4. Auth middleware reads `Bearer <token>`, validates against `users` table, and attaches `userId` to context.
5. Missing/invalid token returns 401.
**Verification:** `curl -H "Authorization: Bearer fake" http://localhost:3001/health` returns 401 (if health is protected in test route).
**Budget:** 600 tokens
**Dependencies:** WP-006

### WP-008: Auth Routes (Login)
**Territory:** Backend API
**Contract Clause:** FR-AUTH-001, FR-AUTH-002, NFR-SEC-005
**Files:**
- Create: `backend/routes/auth.ts`
- Modify: `backend/server.ts` (mount route)
**Acceptance Criteria:**
1. `POST /auth/login` accepts `{ username, password }`.
2. Validates with Zod `loginSchema`.
3. Hashes incoming password with bcrypt (cost 12) and compares to stored hash.
4. On success, returns `{ token }` where token is a random UUID or JWT.
5. Token stored in the `users` table for lookup.
6. On failure, returns 401.
**Verification:** `curl -X POST -d '{"username":"admin","password":"admin"}' http://localhost:3001/auth/login` returns token.
**Budget:** 500 tokens
**Dependencies:** WP-007, WP-005

### WP-009: Transaction Routes
**Territory:** Backend API
**Contract Clause:** FR-TX-001 through FR-TX-012
**Files:**
- Create: `backend/routes/transactions.ts`
**Acceptance Criteria:**
1. `GET /transactions` — supports pagination (`page`, `limit`), filtering (`dateFrom`, `dateTo`, `categoryId`, `type`), sorting (`sortBy`, `sortOrder`).
2. `GET /transactions/:id` — returns single transaction.
3. `POST /transactions` — creates transaction, validates with Zod, returns 201 + created resource.
4. `PUT /transactions/:id` — updates transaction.
5. `DELETE /transactions/:id` — deletes transaction, returns 204.
6. All routes protected by auth middleware.
7. Zod schema validation via `zValidator` on POST/PUT.
**Verification:** API integration tests pass: `bun run --cwd backend test`.
**Budget:** 800 tokens
**Dependencies:** WP-008

### WP-010: Category Routes
**Territory:** Backend API
**Contract Clause:** FR-CAT-001 through FR-CAT-006
**Files:**
- Create: `backend/routes/categories.ts`
**Acceptance Criteria:**
1. `GET /categories` — returns all categories.
2. `POST /categories` — creates custom category with Zod validation.
3. `PUT /categories/:id` — updates custom category.
4. `DELETE /categories/:id` — deletes custom category (warns on frontend, backend allows).
5. Predefined categories cannot be modified (identified by `isPredefined` flag).
6. All routes protected.
**Verification:** `bun run --cwd backend test` passes category CRUD.
**Budget:** 600 tokens
**Dependencies:** WP-009 (can run in parallel if DB schema has categories)

### WP-011: Vite + PWA + Tailwind Configuration
**Territory:** Frontend Foundation
**Contract Clause:** FR-PWA-001, FR-PWA-002, FR-PWA-003
**Files:**
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/style.css`
- Create: `frontend/public/manifest.json`
**Acceptance Criteria:**
1. `vite.config.ts` configures `vite-plugin-pwa` with precache strategy, manifest injection.
2. `tailwind.config.ts` uses content glob for `frontend/src/**/*.svelte`.
3. `index.html` has viewport meta, theme color, and references manifest.
4. PWA icons (192x192, 512x512) placed in `frontend/public/icons/`.
5. `bun run --cwd frontend dev` serves the app on `http://localhost:5173`.
**Verification:** `bun run --cwd frontend build` completes, `frontend/dist/manifest.webmanifest` exists.
**Budget:** 600 tokens
**Dependencies:** WP-001

### WP-012: API Client + Interceptors
**Territory:** Frontend Foundation
**Contract Clause:** FR-AUTH-003, FR-AUTH-004
**Files:**
- Create: `frontend/src/lib/api.ts`
**Acceptance Criteria:**
1. Typed API client using plain `fetch`.
2. Reads `token` from reactive `$state` in auth store.
3. Interceptor adds `Authorization: Bearer <token>` header automatically.
4. On 401, redirects to `/login`.
5. On network error (offline), triggers `navigator.onLine` check and shows offline banner.
6. Exported functions: `getTransactions(filter)`, `createTransaction(data)`, `updateTransaction(id, data)`, `deleteTransaction(id)`, `getCategories()`, `createCategory(data)`, `updateCategory(id, data)`, `deleteCategory(id)`, `login(credentials)`.
**Verification:** Unit test: mock fetch with vitest, verify auth header injection.
**Budget:** 400 tokens
**Dependencies:** WP-011, WP-002

### WP-013: Svelte 5 Runes-Based State Management + Auth Store
**Territory:** Frontend Foundation
**Contract Clause:** Architectural Decision 2 (Svelte 5 runes)
**Files:**
- Create: `frontend/src/state/auth.svelte.ts`
- Create: `frontend/src/state/transactions.svelte.ts`
- Create: `frontend/src/state/categories.svelte.ts`
- Create: `frontend/src/state/dashboard.svelte.ts`
**Acceptance Criteria:**
1. `auth.svelte.ts`: `$state` for token and isLoggedIn. `$derived` for isAuthenticated. login/logout functions.
2. `transactions.svelte.ts`: `$state` for list array, filter state. `$derived` for filtered transactions. CRUD operations call `api.ts`, update state reactively.
3. `categories.svelte.ts`: Same pattern.
4. `dashboard.svelte.ts`: `$derived` for balance, month totals, chart data computed from transaction state.
5. No legacy `writable`/`readable` stores used.
**Verification:** Vitest unit tests for store logic (via exported pure functions if needed, since Svelte stores test best in integration).
**Budget:** 500 tokens
**Dependencies:** WP-012

### WP-014: App Shell + Routing + Login Page
**Territory:** Frontend Foundation
**Contract Clause:** FR-AUTH-001, FR-PWA-001
**Files:**
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.svelte`
- Create: `frontend/src/routes/Login.svelte`
- Create: `frontend/src/components/OfflineNotice.svelte`
**Acceptance Criteria:**
1. `App.svelte` is the root shell. Shows nav if authenticated.
2. Simple hash-based routing: `#/login`, `#/dashboard`, `#/transactions`, `#/settings`.
3. Guards: unauthenticated users redirect to `#/login`.
4. `Login.svelte` form with shadcn `Input` and `Button`.
5. On successful login, stores token via auth store, redirects to `#/dashboard`.
6. Offline banner appears when `navigator.onLine` is false.
**Verification:** E2E test with Playwright: visit `/`, redirect to `/login`, enter credentials, redirect to `/dashboard`.
**Budget:** 600 tokens
**Dependencies:** WP-013

### WP-015: Dashboard Aggregates API
**Territory:** Backend API
**Contract Clause:** FR-DASH-001, FR-DASH-002, FR-DASH-003
**Files:**
- Create: `backend/routes/dashboard.ts`
**Acceptance Criteria:**
1. `GET /dashboard` returns:
   - `currentBalance`
   - `monthIncome`, `monthExpense`
   - `yearIncome`, `yearExpense`
   - `monthlyTrend` (array of { month, income, expense } for last 6 months)
   - `categoryBreakdown` (array of { categoryId, name, total } for current month)
2. All computed in SQL for performance.
3. Protected by auth middleware.
**Verification:** `curl http://localhost:3001/dashboard` returns correct numbers after seeding transactions.
**Budget:** 500 tokens
**Dependencies:** WP-009

### WP-016: Backend API Tests
**Territory:** Backend API
**Contract Clause:** All API ACs
**Files:**
- Create: `backend/tests/api.test.ts`
**Acceptance Criteria:**
1. Hono `testClient` test suite covers: health, login, transactions CRUD, categories CRUD, dashboard aggregates.
2. Uses in-memory SQLite via `:memory:` or temp file.
3. Runs with `bun test`.
4. All tests pass.
**Verification:** `bun run --cwd backend test` — 0 failures.
**Budget:** 600 tokens
**Dependencies:** WP-015

### WP-017: Dashboard Page with Summary + Charts
**Territory:** Frontend Features
**Contract Clause:** FR-DASH-001 through FR-DASH-006
**Files:**
- Create: `frontend/src/routes/Dashboard.svelte`
- Create: `frontend/src/components/BalanceCard.svelte`
- Create: `frontend/src/components/MonthlyChart.svelte`
- Create: `frontend/src/components/CategoryChart.svelte`
**Acceptance Criteria:**
1. Fetches `/dashboard` data on mount via api client.
2. Shows balance, month income/expense cards with shadcn `Card` component.
3. Monthly bar chart (income vs expense) using LayerChart.
4. Category donut/pie chart using LayerChart.
5. Reactive: updating a transaction auto-updates dashboard via `$derived` state.
6. Responsive layout (mobile-first).
**Verification:** Lighthouse PWA audit + visual inspection.
**Budget:** 700 tokens
**Dependencies:** WP-014, WP-015

### WP-018: Transactions List Page
**Territory:** Frontend Features
**Contract Clause:** FR-TX-009, FR-TX-010, FR-TX-011
**Files:**
- Create: `frontend/src/routes/Transactions.svelte`
- Create: `frontend/src/components/TransactionRow.svelte`
- Create: `frontend/src/components/Pagination.svelte`
**Acceptance Criteria:**
1. Fetches transactions with pagination.
2. Supports filtering by date range (shadcn `Calendar` or date inputs), category select, and type toggle.
3. Supports sorting by date/amount/description.
4. Transaction rows show amount (color-coded: green income, red expense), category badge, description, date.
5. Pagination controls: prev/next, page count.
**Verification:** E2E test: load page, apply filter, verify filtered count.
**Budget:** 600 tokens
**Dependencies:** WP-017

### WP-019: Transaction Form (Add / Edit)
**Territory:** Frontend Features
**Contract Clause:** FR-TX-001 through FR-TX-007
**Files:**
- Create: `frontend/src/routes/TransactionForm.svelte`
- Create: `frontend/src/components/CategorySelect.svelte`
**Acceptance Criteria:**
1. Form fields: Amount (number input), Type (radio or toggle: income/expense), Date (date picker or input), Category (dropdown from categories store), Description (textarea).
2. Zod validation with inline error messages (shadcn `Form` components).
3. Submit creates transaction, redirects to `#/transactions`.
4. Edit mode pre-fills form, PUT on submit.
5. Delete button with shadcn `AlertDialog` confirmation.
6. Success toast via shadcn `Toast`.
**Verification:** E2E test: add transaction → verify in list.
**Budget:** 700 tokens
**Dependencies:** WP-018

### WP-020: Category Management Page
**Territory:** Frontend Features
**Contract Clause:** FR-CAT-001 through FR-CAT-006
**Files:**
- Create: `frontend/src/routes/Settings.svelte`
- Create: `frontend/src/components/CategoryBadge.svelte`
**Acceptance Criteria:**
1. Lists all categories with colour swatch, name, icon, type.
2. Predefined categories are read-only.
3. Custom categories have edit/delete buttons.
4. Add category form: name, colour picker, icon picker, type.
5. Edit category updates the category in the backend.
6. Delete shows warning if transactions are categorized.
**Verification:** E2E test: create category → verify in list → delete category.
**Budget:** 500 tokens
**Dependencies:** WP-019

### WP-021: shadcn-svelte Component Setup
**Territory:** Frontend Foundation / Features
**Contract Clause:** NFR-A11Y-004
**Files:**
- Create/Multiple: shadcn components in `frontend/src/components/ui/`
**Acceptance Criteria:**
1. Following shadcn-svelte docs (manual Vite install):
   - Tailwind configured with shadcn colour token CSS variables.
   - Components installed: `Button`, `Card`, `Input`, `Label`, `Dialog`, `AlertDialog`, `Toast`, `Badge`, `Select`, `Calendar` (or equivalent).
2. Each component is accessible (keyboard nav, ARIA labels).
3. Components tested for basic rendering.
**Verification:** Visual inspection + a11y audit on Storybook or manual test.
**Budget:** 1000 tokens
**Dependencies:** WP-011

### WP-022: PWA Manifest + Icons
**Territory:** Frontend Foundation
**Contract Clause:** FR-PWA-002, FR-PWA-003
**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/icons/icon-192x192.png`
- Create: `frontend/public/icons/icon-512x512.png`
**Acceptance Criteria:**
1. `manifest.json` has: name, short_name, start_url, display, background_color, theme_color, icons.
2. Icons are present at correct sizes.
3. `vite-plugin-pwa` injects manifest into build.
4. Lighthouse PWA audit shows manifest detected.
**Verification:** `bun run --cwd frontend build` → `frontend/dist/manifest.webmanifest` generated.
**Budget:** 300 tokens
**Dependencies:** WP-021

### WP-023: Offline Banner
**Territory:** Frontend Features
**Contract Clause:** FR-PWA-005
**Files:**
- Create: `frontend/src/components/OfflineNotice.svelte` (modify from WP-014)
**Acceptance Criteria:**
1. Detects `navigator.onLine` on mount and via window `online`/`offline` events.
2. Shows banner with message "No connection — some features unavailable.", dismissible.
3. When connection returns, banner disappears.
4. Form submission is blocked when offline.
**Verification:** Chrome DevTools Network > Offline mode test.
**Budget:** 200 tokens
**Dependencies:** WP-014

### WP-024: Frontend Unit Tests
**Territory:** Frontend Foundation
**Contract Clause:** NFR-PERF-003
**Files:**
- Create: `frontend/tests/unit/utils.test.ts`
- Create: `frontend/tests/unit/validators.test.ts`
**Acceptance Criteria:**
1. Currency formatter tests (e.g., `$1,234.56`).
2. Date formatter tests (e.g., `Jan 15, 2025`).
3. Zod schema validation tests (valid transaction, invalid amount, missing category).
4. All tests pass with Vitest.
**Verification:** `bun run --cwd frontend test` — 0 failures.
**Budget:** 300 tokens
**Dependencies:** WP-013

### WP-025: Root README + Documentation
**Territory:** Infrastructure & Data
**Contract Clause:** N/A
**Files:**
- Create: `README.md`
**Acceptance Criteria:**
1. Setup instructions: install Bun, `bun install`, dev commands.
2. Architecture overview with technology choices.
3. API endpoint quick reference.
4. Migration command reference.
5. Testing commands.
**Verification:** Read + follow setup steps on a clean machine (manual check is OK).
**Budget:** 200 tokens
**Dependencies:** WP-005, WP-011

### WP-026: End-to-End Integration
**Territory:** All Territories (cross-cutting)
**Contract Clause:** AC-001 through AC-010
**Files:**
- N/A (cross-cutting verification)
**Acceptance Criteria:**
1. Full flow test: Start backend → start frontend → login → add transaction → view dashboard → add category → view transactions → delete transaction → logout.
2. All ACs verified manually or via Playwright.
3. Lighthouse PWA score >= 90.
4. CORS test: API rejects requests from foreign origin.
5. SQL injection test: Zod rejects malicious input.
6. Final build passes.
**Verification:** Manual walkthrough + `bun run build:frontend && bun run build:backend`.
**Budget:** 900 tokens
**Dependencies:** WP-016, WP-022, WP-023, WP-020

---

## Execution Order

### Phase 1: Infrastructure (Sequential)
Done before anything else:
1. WP-001: Root monorepo workspace
2. WP-002: Shared Zod schemas
3. WP-003: Drizzle schema + DB client
4. WP-004: Drizzle migrations
5. WP-005: Seed data

### Phase 2: Backend Core (Parallel after Phase 1)
6. WP-006: Hono server bootstrap
7. WP-007: Middleware stack
8. WP-008: Auth routes (login)
9. WP-009: Transaction routes
10. WP-010: Category routes
11. WP-015: Dashboard aggregates API

### Phase 3: Frontend Foundation (Parallel after Phase 1)
12. WP-011: Vite + PWA + Tailwind config
13. WP-021: shadcn-svelte component setup (parallel with WP-011)
14. WP-012: API client + interceptors
15. WP-013: Runes-based state management
16. WP-014: App shell + routing + login page

### Phase 4: Frontend Features (Parallel after Phase 3)
17. WP-017: Dashboard page with charts
18. WP-018: Transactions list
19. WP-019: Transaction form (add/edit)
20. WP-020: Category management
21. WP-022: PWA manifest + icons (parallel with WP-017)
22. WP-023: Offline banner

### Phase 5: Polish + Verification (After Phase 4)
23. WP-016: Backend API tests
24. WP-024: Frontend unit tests
25. WP-026: End-to-end integration
26. WP-025: Root README

---

## Baseline Verification
- Tests: N/A (greenfield — no tests to pass)
- Dependencies: Bun >= 1.1 (check with `bun --version`)
- Branch: N/A (new repo — commits can be made during The Hit)
- Workspace: `bun install` must complete without errors

## Budget Summary

| Territory | WP Count | Budget |
|-----------|----------|--------|
| Infrastructure & Data | 5 | 2500 |
| Backend API | 7 | 5700 |
| Frontend Foundation | 3 + WP-021 | 2700 |
| Frontend Features | 6 | 2800 |
| Cross-cutting (tests, README, integration) | 4 | 1400 |
| **Total** | **27** | **15100** |

---
## Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Don | [USER] | _______________ | _______ |
| Consigliere | [INSPECTOR] | _______________ | _______ |
| Underboss | [ORCHESTRATOR] | _______________ | _______ |