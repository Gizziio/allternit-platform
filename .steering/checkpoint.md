# Checkpoint — ao/uhp-gateway (P6a executor)

## Goal
Land P6a: UHP 2026-08-11 core-class gateway as new workspace crate
`infrastructure/executor/uhp-gateway/`, in-process under `ao serve`, with
kimi/claude/codex drivers; hard gates: uhp-conformance core green,
stream/cancel/resume across backends, HR pytest advisory; NOTES sentinel.

## Just did
- Pulled latest main (P7 landed). Verified prior-session scaffold compiles,
  32/32 crate tests pass.
- Added `ao serve` verb (src/ao/serve.rs) mounting uhp-gateway in-process;
  engine auto-start parity with ao contract commands; `ao serve health`.
- Fixed live-boot bugs: Discovery capabilities all-false (D-05), axum 0.7
  `:id` path syntax (all parameterized routes 404'd), PTY screen wrapping
  broke NDJSON parsing → turn watcher now reads the transcript tee file
  incrementally, stale tab id on session resume, kimi driver real wire shape
  (role-keyed JSON, no type field; drop non-JSON noise; -S not -c).
- Smoke over HTTP on kimi: blocking turn, SSE stream, background+cancel,
  previous_response_id resume (same session, correct recall), idempotency
  replay. claude (OAuth expired) + codex (usage limit) environmentally blocked.
- Gate 1 (uhp-conformance --class core --harness-id chrn_kimi) running.

## Next
- Gates 2 (stream/cancel/resume per backend; kimi green, claude/codex
  environmental reds) and 3 (HR pytest advisory), commit, NOTES sentinel.

## Open questions
- claude OAuth expired machine-wide; codex usage-limited until Sep 16 — both
  are user-account states outside executor control; will report red honestly.
