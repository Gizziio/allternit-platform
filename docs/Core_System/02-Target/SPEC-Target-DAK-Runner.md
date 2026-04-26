⸻


# agents/spec/DAK_RUNNER_LOCKIN.md
<DAKRunnerLockIn>

## Status
LOCKED — this is the canonical agreement for the Agent Runner (DAK) plane and its separation from Rails.

## Purpose
Define the Agent Runner as a deterministic orchestration kernel that executes agent work under strict constraints, while Rails remains the deterministic control plane and source of truth.

---

## 0) Planes and separation of concerns

### Rails (Control Plane) owns
- Ledger truth (append-only events)
- Leases / locks (authority)
- Receipts authority + immutable blob storage
- Gate decisions (PreToolUse/PostToolUse semantics as authoritative checks)
- Idempotent pipeline transitions and canonical workflow state
- Index rebuilds (derived views)
- Public API endpoints for leases/gates/ledger/receipts/mail/vault

### Agent Runner (Execution Plane) owns
- Orchestration runtime (role-scoped workers, swarms, bounded loops)
- Provider adapters + hook normalization (provider-agnostic HookRuntime)
- ContextPack compiler (deterministic input bundle assembly from Rails truth)
- Prompt packs + cookbooks + role envelopes
- Planning-with-files behavior (plan state is authoritative during execution)
- Output hygiene (anti-drift enforcement; no free writes)
- Replay/diff utilities (can read Rails event streams; may maintain local transient caches)

### Explicitly NOT in Agent Runner
- Ledger authority
- Leases authority
- Receipts authority
- Canonical idempotent state transitions

---

## 1) Agent Runner capability inventory (canonical)

### 1. Execution Kernel (deterministic runtime)
Agent Runner implements the execution harness, but does not duplicate authority already owned by Rails.

Must contain:
- WIH/DAG interpreter for execution decisions (spawn, pack selection, context assembly)
- HookRuntime (SessionStart → UserPromptSubmit → PreToolUse → PostToolUse → … → SessionEnd), provider-agnostic
- Tool invocation wrapper that ALWAYS calls Rails gate endpoints before executing any tool-like action
- ContextPack compiler (deterministic bundle from Rails truth: WIH + DAG slice + receipts/evidence + policies + plan hash set)
- Evidence/receipt emitter that writes ONLY via Rails APIs

### 2. Worker & orchestration
Must contain:
- WorkerManager: spawn, supervise, timebox, terminate workers
- Builder/Validator mutual blocking orchestration (no self-approval; validator gates completion)
- Ralph loop / bounded fix cycles (iteration policies, escalation rules)
- Parallel subagents with strict context inheritance rules:
  - child permissions = intersection(parent WIH ∩ child WIH)
  - child context = sealed ContextPack + policy injection marker

### 3. Observability + replay
Must contain:
- Normalized run event emission (pre/post tool events, gate decisions, failures, spawn boundaries)
- Replay and diff tooling:
  - read Rails event streams + receipts as the authoritative trace
  - optional transient local caches are allowed, but never truth
- Structured errors and escalation envelopes (PromptDeltaNeeded, requires approval, blocked states)

### 4. Planning-with-files
Must contain:
- PlanManager managing authoritative plan artifacts:
  - plan.md, todo.md, progress.md, findings.md
- Plan state drives execution sequencing (no “model whim”)
- ExitPlanMode is a kernel transition controlled by the orchestrator (not the LLM)

### 5. Policies and roles
Must contain:
- Role envelopes: orchestrator, planner, builder, validator, reviewer, security
- Cookbooks: deterministic procedures (loops, spawn, enforce, replay/diff)
- Prompt packs: versioned, indexed, enforced format
- Injection discipline:
  - per-message policy injection (AGENTS.md + role + pack + context slices)
  - enforced at every context-loss boundary (new prompt, new iteration, subagent spawn, post-compaction)

---

## 2) Critical invariants (hard rules)

### Tool gating + eventing
- Every tool-like action MUST be preceded by a Rails gate check (PreToolUse equivalent)
- Every tool-like action MUST emit pre/post events, including:
  - allow/block/transform/require approval decisions
  - outputs (or failure payloads) referenced as receipts/blobs
- Failures emit a PostToolUseFailure-equivalent event (damage control path)

### No drift / write discipline
- No direct filesystem writes outside approved workspace.
- Durable state goes through Rails (events/receipts/blobs), not ad-hoc local writes.
- Any repo mutation must be:
  - performed only under explicit lease + gate approval, OR
  - represented as a patch artifact proposed for application through Rails.

### Mutual blocking
- Validator decides completion; builder never self-approves.
- A DAG node becomes DONE only when validator PASS gates are satisfied (tests/evidence/contracts).

### Determinism definition
Determinism is constraint-level:
- same WIH + same DAG + same repo state + same policies + same tool schemas
  ⇒ same allowed actions and same gate outcomes (auditable and replayable)

---

## 3) Agent Runner file/folder commitments

### `agents/` (spec + assets)
- agents/AGENTS.md: Runner law + prohibitions + role rules
- agents/spec/: DAK spec, WIH schema, DAG schema, BRIDGE spec
- agents/packs/: prompt packs + format spec + index
- agents/roles/: role envelopes
- agents/cookbooks/: deterministic procedures
- agents/primitives/: pinned kernel primitives (hooks, CTR, enforcement, observability model, worker model)

### `.allternit/` (runtime outputs only)
- Only Rails writes authoritative `.allternit` truth.
- Agent Runner may produce transient run workspaces, but must upload durable artifacts via Rails receipts/blobs.

---

## 4) Enforcement strategy (implementation posture)
- Agent Runner injection: per-message policy injection from repo AGENTS.md (+ runner roles/packs)
- Rails gate enforcement: all tool calls go through Rails gate endpoints
- Replayability: events + receipts constitute the run trace; diff compares event streams and receipts by ID

</DAKRunnerLockIn>
