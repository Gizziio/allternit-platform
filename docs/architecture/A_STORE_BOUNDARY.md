# A:// Store Consolidation Boundary (P-T1)

**Status:** Boundary implemented 2026-09-13 (session/aproduct-0913).
Physical merge of the non-canonical stores is deliberately deferred — see
per-store status below.

## The rule

Within a deployment, **every write to A:// cowork run/job/event state flows
only through the canonical fabric-transport store**:
`allternit-cowork-runtime`'s SQLite store (`sqlite_store.rs`), served by
`allternit-api` at `/api/v1/fabric/transport/*`. Only the transport
functions (`enqueue_job`, `claim_job`, `record_heartbeat`, `renew_lease`,
`complete_job`, `expire_leases`) may write lease columns.

Product surfaces that mirror run/job state persist through the canonical
**projection helpers** in `sqlite_store.rs`
(`persist_run_record`, `set_run_delegator`, `persist_job_record`,
`mark_job_queued_for_transport`, `transition_job_record`,
`set_current_run_job`, `set_run_checkpoint`, `update_run_state_record`,
`record_run_event_projection`). These helpers are lease-safe by
construction: they never touch lease columns, and a projection state write
is **refused** while the job holds a fabric-transport lease — only the
transport moves leased work.

Proof: `infrastructure/executor/cowork/cowork/allternit-cowork-runtime/tests/store_boundary_tests.rs`.

## The three stores, per-store status

### 1. Rust runtime SQLite (canonical) — `allternit-cowork-runtime`

- **Role:** canonical store for A:// runs, jobs, events, principals,
  intents, approvals, handoffs, memory grants, delegation rules, connector
  sessions. Same DB file the API's refinery migrations manage
  (`V168` ownership columns, `V153` lease columns, `V162–V167` protocol
  additions).
- **What changed (P-T1):** the Rails cowork REST surface
  (`cmd/allternit-api/src/rails/routes_cowork.rs`) previously issued raw
  SQL upserts that could overwrite `lease_owner` and clobber a leased job's
  state. All of those writes now route through the canonical projection
  helpers; `transition_job` reports `projection_applied: false` when the
  boundary refuses a leased-job write. The crate's test DDL gained the V142
  `user_id` columns (guarded `ensure_column`) so the store schema is
  self-contained.
- **Live-path corrections (2026-09-13 evidence run):** intent-created runs
  are stamped with the authenticated owner via `set_run_owner` (the V168
  owner-scoped Rails reads 404'd on them before); `GET /runs/:id/jobs`
  falls back to the canonical table when the legacy in-memory mirror has no
  rows; `transition_job` only drives the mirror when the mirror holds the
  job — canonical-only jobs go straight to `transition_job_record`.
- **Status:** canonical. Single writer enforced in code (module doc +
  helpers + tests).

### 2. cloud-api Postgres/sqlx (`cmd/allternit-cloud-api`) — product-local projection, NOT removable this pass

- **Role:** this service's own `runs` / `jobs` / `events` / `checkpoints` /
  `approvals` / `schedules` / `attachments` / `tasks` tables back Allternit
  Cloud's hosted-runtime and agent-session product routes. They have never
  participated in the A:// lifecycle (see conformance matrix §5).
- **What changed (P-T1):** `src/db/store_boundary.rs` records the boundary
  contract and honest status; `cowork_models.rs` carries a header pointer.
  Single writer per store: only this service's services/routes write these
  tables; nothing here writes the canonical A:// tables, and no A:// path
  writes these.
- **Status:** explicitly-marked **product-local projection**. Removal is
  future physical-merge work gated on rehoming the cloud product's route
  surface — judged too risky for a single pass (it would gut live cloud
  routes with passing e2e tests).

### 3. gizzi-code Drizzle cowork tables (`cmd/gizzi-code/src/runtime/cowork/cowork.sql.ts`)

- **Role:** local run/event/schedule/approval/checkpoint records for
  gizzi's Cowork runtime (opt-in via `GIZZI_COWORK_ENABLED`) and its server
  routes. When gizzi is paired with an Allternit API these tables are a
  **legacy projection** of A:// state and must not accept writes that would
  fork canonical run/job/event state.
- **What changed (P-T1):** `src/runtime/cowork/store-boundary.ts` resolves a
  store mode and gates every Cowork store write in `cowork.service.ts`
  (runs, events, schedules, approvals, checkpoints — 11 write paths):
  - `GIZZI_COWORK_STORE=canonical` (or `ALLTERNIT_COWORK_CANONICAL=1`):
    writes throw `CoworkStoreBoundaryError` naming the fabric-transport
    endpoints to use instead.
  - default `legacy` (standalone gizzi: the local store is the only store,
    hence canonical for that deployment): writes proceed, with a one-time
    deprecation warning naming the boundary.
  - Reads from the local tables are unchanged; in canonical mode they are a
    read-only legacy projection.
- **Status:** legacy projection when paired; canonical when standalone.
  Physical redirect of the runtime's execute loop onto fabric transport is
  deferred with the physical merge.

## What was NOT done (honest deferrals)

- **No physical merge** of the cloud-api Postgres store or the gizzi
  Drizzle store into the canonical SQLite store. The boundary (single
  writer, lease-safe projections, gated legacy writes) is the v0.1
  consolidation; merging storage engines is a separate, larger migration.
- **Legacy product tables in `cmd/allternit-api/src/cowork_routes.rs`**
  (`cowork_sessions`, `cowork_personas`, `cowork_projects`,
  `cowork_approvals`, `cowork_suggestions`) are product records, not
  run/job/event stores, and are out of this boundary's scope.
