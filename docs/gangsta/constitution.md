# Project Constitution

## Commandments (from Insights)

1. **C-1**: Use `Bun.CryptoHasher` for synchronous hashing inside transaction blocks; never use `Buffer.from().map()` as a naive hash substitute. — Source: insights/2026-04-28-bun-sync-sha256.md

2. **C-2**: Never delete refresh tokens on first use; mark them `consumed = 1` instead. This enables theft detection — if a consumed token is resubmitted, the user_id is available for session revocation. — Source: insights/2026-04-28-refresh-token-theft-detection.md

3. **C-3**: Never throw errors from inside a transaction when the error case also needs DB mutations to commit. Use return-values instead of throws for error cases that require DB changes to persist. — Source: insights/2026-04-28-refresh-token-theft-detection.md

4. **C-4**: Never duplicate secret/config constants across files; extract to a single shared module (e.g., `CONFIG_KEYS` in `lib/config-constants.ts`). — Source: fails/2026-04-28-duplicated-constants.md

5. **C-5**: Never duplicate utility functions across route files (e.g., `formatZodError`); extract to a shared `lib/utils.ts`. — Source: fails/2026-04-28-duplicated-constants.md

6. **C-6**: Never hardcode user IDs in tests; always query the actual ID from the database. — Source: fails/2026-04-28-hardcoded-user-ids.md

7. **C-7**: For destructive operations requiring user confirmation, use a two-step token pattern: generate a single-use, hashed, time-limited, scope-locked token first; validate and consume it before executing the destructive operation. Never skip the token step. — Source: insights/2026-04-29-cleanup-token-pattern.md

8. **C-8**: Always write audit log entries AFTER the transaction block commits, never inside it. If the transaction fails, no audit entry should exist. Token consumption should also happen outside the transaction block to prevent replay after partial failures. — Source: insights/2026-04-29-audit-after-commit.md

## Negative Constraints (from Fails)

1. **NC-1**: After table recreation migrations, never assume auto-increment IDs start at 1. — Source: fails/2026-04-28-hardcoded-user-ids.md

2. **NC-2**: Never duplicate config constants; always use `CONFIG_KEYS` from `lib/config-constants.ts`. — Source: fails/2026-04-28-duplicated-constants.md

3. **NC-3**: Never hardcode user IDs in tests; always query dynamically. — Source: fails/2026-04-28-hardcoded-user-ids.md

4. **NC-4**: Never throw errors inside transactions when the error case needs DB mutations to persist. — Source: insights/2026-04-28-refresh-token-theft-detection.md

5. **NC-5**: Never let Drizzle ORM schema definitions drift from the actual SQLite schema. When adding columns via raw SQL migrations, always update the corresponding Drizzle table definition in `schema.ts` simultaneously. When the Drizzle schema defines a column that doesn't exist in SQLite, either add the column to the database or remove it from the Drizzle definition. — Source: fails/2026-04-29-drizzle-schema-drift.md

6. **NC-6**: Never assume test suites can share a SQLite database without isolation. Each test suite should either use a separate database file or implement a full reset between suites. — Source: fails/2026-04-29-test-isolation-sqlite.md

## Architectural Decisions

- **Raw SQL over Drizzle ORM for queries**: The project uses `bun:sqlite` with hand-written parameterized SQL queries. Drizzle ORM is used only for type definitions in `schema.ts`, not for runtime queries. This decision was made for performance and simplicity with SQLite.
- **Two-step confirmation for destructive operations**: Cleanup operations require a token request + confirmation step with typed uppercase scope name, preventing accidental or CSRF-triggered deletions.
- **Audit log entries written post-commit**: Audit entries are written after the database transaction completes, ensuring no false audit records if the transaction rolls back.