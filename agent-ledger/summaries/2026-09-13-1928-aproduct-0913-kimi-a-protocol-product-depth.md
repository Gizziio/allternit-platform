# Attestation — session/aproduct-0913: A:// protocol product-depth pass (P-T1..P-T6)

- **Date:** 2026-09-13 ( evening pass resumed an interrupted same-day session )
- **Agent:** kimi (Kimi Code CLI), session `aproduct-0913`
- **PR:** #491 — merged `d19eafc87e5073583bc36339f998eb474b4faa67` (merge commit, owner-approved)
- **Branch:** `session/aproduct-0913` (deleted after landing, per ritual)
- **Base:** `ebfa1d5d1` → merged forward over origin/main (`1c27f1017`) before landing

## What was done

The six-item product-depth phase of the A:// v0.1 coordination protocol
(spec: `docs/architecture/A_PROTOCOL.md`, `FABRIC_TRANSPORT.md`,
`A_PROTOCOL_SCHEMA.md`, `COWORK_RUNTIME_STATE_MACHINES.md`), worked in
dependency order. Task DAG with definitions of done:
`MASTER_TRACKING.md` → "A:// Product-Depth Task DAG" (all six CLOSED).

### P-T1 — Multi-store consolidation boundary

Three overlapping run/job stores existed: the canonical Rust runtime
SQLite (fabric transport), cloud-api Postgres/sqlx
(`cmd/allternit-cloud-api/src/db/cowork_models.rs`), and gizzi-code's
Drizzle cowork tables. Full physical merge was too risky in one pass, so
the consolidation BOUNDARY was implemented:

- Rails cowork REST surface (`cmd/allternit-api/src/rails/routes_cowork.rs`)
  persists all run/job/event state through canonical lease-safe projection
  helpers in `allternit-cowork-runtime::sqlite_store`
  (`persist_run_record`, `persist_job_record`,
  `mark_job_queued_for_transport`, `transition_job_record`,
  `set_run_delegator`, `set_current_run_job`, `set_run_checkpoint`,
  `update_run_state_record`, `record_run_event_projection`,
  `set_run_owner`). Raw upserts that could overwrite `lease_owner` and
  clobber leased job state are removed; `POST …/jobs/:job_id/state`
  reports `projection_applied: false` when the boundary refuses a
  leased-job write. 6 boundary tests.
- cloud-api Postgres tables: explicitly marked product-local projection
  (`cmd/allternit-cloud-api/src/db/store_boundary.rs`). NOT removed —
  would gut live cloud routes (the DoD's escape clause).
- gizzi-code Drizzle cowork writes gated by
  `src/runtime/cowork/store-boundary.ts` (11 write paths refuse with
  `CoworkStoreBoundaryError` under `GIZZI_COWORK_STORE=canonical` /
  `ALLTERNIT_COWORK_CANONICAL=1`; standalone default allows writes with a
  one-time deprecation warning). 11 tests.
- Per-store status: `docs/architecture/A_STORE_BOUNDARY.md`.

### P-T2 — Non-local compute placement

Intent `compute` policy (`vm`/`local`/`byo`/`cloud`; `auto` stays
capability-neutral) resolves to mandatory job capabilities via
`sqlite_store::compute_requirements`; `submit_intent` enqueues the
claimable canonical job (Al-targeted parent intents excepted so delegation
cannot be bypassed); `PUT /api/v1/fabric/transport/principals/:id/capabilities`
lets operators declare placement capabilities; the gizzi worker executes
`GIZZI_COMPUTE_MODE=vm` steps inside the Lima VM. Identity/attribution
unchanged. 5 placement tests.

### P-T3 — Gizzi worker daemon packaging

`cmd/gizzi-code/src/runtime/fabric-transport/worker-daemon-entry.ts`:
structured JSON logs, exponential claim backoff with jitter, SIGTERM/SIGINT
graceful stop (in-flight job finishes; abandoned leases requeue via the
sweeper). Claim protocol unchanged. Packaging: `packaging/launchd/
com.allternit.gizzi-worker.plist`, `packaging/systemd/gizzi-worker.service`,
`cmd/gizzi-code/docs/FABRIC_WORKER_DAEMON.md` with the operator-provisioned
token flow end-to-end.

### P-T4 — Connector breadth

GitHub connector (`connector.github.read`/`connector.github.write` via
`ALLTERNIT_BROKER_GITHUB_TOKEN`) and files/local connector
(`connector.files.read`/`connector.files.write` via
`ALLTERNIT_BROKER_FILES_ROOT`, path confinement under the root) through the
existing broker (V173 registers them). Writes approval-gated both; secrets
read system-side at invoke time only, never in worker payloads; attributed
`connector.invoked`. `base64` dep added to the runtime crate. 3 tests
incl. on-disk escape refusals.

### P-T5 — Al persona runtime v0.1

`POST /api/v1/cowork/al/chat` + `GET /api/v1/cowork/al/sessions/:id`
(`cmd/allternit-api/src/al_persona_routes.rs`; transcript table
`cowork_al_messages`, V172). Model-assisted intent extraction reuses the
model router/gateway — `run_completion` was extracted from `/v1/responses`
and shared, so there is NO new LLM path (same catalog, credit gate, OS
inference) — with a deterministic fallback when no control plane is
configured. Target resolution via `resolve_delegation_rule`, shared with
the orchestrator loop. Al acts under `a://principal/al` with its
zero-capability posture: plans and delegates; workers execute. 4 in-module
unit tests.

### P-T6 — Richer Cowork protocol rendering

New endpoints: `GET /fabric/transport/principals`, delegation-rules CRUD
(`GET`/`PUT`/`DELETE /fabric/transport/delegation-rules`),
`GET /fabric/transport/connector-sessions`, attribution triple
(initiator/delegator/executor) on `GET /runs/:id/events`.
`surfaces/ai.allternit.com/src/views/FabricTransportView.tsx`: principals/
bots management (roles, capability chips, one-time token provisioning),
delegation rules editor, connector sessions view, run-detail timeline
interleaving attributed events with approval states (inline grant/deny).
Real endpoints only.

## Out-of-scope-but-necessary fixes (in the same PR, flagged for review)

1. **Fresh-DB migrations were broken on main.** V142/V143/V144 each
   existed twice — the 2026-09-13 cowork production pass (merge `5737b3fbc`)
   collided with the earlier runtime-settings/agent-hardening/deployment
   migrations. Refinery panicked (`UNIQUE constraint failed:
   refinery_schema_history.version`) on EVERY fresh database, and the
   cowork variants were silently skipped on existing databases (their
   `user_id`/approvals columns never applied). This session branched before
   main's own fix (PR #484, `session/cu25-migrationfix`) and independently
   renumbered to V169–V171; the PR #491 merge kept origin/main's numbering
   (cowork trio at V168–V170) and this branch's P-T4/P-T5 additions take
   V172/V173. Fresh DBs now migrate V1→V173 clean.
2. **`embed_migrations!` no-rebuild gotcha** (documented in CHANGELOG):
   `refinery::embed_migrations!` is a proc macro and cannot emit
   `cargo:rerun-if-changed` — adding a file under
   `cmd/allternit-api/migrations/` does not trigger a rebuild; the binary
   silently embeds the previous migration set. Workaround: touch
   `cmd/allternit-api/src/db.rs` (or clean build). Burned one evidence-run
   cycle in this session.
3. **Live-path schema-drift fixes** (surfaced ONLY by the live evidence
   run; the runtime crate's test DDL masked all of them):
   - `submit_intent`/`enqueue_job` omitted `dag_node_id`, NOT NULL on the
     API's V8 schema (defaulted only in the crate's test DDL) — every
     intent submission 500'd on the API schema.
   - Intent-created runs carried no `user_id`, so the V168 owner-scoped
     Rails reads 404'd on them — fixed with new `sqlite_store::set_run_owner`,
     wired into both submit paths.
   - `register_principal` stored full `a://workspace/…` URIs while runs
     store stripped workspace ids — claims and list filters never matched.
     Normalized at registration and in the principals list query.
   - `GET /runs/:id/jobs` consulted only the in-memory legacy mirror
     (intent-created jobs were invisible) and `transition_job` 500'd with
     JobNotFound on canonical-only jobs — canonical-store fallback and
     mirror-conditional transition, per the P-T1 boundary.

## Re-scopes (documented, with reasons)

- **P-T2 VM machinery:** the brief said "existing vfkit machinery", but
  the vfkit manager was deleted in the 2026-09 dead-code cleanup; Lima is
  the current VM surface (`src/runtime/vm/lima-executor.ts`). VM mode was
  implemented via Lima; correction documented in `GIZZI_WORKER_SPEC.md`.
- **P-T1 cloud-api Postgres store:** marked product-local projection, not
  removed — removal would gut live cloud routes (the DoD's explicit escape
  clause). Honest status in `A_STORE_BOUNDARY.md`.

## Verification evidence

- `cargo test -p allternit-cowork-runtime` — **38/38 green post-merge**
  (37 session tests: 6 boundary + 5 placement + 3 connector + in-module Al
  + protocol conformance; +1 added on main), 0 failed.
- `cargo build -p allternit-api` clean; `cargo clippy -p
  allternit-cowork-runtime -p allternit-api --all-targets` clean on every
  touched file (pre-existing warnings in session-touched files fixed:
  unused mut, late-init, missing docs, redundant closures).
- gizzi-code `bun run typecheck` clean (0 errors);
  `test/runtime/cowork-store-boundary.test.ts` 11 pass.
- Frontend `pnpm typecheck` (surfaces/ai.allternit.com) clean.
- `node scripts/release-preflight.mjs` — 36/0.
- Fresh-DB boot on the merge commit: migrates V1→V173, serves health.
- **Live behavioral evidence, all six items** (dev port 18013,
  fresh-migrated scratch DB, 2026-09-13): vm-required job claimed by the
  VM-capable worker / local-only worker refused `A_CAPABILITY_MISSING`
  (422); boundary `projection_applied: false`→`true`; brokered files read,
  approval-gated write (request → human grant → delivered, on-disk proof),
  `../../` escape refused; Al chat fallback + transcript, then a full
  Al → delegation-rule → intent → daemon-worker claim/execute/complete
  cycle; daemon clean SIGTERM stop; every P-T6 endpoint. Captured in
  `tmp/aproduct-evidence/LIVE_EVIDENCE.md`, rerunnable via
  `tmp/aproduct-evidence/run.sh` (kept in the repo per owner).

## Incidents / notes

- The session worktree's `node_modules` had been symlinked to the shared
  checkout by the earlier session; the shared checkout's modules vanished
  mid-hiatus (concurrent sessions), breaking both typechecks. Fixed with a
  real `pnpm install` (worktree-local) — `pnpm-lock.yaml` artifact
  reverted; not part of the PR.
- The dev API on port 18013 was killed twice by an external cause
  (concurrent sessions on this machine) mid-evidence; runs were redone
  cleanly on fresh scratch DBs.
- Merge of origin/main into the PR branch collided on the same migration
  renumber (both sides fixed the V142–V144 duplication independently);
  resolved by keeping main's numbering and bumping this branch's additions
  (V172/V173). Zero duplicate migration versions remain.

## Honest deferrals

- cloud-api Postgres cowork store removal (marked, not removed — see
  re-scopes).
- GitHub connector exercised in unit tests only (no live token used in the
  evidence run); files/local connector exercised live.
- Al's deterministic fallback extraction produces action_type `run` with no
  step payload (jobs execute with zero steps until model-assisted
  extraction is configured); documented behavior, not a gap in the persona
  surface itself.
- Approval-to-lease binding coverage remains non-universal across
  protected tools/connectors (carried from the protocol phase, listed in
  `A_PROTOCOL.md` §16 "Partial").
