---
heist: auth-multi-user
phase: laundering
type: insight
date: 2026-04-28
---

# Refresh Token Rotation with Theft Detection

## Insight
The standard "rotate + delete" refresh token pattern is insufficient for theft detection. If you simply delete the old token on first use and create a new one, when a stolen token is reused, it won't be found in the DB — making it impossible to identify which user to revoke.

**Solution:** Mark consumed tokens (`consumed = 1`) instead of deleting them. When a consumed token is resubmitted, the user_id is available, allowing you to revoke all sessions for that user.

Additionally, when throwing errors from inside a DB transaction, any mutations (DELETEs) are rolled back. To ensure deletions persist, use return-values instead of throws for error cases that also need DB mutations.

## Commandment
- Never delete refresh tokens on first use; mark them consumed instead
- Never throw errors from inside a transaction when the error case also needs DB mutations to commit