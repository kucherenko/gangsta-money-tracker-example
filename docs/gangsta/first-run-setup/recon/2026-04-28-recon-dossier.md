---
heist: first-run-setup
date: 2026-04-28
status: pending-review
---

# Reconnaissance Dossier: First-Run Setup Page

## Objective

Add a first-run setup page that is displayed exactly once when the application has no configured admin user. The page should allow the user to:
- Create an admin account (username, password, optional email)
- Configure initial application settings (default currency, registration toggle, etc.)

This replaces the current behavior of seeding a default `admin/admin` user from environment variables.

## Codebase Overview

### Architecture
- **Monorepo**: Bun workspaces (`frontend/`, `backend/`, `shared/`)
- **Frontend**: Svelte 5 SPA with hash-based routing (`#/path`), Tailwind CSS 4, Vite 6, PWA support
- **Backend**: Hono (v4.7) on Bun runtime, SQLite via `bun:sqlite`, Drizzle ORM for schema only
- **Shared**: Zod schemas, currency data, receipt constraints

### Key Files for This Heist

| File | Lines | Relevance |
|------|-------|-----------|
| `backend/server.ts` | 88-98 | Main entry point — routes registration, health check, static serving |
| `backend/db/index.ts` | 10-123 | `initDb()` creates tables, runs migrations, seeds admin user from env vars |
| `backend/db/seed.ts` | 20-52 | `seed()` creates admin user + default categories — **this is where default admin is seeded** |
| `backend/routes/auth.ts` | 15,38,75,138,147,174 | Auth routes — login, register, refresh, logout, change-password, /me |
| `backend/routes/admin.ts` | 16,21,51,78,87 | Admin routes — user CRUD, system config |
| `backend/routes/settings.ts` | 12,20 | User settings endpoints |
| `backend/middleware/auth.ts` | 5,24 | `authMiddleware` + `adminMiddleware` |
| `backend/config.ts` | — | JWT_SECRET, token expiry constants |
| `frontend/src/App.svelte` | 12-79 | Hash router with auth guard — **route for setup page needed here** |
| `frontend/src/routes/Settings.svelte` | 878 | Settings page with `general`, `currencies`, `categories`, `admin` tabs |
| `frontend/src/state/auth.svelte.ts` | — | AuthState class — manages login/register/token state |
| `frontend/src/state/settings.svelte.ts` | — | SettingsState class |
| `frontend/src/lib/api.ts` | 3 | API client — base URL, fetchWithAuth with auto-refresh |
| `shared/schemas.ts` | — | Zod schemas for all domain types |
| `.env.example` | — | `ADMIN_USERNAME`, `ADMIN_PASSWORD` env vars (defaults: admin/admin) |
| `docker-compose.yml` | — | Backend container with env vars |

### Current Admin Seeding Behavior
- `backend/db/seed.ts:20-52`: On startup, `seed()` checks if admin user exists; if not, creates one using `ADMIN_USERNAME` (default: `admin`) and `ADMIN_PASSWORD` (default: `admin`)
- `backend/db/index.ts:178-182`: `initDb()` calls `seed()` after table creation and migrations
- This means **every fresh install gets an admin/admin user automatically**

### Current Auth Guard
- `frontend/src/App.svelte:18-21`: If not authenticated, redirects to `#/login`
- No concept of "first run" or "setup required" state

### System Config Table
- `system_config` key-value store currently holds only `allow_registration` (seeded as `"false"`)
- Already has `GET /admin/config` and `PUT /admin/config/:key` endpoints

## Existing Test Coverage

| Test File | Lines | Coverage |
|-----------|-------|---------|
| `backend/tests/api.test.ts` | 284 | Auth, currencies, settings, transactions, rates, dashboard |
| `backend/tests/ocr.test.ts` | 344 | OCR upload, URL, receipt serving |
| `backend/tests/multiuser.test.ts` | 331 | Auth, transaction isolation, category isolation, admin management |
| Frontend tests | 0 | None |
| Shared tests | 0 | None |

- **Test framework**: Bun Test (backend), Vitest (frontend — unused)
- **Run commands**: `bun run test:backend`, `bun run test:frontend`

## Dependencies

| Key Dependency | Version | Concern |
|---------------|---------|---------|
| Svelte | ^5.0 | Uses runes API ($state, $derived, $effect, $props) |
| Hono | ^4.7 | HTTP framework |
| Drizzle ORM | ^0.45.2 | Schema declared but queries use raw SQL |
| bcryptjs | latest | Password hashing |
| Zod | latest | Shared validation schemas |
| Tailwind CSS | 4.x | Styling (via @tailwindcss/vite) |

## Relevant Ledger Entries

### Applicable Insights
- **Bun.CryptoHasher for sync hashing** (`insights/2026-04-28-bun-sync-sha256.md`): Use `Bun.CryptoHasher` for sync hashing inside transaction blocks; never use `Buffer.from().map()` as a naive hash substitute.
- **Refresh token theft detection** (`insights/2026-04-28-refresh-token-theft-detection.md`): Mark consumed refresh tokens instead of deleting. Never throw errors from inside a transaction when the error case also needs DB mutations to commit.

### Applicable Negative Constraints
- **NEVER duplicate secret/config constants across files** — Source: `fails/2026-04-28-duplicated-constants.md`. Extract to a single shared module.
- **NEVER duplicate utility functions across route files** — Source: `fails/2026-04-28-duplicated-constants.md`. Extract to `lib/utils.ts`.
- **NEVER hardcode user IDs in tests** — Source: `fails/2026-04-28-hardcoded-user-ids.md`. Always query the actual ID from the database.
- **After table recreation migrations, auto-increment IDs may not start at 1** — Source: `fails/2026-04-28-hardcoded-user-ids.md`.

## Risks and Unknowns

1. **Migration path for existing installs**: Existing deployments already have an admin user seeded. The first-run page should never appear for them. Need a reliable way to detect "app is already set up" vs "fresh install".
2. **Docker deployments**: Current docker-compose seeds admin from env vars (`ADMIN_USERNAME`/`ADMIN_PASSWORD`). First-run setup changes the initialization flow — need backward compatibility.
3. **PWA considerations**: The app runs as a PWA. First-run setup needs to work reliably in offline-first scenarios (though initial setup inherently requires network to create the admin).
4. **Security**: The setup endpoint must only be callable when no admin exists, to prevent unauthorized admin creation.
5. **Database state detection**: Need to determine the canonical way to check "has this app been set up?" — options include: checking if any user with admin role exists, or adding a `system_config` key like `setup_complete`.

## Recommended Scope

### Backend
1. Add `GET /auth/setup-status` endpoint — returns `{ needsSetup: boolean }` indicating whether initial setup is required (no admin user exists)
2. Add `POST /auth/setup` endpoint — creates the initial admin user + configures initial settings; only callable when `needsSetup === true`
3. Modify `seed()` to skip admin user creation (or make it conditional on `needsSetup`)
4. Add Zod schema for setup payload to `shared/schemas.ts`

### Frontend
5. Create `Setup.svelte` route — first-run setup wizard with steps for admin account creation and initial settings
6. Update `App.svelte` router — add `#/setup` route; on app load, check setup status and redirect to `#/setup` if needed
7. Add `setupStatus` state to auth state or create a separate setup state

### Out of Scope
- Email verification
- OAuth/social login
- Profile editing (separate from initial setup)
- Migration tooling for existing deployments (they keep their seeded admin)