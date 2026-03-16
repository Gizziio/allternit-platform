⸻


# agents/spec/BRIDGE_RAILS_RUNNER.md
<BridgeRailsRunnerSpec>

## Purpose
Define the exact interface contract between the Rails control plane and the Agent Runner execution plane, including:
- how work is discovered and claimed
- how tools are gated
- how evidence is recorded
- how progress is advanced without drift

This spec is designed to prevent overlap: Rails remains authority; Runner remains executor.

---

## 1) Shared vocabulary

### IDs
- dag_id: identifier for the DAG
- node_id: DAG node identifier
- wih_id: Work Item Header identifier (canonical execution envelope)
- run_id: execution run identifier (Runner-local but referenced in receipts/events)
- iteration_id: Ralph loop / bounded-fix cycle identifier
- agent_id: stable identity for the executing worker
- correlation_id: message correlation identifier (worker/spawn tracing)

### Plan artifacts (authoritative for execution)
- plan.md
- todo.md
- progress.md
- findings.md

Plan artifacts are referenced and hashed into ContextPacks and receipts.

---

## 2) Authority model (non-negotiable)

### Rails is authoritative for
- ledger truth
- lease issuance
- gate decisions
- receipt/blob authority and canonical indexing

### Runner is authoritative for
- spawning and supervising worker processes
- provider-level hook capture/normalization
- producing artifacts/reports under strict constraints
- calling Rails to request decisions and record outputs

Runner MUST NOT mutate canonical state outside Rails APIs.

---

## 3) Work discovery and claiming

### 3.1 How Runner discovers work
Runner tails Rails ledger/events and listens for work requests, especially:
- RailsLoopIterationSpawnRequested (or equivalent spawn request event)
- PromptDeltaNeeded (requires user input)
- WorkBlocked (missing lease/evidence)
- GateDenied / PolicyViolation (if emitted)

Runner may poll via:
- ledger tail (event stream)
- a dedicated "spawn queue" endpoint if provided

### 3.2 Claim protocol (idempotent, single-worker)
Claiming must be done via Rails leases.

- Lease key format (canonical):
  - `spawn/<spawn_event_id>`
  - Alternative if event_id unavailable: `spawn/<dag_id>/<node_id>/<wih_id>/<iteration>`
- Runner requests lease:
  - `lease.request(key=spawn/<...>, holder=agent_id, ttl=...)`
- If lease granted → Runner may execute.
- If denied → Runner MUST NOT execute.

Runner MUST renew lease while running and release at completion.

---

## 4) ContextPack compilation (Runner-side, Rails-truth)

### 4.1 Inputs to ContextPack
Runner builds a ContextPack from Rails truth:
- WIH content + referenced contracts/specs
- DAG slice: node + hard deps + required ancestors
- receipts/evidence slice from deps (by receipt_id)
- policy bundle refs/hashes (AGENTS.md + packs + role envelope)
- plan artifacts hash set (plan/todo/progress/findings)
- tool registry version pin (by digest/id)
- current lease info (keys held, expiry)

### 4.2 ContextPack sealing
Runner produces a sealed metadata record:
- context_pack_id
- inputs list (IDs + hashes)
- method_version
- created_at

ContextPack is derived and reproducible. It never overwrites Rails truth.

---

## 5) Tool call lifecycle (hard gating)

### 5.1 Rule: every tool-like action requires a Rails gate check
For any tool-like operation (FS read/write/edit, bash exec, web fetch/search, spawning workers, etc.):

Runner MUST call Rails gate endpoints in this order:
1) PreToolUse gate check (authorize + validate)
2) Execute tool (only if allowed)
3) PostToolUse commit (record output + update manifests)
4) PostToolUseFailure on error (record error + affected paths)

### 5.2 PreToolUse gate contract (Rails authoritative)
Runner calls:
- gate.check({
    wih_id, dag_id, node_id, iteration_id,
    actor: { agent_id, role },
    tool: { name, args, intended_paths?, command? },
    context: { policy_bundle_id, context_pack_id, plan_hashes }
  })

Rails MUST evaluate deterministically in this order:
1) tool allowed by WIH scope
2) args validate against tool schema (ToolRegistry)
3) PolicyEngine decision: ALLOW | BLOCK | TRANSFORM | REQUIRE_APPROVAL
4) path guard + protected paths
5) concurrency/lease guard
6) emit a gate decision event (with reasons + hashes)

Runner MUST obey:
- ALLOW: proceed
- BLOCK: do not run; record block outcome
- TRANSFORM: use transformed args only
- REQUIRE_APPROVAL: escalate via Rails (PermissionRequest flow)

### 5.3 PostToolUse commit contract
Runner calls:
- gate.commit({
    correlation_id,
    tool: { name, args_hash },
    result: { stdout/stderr refs, exit_code, produced_paths, produced_hashes },
    receipts: [receipt_ids],
    artifacts_manifest: { path -> hash },
    wih_id, node_id, iteration_id
  })

Rails records receipts/blobs/events and updates derived indices.

### 5.4 Failure contract
Runner calls:
- gate.fail({
    correlation_id,
    tool: { name, args_hash },
    error: { message, class, stderr_ref },
    affected_paths,
    wih_id, node_id, iteration_id
  })

Rails records a failure event and may mark node BLOCKED/FAILED per policy.

---

## 6) Evidence, receipts, and outputs

### 6.1 Output hygiene
Runner must produce outputs in a constrained workspace:
- default: runner-local ephemeral workspace OR `.a2r/out/<run_id>/` if permitted
- any durable artifact must be uploaded as a Rails receipt/blob

### 6.2 Receipt format requirements
Receipts must include:
- provenance: (wih_id, node_id, dag_id, iteration_id, agent_id, role)
- inputs referenced: (context_pack_id, policy_bundle_id, plan hashes)
- outputs referenced: (artifact paths + hashes OR blob ids)
- verdicts for validator reports (PASS/FAIL + reasons + required fixes)

Validator receipts are the completion gate artifacts.

---

## 7) DAG node execution semantics (mutual blocking)

### 7.1 Node execution loop
For each node:
1) Orchestrator spawns Builder worker under WIH constraints
2) Builder produces patch/artifacts + build_report receipt
3) Orchestrator spawns Validator worker under strict no-write constraints
4) Validator runs acceptance checks and produces validator_report receipt
5) Node advances ONLY if validator_report == PASS AND WIH acceptance gates satisfied
6) If FAIL:
   - Orchestrator creates bounded fix cycle (Ralph loop) using validator required_fixes
7) If ambiguous/missing user input:
   - Orchestrator emits PromptDeltaNeeded escalation via Rails

### 7.2 Completion rule
A node is DONE iff:
- validator_report PASS
- declared tests green
- no policy violations in the node’s event range
- required evidence receipts attached

---

## 8) Permission escalation and user input

### 8.1 Require-approval flow
If Rails gate returns REQUIRE_APPROVAL:
- Runner MUST NOT run the tool
- Runner emits a PermissionRequest event through Rails
- Rails (or UI) resolves approval and records result
- Runner may proceed only after an explicit approval event is recorded

### 8.2 PromptDeltaNeeded
If blocked due to ambiguity or missing inputs:
- Runner emits PromptDeltaNeeded with requested_fields
- Execution halts for that node until inputs are provided and recorded

---

## 9) Observability, replay, and diff

### 9.1 Canonical trace source
Rails ledger + receipts are canonical.
Runner may provide utilities:
- replay: re-run a DAG using the same WIHs/policies/tool schemas
- diff: compare two runs by event stream + receipts

### 9.2 Determinism boundary
Determinism is evaluated at the constraint layer:
- gate outcomes, tool allow/deny decisions, acceptance verdicts must be reproducible given identical inputs

---

## 10) Minimal required endpoints (conceptual)
This section is conceptual; actual routes may differ. The contract is the behavior.

Runner needs Rails capabilities for:
- ledger tail/trace
- lease request/renew/release
- gate check/commit/fail
- receipt/blob upload + evidence linking
- work-item state updates (open/close, iteration events)
- escalation events (PermissionRequest, PromptDeltaNeeded)

</BridgeRailsRunnerSpec>

If you want, next I can generate agents/spec/WIH_SCHEMA.md and agents/spec/DAG_SCHEMA.md in the same locked style so the runner and rails both have a single spec to point at.