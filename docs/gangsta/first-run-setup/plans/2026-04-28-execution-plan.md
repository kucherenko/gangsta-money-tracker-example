---
heist: first-run-setup
date: 2026-04-28
total-work-packages: 12
territories: 3
estimated-total-budget: medium
---

# Execution Plan: First-Run Setup Page

## Territories

### Territory: Backend
**Crew Lead Domain:** Backend API routes, database, middleware, auth
**Files:** `backend/routes/*.ts`, `backend/db/*.ts`, `backend/middleware/*.ts`, `backend/server.ts`, `backend/lib/*.ts`
**Work Packages:** WP-001, WP-002, WP-003, WP-004, WP-005, WP-006
**Workers:** 1
**Budget:** medium

### Territory: Frontend
**Crew Lead Domain:** Frontend routes, state, components
**Files:** `frontend/src/routes/*.svelte`, `frontend/src/state/*.ts`, `frontend/src/lib/api.ts`, `frontend/src/App.svelte`
**Work Packages:** WP-007, WP-008, WP-009
**Workers:** 1
**Budget:** medium

### Territory: Shared + Config
**Crew Lead Domain:** Shared schemas, env files, docker-compose, tests
**Files:** `shared/schemas.ts`, `.env.example`, `docker-compose.yml`, `backend/tests/*.ts`
**Work Packages:** WP-010, WP-011, WP-012
**Workers:** 1
**Budget:** small

## Work Packages

### WP-001: Extract token generation to shared module
**Territory:** Backend
**Contract Clause:** NFR-005, AC-13
**Files:**
- Create: `backend/lib/tokens.ts`
- Modify: `backend/routes/auth.ts`
**Acceptance Criteria:**
1. `generateTokenPair` and `hashToken` are exported from `backend/lib/tokens.ts`
2. `backend/routes/auth.ts` imports these from `backend/lib/tokens.ts` instead of defining them locally
3. All existing auth tests still pass
**Verification:** `bun run test:backend`
**Budget:** small
**Dependencies:** None

### WP-002: Create POST /setup endpoint
**Territory:** Backend
**Contract Clause:** FR-002, FR-003, FR-004, FR-005, NFR-001, NFR-002
**Files:**
- Create: `backend/routes/setup.ts`
- Modify: `backend/server.ts` (mount setup routes)
**Acceptance Criteria:**
1. `POST /setup` creates admin user when none exists (201 with `{ token, refreshToken, user: { id, username, role } }`)
2. `POST /setup` returns 409 when admin already exists
3. Password hashed with bcrypt outside transaction; count+insert+ensureSettingsRow inside BEGIN IMMEDIATE transaction
4. 409 case returns `{ created: false }` from transaction (not thrown)
5. Rate-limited to 3 requests per hour per IP
6. Request validated against `setupSchema` (422 for invalid input)
**Verification:** `bun run test:backend` (after WP-012 tests are added)
**Budget:** medium
**Dependencies:** WP-001 (needs token generation from lib)

### WP-003: Add needsSetup to GET /auth/config/register
**Territory:** Backend
**Contract Clause:** FR-001
**Files:**
- Modify: `backend/server.ts`
**Acceptance Criteria:**
1. `GET /auth/config/register` returns `{ allowRegistration: boolean, needsSetup: boolean }`
2. `needsSetup` is true when `SELECT COUNT(*) FROM users WHERE role = 'admin'` returns 0
3. `needsSetup` is false when at least one admin exists
**Verification:** Manual test + WP-012 integration tests
**Budget:** small
**Dependencies:** None

### WP-004: Add last-admin deletion guard
**Territory:** Backend
**Contract Clause:** FR-006
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. `DELETE /admin/users/:id` returns 403 Forbidden when the target is the last remaining admin user
2. Returns appropriate error message: cannot delete last admin
3. Normal deletion still works when other admins exist
**Verification:** `bun run test:backend` (after WP-012 tests are added)
**Budget:** small
**Dependencies:** None

### WP-005: Remove admin seeding from seed.ts
**Territory:** Backend
**Contract Clause:** AD-3, AD-4
**Files:**
- Modify: `backend/db/seed.ts`
- Modify: `backend/db/index.ts` (if seedSystemConfig needs changes)
**Acceptance Criteria:**
1. `seed()` no longer reads `ADMIN_USERNAME` or `ADMIN_PASSWORD` env vars
2. `seed()` no longer creates or updates admin users
3. `seed()` still seeds default categories (with `user_id IS NULL`)
4. `seed()` still seeds system config (`allow_registration = false` via INSERT OR IGNORE)
5. `seed()` no longer calls `ensureSettingsRow` for admin (no admin to create settings for)
6. `bcryptjs` import removed from seed.ts (no longer needed)
**Verification:** `bun run test:backend` (after WP-012 tests are updated)
**Budget:** small
**Dependencies:** None

### WP-006: Remove ADMIN_PASSWORD from validateEnv and config
**Territory:** Backend
**Contract Clause:** AC-12
**Files:**
- Modify: `backend/server.ts` (remove from required production env vars)
- Modify: `backend/db/seed.ts` (already done in WP-005)
- Modify: `.env.example` (remove ADMIN_USERNAME, ADMIN_PASSWORD)
- Modify: `docker-compose.yml` (remove ADMIN_USERNAME, ADMIN_PASSWORD)
- Modify: `.env` (remove ADMIN_USERNAME, ADMIN_PASSWORD if present)
**Acceptance Criteria:**
1. `validateEnv()` no longer requires `ADMIN_PASSWORD` in production
2. `.env.example` has no `ADMIN_USERNAME` or `ADMIN_PASSWORD` entries
3. `docker-compose.yml` has no `ADMIN_USERNAME` or `ADMIN_PASSWORD` env vars
**Verification:** `bun run test:backend` still passes; server starts without ADMIN_PASSWORD
**Budget:** small
**Dependencies:** WP-005

### WP-007: Add setupSchema to shared schemas
**Territory:** Shared + Config
**Contract Clause:** FR-002, AC-14
**Files:**
- Modify: `shared/schemas.ts`
- Modify: `shared/index.ts` (if needed for export)
**Acceptance Criteria:**
1. `setupSchema` added to `shared/schemas.ts` with username (3-30 chars, regex), password (8-128 chars), confirmPassword (must match)
2. Username regex matches `registerSchema` exactly
3. `setupSchema` exported from shared package
**Verification:** TypeScript compilation passes
**Budget:** small
**Dependencies:** None

### WP-008: Update auth state with needsSetup
**Territory:** Frontend
**Contract Clause:** FR-010, FR-009
**Files:**
- Modify: `frontend/src/state/auth.svelte.ts`
**Acceptance Criteria:**
1. `AuthState` has `needsSetup = $state(false)` reactive flag
2. `checkSetupStatus()` method calls `GET /auth/config/register` and sets `needsSetup` from response
3. On network error, `needsSetup` defaults to `false` (shows login page)
4. After successful setup, `needsSetup` is set to `false`
**Verification:** Manual test (cannot verify with automated tests — no frontend tests exist)
**Budget:** small
**Dependencies:** WP-003 (needs backend endpoint)

### WP-009: Create Setup.svelte and update App.svelte routing
**Territory:** Frontend
**Contract Clause:** FR-007, FR-008, NFR-004, NFR-006
**Files:**
- Create: `frontend/src/routes/Setup.svelte`
- Modify: `frontend/src/App.svelte`
- Modify: `frontend/src/lib/api.ts`
**Acceptance Criteria:**
1. `Setup.svelte` renders form with username, password, confirmPassword fields
2. Form validates using `setupSchema` from shared package
3. Submission calls `POST /setup` via raw `fetch` (not `fetchJson`)
4. Error responses parsed by reading JSON body `{ error }` or `{ message }` fields
5. On success: tokens stored in localStorage, `auth.user` set, `auth.needsSetup = false`, redirect to `#/dashboard`
6. `App.svelte` auth guard exempts `#/setup` from redirect-to-login
7. `App.svelte` redirects to `#/setup` when `needsSetup = true`
8. `#/setup` is directly accessible via URL hash navigation
9. `api.ts` has `setup()` method using raw `fetch`
**Verification:** Manual test in browser
**Budget:** medium
**Dependencies:** WP-002 (needs backend endpoint), WP-007 (needs schema), WP-008 (needs auth state)

### WP-010: Update existing backend tests
**Territory:** Backend
**Contract Clause:** AC-7
**Files:**
- Modify: `backend/tests/api.test.ts`
- Modify: `backend/tests/multiuser.test.ts`
**Acceptance Criteria:**
1. `api.test.ts` `beforeAll` creates admin via direct DB insert or `POST /setup` instead of relying on `seed()` to create admin
2. `multiuser.test.ts` continues to work with its existing manual user insertion
3. All 47 existing tests pass
**Verification:** `bun run test:backend` — all pass
**Budget:** medium
**Dependencies:** WP-002 (needs POST /setup endpoint), WP-005 (seed no longer creates admin)

### WP-011: Create new backend tests for setup endpoint
**Territory:** Backend
**Contract Clause:** AC-8
**Files:**
- Create: `backend/tests/setup.test.ts`
**Acceptance Criteria:**
1. Successful setup: POST /setup creates admin, returns 201 with token + user
2. Duplicate setup: POST /setup returns 409 after admin exists
3. Validation errors: POST /setup returns 422 for invalid input (short username, weak password, mismatched confirm)
4. Last-admin deletion guard: DELETE /admin/users/:id returns 403 when target is last admin
5. Setup status detection: GET /auth/config/register returns needsSetup=true when no admin, needsSetup=false when admin exists
6. Rate limiting: POST /setup rate limited to 3/hour/IP
7. No hardcoded user IDs — queries actual DB
**Verification:** `bun run test:backend` — new tests pass alongside existing
**Budget:** medium
**Dependencies:** WP-002, WP-003, WP-004

### WP-012: End-to-end verification
**Territory:** Shared + Config
**Contract Clause:** AC-1 through AC-14
**Files:** None (verification only)
**Acceptance Criteria:**
1. Fresh app (empty database) shows setup page on first visit
2. After admin creation, setup page is inaccessible (409 on POST /setup)
3. Existing deployments never see setup page
4. All acceptance criteria in the Contract are verified
**Verification:** `bun run test:backend` all pass; manual browser verification
**Budget:** small
**Dependencies:** All previous WPs

## Execution Order

**Group 1 (Independent — can run in parallel):**
- WP-001: Extract token generation
- WP-003: Add needsSetup to register endpoint
- WP-004: Add last-admin deletion guard
- WP-005: Remove admin seeding
- WP-007: Add setupSchema to shared schemas

**Group 2 (Depends on Group 1):**
- WP-002: Create POST /setup endpoint (needs WP-001, WP-007)
- WP-006: Remove ADMIN_PASSWORD from config (needs WP-005)
- WP-008: Update auth state (needs WP-003)

**Group 3 (Depends on Group 2):**
- WP-009: Create Setup.svelte and update routing (needs WP-002, WP-007, WP-008)
- WP-010: Update existing backend tests (needs WP-002, WP-005)
- WP-011: Create new backend tests (needs WP-002, WP-003, WP-004)

**Group 4 (Final verification):**
- WP-012: End-to-end verification (needs all)

## Baseline Verification
- Tests: PASS (47/47)
- Dependencies: OK
- Branch: heist/first-run-setup created from main