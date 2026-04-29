---
heist: auth-multi-user
phase: laundering
type: fail
date: 2026-04-28
---

# Duplicated Constants Across Files

## Fail
`JWT_SECRET` fallback string was defined independently in `routes/auth.ts` and `middleware/auth.ts`. If one is changed without the other, token signing and verification mismatch silently.

## Root Cause
Quick implementation without establishing shared config module.

## Negative Constraint
- Never duplicate secret/config constants across files; extract to a single shared module
- `formatZodError` utility was duplicated in 5 route files — extract to `lib/utils.ts`