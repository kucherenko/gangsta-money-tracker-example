# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────
# Stage 1: Dependencies
# ─────────────────────────────────────────────
FROM oven/bun:1.2-slim AS deps
WORKDIR /app

# Lockfile and package manifests
COPY bun.lock package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/

# Install all dependencies (workspaces handled by root bun.lock)
RUN bun install --frozen-lockfile

# ─────────────────────────────────────────────
# Stage 2: Build frontend assets
# ─────────────────────────────────────────────
FROM oven/bun:1.2-slim AS frontend-build
WORKDIR /app

COPY --from=deps /app/bun.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN cd frontend && bun run build

# ─────────────────────────────────────────────
# Stage 3: Production image (backend runtime)
# ─────────────────────────────────────────────
FROM oven/bun:1.2-slim AS production
WORKDIR /app

# Install curl for Docker healthchecks (not present in slim by default)
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Runtime deps only (prod)
COPY bun.lock package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN bun install --frozen-lockfile --production

# App source
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Data directory for SQLite + temp receipts
RUN mkdir -p /app/backend/db /app/backend/data/temp_receipts

# Backend exposes port 3001
EXPOSE 3001

# Static SPA served by backend from ./frontend/dist
ENV NODE_ENV=production
ENV PORT=3001
ENV STATIC_DIR=/app/frontend/dist

WORKDIR /app/backend
CMD ["bun", "run", "server.ts"]
