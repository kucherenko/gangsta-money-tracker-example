---
heist: first-run-setup
phase: the-grilling
status: completed
timestamp: 2026-04-28T00:00:00Z
next-action: Proceed to The Sit-Down
artifacts: []
note: Grilling Conclusions passed in-context to The Sit-Down for inclusion in the Contract
---

# The Grilling: Conclusions

## Key Decisions

1. **Scope: Admin bootstrap ONLY** — First-run setup page handles only admin account creation (username, password, confirm password). No settings onboarding, no currency selection, no registration toggle. Settings remain on the existing Settings page.

2. **Detection: Extend existing `GET /auth/config/register`** — Add a `needsSetup` boolean field to the existing unauthenticated endpoint. No new reconnaissance endpoint. Frontend checks this on app load.

3. **Setup endpoint: `POST /setup`** — Unauthenticated, rate-limited (3/hour/IP), single-use. Uses `BEGIN IMMEDIATE` transaction for atomic count-and-create. Returns auth tokens on success (auto-login). Returns `409 Conflict` after any admin exists.

4. **Last-admin deletion guard** — `DELETE /admin/users/:id` rejects if the target is the last admin user. Prevents privilege escalation via setup endpoint re-opening.

5. **Remove env vars entirely** — `ADMIN_USERNAME` and `ADMIN_PASSWORD` removed from `.env.example`, `docker-compose.yml`, `validateEnv()`, and `seed.ts`. Documented as a breaking change. No fallback, no CLI script (can be added later).

6. **Seed function: categories only** — `seed()` retains category and currency seeding. Admin user creation removed entirely.

7. **`validateEnv()`: Remove `ADMIN_PASSWORD`** — Production no longer requires `ADMIN_PASSWORD`. Only `JWT_SECRET`, `OLLAMA_HOST`, `OLLAMA_MODEL` remain required.

8. **Frontend: `#/setup` route always accessible** — `Setup.svelte` is reachable via hash navigation even if the `needsSetup` check fails (network error). App.svelte redirects to setup when `needsSetup=true`, but direct navigation always works.

9. **Setup form: minimal** — Username + password + confirm password only. No email, no settings. Zod schema in `shared/schemas.ts` as `setupSchema`.

10. **Async hash outside transaction** — Password hashing (`bcrypt.hash`) happens before the `BEGIN IMMEDIATE` transaction. Count check and insert happen inside the transaction. This is safe because `BEGIN IMMEDIATE` serializes the critical section.

## Rejected Alternatives

- **Settings onboarding in setup page**: Rejected — Don decided to decouple settings from admin bootstrap.
- **Keep env vars as fallback**: Rejected — Don chose to remove env vars entirely for cleaner architecture.
- **`system_config.setup_complete` flag**: Rejected — Don chose simple admin-count check. Last-admin deletion guard addresses the escalation vector.
- **CLI setup script**: Deferred — Not included in this Heist. Can be added later for headless deployments.
- **Dedicated `GET /setup/status` endpoint**: Rejected — Extending existing `/auth/config/register` with `needsSetup` field avoids creating new reconnaissance surface.
- **Rate limiting via Redis/external store**: Rejected — Existing codebase uses in-memory rate limiting. Consistent approach.

## Unresolved Objections

1. **In-memory rate limiting on `/setup` is bypassable by IP spoofing** — Accepted risk. The self-disabling nature of the endpoint (closed after first admin) provides the primary security. Rate limiting is a deterrent, not the sole defense.
2. **Password strength for admin is only 8-char minimum** — Accepted. Consistent with existing `registerSchema`. Admin can change password later via Settings. No special strength requirements for admin.

## Termination Reason

Consensus reached after Round 2 — all valid objections addressed, no new concerns raised.