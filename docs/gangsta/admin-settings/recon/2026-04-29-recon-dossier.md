---
heist: admin-settings
date: 2026-04-29
status: pending-review
---

# Reconnaissance Dossier: Admin Settings

## Objective

Build a dedicated Admin Settings page/panel for the application with:
1. **List of users** — view all registered users with key details
2. **Registration toggle** — enable/disable open registration via the existing `system_config.allow_registration` flag
3. **Clean database** — provide a mechanism for admins to clean/purge data
4. Other admin-level configuration controls as appropriate

Currently, admin functionality exists only as a tab within `Settings.svelte` (878 lines). The backend already has full admin API routes (`/admin/users`, `/admin/config`). The frontend needs a proper Admin Settings page with richer controls and dedicated routing.

## Codebase Overview

### Monorepo Structure
- **Root**: Bun workspace monorepo (`frontend`, `backend`, `shared`)
- **Runtime**: Bun (>= 1.1), TypeScript strict mode, ESM
- **Frontend**: Svelte 5 (runes: `$state`, `$derived`, `$effect`), Vite 6, Tailwind CSS 4, PWA
- **Backend**: Hono ^4.7, SQLite via `bun:sqlite`, Drizzle ORM ^0.45.2 (for types only; all queries are raw SQL)
- **Shared**: Zod schemas, currency data, receipt constants

### Backend Key Files
| File | Role |
|------|------|
| `backend/routes/admin.ts` (108 lines) | User CRUD, system config management (admin-only) |
| `backend/middleware/auth.ts` | `authMiddleware` + `adminMiddleware` |
| `backend/db/schema.ts` | `systemConfig` table, `users` table with `role` column |
| `backend/db/index.ts` | Raw SQL helpers: `query()`, `getOne()`, `run()`, `insert()`, `transaction()` |

### Frontend Key Files
| File | Role |
|------|------|
| `frontend/src/App.svelte` | Hash-based SPA router; no `/admin` route exists |
| `frontend/src/routes/Settings.svelte` (878 lines) | Contains admin tab (conditional on `role === 'admin'`) |
| `frontend/src/lib/api.ts` | Admin API methods: `getUsers`, `createUser`, `deleteUser`, `getConfig`, `updateConfig` |
| `frontend/src/state/auth.svelte.ts` | Svelte 5 runes auth state class |

### Database Schema
| Table | Key Columns | Notes |
|-------|------------|-------|
| `users` | id, username, password_hash, email, role | role = "admin" or "user" |
| `system_config` | key (PK), value | Key-value store; `allow_registration` key exists |
| `refresh_tokens` | id, token_hash, user_id, expires_at, consumed | Theft detection via consumed flag |
| `categories` | id, name, color, icon, type, is_predefined, user_id | Hybrid: NULL user_id = global predefined |
| `transactions` | id, amount, currency, user_id, ... | Per-user, filtered by user_id |

### Admin API Endpoints (Already Implemented)
- `GET /admin/users` — List all users
- `POST /admin/users` — Create user (admin-only)
- `DELETE /admin/users/:id` — Delete user with cascade (with last-admin guard)
- `GET /admin/config` — Get all system config
- `PUT /admin/config/:key` — Update a config value

## Existing Test Coverage

### Backend Tests (4 files, 1155 lines)
- `setup.test.ts` — First-run admin creation, validation, duplicate prevention
- `api.test.ts` — General API tests (transactions, settings, currencies, rates)
- `multiuser.test.ts` — Cross-user data isolation, admin operations including user deletion, registration toggle
- `ocr.test.ts` — OCR endpoint validation

### Frontend Tests — **ZERO COVERAGE**
- No test files exist in `frontend/tests/`
- `vitest` is declared as a devDependency but never configured or used

### Key Test Gaps for Admin Settings
- No dedicated admin route tests (admin operations are tested indirectly in `multiuser.test.ts`)
- No frontend tests at all
- No E2E tests

## Dependencies

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Bun | >= 1.1 |
| Backend | Hono | ^4.7 |
| Frontend | Svelte | ^5.0 |
| ORM | Drizzle | ^0.45.2 |
| DB Driver | bun:sqlite | built-in |
| Validation | Zod | latest |
| Auth | hono/jwt + bcryptjs | built-in + latest |
| CSS | Tailwind CSS | v4 (via @tailwindcss/vite) |
| Charts | layerchart | latest |
| PWA | vite-plugin-pwa | latest |

### Security Concerns
- Default `JWT_SECRET` is weak (`money-tracker-secret-key` in config.ts fallback)
- No CSRF protection (Bearer tokens only — API-style)
- No env schema validation library
- CORS open in dev mode (`*` origin fallback)

## Relevant Ledger Entries

### Applicable Insights
- **I-1**: Use `Bun.CryptoHasher` for sync hashing inside transaction blocks — Source: `insights/2026-04-28-bun-sync-sha256.md`
- **I-2**: Mark consumed refresh tokens instead of deleting; detect theft via resubmitted consumed tokens — Source: `insights/2026-04-28-refresh-token-theft-detection.md`
- **I-3**: Never throw errors inside transactions when error cases need DB mutations — Source: `insights/2026-04-28-refresh-token-theft-detection.md`

### Applicable Negative Constraints
- **NC-1**: NEVER assume auto-increment IDs start at 1 after table recreation — Source: `fails/2026-04-28-hardcoded-user-ids.md`
- **NC-2**: NEVER duplicate config constants across files; extract to single shared module — Source: `fails/2026-04-28-duplicated-constants.md`
- **NC-3**: NEVER duplicate utility functions across route files; extract to `lib/utils.ts` — Source: `fails/2026-04-28-duplicated-constants.md`
- **NC-4**: NEVER hardcode user IDs in tests — Source: `fails/2026-04-28-hardcoded-user-ids.md`

## Risks and Unknowns

1. **Settings.svelte complexity** — At 878 lines, Settings.svelte is already large. Extracting admin functionality into a separate route may require significant refactoring.
2. **Database clean scope** — "Clean database" could mean many things (truncate transactions, reset all data, delete non-admin users, etc.). Needs clarification from the Don.
3. **No `constitution.md`** — Governance is emergent from Ledger entries and signed Contracts only.
4. **First-run-setup heist appears in-progress** — The `first-run-setup` heist directory exists with a signed contract but no laundering checkpoint. This may indicate unfinished work.
5. **Stale `/backend/src/` directory** — Contains what appears to be a copy of routes, middleware, and db code. Unclear if it's in use or should be removed.

## Recommended Scope

1. **Create dedicated Admin Settings page** (`Admin.svelte` route) separate from `Settings.svelte`
2. **User list** — Fetch and display users from `GET /admin/users` with role, creation date, and status info
3. **Registration toggle** — UI control for `GET/PUT /admin/config/allow_registration`
4. **Database cleanup** — New backend endpoint(s) for admin-initiated data cleanup (define scope — transactions only? all user data? etc.)
5. **Admin navigation** — Add `/admin` hash route to `App.svelte` router, visible only to admin users
6. **Migrate existing admin tab** from Settings.svelte to the new Admin page
7. **Backend tests** — Add dedicated admin route tests if gaps exist
8. **Consider frontend testing** — At minimum add API client tests for admin endpoints