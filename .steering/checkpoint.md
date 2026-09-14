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
1. Owner reviews PR #491 (https://github.com/Gizziio/allternit-platform/pull/491).
   No merge by this session; no attestation (post-merge step).
2. Worktree left in place per instructions.

## Open questions
- P-T2 doc said "vfkit machinery" but the vfkit manager was deleted in the
  2026-09 cleanup; Lima is the current VM surface. Implemented VM mode via
  Lima and documented the correction in GIZZI_WORKER_SPEC.
- cloud-api Postgres store: honestly marked product-local projection, NOT
  removed (would gut live cloud routes) — per DoD's escape clause.
- API dev server on 18013 was killed twice by unknown external causes
  mid-session (concurrent sessions on this machine); evidence runs were
  re-done cleanly. Not investigated further.

Implement Rails as the unified agent communication and coordination system: consolidate cross-session messaging, agent orchestration, and steering under the existing Allternit Agent System Rails (`rails/`). Deliver Phase 1 (peer registry + steering foundation) through Phase 7 (documentation and packaging).

## Just did

- Created session worktree `allternit-session-e0669b29-9550-4a8e-af12-3f0d9e66f3c5` on branch `session/e0669b29-9550-4a8e-af12-3f0d9e66f3c5`.
- Phase 1 (peer registry + steering foundation):
  - Implemented `rails/src/peer/` module (`types.rs`, `registry.rs`, `inbox.rs`, `mod.rs`).
  - Implemented `rails/src/steer/` module (`types.rs`, `checkpoint.rs`, `consult.rs`, `mod.rs`).
  - Wired peer and steer into `rails/src/lib.rs`, `rails/src/service.rs`, and `rails/src/bin/allternit-rails.rs`.
  - Added `/api/rails/peers/*` and `/api/rails/steer/*` proxy routes in `cmd/allternit-api/src/rails/mod.rs`.
- Phase 2 (cross-session messaging via Bus):
  - Extended `rails/src/mail/types.rs` with peer address support.
  - Added `run_uds_transport` and UDS delivery to `rails/src/bus/mod.rs`.
  - Added `PeerInboundPolicy` gating in `rails/src/gate/gate.rs`.
  - Added `/v1/peers/send` and `/v1/peers` HTTP routes in `rails/src/service.rs`.
- Phase 3 (native orchestrator):
  - Implemented `rails/src/orchestrator/` module (`spec.rs`, `session.rs`, `runner.rs`, `review.rs`, `mod.rs`).
  - Added `/v1/orchestrator/*` HTTP routes and `allternit rails orchestrator ...` CLI commands.
  - Added `/api/rails/orchestrator/*` proxy routes in `cmd/allternit-api/src/rails/mod.rs`.
- Phase 4 (gizzi-code wiring):
  - Implemented `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/` (tool, prompt, UI, constants).
  - Replaced `udsMessaging.ts` and `udsClient.ts` stubs in both `src/cli/ui/ink-app/utils/` and `src/shared/utils/` with Rails peer-registry clients.
  - Updated `src/cli/ui/ink-app/setup.ts` and `src/runtime/gizzi-core/setup.ts` to export the session id before starting UDS messaging.
  - Updated `src/runtime/tools-registry-gizzi.ts` to register `ListPeersTool` from the ink-app tool.
  - `SendMessageTool` UDS branch now routes through Rails `/v1/peers/send` via `sendToUdsSocket()`.
- Verified:
  - `cargo test -p allternit-agent-system-rails` ✅ (85 passed + 5 invariants + 1 doc test)
  - `cargo build -p allternit-api` ✅
  - gizzi-code TypeScript has no errors in changed files (full `tsc --noEmit` is blocked by pre-existing missing `@allternit/gizzi-sdk/dist` artifacts in this worktree).

## Next

1. Phase 5: rewrite `tools/agent-orchestrator/scripts/ao-*` as thin `allternit rails orchestrator ...` / `allternit rails steer ...` shims.
2. Phase 6: replace `.steering/bin/*.sh` hooks with `allternit rails steer ...` calls.
3. Phase 7: update `rails/README.md`, `docs/Core_System/01-Reality/SPEC-Reality-Rails-Control-Plane.md`, `docs/ALLTERNIT_MUX_PLAN.md`, and relevant `AGENTS.md` files.

## Open questions

- Should the UDS runner be started automatically by the Rails service, or exposed as a separate `allternit-rails bus uds-runner` command?
- How should the orchestrator module authenticate to the `allternit-mux` UDS API when running inside the Rails service?
- Do we keep the existing `@allternit/orchestrator` package API surface unchanged while redirecting internals to Rails, or do we publish a breaking change?
- Should gizzi-code automatically start the Rails service if it is not running, or fail closed with a clear error?

## Files changed / to commit

New:
- `rails/src/peer/types.rs`
- `rails/src/peer/registry.rs`
- `rails/src/peer/inbox.rs`
- `rails/src/peer/mod.rs`
- `rails/src/steer/types.rs`
- `rails/src/steer/checkpoint.rs`
- `rails/src/steer/consult.rs`
- `rails/src/steer/mod.rs`
- `rails/src/orchestrator/spec.rs`
- `rails/src/orchestrator/session.rs`
- `rails/src/orchestrator/runner.rs`
- `rails/src/orchestrator/review.rs`
- `rails/src/orchestrator/mod.rs`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/ListPeersTool.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/constants.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/prompt.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/UI.tsx`

Modified:
- `rails/src/lib.rs`
- `rails/src/service.rs`
- `rails/src/bus/mod.rs`
- `rails/src/mail/types.rs`
- `rails/src/gate/gate.rs`
- `rails/src/bin/allternit-rails.rs`
- `cmd/allternit-api/src/rails/mod.rs`
- `cmd/gizzi-code/src/cli/ui/ink-app/utils/udsMessaging.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/utils/udsClient.ts`
- `cmd/gizzi-code/src/shared/utils/udsMessaging.ts`
- `cmd/gizzi-code/src/shared/utils/udsClient.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/setup.ts`
- `cmd/gizzi-code/src/runtime/gizzi-core/setup.ts`
- `cmd/gizzi-code/src/runtime/tools-registry-gizzi.ts`
- `.steering/checkpoint.md`
