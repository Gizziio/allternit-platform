# Agent Runner DAG Task Plan (v1)

## Background
- Rails is the control plane: ledger, leases, gates, receipts, mail, and CLI commands (`allternit plan`, `allternit wih`, `allternit gate`, etc.) are the single source of truth.  
- The Agent Runner (DAK) must stay entirely execution-plane, running deterministic orchestration, context pack assembly, prompt packs, worker swarms, and gasping tool calls through Rails gates.  
- Source material used: everything under `agent/` (ownership map, bridge specs, REC, DAK runner spec, Claude delta, policy pack, prompt format/index, WIH scheme, examples, profiles).

## Phase 0: Governance & Compliance Mapping
**Goal:** Lock down the bridge/responsibility contract before any implementation.

1. **Verify Rails → Runner API contract**
   - Digest `BridgeSpec_AgentRunner_RailsRunner_v1.md`, `BridgeSpec_AgentRunner_RailsRunner_v2.md`, `Runner_Rails_Event_Contract_REC_v1.md`, `agent/spec/bridge-rails-runner.md`.
   - Define concrete request/response payloads (WorkRequest, Claim, Gate check, ReceiptRecorded, etc.).
   - Document canonical lease key (`spawn/<event_id>`), event payload fields, and gatestates.
   - Output: `agents/spec/BRIDGE_RAILS_RUNNER.md` (locked) and `agent/spec/bridge-rails-runner.md` expanded.

2. **Formalize policy & write scopes**
   - Capture invariants from `agent/POLICY.md`, `agent/agent_profiles.json`, and Claude delta notes.  
   - Produce a runnable policy bundle specification referencing `.allternit/agents/` + `AGENTS.md`.
   - Output: policy bundle builder module + injection marker plan under `policy/`.

Dependencies: `AGENTS.md` instructions and rails spec for gate commands.

## Phase 1: Core Execution Kernel (Hook Runtime + Tool Contracts)
**Goal:** Build the deterministic runtime that interprets WIH/DAG and proxies tool use through Rails gates.

1. **Hook Runtime & Lifecycle**
   - Implement `hooks/runtime.ts` (SessionStart → PreToolUse → PostToolUse → PostToolUseFailure → SessionEnd).
   - Normalize provider events (Claude/others) per Claude delta docs.
   - Emits HookEvents into local observability bus and ensures RL gating occurs at PreToolUse.
   - Output: `hooks/runtime.ts`, hook schema reference doc, `agents/primitives/DAK-HOOKS.md`.

2. **ToolRegistry + Enforcement**
   - Build `tools/registry.ts` referencing Claude tool list + plan for `MCP` naming.
   - Wire `tools/enforce.ts` to validate arguments, allowed/forbidden tool sets, and to call PolicyEngine.
   - Create schema assets (`agents/primitives/ENFORCEMENT_LAYER.md`, `agent/Agentic Prompts/formats/dag-schema.md` if needed).

3. **Policy Engine & Gate Choke**
   - Implement `policy_engine/engine.ts` with protected paths, bash patterns, write/edit rules referencing `agent/ClaudeCode*` content.
   - Intercepts PreToolUse to produce decisions (ALLOW/BLOCK/TRANSFORM/REQUIRE_APPROVAL).
   - Call Rails gate APIs per REC spec (pre-check → post-commit/failure).  
   - Outputs: `policy_engine/rules/*.yaml`, `rule` ingestion tests.

4. **Bridge Adapter**
   - Add `adapters/rails_api.ts` that issues Lease requests, Gate check/commit/fail, Receipt writes, WIH transitions through CLI or HTTP.
   - Add `runner/agent-runner.ts` to tie claim → execute loops sending structured events.

Dependencies: WIH schema, context packs, policy definitions.

## Phase 2: Planning, Workers, & Orchestration
**Goal:** Provide deterministic control: context pack builder, worker manager, Ralph loop, plan-with-files.

1. **ContextPack Builder**
   - Implement `context/sealer.ts` + `context/builder.ts` per Bridge spec inputs (AGENTS.md hash, DAG slice, receipts, plan artifacts, leases).
   - Seal metadata (context_pack_id, method_version, inputs list) stored under `.allternit/runner/context_packs/`.

2. **PlanManager & Plan Files**
   - Write modules handling `plan.md`, `todo.md`, `progress.md`, `findings.md` (append-only updates, deterministic schema).
   - Tie into prompt packs (core `plan_with_files`, `loop` prompts).

3. **WorkerManager & Execution Loop**
   - Create `workers/worker_manager.ts` to spawn builder/validator/reviewer/security roles, enforce context inheritance (intersection of WIH scope), track worker_id/correlation_id.
   - Implement `loop/ralph.ts` (toposort nodes, spawn builder, then validator, handle failure with bounded fix cycles).
   - Emit events to `observability/events.jsonl`.

4. **Role envelopes & cookbooks**
   - Populate `agents/roles/*.md` per spec (orchestrator, builder, validator, reviewer, security).
   - Document cookbooks `agents/cookbooks/*.md` for loops, policy authoring, replay, worker spawn.

Dependencies: prompt packs from Phase 3, policy invariants, plan files.

## Phase 3: Observability, Receipts, & Replay
**Goal:** Capture deterministic traces, run reports, diff/replay, and ensure receipts are emitted.

1. **Observability & Event Log**
   - Append events (hook events, gate decisions, worker lifecycle) to `observability/events.jsonl`.
   - Provide ingestion/diff/replay modules (`observability/ingest.ts`, `diff.ts`, `replay.ts`).

2. **Receipt emission & manifests**
   - Implement `observability/manifest.ts` to record `run_manifest.json`, `artifact_manifest.json`.
   - Hook `policy_engine`/`tools` to emit receipts (`injection_marker`, `tool_call_pre/post/failure`, `context_pack_seal`, `validator_report`, `compaction_summary`) through Rails API.
   - Ensure validator PASS necessary for WIH completion.

3. **Compaction & Reinjection**
   - Build compaction prompt packs (`Agentic Prompts` B pack) + modules to produce `.allternit/runs/<run>/reports/CompactionSummary.md`.
   - Emit reinjection policies referencing CTR config.

Dependencies: Phase 2 plan/traces, policy gating.

## Phase 4: Prompt Packs & Role Implementations
**Goal:** Lock down all prompts, cookbooks, and role definitions the Runner will use.

1. **Prompt Format & Packs**
   - Finalize `prompt-format-spec-v1.md`, `prompt-format.md`, and `prompt-packs-index.md` (core/orch/role/evidence).
   - Build actual prompt files under `agents/packs/` using templates referencing AGENTS instructions.

2. **Policy Injection Bundles**
   - Implement `policy/bundle_builder.ts` that hashes AGENTS + policy docs and writes injection markers under `.allternit/runs/<run>/reports/`.

3. **Evidence Packs**
   - Create pack for receipt emission (`evidence.receipt_emit`), tracing summary (`evidence.trace_summarize`), and register outputs.

4. **Role Reports**
   - Provide templates for `build_report.yaml`, `validator_report.yaml`, `review_report.md`, `security_report.yaml` (per WIH schema).

Dependencies: Phase 1 policy/gate modules and phase 2 plan artifacts.

## Cross-cutting Requirements
- Documentation: maintain `agents/AGENTS.md` and `docs/agent-runner-handoff.md`.  
- Tests: add deterministic tests under `tests/` for gate enforcement, tool schema validation, lease claims, plan artifacts, and event logging.  
- No-drift: runner writes only under `.allternit/runner/**` (per `POLICY.md`).  
- Prompt injection: ensure each new worker or context loss re-injects AGENTS + policy bundle.

## Acceptance Criteria for the DAG
- Each phase produces runnable modules + artifacts referenced in specs (contexts, prompts, receipts).  
- Rails gate coverage is 100% for PreToolUse/PostToolUse (with evidence receipts).  
- Each DAG node run produces plan files, context packs, receipts, and validator-gated completion.  
- Observability traces allow replay/diff between runs.

## Deliverables per Phase Summary
| Phase | Key Deliverables | Files to Author |
| --- | --- | --- |
| 0 | Bridge spec, policy bundle, gate payload doc | `agents/spec/BRIDGE_RAILS_RUNNER.md`, `agent/spec/bridge-rails-runner.md`, `policy/bundle_builder.ts` |
| 1 | Hook runtime, PolicyEngine, ToolRegistry, Rails adapter | `hooks/runtime.ts`, `tools/registry.ts`, `policy_engine/engine.ts`, `adapters/rails_api.ts`, `runner/agent-runner.ts` |
| 2 | Context pack builder, PlanManager, WorkerManager, loop | `context/*.ts`, `loop/*.ts`, `workers/*.ts`, `agents/roles/*.md`, `agents/cookbooks/*.md` |
| 3 | Observability/replay, receipts/manifest, compaction | `observability/*.ts`, `.allternit/runner/*` run artifacts, `agent/examples/*` (maybe updated) |
| 4 | Prompt packs + evidence/reinjection prompts | `agents/packs/*`, `Agentic Prompts/*`, `policy/*.ts`, `agents/recipes` |

