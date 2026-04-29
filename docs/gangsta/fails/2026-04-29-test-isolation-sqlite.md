---
date: 2026-04-29
heist: admin-settings
phase: the-hit
tags: [test-isolation, sqlite, shared-database, flaky-tests]
severity: low
---

# Test Suite Isolation Failures with Shared SQLite Database

## What Happened
When running all backend test files together (`bun test backend/tests/`), 17 tests fail due to database state pollution between suites. However, each suite passes individually with 100% success rate. The root cause is that all test files share the same SQLite database file, and state (especially user records and auto-increment IDs) created by one suite leaks into another.

## Cognitive Diagnosis
The test setup uses a single shared database without proper cleanup between suites. While individual suites may reset some state, they don't fully isolate from each other. SQLite's auto-increment counters persist even after row deletion, causing ID mismatches in tests that assume specific ID values.

## Negative Constraint
NC-6: NEVER assume test suites can share a SQLite database without isolation. Each test suite should either use a separate database file or implement a full reset (including `DELETE FROM` + `DELETE FROM sqlite_sequence WHERE name IN (...)`) between suites. Pre-existing issue — not introduced by this Heist.