---
date: 2026-04-29
heist: admin-settings
phase: the-hit
tags: [drizzle, schema, sqlite, mismatch, raw-sql]
severity: medium
---

# Drizzle ORM Schema Out of Sync with Actual SQLite Schema

## What Happened
During the Consigliere review, it was discovered that the `refresh_tokens` table in the actual SQLite database has a `consumed` column (added via migration in `db/index.ts` line 234), but the Drizzle ORM schema definition (`db/schema.ts`) does NOT include this column. This means any code using the Drizzle ORM to query `refresh_tokens` would not see the `consumed` field, while raw SQL queries work correctly.

Similarly, the `users` table does NOT have a `created_at` column in SQLite, but the Drizzle schema defines `createdAt: integer("created_at")` with a default. The Consigliere flagged this as a Contract deviation (FR-004 wanted `created_at` in the user list response), but the column doesn't actually exist in the database.

## Cognitive Diagnosis
The codebase uses a dual approach: Drizzle ORM type definitions in `schema.ts` alongside raw SQL queries with `bun:sqlite`. Migrations are done manually in `db/index.ts` rather than via Drizzle's migration system. This led to the Drizzle schema drifting from the actual SQLite schema over time — columns added via raw SQL migrations weren't reflected back in the Drizzle type definitions, and the Drizzle definitions included columns that don't exist in SQLite.

## Negative Constraint
NC-5: NEVER let Drizzle ORM schema definitions drift from the actual SQLite schema. When adding columns via raw SQL migrations, ALWAYS update the corresponding Drizzle table definition in `schema.ts` simultaneously. When the Drizzle schema defines a column that doesn't exist in SQLite, either add the column to the database or remove it from the Drizzle definition.