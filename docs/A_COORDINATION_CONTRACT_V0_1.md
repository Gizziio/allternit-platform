# A:// Coordination Contract v0.1

**Status:** Internal architecture draft
**Public status:** Not yet a customer-facing protocol
**Pronunciation:** `A://` is pronounced **"Al"** when referring to the user-facing Coworker persona.
**Scheme notation:** In technical specifications and code, the coordination namespace is written **`a://`**.
**Last updated:** 2026-09-12 (four fabric-transport/lease corrections folded into §8; see §8.0)

---

## 1. Purpose

A:// defines the common coordination contract used by participants inside the Allternit system.

It establishes how humans, agents, bots, tools, services, models, runtimes, and compute resources are:

- identified
- addressed
- authorized
- delegated work
- transported
- supervised
- approved
- attributed
- returned results

A:// does not perform intelligence itself.

**A:// is not the intelligence. A:// is the protocol by which intelligence coordinates.**

The user-facing Coworker known as **Al** is a principal that speaks A://. Al is not the protocol itself and is not a mandatory security root.

---

## 2. Core architecture

A:// separates four concerns: **Participants** (who), **Roles** (what they're permitted to do), **Transport** (how messages move), **Execution** (how work runs).

### Participants

Every actor is a first-class **Principal**.

Examples:

```text
a://principal/al
a://principal/gizzi
a://bot/research
a://bot/bookkeeper
a://user/joe
```

A Principal owns or references:

```text
identity
workspace
credentials
memory scope
connector permissions
approval policy
model/router policy
compute policy
budget
concurrency limits
audit identity
```

Every action MUST be attributed to the principal that actually performed it.

The principal that delegated an action MUST NOT replace the executor in the audit record.

Example:

```text
initiator: a://principal/al
executor:  a://bot/research
```

not:

```text
actor: a://principal/al
```

for everything that happens downstream.

---

## 3. Roles

A role describes what a Principal is permitted or expected to do.

Roles are not identities.

Initial role vocabulary:

```text
orchestrator
worker
reviewer
observer
system
human
```

A Principal MAY hold multiple roles.

Example:

```text
Principal: a://principal/al
roles:
  - orchestrator
  - user-interface
```

Gizzi:

```text
Principal: a://principal/gizzi
roles:
  - worker
  - terminal
  - code
```

A user-created Research Bot:

```text
Principal: a://bot/research
roles:
  - worker
  - research
```

No architectural rule requires all work to pass through Al.

Al ships as the **default user-facing orchestrator**, not the mandatory root of the graph.

Other principals MAY:

- coordinate their own subdomain
- delegate directly
- communicate peer-to-peer
- operate without Al
- exist in isolated trust domains

---

## 4. Addressing

A:// resources use an internal logical namespace.

Examples:

```text
a://principal/al
a://principal/gizzi
a://bot/research
a://bot/bookkeeper
a://workspace/allternit
a://run/8f21
a://task/42
a://connector/github
a://connector/gmail
a://compute/local
a://compute/vm/dev-01
a://compute/cloud/default
a://memory/project/allternit-os
```

An A:// address identifies a logical resource.

It does NOT imply:

- a public Internet URI scheme
- OS-level URL handlers
- DNS resolution
- public interoperability
- direct network transport

External systems reach A:// resources through supported APIs, connectors, or gateways.

---

## 5. Intent envelope

All work entering the execution system SHOULD normalize into an A:// Intent.

Minimum envelope:

```yaml
version: a/0.1

intent_id: intent_01J...
workspace: a://workspace/allternit

initiator:
  principal: a://user/joe

target:
  principal: a://bot/research

action:
  type: research
  description: >
    Research three vendors and compare price,
    capability, and reputation.

context:
  memory:
    - a://memory/project/vendor-selection

permissions:
  requested:
    - web.read
    - files.project.read

connectors:
  allowed:
    - a://connector/web

compute:
  policy: auto

model:
  policy: router:auto

approval:
  policy: risk-gated

return:
  channel: cowork
  destination: a://workspace/allternit

metadata:
  correlation_id: corr_...
```

The envelope describes intent.

It MUST NOT imply that execution has occurred.

### Intent idempotency

Intent submission is idempotent on `intent_id`.

Submitting the same `intent_id` more than once MUST NOT create multiple logical Runs.

```text
same intent_id → same logical intent → same canonical run_id
```

The system MAY return the existing Run when duplicate delivery occurs.

Events are idempotent on `event_id`.

Terminal results are idempotent on `run_id + terminal_state`.

This requirement applies across HTTP, CommRails, WebSocket, scheduler delivery, webhook delivery, retries, reconnects, and worker recovery.

At-least-once transport delivery MUST NOT become at-least-once side effects.

**Implemented for the event API (migration V157).** `POST /runs/:id/events`
accepts an optional client-supplied `event_id` idempotency key
(`client_event_id`, unique per run): retries return the canonical existing
event (`{id, duplicated: true}`) instead of double-writing. Store-level:
`sqlite_store::insert_event_idempotent`. System-generated fabric-transport
events remain single-writer by construction.

---

## 6. Intent lifecycle

The canonical lifecycle is:

```text
INTENT
  ↓
VALIDATED
  ↓
PLANNED
  ↓
TRANSPORTED
  ↓
LEASED
  ↓
RUNNING
  ↓
WAITING_APPROVAL
  ↓
RUNNING
  ↓
COMPLETED
```

Alternate terminal states:

```text
REJECTED
CANCELLED
FAILED
EXPIRED
```

No UI may report an intent as assigned, running, or complete unless the underlying runtime has entered the corresponding state.

### Lifecycle mapping

The A:// lifecycle MUST map explicitly onto the canonical Run/DAG implementation (`allternit-cowork-runtime`). The existing runtime state machine (created→planned→queued→running→paused/awaiting_approval/recovering→completed/failed/cancelled, with job states leased/checkpointing/retry_backoff/dead_letter) is retained; A:// states are the semantic names layered on it.

```text
A:// concept          Runtime state
INTENT RECEIVED   →   created
PLANNED           →   planned
TRANSPORTABLE      →   queued
LEASED            →   job: leased
RUNNING           →   running
WAITING APPROVAL  →   awaiting_approval
RECOVERING        →   recovering
RETRY WAIT        →   retry_backoff
COMPLETED         →   completed
FAILED            →   failed
CANCELLED         →   cancelled
UNRECOVERABLE     →   dead_letter
```

The implementation MUST define one canonical persisted state machine. Other product surfaces translate from it. They MUST NOT maintain competing lifecycle definitions.

---

## 7. Fabric transport (summary)

An accepted Intent produces or attaches to a Run.

```text
Intent → Run → Jobs / DAG
```

Fabric transport determines: eligible worker, execution environment, required capabilities, connector availability, permission compatibility, resource availability, concurrency, budget, policy.

A:// is not considered operational until this path is real. §8 defines the protocol.

---

# 8. Fabric Transport and Lease Protocol

## 8.0 The four locks (2026-09-12)

These four decisions are architectural and were folded in before implementation. They MUST NOT be re-litigated in code review; changing one requires a contract revision.

1. **Canonical proof-slice store = Rust runtime SQLite.** For the v0.1 proof slice, the Rust `allternit-cowork-runtime` SQLite store is the canonical persisted run/job/event state. The cloud API and gizzi orchestrator act as clients of that spine for this slice; they do not maintain competing run truth. (The repo currently has three overlapping stores — Rust runtime SQLite, cloud-api Postgres/sqlx, gizzi-code Drizzle — so atomic leasing requires this choice now.)
2. **Claims are atomic at the persistence layer.** Eligibility MAY be calculated in `RunManager`, but the actual claim MUST be a transactional compare-and-swap against the persisted `cowork_jobs` row, not an in-process lock.
3. **Recovery = replay from the last committed checkpoint; server clock is authoritative.** A replacement worker does not magically resume in-memory state: a job is a deterministic step sequence and resumption = replay from the last committed checkpoint under a new lease generation. Lease expiry is judged by the fabric-transport/server clock only; `worker_time` in heartbeats is advisory.
4. **v0.1 workers discover jobs by long-polling the claim endpoint.** CommRails push is a latency optimization only and is outside the protocol correctness contract.

## 8.1 Purpose

A:// fabric transport converts validated intent into durable execution.

Its responsibility is not to perform the work. Its responsibility is to determine:

- what work is executable
- which Principal may perform it
- which capabilities are required
- where execution may occur
- which policies govern execution
- how ownership of a Job is temporarily granted
- what happens when a worker disappears
- how execution completes exactly once

Fabric transport is part of the execution substrate, not part of Al's identity.

Al MAY create or delegate an Intent.

Al MUST NOT be required for fabric transport.

Any authorized A:// Principal or system component MAY originate executable work.

## 8.2 Canonical path

Every executable request follows the same path:

```text
Intent
  ↓
Validate
  ↓
Create / Resolve Run
  ↓
Generate Jobs / DAG
  ↓
Queue Job
  ↓
Fabric transport evaluates eligibility
  ↓
Worker claims Lease        (long-poll; see 8.0 lock 4)
  ↓
Worker executes
  ↓
Heartbeat / Renew
  ↓
Complete | Fail | Retry | Reassign
  ↓
Result
  ↓
Attributed Ledger Event
```

A user interface MUST NOT report work as running merely because a Principal said it delegated the task.

`RUNNING` means an eligible worker holds a valid execution lease and the runtime has entered the running state.

## 8.3 Workspace-scoped addressing

Executable Principals MUST resolve inside a workspace or tenant scope.

Canonical internal form:

```text
a://workspace/{workspace_id}/principal/{principal_id}
a://workspace/{workspace_id}/bot/{bot_id}
```

Examples:

```text
a://workspace/allternit/principal/al
a://workspace/allternit/principal/gizzi
a://workspace/allternit/bot/research
```

A short alias MAY exist within an already-resolved workspace (`a://bot/research`), but the canonical persisted identity MUST remain workspace scoped.

Two workspaces MAY independently contain `bot/research` without collision.

Address minting MUST require authority within the target workspace.

## 8.4 Principal authentication

A worker MUST prove which Principal it represents before it may claim work.

Possession of an `a://` address is not authentication.

Authentication MAY vary by transport, but MUST bind the runtime process to a Principal identity.

Initial supported mechanisms MAY include:

```text
local IPC            → operating-system peer identity
local / remote service → signed bearer credential
service-to-service   → mTLS identity
cloud worker         → short-lived worker token
BYO compute worker   → enrolled machine identity + short-lived execution credential
```

The authenticated identity MUST equal the Principal attempting to claim the lease.

A worker authenticated as `a://workspace/acme/bot/research` MUST NOT claim a Job as `a://workspace/acme/bot/bookkeeper` unless explicitly delegated a separate credential for that Principal.

## 8.5 Connector secret isolation

Principals MUST NOT receive raw long-lived connector credentials as normal execution inputs.

Connector access is brokered.

```text
Principal → requests capability → Connector Broker
   → checks Principal + Run + Policy → issues scoped session → external service
```

A brokered connector session SHOULD be scoped to: principal, run, capability, resource scope, expiry, approval state.

The Bookkeeper Bot may use the authorized QuickBooks capability. It does not receive the underlying reusable QuickBooks secret.

(The connector broker itself is out of scope for the v0.1 proof slice; this section defines the invariant it must eventually satisfy.)

## 8.6 Capability vocabulary

Workers declare capabilities. Jobs declare required capabilities.

Version 0.1 uses flat capability strings. Initial vocabulary MAY include:

```text
web.read / web.write
files.project.read / files.project.write
files.system.read / files.system.write
shell.exec
git.read / git.write
gui.observe / gui.control
browser.navigate / browser.form.submit
connector.github.read / connector.github.write
connector.gmail.read / connector.gmail.send
connector.calendar.read / connector.calendar.write
memory.read / memory.write
artifact.create / artifact.modify
```

Workers MAY expose additional namespaced capabilities (e.g. `vendor.example.capability`).

Fabric-transport eligibility requires the worker's effective capability set to satisfy all mandatory Job requirements.

Capabilities describe what a worker **can** do. Policy determines what that worker **may** do in the current context. These are separate.

## 8.7 Job eligibility

A worker is eligible for a Job only when all mandatory constraints pass.

Minimum eligibility evaluation:

```text
workspace match
principal status
worker online/available
required capabilities
connector availability
permission policy
compute compatibility
resource limits
budget
concurrency
model requirements
trust-domain restrictions
```

Eligibility is deterministic policy evaluation.

Model reasoning MAY assist in planning work.

Model reasoning MUST NOT silently bypass fabric-transport eligibility rules.

## 8.8 Compute placement

A Job MAY declare a compute requirement or placement policy.

Examples: `local`, `vm`, `remote`, `cloud`, `byo`, `auto`.

Fabric transport resolves placement against: job requirements, principal policy, workspace policy, available workers, hardware capability, data locality, security classification, cost policy, latency policy.

Compute placement MUST NOT change the Principal responsible for the action.

Identity and execution location are independent.

(Non-local placement is out of scope for the v0.1 proof slice.)

## 8.9 Lease creation

A queued Job becomes executable only after a valid lease is issued.

A lease minimally contains:

```yaml
lease_id: lease_01...
lease_generation: 3

run_id: run_01...
job_id: job_07...

executor:
  principal: a://workspace/acme/bot/research

compute:
  target: a://workspace/acme/compute/local

issued_at: ...        # server-authoritative (lock 3)
expires_at: ...       # server-authoritative (lock 3)

capabilities:
  - web.read
  - files.project.read
```

`lease_generation` MUST increase whenever execution ownership changes.

A stale worker MUST NOT continue execution under an earlier lease generation.

## 8.10 Claim

Workers discover work by **long-polling the claim endpoint** in v0.1 (lock 4). CommRails push MAY later optimize wake-up latency, but it is not part of the correctness contract.

Workers claim Jobs; fabric transport does not assume delivery equals ownership.

```text
Worker → claim(job_id)
Fabric transport:
  ├── authenticate worker
  ├── verify eligibility
  ├── verify job still available
  ├── atomically assign lease     (persistence-level CAS — lock 2)
  └── return lease
```

**Claiming MUST be atomic at the persistence layer.** Eligibility is evaluated in fabric transport, but exclusivity of ownership is decided by a transactional compare-and-swap against the persisted job row (e.g. `UPDATE cowork_jobs SET lease_owner = ?, lease_generation = lease_generation + 1, ... WHERE job_id = ? AND state = 'queued' RETURNING ...`). An in-process lock MUST NOT be the source of claim exclusivity.

Exactly one active lease generation may own a Job at a time. Concurrent claims must result in one winner. Other workers receive an explicit conflict or unavailable result.

## 8.11 Heartbeat

A leased worker MUST heartbeat while performing work.

Heartbeat proves liveness. Heartbeat does not imply progress.

```yaml
lease_id: lease_01...
lease_generation: 3
worker_time: ...     # advisory only; server clock decides expiry (lock 3)
status: running
```

The runtime SHOULD record progress separately through attributed events.

If heartbeats stop beyond the configured lease timeout:

```text
LEASE ACTIVE → heartbeat stops → LEASE EXPIRES → job enters recovery/requeue policy
```

## 8.12 Renew

A worker MAY renew a lease before expiration.

Renewal succeeds only if:

```text
lease_id matches
lease_generation matches
executor matches
Job is not terminal
Run is not cancelled
policy still permits execution
```

Renewal MUST NOT resurrect an expired lease generation.

## 8.13 Lease expiry

Lease expiry is judged by the **server-authoritative clock** (lock 3).

When a lease expires, the worker loses authority to execute the Job.

The runtime MUST:

```text
mark lease expired
record attributed expiration event
invalidate lease-bound approvals
transition Job according to recovery policy
```

Recovery MAY result in: retry, requeue, reassign, fail, dead-letter.

A process continuing after lease expiry MUST have its subsequent completion rejected.

**Recovery semantics (lock 3):** a replacement worker does not resume in-memory state. A Job is a deterministic step sequence; resumption = replay from the last committed checkpoint under the new lease generation. Checkpoints are data and are portable across lease generations.

## 8.14 Approval binding

An approval is bound to an execution context.

Minimum scope:

```text
executor
capability
target
run_id
job_id
lease_generation
```

Example:

```yaml
executor: a://workspace/acme/bot/bookkeeper
capability: connector.bank.payment.submit
target: payment/123
run_id: run_01
job_id: job_09
lease_generation: 2
```

If generation `2` expires and generation `3` is issued to another worker, the previous approval is invalid.

A new approval MUST be obtained unless policy explicitly defines a safe reusable authorization class.

This prevents replay of stale approvals after reassignment.

**Implemented (v0.1 proof slice).** `cowork_approval_bindings` (migration V155) scopes
every approval to (executor, capability, target, run_id, job_id, lease_generation).
Workers request under their lease via `POST /api/v1/fabric/transport/jobs/:id/approvals/request`
and gate protected actions with `.../approvals/check` (store-level:
`allternit-cowork-runtime/src/sqlite_store.rs::request_approval/check_approval`);
humans decide via `.../approvals/:id/grant|deny` (user auth). Lease expiry
invalidates all bindings of the expired generation (`approval.invalidated` event,
executor-attributed), so a replacement worker under a new generation must
re-obtain approval — enforced in the §8.24 conformance test.

**Timeout / auto-deny (implemented).** Every binding carries a server-clock
`expires_at` (request-selectable TTL, default 300s; migration V156). The sweeper
and the boot pass expire stale requests with attributed `approval.expired`
events; `decide` after expiry is rejected (`A_APPROVAL_INVALID`) and `check` on
an expired binding returns `A_APPROVAL_REQUIRED`. Recovery policy for an
expired approval is **re-request** (deny-by-default): a late human grant can
never authorize execution that was already told to re-request.

**Single policy path (implemented).** Risk rules and bindings are one system:
`allternit-cowork-runtime/src/risk_policy.rs` implements the same rule model as
the cowork-engine `ApprovalGate` (first-match on actionType + riskLevel,
low-risk auto-approve default; workspace overrides in `cowork_approval_policy`,
migration V158). Risk rules decide WHETHER a protected action needs an
approval at all; bindings scope the approval when one is required. Auto-decide
via the request path is ledgered (`approval.granted`/`approval.denied`,
decided_by=`risk-rule (...)`); `check` is read-only and writes nothing, so
polling cannot flood the ledger. The TS `ApprovalGate` remains the UI-side
request manager; it does not gate execution — fabric transport's evaluation is
the single execution-gating path.

## 8.15 Delegation chain

Every delegated Intent or Job MUST carry an append-only causation chain.

Example:

```text
a://user/joe → a://principal/al → a://bot/research → a://bot/browser
```

Structured representation:

```yaml
causation_chain:
  - a://workspace/allternit/user/joe
  - a://workspace/allternit/principal/al
  - a://workspace/allternit/bot/research
  - a://workspace/allternit/bot/browser
```

The system MUST reject delegation cycles (`A → B → A` is invalid).

Version 0.1 SHOULD enforce a configurable maximum delegation depth. Recommended default: `4`. Workspace policy MAY reduce this limit. Increasing it SHOULD require explicit policy.

## 8.16 Completion

A worker completes a Job by submitting a terminal result while holding the active lease generation.

Completion MUST validate:

```text
authenticated executor
lease_id
lease_generation
job ownership
run state
result schema
```

A valid completion atomically:

```text
records result
marks Job terminal
releases lease
writes terminal event
advances DAG
updates Run state
```

Repeated completion requests for the same terminal Job MUST return the canonical existing result rather than produce duplicate side effects.

## 8.17 Result envelope

Completion does not mean "stdout exists."

A completed Job or Run returns a typed Result.

Minimum structure:

```yaml
result_id: result_01...
run_id: run_01...
job_id: job_07...

status: completed

executor:
  a://workspace/allternit/bot/research

summary:
  "Compared three vendors."

artifacts:
  - a://workspace/allternit/artifact/vendor-comparison

outputs:
  structured:
    vendor_count: 3

completed_at: ...
```

Results MAY contain: artifact references, structured data, messages, external action references, checkpoints, logs, metrics.

Large artifacts SHOULD be referenced rather than embedded.

## 8.18 Attribution

Every transport-related material event MUST preserve:

```text
initiator
delegator
executor
```

Example:

```yaml
initiator: a://workspace/allternit/user/joe
delegator: a://workspace/allternit/principal/al
executor:  a://workspace/allternit/bot/research
```

If Research delegates browser work:

```yaml
initiator: a://workspace/allternit/user/joe
delegator: a://workspace/allternit/bot/research
executor:  a://workspace/allternit/bot/browser
```

Al MUST NOT appear as executor merely because Al originated or coordinated the overall work.

## 8.19 Cancellation

Cancellation MUST propagate down the causation tree.

Cancelling a Run prevents new Jobs from being leased.

Active workers are notified to terminate.

Active leases become non-renewable.

Sensitive capabilities and connector sessions SHOULD be revoked.

Already-completed external side effects are not automatically reversible.

The ledger must distinguish: cancel requested / execution stopped / external effect already committed.

## 8.20 Recovery on restart

On restart, fabric transport MUST rehydrate durable state from the canonical store (lock 1).

It MUST determine:

```text
which Runs are active
which Jobs are queued
which leases remain valid
which leases expired during downtime
which Jobs require retry
which Jobs require human intervention
```

A process restart MUST NOT silently convert unknown work into success or loss.

**Implemented (v0.1 proof slice).** At boot, `cmd/allternit-api` first runs one
`expire_leases` pass against the canonical store (server clock; downtime-expired
leases get the same requeue/dead-letter recovery as runtime expiry), then
rehydrates ALL runs and ALL jobs — queued and leased — into the RunManager
mirror (`load_persisted_cowork_jobs`, `RunManager::load_job`; the runtime `Job`
type carries `lease_id`, `lease_generation`, `required_capabilities`).

## 8.21 Dead-letter

A Job reaches `dead_letter` when automated recovery is exhausted or policy forbids retry.

Examples:

```text
max retries reached
repeated worker crash
required connector permanently unavailable
invalid capability configuration
non-recoverable external action ambiguity
```

Dead-letter Jobs require explicit inspection or remediation.

Cowork SHOULD surface them prominently.

## 8.22 Required fabric-transport events

Version 0.1 SHOULD standardize at least:

```text
intent.accepted / intent.rejected
run.created / run.planned / run.queued / run.started / run.completed / run.failed / run.cancelled
job.queued / job.claimed / job.leased / job.started / job.heartbeat / job.lease_renewed
  / job.lease_expired / job.requeued / job.completed / job.failed / job.dead_lettered
delegation.created / delegation.rejected
approval.requested / approval.granted / approval.denied / approval.expired / approval.invalidated
result.created
```

Every event MUST carry `event_id`.

Material execution events MUST carry attribution.

## 8.23 Failure semantics

A:// failures MUST be explicit.

Initial fabric-transport-related errors:

```text
A_AUTHENTICATION_FAILED
A_PRINCIPAL_NOT_FOUND
A_WORKSPACE_MISMATCH
A_CAPABILITY_MISSING
A_PERMISSION_DENIED
A_NO_ELIGIBLE_WORKER
A_COMPUTE_UNAVAILABLE
A_JOB_ALREADY_LEASED
A_INVALID_LEASE
A_STALE_LEASE_GENERATION
A_LEASE_EXPIRED
A_APPROVAL_REQUIRED
A_APPROVAL_INVALID
A_DELEGATION_CYCLE
A_DELEGATION_DEPTH_EXCEEDED
A_RUN_CANCELLED
A_RESULT_ALREADY_COMMITTED
A_TRANSPORT_FAILED
```

Errors MUST be observable by Cowork and the audit ledger.

## 8.24 Proof-of-protocol test

A:// Fabric-Transport Conformance is not achieved until the following test passes end to end:

```text
 1. User submits Intent
 2. Al delegates to Research Bot
 3. Intent resolves to durable Run
 4. Job enters queue
 5. Fabric transport identifies eligible worker
 6. Worker authenticates
 7. Worker claims lease generation 1
 8. Worker begins execution
 9. Worker requires protected action
10. ApprovalGate requests approval
11. User approves
12. Execution resumes
13. Worker is killed before completion
14. Heartbeats stop
15. Lease generation 1 expires
16. Approval bound to generation 1 becomes invalid
17. Fabric transport requeues Job
18. Replacement worker authenticates
19. Replacement claims lease generation 2
20. Required protected action is re-evaluated
21. Worker completes
22. Result commits exactly once
23. Run reaches completed
24. Cowork shows canonical state
25. Ledger shows: initiator = user, delegator = Al, executor = actual worker(s)
```

The test MUST also verify that the killed worker cannot later submit a valid completion using lease generation 1.

Passing this test establishes that:

```text
identity is real
transport is real
leases are real
failover is real
approval binding is real
attribution is real
exactly-once completion is real
```

Only then should the implementation claim A:// Fabric-Transport conformance.

## 8.25 Implementation priority

```text
 1. Canonical Principal identity + authentication
 2. Capability registry
 3. Canonical IntentEnvelope
 4. Intent → Run creation
 5. Fabric transport
 6. Atomic Job claim (persistence-level CAS)
 7. Lease generation/token
 8. Heartbeat
 9. Renew/expire
10. Recovery/reassignment (checkpoint replay)
11. Approval ↔ lease binding
12. Three-actor attribution
13. Typed Result envelope
14. Adversarial failover test
15. Cowork visualization
```

UI polish comes after the execution contract is proven.

## 8.26 Invariant

Fabric transport does not decide **who someone is**.

The model does not decide **what someone may do**.

Al does not decide **what the ledger attributes to another Principal**.

A worker does not decide **whether its own lease remains valid**.

Each boundary belongs to the system designed to enforce it.

The core A:// execution invariant is:

> **No work is considered executed unless an authenticated Principal performs it under a valid lease, within policy, with attributable results.**

---

## 9. Transport

**CommRails** is the primary participant-to-participant transport abstraction.

A:// specifies the semantic message.

CommRails carries it.

These must remain separate concepts.

```text
A://          → semantic contract
CommRails     → transport / addressing / delivery
Run Engine    → durable execution
```

Other transports MAY carry an A:// envelope: HTTP API, WebSocket, local IPC, message queue, Slack adapter, email adapter, mobile push.

Transport does not change the meaning of the A:// message.

---

## 10. Execution

The Run/DAG engine is the canonical execution substrate.

A:// requests ultimately resolve into executable runs.

```text
a:// intent → fabric transport → run/DAG → worker → tool/connector/computer
   → event stream → ledger → result
```

Cowork, Slack, mobile, terminal, API, and other surfaces MUST observe the same underlying run rather than creating separate execution models.

---

## 11. Cowork

Cowork is the primary **control room** for A:// activity.

Cowork is not Al.

Cowork should expose:

```text
conversation / runs / plans / workers / bots / delegations / approvals
timelines / artifacts / events / compute / connectors / audit
```

Al may be conversationally present inside Cowork, but the product must not collapse into a single chat transcript.

The underlying work remains inspectable independently of Al's conversational representation.

---

## 12. Al

**Al** is the persistent default Coworker identity.

Technical identity: `a://principal/al` (canonical: `a://workspace/{ws}/principal/al`).

Default roles: `orchestrator`, `user-interface`.

Al may: receive requests, maintain conversational continuity, plan work, create runs, delegate, monitor, request approval, summarize state, report results.

Al MUST NOT automatically own: all credentials, all worker memories, all connector permissions, all execution authority, all audit attribution.

Al coordinates the system.

Al is not the system.

---

## 13. Gizzi

Gizzi is the default technical worker underneath the A:// coordination layer.

Technical identity: `a://principal/gizzi`.

Primary roles: `code`, `terminal`, `repository`, `filesystem`, `build`, `debug`, `development-environment`.

Al may delegate technical work to Gizzi.

Gizzi remains independently: permissioned, audited, routed, scheduled, sandboxed.

---

## 14. User-created Bots

Bots are durable worker principals created or configured by users.

Example:

```text
a://bot/research
a://bot/travel
a://bot/bookkeeper
a://bot/support
```

Each bot has independent: identity, role, memory, credentials, connectors, permissions, triggers, compute policy, model policy, approval policy, budget, audit history.

Bots MAY communicate directly with other principals over CommRails when policy permits.

---

## 15. Versioning

Every A:// message MUST declare a protocol version.

Initial form: `a/0.1`.

Breaking semantic changes require a version change.

Unknown mandatory fields or unsupported versions MUST fail explicitly rather than silently degrading.

Example errors:

```text
A_UNSUPPORTED_VERSION
A_UNKNOWN_PRINCIPAL
A_PERMISSION_DENIED
A_NO_ELIGIBLE_WORKER
A_LEASE_EXPIRED
A_APPROVAL_REQUIRED
A_CONNECTOR_UNAVAILABLE
A_EXECUTION_FAILED
A_RETURN_UNREACHABLE
```

---

## 16. Conformance

A component may claim it **speaks A://** only if it can participate in the required lifecycle for its declared role.

A worker claiming A:// Worker conformance must be able to:

```text
resolve its principal identity
accept eligible jobs
claim a lease
heartbeat
emit attributed events
respect approval gates
complete/fail the job
return a result
```

A surface claiming A:// Control conformance must be able to:

```text
create or observe intents
observe canonical run state
display approvals
display attributed events
display completion/failure
```

A component that only stores an `a://` identifier is not A:// conformant.

---

## 17. First proof slice

A:// MUST remain an internal draft until the vertical slice in §8.24 works.

Required proof:

```text
initiator = user
delegator = Al
executor = Research Bot

run is durable
worker claims a real lease
approval is scoped correctly
execution actually occurs
completion returns
ledger preserves attribution
Cowork displays the canonical state
```

The v0.1 slice deliberately uses a simple shell-step job — the point is proving durable execution, leases, failover, approval semantics, and attribution, not model intelligence.

Until this works end to end: **A:// is a proposed coordination contract.**

After this works: **A:// is an implemented coordination protocol.**

---

## 18. Architectural rule

Any future Allternit feature involving intelligence should answer:

> Does this participate in A://, or are we creating another execution island?

The goal is not to force every subsystem through Al.

The goal is to give every subsystem the same grammar for coordination.

---

## 19. Canonical summary

**A:// is Allternit's coordination protocol for humans, agents, bots, tools, models, and compute.**

**Al is the persistent user-facing Coworker and default orchestrator that speaks A://.**

**Gizzi is Al's primary technical and terminal worker.**

**Bots are independently permissioned, independently auditable worker identities.**

**CommRails moves messages.**

**The Run/DAG engine executes work.**

**Fabric decides where work runs.**

**Cowork is the control room where the whole system can be observed and governed.**

And the architectural invariant is:

> **A:// coordinates intelligence without collapsing intelligence into one identity.**

---

# Appendix A — Type mapping onto the existing codebase

Verdicts: **Reuse** (exists, fits) / **Extend** (exists, needs fields) / **Missing** (build it).

### Principal — Extend

| Field | Lands in | Verdict |
|---|---|---|
| identity | `cowork_personas` (name, system_prompt) + CommRails peer registry `.allternit/peers/` | Extend — personas table has no credentials/policy/budget |
| workspace | `cowork_projects` / cloud `tenant_id` | Reuse |
| approval policy | `ApprovalGate` auto-rules by risk/action (`packages/@allternit/cowork-engine/src/gate.ts`) | Extend — real rules engine exists; needs per-principal binding + surfaced modes (`always-ask/risk-gated/autonomous`) |
| memory scope | `cowork_memory_entries` (type/tags/source) + engine `CoworkMemoryService` | Extend — no per-principal scoping or sharing rules |
| compute/model policy | Rust `cowork_runs.policy_profile` | Extend — column exists, undefined semantics |
| budget/concurrency | — | Missing |
| audit identity | commrails Ledger events | Extend — events lack the initiator/delegator/executor triple |

### IntentEnvelope — Missing as a type; pieces exist

`version/initiator/target/action` have no home. `POST /cowork/run-agent` and `/team-execute` (`cmd/allternit-api/src/cowork_routes.rs:1692-1819`) are the closest thing — and they are dead-end INSERTs (nothing ever reads `cowork_executions`). The envelope replaces `cowork_executions`: that table is inserted and never read; it should either become the intent store or be deleted. `context.memory` → memory entries (Reuse); `return.channel` → cowork-controller WS broadcast (Reuse).

### Run — Reuse/Extend

Rust runtime already nails this: `cowork_runs` (initiator, mode, state, entrypoint, dag_id, current_job_id, current_checkpoint_id, policy_profile) with a validated state machine (`allternit-cowork-runtime/src/run.rs:514-558`) and rehydration from SQLite at boot (`cmd/allternit-api/src/main.rs:1154`). Gaps: add `intent_id` FK, `delegation_depth`, `causation_chain`. Cloud-api models duplicate this (`cmd/allternit-cloud-api/src/db/cowork_models.rs`) — for the slice, one canonical store (lock 1).

### Job + Lease — Extend the schema, Missing the machinery

`cowork_jobs` (migration `V8__cowork_jobs_and_handoffs.sql`) already has `lease_owner`, `retry_count/max_retries`, `timeout_sec` — the lease columns exist. But there is no claim/heartbeat/renew/expire protocol (heartbeat loops are empty, `run.rs:560-592`), no lease generation/token, and job transitions are unvalidated. This is the critical path.

### Approval — binding implemented (v0.1)

Scoped bindings landed: `cowork_approval_bindings` (V155) with
(executor, capability, target, run, job, lease_generation) scope, request/check/grant/deny
protocol under `/api/v1/fabric/transport/*`, expiry invalidation (§8.14), server-clock
request expiry with auto-deny (V156), and one policy evaluation path shared with
the cowork-engine ApprovalGate rule model (`risk_policy.rs`, workspace overrides in
`cowork_approval_policy`, V158) — see the §8.14 implementation notes. The unscoped
listing bug (`cmd/allternit-api/src/cowork_routes.rs` `GET /cowork/approvals`) is
fixed (user-filtered). Still open: unifying the older `ApprovalGate` UI request
manager's pending-set with the binding table (single table), approval
auto-deny *reasons* surfaced in Cowork.

### Event/Attribution — conformant for material events

`cowork_run_events` (append-only) + commrails ledger mirroring (`cmd/allternit-api/src/rails_client_impl.rs:436-482`) + SSE stream (`rails/routes_cowork.rs`) are the spine. Landed: the three-actor attribution triple (V154) on every fabric-transport material event, event types per §8.22 for the transport/approval vocabulary (`job.claimed`, `job.lease_expired`, `approval.requested/granted/denied/invalidated`, `result.created`, …). Still open: idempotency on client-supplied `event_id` (system-generated ids today).

### Result/Artifact — Extend

Attachments registry (`allternit-cowork-runtime/src/attachment.rs`, with reconnect tokens — store hashed, per this spec's claim), checkpoints (JSON, best-effort). Missing: a declared typed result envelope (what does `COMPLETED` return? typed artifact refs, not stdout).

### Fabric transport (was: dispatcher) — proof slice implemented

Was a blank page; now implemented as the v0.1 proof slice (see Appendix B): bearer-token
principal auth, eligibility + persistence-level CAS claim, lease generation/token,
heartbeat/renew, server-clock expiry sweeper with requeue/dead-letter, stale-generation
completion rejection, exactly-once typed result, and the initiator/delegator/executor
attribution triple on every material event. File pointers:
`allternit-cowork-runtime/src/transport.rs` (types + `A_*` error codes),
`allternit-cowork-runtime/src/sqlite_store.rs` (store-level protocol),
`allternit-cowork-runtime/src/run.rs` (lease sweeper),
`cmd/allternit-api/src/rails/fabric_transport_routes.rs` (HTTP surface under
`/api/v1/fabric/transport/*`), migrations V152–V154. Still missing (later slices):
capability registry beyond flat strings, non-local compute placement, reassignment
policy beyond requeue, CommRails push wake-up.

### Honest scorecard against §16

```text
Run                = conformant
Event/Transport    = conformant (attribution triple on material events)
Approval           = conformant (scoped, expiry-invalidated, timeout auto-deny, single risk-policy path)
Principal          = auth conformant (bearer-token, hashed)
Lease/Fabric-transport = proof slice conformant (§8.24 test passes)
Intent             = not yet (envelope type; run creation is the current entry)
```

---

# Appendix B — Proof-slice implementation plan

Target: the §8.24 test with the simplest real job (a shell step sequence, not a model call). One store, one fabric transport, two fake workers.

| Step | Build | Lands in |
|---|---|---|
| 0 | Commit this contract to `docs/` | `docs/A_COORDINATION_CONTRACT_V0_1.md` |
| 1 | `cowork_principals` table: id, workspace, capabilities JSON, token hash, status | new migration `V83__cowork_principals.sql` (verify next free number) |
| 2 | Job lease columns: `lease_id`, `lease_generation`, `lease_expires_at`, `claimed_at` | migration + `cowork_jobs` |
| 3 | Auth middleware on claim/heartbeat/complete: bearer token → principal identity | `cmd/allternit-api/src/rails/routes_cowork.rs` |
| 4 | Claim as store-level CAS; eligibility check in `RunManager` before CAS | `allternit-cowork-runtime/src/run.rs` + store |
| 5 | Real expiry sweeper: replace the empty heartbeat loops (`run.rs:560-592`) — expire leases, invalidate bound approvals, requeue per policy | same |
| 6 | Heartbeat/renew endpoints with server-authoritative clock + generation check | `routes_cowork.rs` |
| 7 | Attribution triple on `cowork_run_events` (initiator/delegator/executor) | migration + event writes |
| 8 | Completion validation: executor + lease + generation + idempotent on terminal state | `run.rs` |
| 9 | The adversarial test: worker A claims gen 1, killed, lease expires, worker B claims gen 2, A's late completion rejected, exactly-once result, ledger shows the triple | `allternit-cowork-runtime/tests/integration_tests.rs` + a small fake-worker binary |

**Explicitly out of scope:** connector broker (§8.5), compute placement beyond `local`, CommRails push notification, model execution, Cowork visualization, cleanup of dead/fake execution paths (`cowork_executions`, gizzi fake remote modes), desktop release path.

**Exit criterion:** step 9 passes behaviorally — nothing else counts.

---

*Changelog: 2026-09-12 — v0.1 internal draft (fourth update): approval request timeout/auto-deny (V156, sweeper `approval.expired`, late-grant rejection, recovery policy = re-request); event POST idempotency on client-supplied `event_id` (V157, canonical-return on retry); single approval policy path — Rust `risk_policy.rs` mirrors the cowork-engine ApprovalGate rule model, workspace overrides (V158); conformance tests for expiry, idempotency, risk policy. 2026-09-12 — v0.1 internal draft (third update): approval↔lease binding (§8.14) implemented — `cowork_approval_bindings` (V155), request/check/grant/deny protocol, expiry invalidation; boot-time recovery (§8.20) implemented — downtime lease expiry pass + full run/job rehydration; `start_run` now stops at `queued` (RUNNING = lease held, §8.2); full §8.24 conformance test including approval steps passes. 2026-09-12 — v0.1 internal draft. Merged dispatcher/lease protocol as §8, superseding the original §8 "Lease / claim semantics". Folded in the four architectural locks (§8.0). Added Appendix A (codebase type mapping) and Appendix B (proof-slice plan). 2026-09-12 (later) — terminology locked: "dispatcher"/"dispatch" renamed to **fabric transport** throughout §7/§8 and the appendices (lifecycle `DISPATCHED` → `TRANSPORTED`); `A_DISPATCH_FAILED` → `A_TRANSPORT_FAILED`; HTTP surface `/api/v1/dispatch/*` → `/api/v1/fabric/transport/*`; env `ALLTERNIT_DISPATCH_*` → `ALLTERNIT_FABRIC_TRANSPORT_*`. Behavior, CAS mechanism, and the four locks unchanged.*
