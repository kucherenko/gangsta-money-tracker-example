---
heist: auth-multi-user
date: 2026-04-28
status: pending-review
---

# Reconnaissance Dossier: Auth & Multi-User

## Objective
Implement proper authentication and multi-user support. Currently the app has a single hardcoded admin user. The Don wants full auth (registration, login, sessions) with per-user data isolation.

## Codebase Overview

### Architecture
- **Monorepo**: Bun workspaces with 3 packages (`frontend`, `backend`, `shared`)
- **Backend**: Hono framework, Bun runtime, `bun:sqlite` database
- **Frontend**: Svelte 5 (runes), Vite 6, Tailwind CSS v4, PWA
- **Shared**: Zod schemas via `@money-tracker/shared`

### Current Auth (Single-User, Simplified)
- **`/backend/routes/auth.ts`**: Only `POST /auth/login` — validates username/password, signs JWT, stores token in `users.token` column
- **`/backend/middleware/auth.ts`**: Bearer token middleware — looks up token in `users` table directly (no JWT verification on each request)
- **`/backend/db/seed.ts`**: Seeds single admin user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars (bcrypt, 12 rounds)
- **`/frontend/src/state/auth.svelte.ts`**: Stores token in localStorage, reactive `$state`
- **`/frontend/src/lib/api.ts`**: Adds `Authorization: Bearer <token>` header, on 401 → clears token + redirects to login
- **`/frontend/src/routes/Login.svelte`**: Simple login form
- **`/frontend/src/App.svelte`**: Hash-based routing with auth guard

### Database Schema (SQLite via Drizzle ORM)
| Table | Key Columns | Notes |
|-------|------------|-------|
| `users` | `id` (PK), `username` (unique), `password_hash`, `token` | Single-row use currently; no email, no roles |
| `settings` | `user_id` (FK→users) | Already has `user_id` FK but used globally |
| `transactions` | No `user_id` column | **Critical gap** — all users would see all transactions |
| `categories` | No `user_id` column | Same gap |
| `currencies` | Global | Shared across users (intentional) |
| `exchange_rates` | Global | Shared across users (intentional) |

### Key Data Isolation Gaps
1. **`transactions` table has no `user_id`** — must add for per-user isolation
2. **`categories` table has no `user_id`** — predefined categories are global, but custom categories need per-user scoping
3. **`settings` has `user_id`** but is used as a single global row — needs per-user rows
4. **Dashboard queries** — currently aggregate all data, need `WHERE user_id = ?`

## Existing Test Coverage
- **Backend**: 282-line `api.test.ts` (integration via Hono testClient) + `ocr.test.ts` (333 lines)
- Tests cover: auth, currencies, settings, transactions, rates, dashboard, OCR, protected routes
- All tests assume single admin user
- **Frontend**: No tests exist (`vitest` configured but empty `tests/` dir)

## Dependencies
- **Auth-relevant**: `bcryptjs` (already in backend), `hono/jwt` (used for JWT signing)
- **No registration endpoint** exists currently
- **No refresh token mechanism** — tokens stored in DB, no expiry

## Risks and Unknowns
1. **Data migration**: Adding `user_id` to transactions/categories requires a migration strategy for existing data
2. **Token auth model**: Current approach (store token in DB, compare directly) is simple but lacks expiry, refresh, or proper JWT verification on each request
3. **Password reset**: Not currently implemented, may be desired
4. **Email verification**: Not currently implemented, may be desired
5. **Role-based access**: Only single admin exists, no roles defined

## Recommended Scope
- Add user registration (sign-up) endpoint
- Add proper JWT auth with token verification (not just DB lookup)
- Add `user_id` to transactions and categories tables with migration
- Scope all data queries by `user_id` for isolation
- Update frontend: registration form, user-aware state
- Update dashboard/stats to be per-user
- Maintain backward compatibility with existing admin user and data

## Relevant Ledger Entries

### Applicable Insights
- No insights directory exists yet

### Applicable Negative Constraints
- No fails directory exists yet