# Money Tracker

A full-stack Progressive Web Application (PWA) for personal money tracking, built with Svelte 5 + Bun + Hono + Drizzle + SQLite.

## Features

- **Transactions**: Add, edit, delete, and list income/expense entries
- **Categories**: Predefined + custom categories with colors and icons
- **Dashboard**: Real-time balance, monthly summaries, category breakdown
- **PWA**: Installable on mobile and desktop, offline banner
- **Auth**: Bearer token authentication (default: admin/admin)

## Prerequisites

- [Bun](https://bun.sh/) >= 1.1 `curl -fsSL https://bun.sh/install | bash`

## Setup

```bash
# Clone and install
git clone <repo>
cd money-tracker
bun install

# Start backend (creates DB + seeds default data)
bun run dev:backend

# Start frontend (new terminal)
bun run dev:frontend
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Default login: `admin` / `admin`

## Project Structure

```
money-tracker/
├── frontend/          # Svelte 5 SPA with Vite
│   ├── src/
│   │   ├── routes/    # Pages (Dashboard, Transactions, etc.)
│   │   ├── state/     # Svelte 5 runes-based state
│   │   ├── lib/       # API client, utils
│   │   └── components/# Reusable components
│   └── public/icons/  # PWA icons
├── backend/           # Bun + Hono REST API
│   ├── routes/        # API endpoints
│   ├── db/            # Schema + Drizzle config
│   └── middleware/    # Auth, CORS, logging
├── shared/            # Zod schemas (shared across frontend/backend)
└── package.json       # Workspace root
```

## Tech Stack

| Component | Technology |
|-----------|----------|
| Frontend | Svelte 5 (runes) + Vite + Tailwind CSS |
| State | Svelte 5 `$state` / `$derived` |
| Backend | Bun + Hono |
| Database | SQLite (`bun:sqlite`) |
| ORM | Drizzle ORM |
| Validation | Zod (shared schemas) |
| Auth | Bearer token (JWT) |
| Charts | Custom SVG (no external library) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Login (returns token) |
| `GET` | `/transactions` | List transactions (with filters) |
| `POST` | `/transactions` | Create transaction |
| `PUT` | `/transactions/:id` | Update transaction |
| `DELETE` | `/transactions/:id` | Delete transaction |
| `GET` | `/categories` | List categories |
| `POST` | `/categories` | Create category |
| `PUT` | `/categories/:id` | Update category |
| `DELETE` | `/categories/:id` | Delete category |
| `GET` | `/dashboard` | Dashboard aggregates |
| `GET` | `/health` | Health check |

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

## License

MIT
