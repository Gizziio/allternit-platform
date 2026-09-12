# Checkpoint — artphase1-0912

**Goal:** Land Artifacts API Phase 1 (gateway CRUD + design-session persistence) per docs/design/artifacts-api.md; version retention cap 50 at append time; PR merge, ledger, desktop rebuild, cleanup.

**Just did:** All 6 content-artifact route tests pass (lifecycle, create idempotency, append idempotency, retention cap prune w/ env override, filters+cursor pagination+user scoping, file storage roundtrip). Fixed two real bugs found by tests: skillId/skillName camelCase aliases; cursor-bind placeholder collapse. Design vitest 80/80. typecheck 0 errors. release-preflight 35/0. Session branch pushed (2 commits). Full `cargo test -p allternit-api` running in background.

**Next:** Full test suite → `cargo build --release -p allternit-api` → live curl smoke (ALLTERNIT_LOCAL_DEV_BYPASS=1, port 18013, temp data dir) → PR + merge → issue 387 comment/close → ledger → desktop rebuild → cleanup.

**Open questions:** None.
