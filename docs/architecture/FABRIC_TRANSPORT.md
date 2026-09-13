# Fabric Transport and Lease Protocol

**Layer:** Execution transport under A://

**Canonical route prefix:** `/api/v1/fabric/transport/*`

**Primary implementation:**

- `cmd/allternit-api/src/rails/fabric_transport_routes.rs`
- `infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/transport.rs`
- `infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/sqlite_store.rs`
- `cmd/allternit-api/migrations/V149__cowork_principals.sql`
- `cmd/allternit-api/migrations/V150__cowork_job_lease_columns.sql`
- `cmd/allternit-api/migrations/V151__cowork_event_attribution.sql`
- `cmd/allternit-api/migrations/V155__cowork_approval_bindings.sql`

## 1. What Fabric Transport is

Fabric Transport is the worker-facing execution ownership layer for A:// jobs.

It answers one question:

> Which authenticated principal owns the right to execute this job right now?

It does **not** define the full A:// protocol, model routing, bot personality, Cowork UX, or connector semantics.

## 2. Core contract

A queued job becomes executable only when an authenticated principal successfully claims a lease.

```text
queued job
   -> eligibility check
   -> persistence-level atomic claim
   -> lease grant
   -> running
   -> heartbeat / renew
   -> complete | expire
```

The lease is the execution authority.

## 3. Principal registration and authentication

Workers are registered as `cowork_principals` with:

- canonical principal ID
- workspace
- declared capabilities
- token hash
- status

The registration endpoint returns the bearer token once. Only its SHA-256 hash is persisted.

A worker must authenticate using:

```http
Authorization: Bearer <token>
```

Possession of an `a://` address alone is not authentication.

## 4. HTTP surface

### Principal registration

```http
POST /api/v1/fabric/transport/principals
```

Requires normal user authentication.

Request:

```json
{
  "id": "a://workspace/acme/bot/research",
  "workspace": "acme",
  "capabilities": ["web.read", "files.project.read"]
}
```

Response includes a bearer token exactly once.

### Claim

```http
POST /api/v1/fabric/transport/claim
```

Requires worker bearer authentication.

Request fields:

- `job_id` optional targeted claim
- `wait_secs` optional long-poll duration, capped by the server
- `lease_ttl_secs` optional lease lifetime

Successful claim returns a `LeaseGrant` containing:

- `job_id`
- `run_id`
- `lease_id`
- `lease_generation`
- `lease_expires_at`
- `payload`
- `required_capabilities`
- `current_checkpoint_id`
- `initiator`
- `delegator`

### Job view

```http
GET /api/v1/fabric/transport/jobs/:job_id
```

Returns the canonical persisted job view.

### Heartbeat

```http
POST /api/v1/fabric/transport/jobs/:job_id/heartbeat
```

Required fields:

- `lease_id`
- `lease_generation`

`worker_time` is advisory only. The server clock is authoritative.

### Renew

```http
POST /api/v1/fabric/transport/jobs/:job_id/renew
```

Validates principal, lease ID, generation, job state, and server-side expiry before extending ownership.

### Complete

```http
POST /api/v1/fabric/transport/jobs/:job_id/complete
```

Completion is accepted only from the authenticated executor holding the current valid lease generation.

The endpoint is idempotent for already committed terminal work and returns the canonical existing result instead of creating duplicate effects.

## 5. Approval binding

Protected execution can use lease-scoped approval bindings.

### Worker endpoints

```text
POST /fabric/transport/jobs/:job_id/approvals/request
POST /fabric/transport/jobs/:job_id/approvals/check
GET  /fabric/transport/approvals/:approval_id
```

### Human decision endpoints

```text
POST /fabric/transport/approvals/:approval_id/grant
POST /fabric/transport/approvals/:approval_id/deny
```

Approval scope includes:

- executor
- capability
- target
- run
- job
- lease ID
- lease generation

When a lease generation expires, its approval bindings are invalidated. A replacement worker under a new generation must re-obtain approval for the protected action.

## 6. Atomic claim rule

Claim atomicity lives in persistence, not only in `RunManager`.

The invariant is equivalent to a compare-and-swap:

```text
UPDATE queued job
SET owner, lease_id, lease_generation = lease_generation + 1, expires_at
WHERE job is still queued / eligible
```

Exactly one active generation may own a job at a time.

The in-memory runtime is a mirror used for execution/runtime coherence; it is not allowed to create a second source of ownership truth.

## 7. Lease generations

`lease_generation` is a monotonic execution-ownership counter.

Example:

```text
Worker A -> generation 1
A disappears
lease 1 expires
job requeued
Worker B -> generation 2
```

A late completion from Worker A must fail with stale-generation semantics.

## 8. Heartbeat and expiry

Workers heartbeat while executing. Heartbeat proves liveness, not progress.

Lease expiry is decided by the server clock.

On expiry, the runtime applies recovery policy:

```text
leased
  -> expired
  -> approval bindings invalidated
  -> retry count advanced
  -> queued OR dead_letter
```

The sweeper handles runtime expiry. Boot recovery also expires leases that died while the server was offline.

## 9. Restart recovery

Startup recovery performs three important actions:

1. expire leases whose server-issued deadline passed during downtime;
2. rehydrate persisted Cowork runs;
3. rehydrate persisted Cowork jobs, including queued and leased jobs.

The runtime must not silently lose durable work after restart.

## 10. Run-state honesty

A run must not become `running` simply because it was created or planned.

Current contract:

```text
created -> planned -> queued
claim succeeds -> running
```

`RUNNING` means execution ownership exists.

## 11. Checkpoint recovery model

Recovery does not promise resurrection of process memory or in-flight tool calls.

The portable unit is the last committed checkpoint.

After reassignment:

```text
new lease generation
   -> load canonical job/run state
   -> resolve last committed checkpoint
   -> replay/resume deterministic work from checkpoint
```

Workers should design jobs so externally committed effects and checkpoint boundaries are explicit.

## 12. Capability eligibility

The principal declares capabilities. The job declares `required_capabilities`.

A worker is not eligible if required capability strings are absent.

Capability checks are dispatcher/transport enforcement, not model judgment.

## 13. Attribution

Material run events support the attribution triple:

- `initiator`
- `delegator`
- `executor`

Example:

```text
initiator: a://workspace/acme/user/joe
delegator: a://workspace/acme/principal/al
executor:  a://workspace/acme/bot/research
```

Execution must be attributed to the principal that actually acted.

## 14. Error vocabulary

Stable wire errors are defined by `TransportErrorCode`.

Current examples include:

```text
A_AUTHENTICATION_FAILED
A_PRINCIPAL_NOT_FOUND
A_WORKSPACE_MISMATCH
A_CAPABILITY_MISSING
A_PERMISSION_DENIED
A_NO_ELIGIBLE_WORKER
A_JOB_ALREADY_LEASED
A_INVALID_LEASE
A_STALE_LEASE_GENERATION
A_LEASE_EXPIRED
A_RUN_CANCELLED
A_APPROVAL_REQUIRED
A_APPROVAL_INVALID
A_RESULT_ALREADY_COMMITTED
A_JOB_NOT_FOUND
A_STORE_ERROR
```

Callers should branch on stable wire codes, not human-readable error text.

## 15. Environment configuration

Current server defaults can be overridden with:

```text
ALLTERNIT_FABRIC_TRANSPORT_LEASE_SECS
ALLTERNIT_FABRIC_TRANSPORT_SWEEP_SECS
```

Treat these as operational tuning knobs, not semantic changes to the protocol.

## 16. Worker reference loop

A basic worker should behave like:

```text
authenticate
loop:
  long-poll claim
  if no work: continue
  load checkpoint if present
  execute deterministic step(s)
  heartbeat while active
  renew before expiry when needed
  request/check approval for protected action
  checkpoint after committed step boundaries
  complete with typed result
```

Never continue executing a job after losing the active lease generation.

## 17. Conformance test

The defining failure-recovery test is:

```text
Worker A claims generation 1
A starts work
A dies
heartbeats stop
lease generation 1 expires
bound approvals are invalidated
job requeues
Worker B claims generation 2
B resumes from last committed checkpoint
A submits late completion -> rejected
B completes -> exactly one canonical terminal result
ledger preserves attribution
```

Any future transport implementation must preserve these semantics even if its network mechanism differs.

## 18. Not Fabric Transport's responsibility

Do not put these concerns into Fabric Transport merely because work passes through it:

- Al personality or prompt
- bot product configuration
- model selection logic
- user memory policy
- connector secret storage
- Cowork presentation
- CommRails peer messaging semantics
- public `a://` resolution

Fabric Transport should remain narrow: authenticated execution ownership, lease lifecycle, protected action binding, and attributable completion.
