# /spec/layers/messaging/FullSpec.md
# A2rchitech Messaging Layer Specification (v2)
## Task Queue + Event Bus + Agent Mail + Coordination Leases + Planning Backlog

Status: Canonical  
Layer: L1 Runtime Eventing + L3 Orchestration Transport  
Scope: Workflows, agents, hooks, tool gateway, history ledger, swarm coordination

---

## 1. Purpose
Messaging is the transport substrate for:
- durable workflow scheduling (Task Queue)
- real-time system coordination (Event Bus)
- asynchronous multi-agent coordination (Agent Mail)
- conflict-avoidance signaling (File/Resource Leases)
- deterministic replay (envelopes + ledger linkage)

Messaging is infrastructure, not policy and not tool execution.

---

## 2. Components

### 2.1 Task Queue (Durable Scheduling Surface)
Responsibilities:
- enqueue tasks with strict envelopes
- guarantee at-least-once delivery
- retries with backoff
- priority + deadlines
- concurrency limits per tenant/session/workflow
- idempotency keys

Non-responsibilities:
- no policy decisions
- no tool execution
- no memory writes

### 2.2 Event Bus (Lifecycle + Observability)
Responsibilities:
- pub/sub lifecycle events
- hook triggers
- tracing spans + correlation IDs
- decoupled automation

Events are immutable once emitted.

### 2.3 Agent Mail (Asynchronous Coordination Fabric)
Concept: “Gmail for coding agents” with inbox/outbox, searchable history, and identities. citeturn12view0

Responsibilities:
- register agent identities (temporary-but-persistent handles) citeturn12view0
- send/receive messages (GFM Markdown, attachments) citeturn12view0
- thread conversations and summarize/search history citeturn12view0
- maintain a directory of active agents/programs/models/activity citeturn12view0
- provide a transport for “change-intent signaling” between agents citeturn12view0

Non-responsibilities:
- does not grant permissions
- does not execute tools
- does not mutate memory tiers directly (only emits events/artifacts)

### 2.4 Coordination Leases (Advisory Reservations)
Agent Mail includes “voluntary file reservation leases” to avoid agents stepping on each other. citeturn12view0

Responsibilities:
- advisory reservations on:
  - files/globs
  - modules/packages
  - tickets/tasks
  - external resources (ports, devices, credentials handles)
- lease lifecycle:
  - acquire → renew → release → expire
- lease conflict signaling:
  - notify via mail + event
  - downgrade work to read-only or “branch-only” mode (policy may enforce stronger rules)

Leases are not locks; they are coordination signals.
Policy may elevate leases to enforced locks for destructive tiers.

### 2.5 Planning Backlog Bridge (Beads-style)
Agent Mail’s workflow suggests using Beads tasks as an executable backlog. citeturn12view0

In A2rchitech, we treat this as a bridge layer that:
- maps human plans → backlog tasks
- maps backlog tasks → workflow nodes (TaskQueue)
- maps task status → events + ledger entries

Beads itself is not required; the interface is.

---

## 3. Canonical Envelopes

### 3.1 Task Envelope (TaskQueue)
Required:
- task_id (uuid)
- session_id
- tenant_id
- workflow_id
- step_id
- role (requesting agent role)
- intent
- input_refs (artifact pointers)
- constraints (time/budget/scope)
- idempotency_key
- created_at
- ttl
- retry_policy

Optional:
- priority
- deadline
- parent_task_id
- trace_id

### 3.2 Event Envelope (EventBus)
Required:
- event_id (uuid)
- event_type
- session_id
- tenant_id
- actor_id (human/agent/service/device)
- role
- timestamp
- trace_id
- payload (typed)

### 3.3 Agent Mail Message Envelope
Required:
- message_id (uuid)
- tenant_id
- thread_id
- from_identity
- to_identities[] (or mailbox selector)
- subject
- body_md (GFM)
- attachments[] (artifact pointers)
- created_at
- tags[]
- trace_id (optional but recommended)

Optional:
- reply_to_message_id
- priority
- expires_at (for ephemeral notes)

### 3.4 Lease Envelope
Required:
- lease_id (uuid)
- tenant_id
- holder_identity
- resource_selector (file/glob/module/device/etc.)
- purpose
- scope (session/workflow/task)
- acquired_at
- expires_at
- trace_id

Optional:
- renew_token
- conflict_policy (notify-only | block | branch-only)

### 3.5 Artifact Pointer
- artifact_id
- content_hash
- media_type
- storage_uri
- created_by
- created_at

---

## 4. Canonical Event Types (Hook-Compatible)
Minimum set:
- SessionStart / SessionEnd
- WorkflowStart / WorkflowStepStart / WorkflowStepEnd
- PreToolUse / PostToolUse
- PolicyDecision
- MemoryCandidateCreated / MemoryCommitAttempt / MemoryCommit
- SkillInstall / SkillEnable / SkillRevoke
- SubagentStart / SubagentStop
- Stop (hard terminate)

Coordination extensions:
- AgentIdentityRegistered
- AgentMailSent
- AgentMailReceived
- LeaseAcquired
- LeaseRenewed
- LeaseReleased
- LeaseConflictDetected
- BacklogTaskCreated
- BacklogTaskStateChanged

Events must be sufficient to reconstruct the run.

---

## 5. Ordering, Delivery, and Idempotency

### 5.1 Ordering
- Ordering is guaranteed per-session for lifecycle events when possible.
- Mail thread ordering is “best effort”; clients de-dup and sort by timestamp + message_id.
- Lease operations must be linearizable per resource_selector when enforcement is enabled.

### 5.2 Delivery semantics
- TaskQueue: at-least-once + idempotency for side effects
- EventBus: at-most-once or at-least-once depending on backend; consumers de-dup via event_id
- Agent Mail: at-least-once preferred; clients de-dup via message_id

### 5.3 Idempotency rules
- Side-effecting tasks require idempotency_key
- Lease acquisition is idempotent by (holder_identity, resource_selector, scope)
- Mail send is idempotent by message_id

---

## 6. Backends (Implementation Guidance)

On-prem defaults should be simple and replaceable:
- TaskQueue: Redis-backed queue or embedded durable queue
- EventBus: in-proc emitter, Redis pub/sub, or NATS
- Agent Mail:
  - SQLite for indexing/query
  - Git-backed mailbox artifacts for auditability is a viable pattern citeturn12view0
- Schemas: JSON Schema validators

Backend choice must not change envelope contracts.

---

## 7. Security and Multi-Tenancy
- tenant_id required on all messages
- per-tenant quotas (rate, concurrency, storage)
- message redaction rules for sensitive content
- authenticated producers/consumers (service identities)
- mailboxes are scoped; cross-tenant mail prohibited

---

## 8. Integration with Policy (Hard Requirement)
- PreToolUse triggers PolicyDecision
- Tool Gateway blocks until policy allow/deny/constraints
- Lease conflicts may trigger policy downgrades (e.g., disallow writes)

Messaging transports decisions; it does not make them.

---

## 9. Integration with History Ledger
Every task execution, mail message, lease operation, and event emission must be:
- mirrored to History Ledger streams (JSONL)
- derivable into human-readable Markdown narratives

Replay mode consumes the ledger and can:
- re-drive TaskQueue deterministically
- rehydrate mail threads for analysis
- validate lease conflict timelines

---

## 10. Acceptance Tests
Minimum acceptance:
1) enqueue/dequeue validates Task Envelope
2) hooks receive lifecycle events deterministically
3) mail send/receive is queryable, deduped, and auditable citeturn12view0
4) leases detect conflicts and emit conflict events citeturn12view0
5) tool runs reproducible from ledger replay
6) cross-tenant isolation verified

---

End of Messaging Layer Specification (v2)
