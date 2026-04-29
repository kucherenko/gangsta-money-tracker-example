---
heist: admin-settings
date: 2026-04-29
total-work-packages: 14
territories: 3
estimated-total-budget: medium
---

# Execution Plan: Admin Settings

## Territories

### Territory: Backend
**Crew Lead Domain:** All server-side changes: database schema, API routes, middleware, config constants, and backend tests
**Files:** `backend/db/schema.ts`, `backend/db/index.ts`, `backend/routes/admin.ts`, `backend/middleware/auth.ts`, `backend/lib/config-constants.ts`, `backend/tests/admin.test.ts`
**Workers:** 1 (sequential — backend work has internal dependencies)
**Budget:** medium

### Territory: Frontend
**Crew Lead Domain:** All client-side changes: new Admin page, state management, routing, API client, admin tab extraction from Settings
**Files:** `frontend/src/routes/Admin.svelte`, `frontend/src/state/admin.svelte.ts`, `frontend/src/state/settings.svelte.ts`, `frontend/src/App.svelte`, `frontend/src/routes/Settings.svelte`, `frontend/src/lib/api.ts`
**Workers:** 1 (sequential — frontend work has internal dependencies)
**Budget:** medium

### Territory: Shared
**Crew Lead Domain:** Shared constants and Zod schemas needed by both territories
**Files:** `shared/schemas.ts`, `shared/index.ts`
**Workers:** 1
**Budget:** small

## Work Packages

### WP-001: Create `cleanup_tokens` and `audit_log` database tables
**Territory:** Backend
**Contract Clause:** FR-005, FR-007, FR-008, NFR-006
**Files:**
- Modify: `backend/db/schema.ts`
- Modify: `backend/db/index.ts`
**Acceptance Criteria:**
1. `cleanup_tokens` table defined in schema with: id, token_hash, user_id (FK users ON DELETE CASCADE), scope (CHECK constraint), consumed, expires_at, created_at
2. `audit_log` table defined in schema with: id, performed_by (FK users ON DELETE SET NULL), action, scope, details, ip_address, created_at
3. Indexes created: `idx_cleanup_tokens_user_id`, `idx_audit_log_performed_by`, `idx_audit_log_created_at`
4. `initDb()` creates both tables if they don't exist
5. Existing 59 tests still pass
**Verification:** `bun run test:backend`
**Budget:** small
**Dependencies:** None

### WP-002: Create `config-constants.ts` and centralize `allow_registration`
**Territory:** Backend
**Contract Clause:** FR-011, C-4, NC-2
**Files:**
- Create: `backend/lib/config-constants.ts`
- Modify: `backend/routes/admin.ts`
- Modify: `backend/routes/auth.ts`
- Modify: `backend/server.ts` (if applicable)
- Modify: `backend/db/index.ts` (if `allow_registration` string used in seed/init)
**Acceptance Criteria:**
1. `CONFIG_KEYS.ALLOW_REGISTRATION` constant exported from `backend/lib/config-constants.ts`
2. All hardcoded `"allow_registration"` string literals in backend files replaced with the constant
3. Existing 59 tests still pass
**Verification:** `bun run test:backend`
**Budget:** small
**Dependencies:** None

### WP-003: Add Zod schemas for new endpoints
**Territory:** Shared
**Contract Clause:** FR-005, FR-006, FR-007, FR-008
**Files:**
- Modify: `shared/schemas.ts`
- Modify: `shared/index.ts`
**Acceptance Criteria:**
1. `cleanupTokenRequestSchema` validates `{ scope: "transactions" | "orphaned" }`
2. `cleanupExecuteSchema` validates `{ token: string, scope: "transactions" | "orphaned" }`
3. `adminStatsSchema` validates the response shape
4. Schemas exported from shared/index.ts
**Verification:** `bun run test:backend` (existing tests import from shared)
**Budget:** small
**Dependencies:** None

### WP-004: Implement `GET /admin/stats` endpoint
**Territory:** Backend
**Contract Clause:** FR-002, AC-002
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. `GET /admin/stats` returns `{ users: N, transactions: N, categories: N, exchange_rates: N }`
2. Returns 403 for non-admin users
3. Returns 401 for unauthenticated users
**Verification:** Test in `admin.test.ts`
**Budget:** small
**Dependencies:** WP-002 (config constants)

### WP-005: Implement `GET /admin/users` with optional pagination
**Territory:** Backend
**Contract Clause:** FR-004, AC-010, AC-011, NFR-004
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. `GET /admin/users` without params returns full array (backward compatible)
2. `GET /admin/users?page=1&limit=10` returns `{ items: [...], total: N, page: 1, limit: 10 }`
3. Returns 403 for non-admin users
**Verification:** Test in `admin.test.ts`
**Budget:** small
**Dependencies:** WP-002

### WP-006: Implement `POST /admin/cleanup/token` endpoint
**Territory:** Backend
**Contract Clause:** FR-005, FR-007, NFR-002, NFR-003
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. Generates token via `crypto.randomUUID()`, hashes with `Bun.CryptoHasher("sha256")`, stores hash in `cleanup_tokens` table
2. Returns `{ token: string }` with raw token (hash stored, raw token returned once)
3. Rate limited: 1 token request per userId per 60 seconds (enforced at handler level)
4. Token scoped to requesting user and specified scope
5. Returns 429 if rate limit exceeded
6. Returns 403 for non-admin users
**Verification:** Test in `admin.test.ts`
**Budget:** medium
**Dependencies:** WP-001, WP-003

### WP-007: Implement `POST /admin/cleanup` endpoint
**Territory:** Backend
**Contract Clause:** FR-006, FR-007, NFR-001, AC-006, AC-007
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. Validates token hash: exists, not consumed, not expired, belongs to requesting user, scope matches submitted scope
2. Marks token consumed immediately upon validation
3. `scope=transactions`: Deletes all rows from `transactions` table within `transaction()` block
4. `scope=orphaned`: Deletes consumed expired refresh tokens and orphaned non-predefined categories within `transaction()` block
4. Returns `{ affected_rows: N, scope: string }` on success
5. Writes audit log entry AFTER transaction commits (not inside transaction)
6. If transaction fails, rolls back; token remains consumed (prevent retry with same token)
7. Returns 403 for non-admin, 400 for invalid/expired/wrong-scope token
**Verification:** Test in `admin.test.ts`
**Budget:** medium
**Dependencies:** WP-001, WP-003, WP-006

### WP-008: Update `DELETE /admin/users/:id` with transaction wrapping and audit logging
**Territory:** Backend
**Contract Clause:** FR-008, NFR-001, AC-009, AC-018
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. User cascade deletion wrapped in `transaction()` block
2. Audit log entry written AFTER transaction commits with action, performed_by, scope "user_deletion", and details JSON containing deleted user ID and counts
3. Last-admin guard still works (returns 403)
4. Self-deletion guard still works
**Verification:** Test in `admin.test.ts`
**Budget:** small
**Dependencies:** WP-001, WP-002

### WP-009: Add audit logging for `allow_registration` config changes
**Territory:** Backend
**Contract Clause:** FR-008, AC-009
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. `PUT /admin/config/:key` writes audit log entry when changing `allow_registration` with action, performed_by, scope "config_change", and details JSON containing old and new values
**Verification:** Test in `admin.test.ts`
**Budget:** small
**Dependencies:** WP-001, WP-002

### WP-010: Implement `GET /admin/audit` endpoint
**Territory:** Backend
**Contract Clause:** FR-008, AC-016
**Files:**
- Modify: `backend/routes/admin.ts`
**Acceptance Criteria:**
1. Returns last 50 audit log entries ordered by created_at DESC
2. Returns 403 for non-admin users
**Verification:** Test in `admin.test.ts`
**Budget:** small
**Dependencies:** WP-001

### WP-011: Backend tests for all new admin endpoints
**Territory:** Backend
**Contract Clause:** AC-014, NFR-007, C-6, NC-3
**Files:**
- Create: `backend/tests/admin.test.ts`
**Acceptance Criteria:**
1. Test all AC items: AC-001 through AC-002, AC-004 through AC-011, AC-013 through AC-018
2. Never hardcode user IDs — always query from DB (NC-3)
3. Never assume auto-increment IDs start at 1 (NC-1)
4. All 59 existing tests still pass + new admin tests pass
**Verification:** `bun run test:backend`
**Budget:** medium
**Dependencies:** WP-004 through WP-010

### WP-012: Create Admin state management and update API client
**Territory:** Frontend
**Contract Clause:** FR-010, FR-005
**Files:**
- Create: `frontend/src/state/admin.svelte.ts`
- Modify: `frontend/src/state/settings.svelte.ts`
- Modify: `frontend/src/lib/api.ts`
**Acceptance Criteria:**
1. `admin.svelte.ts` exports a class with: users list, stats, cleanup state, audit log state, loading flags
2. `settings.svelte.ts` extended with `allowRegistration` state and load/save methods
3. `api.ts` adds: `getAdminStats()`, `requestCleanupToken(scope)`, `executeCleanup(token, scope)`, `getAdminAudit()`, `getAdminUsersPaginated(page, limit)`
4. Existing `getUsers()` unchanged for backward compatibility
**Verification:** Dev server starts without errors
**Budget:** medium
**Dependencies:** WP-003 (Zod schemas)

### WP-013: Create Admin.svelte page and update App.svelte routing
**Territory:** Frontend
**Contract Clause:** FR-001, FR-002, FR-003, FR-004, FR-005, NFR-005
**Files:**
- Create: `frontend/src/routes/Admin.svelte`
- Modify: `frontend/src/App.svelte`
**Acceptance Criteria:**
1. `#/admin` route renders for admin users, redirects non-admins to `#/dashboard`
2. "Admin" nav link visible only to admin users
3. Admin page shows: Stats cards, Registration toggle, Paginated user list with create/delete, System cleanup section
4. Cleanup section: two-step flow with token request, confirmation modal requiring typed scope name, submission
5. Nothing renders until `auth.user?.role === 'admin'` is confirmed
**Verification:** Dev server renders page without errors
**Budget:** medium
**Dependencies:** WP-012

### WP-014: Remove admin tab from Settings.svelte
**Territory:** Frontend
**Contract Clause:** FR-009, AC-012
**Files:**
- Modify: `frontend/src/routes/Settings.svelte`
**Acceptance Criteria:**
1. Admin tab removed: state variables, handlers, and template (~150 lines)
2. `errors.admin` key no longer set
3. `isAdmin` derived state removed
4. `loadAdminData` call removed
5. Settings tabs limited to: general, currencies, categories
6. Settings page still functions correctly for all remaining tabs
**Verification:** `bun run test:backend` (no regression)
**Budget:** small
**Dependencies:** WP-013 (admin functionality exists elsewhere before removal)

## Execution Order

1. **Independent (parallel where possible):** WP-001, WP-002, WP-003 (no dependencies between them)
2. **Backend endpoints (sequential):** WP-004, WP-005 (depend on WP-002) → WP-006 (depends on WP-001, WP-003) → WP-007 (depends on WP-006) → WP-008, WP-009, WP-010 (depends on WP-001, WP-002)
3. **Backend tests:** WP-011 (depends on WP-004 through WP-010)
4. **Frontend state + API:** WP-012 (depends on WP-003)
5. **Frontend page:** WP-013 (depends on WP-012)
6. **Frontend cleanup:** WP-014 (depends on WP-013)

## Baseline Verification
- Tests: PASS (59 tests across 4 files)
- Dependencies: OK (all packages installed)
- Branch: `heist/admin-settings` created from `main`