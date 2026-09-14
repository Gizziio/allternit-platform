# A:// Schema / API Reference

**Status:** Reference. Every shape below is grounded in code (file cited) or explicitly marked **Specified / Planned**.

**Companion documents:** `A_PROTOCOL.md` (semantics), `FABRIC_TRANSPORT.md` (lease protocol), `COWORK_RUNTIME_STATE_MACHINES.md` (state machines), `A_PROTOCOL_CONFORMANCE_MATRIX.md` (proofs).

**Terminology lock:** Fabric Transport. No "dispatcher" naming.

---

## 1. Principal

Executable identity record. Grounded in `cowork_principals`
(`cmd/allternit-api/migrations/V152__cowork_principals.sql`) and
`PrincipalRecord` (`infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/transport.rs`).

```json
{
  "id": "a://workspace/acme/bot/research",
  "workspace": "acme",
  "capabilities": ["web.read", "files.project.read"],
  "status": "active"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Canonical workspace-scoped address. PK. |
| `workspace` | string | Eligibility boundary; claims only match same-workspace jobs. |
| `capabilities` | string[] (JSON col) | Flat namespaced strings, §8.6 vocabulary. |
| `token_hash` | string | SHA-256 hex of the bearer token (`hash_token`, `transport.rs`). Never returned. |
| `status` | string | `active` or suspended; only `active` authenticates. |

Registration response (token returned exactly once,
`fabric_transport_routes.rs::create_principal`):

```json
{
  "id": "a://workspace/acme/bot/research",
  "workspace": "acme",
  "capabilities": ["web.read", "files.project.read"],
  "token": "atok_<uuid>"
}
```

Authentication on every worker endpoint:

```http
Authorization: Bearer <token>
```

Failure: `A_AUTHENTICATION_FAILED` (401). Suspended principal:
`A_PERMISSION_DENIED` (403).

## 2. LeaseGrant (claim response)

Grounded in `LeaseGrant` (`transport.rs`) returned by
`POST /api/v1/fabric/transport/claim` (`sqlite_store.rs::claim_job`).

```json
{
  "job_id": "cf2b61b2-ffad-411e-9434-2c477d5006ef",
  "run_id": "579b8af2-8e54-49a1-9f91-3bf21872b397",
  "lease_id": "lease_0e414bd8-aa7f-4af8-aa5e-895b3cd80d24",
  "lease_generation": 2,
  "lease_expires_at": "2026-09-12T17:31:30.514887+00:00",
  "payload": { "steps": ["echo one", "echo two"], "checkpoint_every": 1 },
  "required_capabilities": ["shell.exec"],
  "current_checkpoint_id": "6f63cc02-cb8a-44db-a233-cc3a6ebfafd6",
  "initiator": "a://workspace/acme/user/joe",
  "delegator": "a://workspace/acme/principal/al"
}
```

| Field | Notes |
|---|---|
| `lease_generation` | Monotonic per job; increments on every ownership change (claim CAS: `lease_generation = lease_generation + 1`). |
| `lease_expires_at` | Server-authoritative RFC3339. Worker time is never consulted for expiry. |
| `current_checkpoint_id` | Replay pointer: the replacement worker resumes from the last committed checkpoint under the new generation (lock 3). |

Claim errors: `A_JOB_ALREADY_LEASED`, `A_NO_ELIGIBLE_WORKER`,
`A_CAPABILITY_MISSING`, `A_WORKSPACE_MISMATCH`, `A_RUN_CANCELLED` (see §7).

## 3. ApprovalBinding

Grounded in `ApprovalBinding` (`transport.rs`) and `cowork_approval_bindings`
(`V155`, expiry column `V156`). Scope is exactly §8.14:
(executor, capability, target, run, job, lease_generation).

```json
{
  "id": "appr_4bdb7502-d917-491c-b03b-e3e66c25ae02",
  "run_id": "f229bb22-a75f-4e3b-af5c-6887e71dd9d2",
  "job_id": "c402224f-8c44-441e-b5b5-d4962df9becc",
  "lease_id": "lease_a0e683fa-4533-4a2f-9e19-25eedf46b62c",
  "lease_generation": 2,
  "executor": "a://workspace/acme/bot/worker-b",
  "capability": "connector.bank.payment.submit",
  "target": "payment/123",
  "status": "granted",
  "decided_by": "local-dev-user",
  "expires_at": "2026-09-12T19:26:25.498140+00:00"
}
```

Status lifecycle: `pending` → `granted` | `denied` | `expired` | `invalidated`.

- `granted`/`denied`: human decision (`decide_approval`); decided_by records the user principal.
- `expired`: sweeper/boot pass found `expires_at` past (server clock); attributed `approval.expired` event. Late grant → `A_APPROVAL_INVALID`.
- `invalidated`: the bound lease generation expired; attributed `approval.invalidated` event. Reuse under a new generation → `A_APPROVAL_INVALID`.

Auto-decisions (risk policy, §6) return a synthetic binding:

```json
{
  "id": "auto:approve:web.read",
  "status": "granted",
  "decided_by": "risk-rule (low-risk auto-approve)",
  "expires_at": null
}
```

Recovery policy for expired/invalidated/denied bindings: **re-request** (deny-by-default). `check_approval` returns `A_APPROVAL_REQUIRED`, never silent authorization.

## 4. Result

Grounded in `complete_job` (`sqlite_store.rs`); stored in `cowork_jobs.result`
(`V153`), returned by the complete endpoint and the idempotent duplicate path.

```json
{
  "result_id": "result_df6513eb-902a-4e86-b320-5de7666ab2e2",
  "run_id": "6fd535d0-3064-4d27-9d76-0909b788e904",
  "job_id": "c7fce7e0-4f45-4e10-8292-13efbd80ff8a",
  "status": "completed",
  "summary": "replayed from checkpoint, steps 1-2 done",
  "outputs": { "steps_replayed": 2 },
  "executor": "a://workspace/acme/bot/worker-b",
  "completed_at": "2026-09-12T17:31:34.514887+00:00"
}
```

`status` is `completed` or `failed`. Repeat completion under the terminal
generation returns `{"outcome": "already_committed", "result": <canonical>}` —
exactly-once side effects (§8.16). A stale generation on a terminal job is
still rejected `A_STALE_LEASE_GENERATION` (the killed worker never gets a
valid completion path).

## 5. Standardized events (§8.22 vocabulary)

Grounded in `insert_event`/`insert_event_idempotent` (`sqlite_store.rs`),
persisted to `cowork_run_events` (attribution columns `V154`,
`client_event_id` dedup `V157`). Every row carries `initiator`, `delegator`,
`executor` where the actor exists.

| event_type | Emitted by | Key payload fields | executor |
|---|---|---|---|
| `job.claimed` | claim CAS | `job_id, lease_id, lease_generation, lease_expires_at, capabilities` | claiming worker |
| `job.heartbeat` | heartbeat | `lease_id, lease_generation, worker_time` (advisory) | worker |
| `job.lease_renewed` | renew | `lease_id, lease_generation, lease_expires_at` | worker |
| `job.lease_expired` | sweeper / boot | `lease_id, lease_generation, expired_at` | displaced worker |
| `job.requeued` | sweeper / boot | `retry_count, max_retries` | none (transport action) |
| `job.dead_lettered` | sweeper / boot (retries exhausted) | `retry_count` | none |
| `job.completed` / `job.failed` | completion CAS | `lease_id, lease_generation, result_id` | completing worker |
| `result.created` | completion CAS | full Result object | completing worker |
| `run.completed` | completion CAS (last job terminal) | `state` (`completed`/`failed`) | completing worker |
| `approval.requested` | request_approval | `approval_id, capability, target, lease_generation, expires_at` | requesting worker |
| `approval.granted` / `approval.denied` | decide_approval / risk auto | `approval_id, capability, target, decided_by` | bound executor |
| `approval.invalidated` | lease expiry | `approval_id, capability, target, lease_generation` | displaced worker |
| `approval.expired` | approval sweeper / boot | `approval_id, capability, expired_at` | bound executor |

Legacy pre-transport event names (`run_created`, `job_created`,
`job_state_changed`, `run_state_changed`, `run_queued`, `run_cancelled`,
`checkpoint_created`, `run_recovered`, `handoff_created`) remain in the same
table from the older run API (`rails/routes_cowork.rs`); new code should prefer
the dotted vocabulary above.

Client-emitted events: `POST /api/v1/runs/:id/events`
(`routes_cowork.rs::post_run_event`) accepts
`{event_type, payload, event_id?}`. Same `event_id` →
`{id: <canonical>, duplicated: true}`, no double-write (§5 idempotency).

## 6. Risk policy

Grounded in `risk_policy.rs` (rule model mirrors
`packages/@allternit/cowork-engine/src/approval/gate.ts`) and
`cowork_approval_policy` (`V158`).

```json
{
  "capability_risk": { "shell.exec": "critical" },
  "rules": [
    {
      "action_type": "shell.exec.",
      "risk_level": [],
      "decision": "reject",
      "reason": "workspace forbids shell"
    },
    {
      "action_type": "web.read",
      "risk_level": ["low"],
      "decision": "approve",
      "reason": "reading allowed"
    }
  ]
}
```

Evaluation (`evaluate_protection`): first rule matching (capability ==
`action_type`, or `action_type` trailing-dot prefix) AND (risk in
`risk_level`, or empty) wins → `AutoApprove(reason)` / `AutoDeny(reason)` /
`RequiresApproval`. Canonical risk table (overridable per capability):
`connector.bank.*`/`.submit`/`gui.control` = critical; `connector.*`,
`files.system.*`, `gui.observe`, `browser.form.submit` = high;
`shell.exec`, `*.write`, `artifact.*`, `browser.navigate` = medium; rest = low.
Default policy auto-approves low risk only.

## 7. Error vocabulary

Grounded in `TransportErrorCode` (`transport.rs`). Branch on wire codes, never prose.

| Code | HTTP | Meaning |
|---|---|---|
| `A_AUTHENTICATION_FAILED` | 401 | missing/unknown bearer token |
| `A_PRINCIPAL_NOT_FOUND` | 401 | token does not resolve (reserved) |
| `A_WORKSPACE_MISMATCH` | 403 | principal/job workspace differ |
| `A_CAPABILITY_MISSING` | 422 | mandatory capability absent |
| `A_PERMISSION_DENIED` | 403 | wrong owner / suspended / risk auto-deny |
| `A_NO_ELIGIBLE_WORKER` | 422 | nothing claimable for this principal |
| `A_JOB_ALREADY_LEASED` | 409 | CAS lost; another worker holds the job |
| `A_INVALID_LEASE` | 409 | lease_id does not own the job |
| `A_STALE_LEASE_GENERATION` | 409 | presented generation ≠ current (rejected even for terminal jobs) |
| `A_LEASE_EXPIRED` | 409 | server clock passed lease_expires_at |
| `A_RUN_CANCELLED` | 409 | run/job cancelled |
| `A_DELEGATION_CYCLE` | 409 | causation chain repeats a principal (§8.15) |
| `A_DELEGATION_DEPTH_EXCEEDED` | 409 | chain longer than workspace limit (default 4) |
| `A_APPROVAL_REQUIRED` | 403 | no binding / pending / expired / denied → re-request |
| `A_APPROVAL_INVALID` | 409 | stale-generation or invalidated binding; late grant |
| `A_RESULT_ALREADY_COMMITTED` | — | code reserved; the wire returns `already_committed` outcome (200) |
| `A_JOB_NOT_FOUND` | 404 | unknown job/approval id |
| `A_STORE_ERROR` | 500 | SQLite failure |

## 8. HTTP surface

All under `/api/v1/fabric/transport/*` (`fabric_transport_routes.rs`).
Auth column: **user** = normal app auth (Clerk/dev); **worker** = principal
bearer token.

| Endpoint | Auth | Body → Response |
|---|---|---|
| `POST /principals` | user | `{id, workspace, capabilities}` → registration + one-time token |
| `POST /claim` | worker | `{job_id?, wait_secs?, lease_ttl_secs?}` → LeaseGrant (long-poll; retryable on `A_NO_ELIGIBLE_WORKER`/`A_JOB_ALREADY_LEASED` until `wait_secs`) |
| `GET /jobs/:job_id` | open (read-only canonical view) | → full job view incl. result |
| `POST /jobs/:job_id/heartbeat` | worker | `{lease_id, lease_generation, worker_time?}` → `{ok}` |
| `POST /jobs/:job_id/renew` | worker | `{lease_id, lease_generation, lease_ttl_secs?}` → `{ok, lease_expires_at}` |
| `POST /jobs/:job_id/complete` | worker | `{lease_id, lease_generation, success, summary?, outputs?}` → CompleteOutcome |
| `POST /intents` | user | IntentEnvelope → IntentSubmission (idempotent on intent_id) |
| `GET /intents/:intent_id` | open (read-only) | → `{intent_id, run_id, envelope}` |
| `GET /approvals` | user | `?workspace=&status=` → approval inbox (control surface) |
| `POST /principals/:principal_id/provision-token` | user | rotate/provision a principal token (returned once) |
| `PUT /principals/:principal_id/capabilities` | user | `{capabilities: [...]}` → replace declared capabilities (P-T2; workers declare `compute.vm` for VM mode) |
| `POST /jobs/:job_id/connector-sessions` | worker | `{lease_id, lease_generation, capability, ttl_secs?}` → ConnectorBrokerSession |
| `POST /connector-sessions/:session_id/invoke` | worker | `{job_id, lease_id, lease_generation, payload}` → `{delivered, simulated, detail}` |
| `POST /runs/:run_id/handoffs` | user | `{to_agent_id, task_id?, note?, causation_chain?}` → handoff (chain validated) |
| `POST /runs/:run_id/handoffs/:handoff_id/ack` | user | `{note?}` → completes the handoff + linked job |
| `POST /jobs/:job_id/approvals/request` | worker | `{lease_id, lease_generation, capability, target, approval_ttl_secs?}` → ApprovalBinding |
| `POST /jobs/:job_id/approvals/check` | worker | same body → `{ok, approval_id, status}` or approval error |
| `GET /approvals/:approval_id` | worker (executor-scoped) | → ApprovalBinding (poll for the human decision) |
| `POST /approvals/:approval_id/grant` | user | → ApprovalBinding; late → `A_APPROVAL_INVALID` |
| `POST /approvals/:approval_id/deny` | user | → ApprovalBinding |

Env knobs (`main.rs`): `ALLTERNIT_FABRIC_TRANSPORT_LEASE_SECS` (default 60),
`ALLTERNIT_FABRIC_TRANSPORT_SWEEP_SECS` (default 5). Operational tuning only.

## 8a. ConnectorBrokerSession — **Implemented (v0.1, §8.5)**

```json
{
  "session_id": "cs_4bdb7502-d917-491c-b03b-e3e66c25ae02",
  "capability": "connector.webhook.send",
  "expires_at": "2026-09-13T20:26:25.498140+00:00"
}
```

Issued by `POST /fabric/transport/jobs/:job_id/connector-sessions` (worker
bearer auth; lease-validated; risk policy enforced — protected capabilities
require a granted approval for the current generation). **No secret is ever
returned or embedded in job payloads.** Invocation is system-side:
`POST /fabric/transport/connector-sessions/:id/invoke` (worker bearer auth,
principal-bound session, server-clock expiry) performs the external call with
the registered secret read from its env var at invoke time; the result and an
attributed `connector.invoked` event report delivered/simulated honestly.

**Connector breadth (P-T4, v0.1):** beyond the reference webhook connector
(`connector.webhook.send` → `ALLTERNIT_BROKER_WEBHOOK_URL`), the broker ships
a **GitHub connector** (`connector.github.read` / `connector.github.write` →
`ALLTERNIT_BROKER_GITHUB_TOKEN`; payloads `{repo: "owner/name", path?, ref?}`
/ `{repo, path, content, message}`; write is approval-gated, read
auto-approves by default) and a **files/local connector**
(`connector.files.read` / `connector.files.write` →
`ALLTERNIT_BROKER_FILES_ROOT`; every payload path is confined under the
root — absolute paths and `..` escapes are refused; write is
approval-gated). Unknown registered capabilities keep the generic
webhook-POST behavior.

## 8c. Al persona runtime — **Implemented (v0.1, P-T5)**

| Endpoint | Auth | Body → Response |
|---|---|---|
| `POST /cowork/al/chat` | user | `{session_id?, message, workspace?}` → `{session_id, reply, delegated, intent_id?, run_id?, target?, run_state?, pending_approvals?, extracted}` |
| `GET /cowork/al/sessions/:session_id` | user (owner-scoped) | → transcript with observed canonical run states per turn |

Talk to Al; Al turns the request into a canonical intent. Extraction is
model-assisted through the existing model router/gateway (`run_completion`,
shared with `/v1/responses`; `ALLTERNIT_AL_MODEL`, default
`openai/gpt-4o-mini`) and falls back to a deterministic normalizer when no
OS control plane is configured. Target resolution uses the workspace
delegation rules (`resolve_delegation_rule` — identical to the orchestrator
loop). Submitted intents carry `initiator = user`, `delegator =
a://…/principal/al`, chain `[user, al]`; with no matching rule nothing is
submitted and Al says so. Al holds zero capabilities: it never claims,
executes, or holds secrets. Transcript: `cowork_al_messages` (V168).

## 8b. MemoryGrant — **Implemented (v0.1)**

Memory entries carry `owner_principal` (nullable) + `grants` (JSON string
array). Visibility rule: unowned entries (legacy) OR owned by the caller OR
explicitly granted; everything else is default-deny. Write access uses the
same check (`A_PERMISSION_DENIED` otherwise).

## 9. IntentEnvelope — **Implemented**

Grounded in `transport.rs::IntentEnvelope` and `sqlite_store::submit_intent`
(store `cowork_intents`, V164). Submission: `POST /api/v1/fabric/transport/intents`
(user auth); observe: `GET /api/v1/fabric/transport/intents/:intent_id`.

**Idempotent on `intent_id` (§5):** resubmitting the same `intent_id` returns
the canonical existing `run_id` with `created: false` — at-least-once delivery
never becomes duplicate runs. Validation: version must be `a/0.1`; the
`causation_chain` is cycle- and depth-checked (§8.15, workspace-configurable,
default 4 — violations: `A_DELEGATION_CYCLE` / `A_DELEGATION_DEPTH_EXCEEDED`).
The created run starts `queued` (§8.2 honesty) with the attribution triple and
chain persisted; an attributed `intent.accepted` event is written.

```json
{
  "version": "a/0.1",
  "intent_id": "intent_01J...",
  "workspace": "a://workspace/acme",
  "initiator": "a://workspace/acme/user/joe",
  "delegator": "a://workspace/acme/principal/al",
  "target": "a://workspace/acme/bot/research",
  "action": { "action_type": "research", "description": "Compare three vendors." },
  "permissions": ["web.read"],
  "compute": { "policy": "auto" },
  "model": { "policy": "router:auto" },
  "approval": { "policy": "risk-gated" },
  "return_channel": { "channel": "cowork" },
  "causation_chain": ["a://workspace/acme/user/joe", "a://workspace/acme/principal/al"]
}
```

→ `{ "intent_id": "...", "run_id": "<uuid>", "created": true|false }`

**Job enqueue (P-T2):** submission also enqueues the run's canonical job
(`action.payload` as the job payload), completing Intent → Run → Job →
queue. The intent's `compute` policy resolves to mandatory job capabilities
(§8.8 placement): `vm` → `compute.vm`, `local` → `compute.local`,
`byo`/`cloud` → `compute.byo`/`compute.cloud`; `auto`/absent stays
capability-neutral and resolves by capability intersection at claim time.
Claim eligibility then refuses under-capable workers with
`A_CAPABILITY_MISSING`. Placement never rewrites identity/attribution.
Intents targeted at `…/principal/al` are the exception: the parent run gets
no claimable job (Al plans; the orchestrator's child intent carries the
job), so delegation cannot be bypassed.

The legacy `POST /cowork/run-agent` and `/cowork/team-execute` endpoints now
submit canonical intents (the `cowork_executions` dead-end inserts are gone).
