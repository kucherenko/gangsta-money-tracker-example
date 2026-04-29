---
heist: auth-multi-user
phase: laundering
type: fail
date: 2026-04-28
---

# Hardcoded User IDs in Tests

## Fail
Test files used hardcoded `user_id=1` for the admin user. After the users table was recreated with new schema (DROP + CREATE), auto-increment IDs continued from previous values (e.g., admin got id=70). FK constraints on transactions broke because the inserted `user_id=1` didn't exist.

## Root Cause
Assumption that the admin user always has `id=1` after migration.

## Negative Constraint
- Never hardcode user IDs in tests; always query the actual ID from the database
- After table recreation migrations, auto-increment IDs may not start at 1