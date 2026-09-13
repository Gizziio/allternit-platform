# Steering checkpoint — session/aproduct-0913

## Goal
A:// product-depth phase (2026-09-13), owner-approved. Six items, dependency
order: P-T1 store-consolidation boundary → P-T2 non-local compute placement →
P-T3 worker daemon packaging → P-T4 connector breadth → P-T5 Al persona
runtime v0.1 → P-T6 Cowork protocol rendering. No merges — owner reviews.
Worktree: ../allternit-session-aproduct-0913 on session/aproduct-0913.

## Just did (resumed session — implementation was complete from prior run;
this run = verification, live evidence, and live-path bug fixes)
- Verified: cargo test -p allternit-cowork-runtime 37 green; cargo build
  -p allternit-api clean; clippy clean on ALL touched files (fixed
  pre-existing warnings in session-touched files: unused mut, late-init,
  missing docs, redundant closures); gizzi typecheck clean (0 errors after
  pnpm install restored worktree node_modules — note: prior session had
  symlinked root node_modules to the shared checkout, which vanished);
  frontend (ai.allternit.com) typecheck clean.
- Live evidence (fresh-migrated scratch DB, dev port 18013, captured in
  tmp/aproduct-evidence/LIVE_EVIDENCE.md + runnable run.sh): P-T2 vm-job
  claim granted/refused (A_CAPABILITY_MISSING 422); P-T4 files read/write
  through broker incl. approval gate + path-escape refusal + on-disk proof;
  P-T1 projection_applied false→true boundary; P-T5 Al chat fallback +
  transcript + end-to-end delegation (rule → intent → run → daemon claim);
  P-T3 daemon claim→execute→complete→SIGTERM; P-T6 all new endpoints.
- Live-path fixes (found ONLY by the live run; unit tests used the runtime
  schema and missed them): submit_intent/enqueue_job omitted dag_node_id
  (NOT NULL on API schema) → 500 on every intent submit; intent runs had no
  user_id → V169 owner-scoped reads 404'd; register_principal stored full
  a://workspace URIs vs stripped run workspace_ids → claims never matched;
  list_jobs/transition_job consulted only the in-memory mirror → canonical
  jobs invisible / 500. All fixed via canonical helpers (set_run_owner,
  workspace normalization, canonical fallbacks).
- Pre-existing main breakage fixed: duplicate migration versions
  V142/V143/V144 (cowork pass vs earlier migrations) panicked EVERY fresh
  DB (refinery UNIQUE constraint) and silently skipped the cowork columns
  on existing DBs → renumbered V169/V170/V171; added V172 connector-breadth
  seeds (github/files registrations were only in the runtime DDL seed, not
  the API migration chain). Gotcha documented: embed_migrations! does not
  trigger rebuilds on new migration files — touch db.rs.

## Next
1. Conventional commits per item (grouped), push session branch.
2. Open PR (no merge); owner reviews.

## Open questions
- P-T2 doc said "vfkit machinery" but the vfkit manager was deleted in the
  2026-09 cleanup; Lima is the current VM surface. Implemented VM mode via
  Lima and documented the correction in GIZZI_WORKER_SPEC.
- cloud-api Postgres store: honestly marked product-local projection, NOT
  removed (would gut live cloud routes) — per DoD's escape clause.
- API dev server on 18013 was killed twice by unknown external causes
  mid-session (concurrent sessions on this machine); evidence runs were
  re-done cleanly. Not investigated further.
