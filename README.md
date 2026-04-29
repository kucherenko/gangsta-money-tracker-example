# Money Tracker

A full-stack Progressive Web Application (PWA) for personal money tracking, built with Svelte 5 + Bun + Hono + Drizzle + SQLite.

**This project is a living example of the [Gangsta Agents Framework](https://github.com/kucherenko/gangsta)** — a spec-driven development framework that uses structured Heists (multi-phase workflows) to plan, debate, spec, and implement features. All development artifacts are preserved in `docs/gangsta/`.

## Features

- **First-Run Setup**: One-time setup page to create admin account (no default credentials)
- **Multi-User Auth**: JWT access tokens + refresh token rotation with theft detection
- **Transactions**: Add, edit, delete, and list income/expense entries with multi-currency support
- **Categories**: Predefined + custom categories with colors and icons
- **Dashboard**: Real-time balance, monthly summaries, category breakdown
- **Receipt OCR**: Upload receipt images/PDFs for automatic data extraction (via Ollama)
- **PWA**: Installable on mobile and desktop, offline banner
- **Admin Panel**: User management, registration toggle, system configuration

## Prerequisites

- [Bun](https://bun.sh/) >= 1.1 `curl -fsSL https://bun.sh/install | bash`

## Setup

```bash
# Clone and install
git clone <repo>
cd money-tracker
bun install

# Start backend (creates DB + seeds categories)
bun run dev:backend

# Start frontend (new terminal)
bun run dev:frontend
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- On first visit, you'll be prompted to create an admin account

## Project Structure

```
money-tracker/
├── frontend/          # Svelte 5 SPA with Vite
│   ├── src/
│   │   ├── routes/    # Pages (Dashboard, Transactions, Setup, etc.)
│   │   ├── state/     # Svelte 5 runes-based state
│   │   ├── lib/       # API client, utils
│   │   └── components/# Reusable components
│   └── public/icons/  # PWA icons
├── backend/           # Bun + Hono REST API
│   ├── routes/        # API endpoints
│   ├── db/            # Schema + Drizzle config
│   ├── lib/           # Shared utilities (tokens, utils)
│   └── middleware/    # Auth, CORS, rate limiting, logging
├── shared/            # Zod schemas (shared across frontend/backend)
├── docs/gangsta/      # Gangsta Agents framework artifacts
└── package.json       # Workspace root
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Svelte 5 (runes) + Vite + Tailwind CSS |
| State | Svelte 5 `$state` / `$derived` |
| Backend | Bun + Hono |
| Database | SQLite (`bun:sqlite`) |
| ORM | Drizzle ORM |
| Validation | Zod (shared schemas) |
| Auth | JWT (15min access + 7day refresh with rotation) |
| Charts | LayerChart |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/setup` | No | First-run admin account creation (one-time) |
| `GET` | `/auth/config/register` | No | Registration status + setup needed flag |
| `POST` | `/auth/login` | No | Login (returns tokens) |
| `POST` | `/auth/register` | No | Register (when enabled) |
| `POST` | `/auth/refresh` | No | Refresh access token |
| `POST` | `/auth/logout` | Yes | Revoke refresh token |
| `GET` | `/auth/me` | Yes | Current user profile |
| `GET` | `/transactions` | Yes | List transactions (with filters) |
| `POST` | `/transactions` | Yes | Create transaction |
| `PUT` | `/transactions/:id` | Yes | Update transaction |
| `DELETE` | `/transactions/:id` | Yes | Delete transaction |
| `GET` | `/categories` | Yes | List categories |
| `POST` | `/categories` | Yes | Create category |
| `GET` | `/dashboard` | Yes | Dashboard aggregates |
| `GET` | `/settings` | Yes | User settings |
| `PUT` | `/settings` | Yes | Update settings |
| `GET` | `/currencies` | Yes | List currencies |
| `GET` | `/rates` | Yes | Exchange rates |
| `GET` | `/admin/users` | Admin | List all users |
| `POST` | `/admin/users` | Admin | Create user |
| `DELETE` | `/admin/users/:id` | Admin | Delete user (cascade) |
| `GET` | `/admin/config` | Admin | System configuration |
| `PUT` | `/admin/config/:key` | Admin | Update config |
| `POST` | `/api/ocr` | Yes | Receipt OCR upload |
| `GET` | `/health` | No | Health check |

## Development

```bash
# Run backend tests
bun run test:backend

# Run dev servers
bun run dev:backend
bun run dev:frontend

# Generate Drizzle migration
bun run db:generate

# Apply migrations
bun run db:migrate
```

## Gangsta Agents Framework

This project is developed using the [Gangsta Agents Framework](https://github.com/kucherenko/gangsta) — a spec-driven development methodology where features are built through structured **Heists** (6-phase operational cycles) with adversarial debate, formal contracts, and institutional memory.

### The Heist Pipeline

Every feature goes through 6 phases:

| Phase | What Happens |
|-------|-------------|
| **1. Reconnaissance** | Intel gathering on codebase, dependencies, existing tests |
| **2. The Grilling** | Multi-agent adversarial debate (Proposer vs Devils-Advocate vs Synthesizer) |
| **3. The Sit-Down** | Formal spec drafting — NO code allowed until Contract is signed |
| **4. Resource Development** | Task decomposition into Work Packages with territories |
| **5. The Hit** | Parallel execution by Workers with TDD enforcement |
| **6. Laundering** | Verification, integration, Consigliere review, Ledger updates |

### Heist History

Every Heist produces structured artifacts in `docs/gangsta/`:

```
docs/gangsta/
├── first-run-setup/              # First-run setup page Heist
│   ├── recon/                    # Reconnaissance dossier
│   ├── specs/                    # Signed Contract
│   ├── plans/                    # Execution plan with Work Packages
│   └── checkpoints/             # Phase completion checkpoints
├── auth-multi-user/              # Multi-user auth Heist
│   ├── recon/
│   ├── specs/
│   ├── plans/
│   └── checkpoints/
├── insights/                     # Project Commandments (from successful solutions)
│   ├── bun-sync-sha256.md        # Use Bun.CryptoHasher for sync hashing
│   └── refresh-token-theft-detection.md  # Mark consumed tokens, don't delete
└── fails/                        # Negative Constraints (from past mistakes)
    ├── duplicated-constants.md   # Never duplicate config/constants across files
    └── hardcoded-user-ids.md     # Never hardcode user IDs in tests
```

### Project Constitution

The Ledger accumulates rules across Heists that govern all future development:

**Commandments:**
- Use `Bun.CryptoHasher` for sync hashing inside transaction blocks
- Never delete refresh tokens on first use; mark them consumed instead
- Never throw errors from inside a transaction when the error case needs DB mutations
- Never duplicate secret/config constants across files; extract to a single shared module
- Never duplicate utility functions across route files; extract to `lib/utils.ts`
- Never hardcode user IDs in tests; always query the actual ID from the database

**Negative Constraints:**
- NEVER assume auto-increment IDs start at 1 after table recreation
- NEVER duplicate config constants across files
- NEVER hardcode user IDs in tests

### Example: First-Run Setup Heist

The `first-run-setup` Heist is a complete example of the Gangsta pipeline:

1. **Reconnaissance** — Associate subagents surveyed the codebase (architecture, auth system, dependencies, test coverage, Ledger entries) and produced a structured dossier

2. **The Grilling** — 2 rounds of adversarial debate:
   - Proposer suggested extending existing endpoints + new `POST /setup`
   - Devils-Advocate challenged scope (decouple settings from admin bootstrap), Docker backward compatibility, TOCTOU race conditions, last-admin deletion escalation
   - Don made key decisions: decouple scope, remove env vars entirely, simple admin-count check
   - Synthesizer produced revised solution incorporating all feedback

3. **The Sit-Down** — Formal Contract with 10 functional requirements, 6 non-functional requirements, 8 architectural decisions, 14 acceptance criteria. Consigliere reviewed for contradictions, ambiguities, and completeness.

4. **Resource Development** — 12 Work Packages across 3 territories (Backend, Frontend, Shared+Config) with execution dependencies

5. **The Hit** — All 12 WPs implemented. 59 tests pass, 0 fail.

6. **Laundering** — Verification against all acceptance criteria

## License

MIT