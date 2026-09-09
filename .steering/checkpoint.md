# cu13-rust checkpoint

Goal: fix pre-existing flake in `idempotency::tests::in_progress_request_returns_conflict` (sleep-50ms scheduling assumption) without weakening assertions; audit idempotency module for same pattern.

## Status: DONE — PR #167 open (https://github.com/Gizziio/allternit-platform/pull/167), NOT merged (orchestrator merges).

- Fix: handler signals `started_tx` oneshot when it begins (handler runs only after middleware reserves the in-flight slot); test awaits signal instead of sleeping. 10s timeout = hang guard only. Assertions unchanged (duplicate → 409, first → 200).
- Audit: only one wall-clock sync assumption in module (the sleep). `IN_PROGRESS_STALE_SECS`/`datetime('now')` is prod TTL semantics, not test sync.
- Verification: idempotency tests 10/10 runs green; full suite 723 passed / 4 failed = the 4 pre-existing agent_cloud_routes env fails (matches baseline). No new rustfmt drift.
- Commit: 29d44885c on `session/cu13-rust`, pushed. Worktree + branch left intact for orchestrator merge (per task: do NOT merge).
