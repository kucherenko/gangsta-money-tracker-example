---
date: 2026-04-29
heist: admin-settings
phase: the-hit
tags: [audit-log, transactions, ordering, sqlite]
---

# Audit Log Writes After Transaction Commit

## Discovery
During implementation of the admin cleanup and user deletion endpoints, we needed to write audit log entries for destructive operations. The Constitution (C-3) already states: "Never throw errors inside transactions when error cases need DB mutations."

## Solution
Audit log entries are written AFTER the `transaction()` block completes successfully, not inside it. This ensures:
1. If the transaction rolls back, no audit entry is falsely recorded
2. If the audit write fails, the actual data mutation still succeeded
3. No risk of throwing inside a transaction (Constitution compliance)

Token consumption (`UPDATE cleanup_tokens SET consumed = 1`) is also performed outside the transaction block — if the cleanup transaction fails, the token is already consumed, preventing replay of a failed operation.

## Project Commandment
C-8: Always write audit log entries AFTER the transaction block commits, never inside it. If the transaction fails, no audit entry should exist. Token consumption should also happen outside the transaction block to prevent replay after partial failures.