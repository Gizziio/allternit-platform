# cu13-rust checkpoint

Goal: fix pre-existing flake in `idempotency::tests::in_progress_request_returns_conflict` (sleep-50ms scheduling assumption) without weakening assertions; audit idempotency module for same pattern.

## 2026-09-08 — milestone 0: worktree ritual
- Worktree: `../allternit-session-cu13-rust` on branch `session/cu13-rust` from `main` (335b3badc).
- Sole ownership: `cmd/allternit-api/**` only.

## milestone 1: root cause + fix
- Root cause: `idempotency.rs` test slept 50ms and assumed req 1 had reserved its in-flight DB slot. Under load the duplicate could reserve first → 200 instead of 409 (test asserts 409).
- Fix: handler now signals `started_tx` when it begins (handler only runs after middleware reserves the slot); test awaits that signal instead of sleeping. 10s timeout is a hang guard only, not a scheduling assumption. Assertion unchanged: duplicate → 409, first → 200.
- Audit: only one wall-clock sync assumption in the module (line 497). `IN_PROGRESS_STALE_SECS`/`datetime('now')` in prod code is TTL semantics, not test sync. No other instances.

## Next
- Full suite running: `cargo test -p allternit-api` (expect 723 pass / 4 pre-existing agent_cloud_routes env fails).
- Commit `fix(allternit-api):`, push, PR.

## milestone 2: verification (partial)
- `cargo test -p allternit-api idempotency` 10/10 runs green (7 passed each).
- No new rustfmt drift from my lines (pre-existing drift elsewhere in crate left untouched).
