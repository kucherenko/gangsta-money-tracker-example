---
date: 2026-04-29
heist: admin-settings
phase: the-hit
tags: [cleanup, tokens, two-step-confirmation, safety]
---

# Cleanup Token Pattern for Destructive Operations

## Discovery
During the admin-settings Heist, we needed a way to protect destructive database cleanup operations (deleting all transactions, removing orphaned data). The Devils-Advocate in The Grilling pushed for safeguards beyond simple confirmation dialogs.

## Solution
Implemented a two-step confirmation pattern using single-use, hashed, time-limited tokens:
1. `POST /admin/cleanup/token` generates a `crypto.randomUUID()`, hashes it with `Bun.CryptoHasher("sha256")`, stores only the hash with 5-minute expiry, scope-lock, and user-lock. Returns the raw UUID to the requester.
2. `POST /admin/cleanup` requires submitting the raw token + scope. The handler validates hash match, expiry, scope, user, and consumption status, then marks the token consumed BEFORE executing the transaction-wrapped cleanup.

This pattern prevents CSRF (token required), replay attacks (single-use), and accidental execution (typed uppercase scope confirmation on frontend).

## Project Commandment
C-7: For destructive operations requiring user confirmation, use a two-step token pattern: generate a single-use, hashed, time-limited, scope-locked token first; validate and consume it before executing the destructive operation. Never skip the token step.