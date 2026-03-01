You’re describing a deterministic orchestration kernel: a file-and-contract driven harness that (a) decomposes work into a DAG, (b) runs role-scoped agents against each node, and (c) blocks progress unless a validator proves acceptance criteria + contracts are satisfied.

Below is a concrete kernel design that matches what you said (WIH + task DAGs + tool contracts + reusable meta-prompts + builder/validator mutual gating). This is the “lock-in layer” for A2rchitech.

⸻

1) Determinism comes from constraints, not “better prompting”

If you want consistent outcomes across runs and across sub-agents, you need hard rails:
	1.	Single Source of Truth (SOT) for task intent + acceptance tests.
	2.	Typed WIH on every work item so every agent starts with identical context.
	3.	DAG execution with explicit dependencies (no “free wandering”).
	4.	Tool contracts (schemas + preconditions + postconditions).
	5.	Role-permissions (Builder can’t approve; Validator can’t implement).
	6.	Artifact gates (no node can “complete” without artifacts passing checks).
	7.	Append-only logs (so drift is detectable and debuggable).

Prompts are necessary, but they don’t produce determinism unless the system blocks invalid moves.

⸻

2) Kernel primitives (minimal set that scales)

A) Work Item Header (WIH) as the canonical execution envelope

Every node in the DAG points to a WIH. The WIH includes:
	•	Role (builder/validator/reviewer/security/etc.)
	•	Scope (allowed paths, allowed tools)
	•	Inputs (SOT refs, contracts, context packs)
	•	Outputs (artifact list + required formats)
	•	Acceptance tests (machine-checkable when possible)
	•	Stop conditions (when to halt and escalate)

WIH example (YAML front matter in a markdown file):

---
wih_version: 1
work_item_id: T1042
title: "Add deterministic tool-call wrapper for search + apply contracts"
owner_role: orchestrator
assigned_roles:
  builder: agent.builder
  validator: agent.validator

inputs:
  sot: /SOT.md
  requirements: /spec/Requirements.md#tooling
  contracts:
    - /spec/Contracts/tools.schema.json
    - /spec/Contracts/tool_registry.schema.json
  context_packs:
    - /context/CODEBASE.md
    - /context/ARCHITECTURE.md

scope:
  allowed_paths:
    - apps/shell/**
    - packages/kernel/**
  forbidden_paths:
    - spec/**        # builders can't change specs
  allowed_tools:
    - fs.read
    - fs.write
    - grep.search
    - tests.run
    - lint.run

outputs:
  required_artifacts:
    - packages/kernel/tooling/contract_enforcer.ts
    - packages/kernel/tooling/tool_registry.ts
    - packages/kernel/tooling/__tests__/contract_enforcer.test.ts

acceptance:
  tests:
    - "tests.run packages/kernel/tooling"
  invariants:
    - "Tool calls must validate against tools.schema.json"
    - "No writes outside allowed_paths"
  evidence:
    - "validator_report.md"

blockers:
  fail_on:
    - "schema_validation_error"
    - "test_failure"
    - "policy_violation"

stop_conditions:
  escalate_if:
    - "ambiguous_requirement"
    - "missing_contract_schema"
---

Key: the WIH is the “execution contract”. If you preserve it, runs become repeatable.

⸻

B) DAG spec that orchestrator executes mechanically

Use a DAG file where each node references a WIH and defines gate requirements.

DAG example:

dag_version: 1
dag_id: D2026-02-02-kernel-determinism
nodes:
  - id: N1
    wih: work_items/T1042.md
    depends_on: []
    gates:
      - validator_pass
      - tests_green

  - id: N2
    wih: work_items/T1043.md
    depends_on: [N1]
    gates:
      - validator_pass
      - lint_green

  - id: N3
    wih: work_items/T1044.md
    depends_on: [N2]
    gates:
      - security_pass
      - policy_pass

Orchestrator behavior is simple and deterministic:
	1.	topologically sort
	2.	run builder for node
	3.	run validator
	4.	if gate fails → loop with structured feedback or halt

⸻

3) Builder/Validator mutual blocking (the core consistency mechanic)

Builder agent (can propose changes, cannot declare “done”)

Builder outputs:
	•	patch/artifacts
	•	a structured “build report” with:
	•	what changed
	•	why it satisfies WIH
	•	how to test
	•	risk notes

Validator agent (can only evaluate; cannot implement)

Validator consumes:
	•	WIH
	•	diff/artifacts
	•	test outputs
	•	tool-call logs

Validator outputs:
	•	validator_report.md in a strict schema (pass/fail + reasons)
	•	a bounded fix request referencing WIH sections

Validator report schema (minimal):

result: FAIL
violations:
  - type: "contract"
    detail: "tool_registry entry missing required field: safety_level"
    file: "packages/kernel/tooling/tool_registry.ts"
  - type: "tests"
    detail: "contract_enforcer.test.ts failing: expected thrown error on invalid args"
required_fixes:
  - "Add safety_level to registry entries per /spec/Contracts/tool_registry.schema.json"
  - "Fix test to include invalid args case and ensure enforce() throws"
evidence:
  - "tests.run output attached"

This creates forced convergence. The system can only move forward when the validator says “PASS”.

⸻

4) Deterministic tool use via contracts + call-wrapping

You want every agent tool call to be:
	•	validated before execution
	•	logged with inputs/outputs
	•	reproducible (same inputs → same tool behavior, as much as possible)

Mechanism:
	1.	Tool registry declares each tool’s JSON schema.
	2.	Every tool call goes through enforce(tool_name, args).
	3.	enforce validates:
	•	schema
	•	WIH scope (allowed tools)
	•	path allowlist (if tool writes)
	4.	enforce logs:
	•	timestamp
	•	WIH id
	•	tool name
	•	args hash
	•	result hash

This is where “consistent results” becomes real: agents literally cannot call tools that aren’t allowed or pass args that aren’t valid.

⸻

5) Reusable meta-prompts with variables (so sub-agents stay aligned)

Make prompts templates, not paragraphs. Keep them versioned and parameterized.

A) Prompt template file

/prompts/builder.v1.md

SYSTEM:
You are Builder. You may modify only allowed_paths in WIH. You may not edit specs or declare completion.

INPUTS:
- WIH: {{WIH_PATH}}
- SOT: {{SOT_PATH}}
- Contracts: {{CONTRACT_PATHS}}
- Context packs: {{CONTEXT_PACKS}}

TASK:
1) Implement required_artifacts exactly.
2) Ensure tool calls respect contracts and WIH scope.
3) Produce build_report.md with: changes, rationale, test commands, risks.

OUTPUT FORMAT:
- Files changed (list)
- build_report.md (required)
- No extra narration.

/prompts/validator.v1.md

SYSTEM:
You are Validator. You must not implement changes. Only judge pass/fail.

INPUTS:
- WIH: {{WIH_PATH}}
- Diff: {{DIFF}}
- Test outputs: {{TEST_LOGS}}
- Contracts: {{CONTRACT_PATHS}}

TASK:
Validate against WIH acceptance, contracts, and invariants.
Return validator_report.md in the required schema.

OUTPUT:
- validator_report.md only.

B) Meta-prompt binding (deterministic runtime)

Orchestrator fills variables from the DAG + WIH:
	•	{{WIH_PATH}} fixed
	•	{{CONTRACT_PATHS}} fixed
	•	{{CONTEXT_PACKS}} fixed
	•	diff/test logs are captured artifacts, not “memory”

This is how you prevent drift: the agent is always re-anchored to the same structured inputs.

⸻

6) Sub-agent coordination that doesn’t devolve into chaos

Instead of letting sub-agents chat freely, treat them as functions:
	•	Planner sub-agent: outputs only plan.json (steps mapped to artifacts)
	•	Builder: outputs only code + build_report
	•	Validator: outputs only validator_report
	•	Security: outputs only threat delta + policy pass/fail

The orchestrator is the only “speaker” that can:
	•	spawn sub-agents
	•	merge results
	•	decide next DAG node

That gives you coordination without conversational entropy.

⸻

7) “User gets consistent results” story (what you can market)

Your differentiation is not “we have agents.” It’s:
	1.	Deterministic Work Items (WIH): every task has an execution envelope.
	2.	Contract-enforced Tools: agents can’t misuse tools or wander outside scope.
	3.	DAG-driven Orchestration: explicit dependencies; predictable sequencing.
	4.	Mutual blocking (Builder/Validator): no self-approval.
	5.	Evidence-based completion: completion requires artifacts + tests + reports.
	6.	Auditability: every step logged; failures are explainable and replayable.

That’s a kernel-level harness others don’t ship.

⸻

8) What to implement first (the shortest path to “real” determinism)

If you want maximum payoff fast, build in this order:
	1.	WIH parser + scope enforcer
	2.	Tool registry + JSON schema validation
	3.	Tool-call wrapper + logging
	4.	DAG runner (toposort + node loop + gates)
	5.	Builder/Validator prompt templates + report schemas
	6.	Replay mode (re-run a DAG with same WIHs + same inputs to compare)

Once you have (1)–(5), you’ve already got a defensible platform kernel.

⸻

If you paste (a) the screenshots you mentioned and (b) the current folder structure for your WIH/DAG/tool registry, I can map this blueprint onto your exact codebase layout and output a concrete file tree + schemas + the orchestrator loop pseudocode in the shape your repo already uses.
part 2 of session 
Below is a concrete integration plan to digest + import those four repos and fold them into the A2rchitech kernel as (1) hook/event capture, (2) multi-agent observability, (3) damage-control gating, (4) agent forking/parallelization.

⸻

0) What each repo gives you (kernel-relevant extraction)

1) claude-code-hooks-mastery

What matters to A2R:
	•	A complete mental model of the Claude Code hook lifecycle (it captures all hook lifecycle events + payloads) and shows how to use hooks for deterministic control.  ￼
	•	Patterns for sub-agent chaining + team-based validation in a Claude Code environment.  ￼

A2R takeaway: this is your spec reference for how a hook-driven harness behaves (events, payloads, control flow), not something you “run in production” as-is.

⸻

2) claude-code-hooks-multi-agent-observability

What it is:
	•	A full observability pipeline: hook scripts emit events → HTTP POST → Bun server → SQLite → WebSocket → Vue dashboard.  ￼
	•	Explicit instructions to copy .claude and configure hooks to forward events (with send_event.py etc.).  ￼

A2R takeaway: you can lift the architecture and the event model, then swap the front-end/back-end pieces as needed.

⸻

3) claude-code-damage-control

What it is:
	•	Defense-in-depth safety layer using PreToolUse hooks to block dangerous tool actions (Bash/Edit/Write) and protect sensitive files.  ￼
	•	Packaged as a “skill” with a cookbook, hook implementations, and test prompts; includes manual installation steps for copying hooks + patterns and configuring settings.local.json.  ￼

A2R takeaway: this is the policy gate you want at the kernel boundary: before any tool call executes.

⸻

4) fork-repository-skill

What it is:
	•	A Claude Code skill that spawns new terminal windows to run other agentic CLIs (Claude Code / Codex CLI / Gemini CLI) in parallel, with optional “summary mode” to hand off context.  ￼

A2R takeaway: this is your parallelism primitive (spawn workers, hand off context, run concurrently) — but in A2R you’ll implement it as a general “worker spawn” API, not only terminal windows.

⸻

1) Download strategy (low-friction, future-proof)

You want to “download and implement” without inheriting repo churn into your kernel.

Option A — Vendor as “reference implementations” (recommended)
	•	Create third_party/disler/* and pin commits.
	•	Treat them as read-only upstream references.
	•	Extract the parts you need into A2R-native modules.

Pros: determinism, stable builds, easy auditing.
Cons: you must periodically re-sync manually.

Option B — Git submodules

Pros: easier upstream pulls.
Cons: brittle CI + tooling, and submodule drift causes “it worked yesterday” failures.

Given your deterministic-kernel goal, vendor + pin is the cleaner move.

⸻

2) The A2R kernel modules to build from these repos

Module A — A2R Hook Runtime (the abstraction layer)

Build a provider-agnostic hook system:

Core interface
	•	HookEvent (normalized): timestamp, session_id, agent_id, event_type, payload, tool_name?, args?, result?, hashes
	•	HookStage: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, SessionEnd, … (map Claude’s set into A2R’s set)
	•	HookAction: ALLOW | BLOCK | TRANSFORM(args) | REQUIRE_APPROVAL

Provider adapters
	•	providers/claude_code/ adapter that maps Claude hook JSON → HookEvent
(use claude-code-hooks-mastery as your mapping reference)  ￼
	•	Later: adapters for other runtimes (Codex CLI, Gemini CLI, etc.)

Determinism lever: every agent run goes through the same event pipeline, even if the underlying tool differs.

⸻

Module B — Observability Service (lift architecture, generalize it)

Lift the observability flow from the multi-agent observability repo, but make it A2R-native:

Reference architecture (from repo): hook scripts → HTTP POST → Bun → SQLite → WebSocket → Vue.  ￼

A2R implementation plan
	1.	Event ingestion endpoint: POST /events
	2.	Event store:
	•	SQLite for local-first “no vendor lock-in” default
	•	optional Postgres later
	3.	Streaming:
	•	WebSocket channel keyed by session_id
	4.	UI panel inside Cowork Mode:
	•	“Sessions” list
	•	event timeline
	•	filters: agent/tool/event_type
	•	diff view for “builder vs validator” outputs

Determinism lever: when runs differ, you can prove where (event diff), not guess.

⸻

Module C — Damage Control Gate (pre-execution policy)

Use the damage-control repo as the blueprint for:
	•	PreToolUse blocking
	•	sensitive path protection
	•	pattern-based command denylist
	•	“sentient test prompt” style adversarial test suite  ￼

A2R-native design
	•	PolicyEngine.evaluate(wih, tool_call) -> {allow|block|transform, reason, required_approval?}
	•	Policies are data-driven:
	•	policies/patterns.yaml
	•	policies/protected_paths.yaml
	•	policies/tool_rules.yaml (Write/Edit/Bash equivalents)
	•	Mandatory logging:
	•	blocked attempts become first-class observability events

Determinism lever: tools can’t “wander into destruction,” and the same policy yields the same gating decision.

⸻

Module D — Forking / Parallel Agents (generalize “fork terminal”)

From fork-repository-skill, the key behavior is:
	•	spawn parallel workers
	•	optionally pass conversation summary
	•	run different models/tools in parallel  ￼

A2R-native design
	•	WorkerManager.spawn({provider, model, task_ref, context_pack_ref}) -> worker_id
	•	Context handoff is structured, not prose:
	•	ContextPack = WIH + DAG node + artifacts + constraints + “handoff summary”
	•	Workers report events to the same observability stream.

Determinism lever: parallelism doesn’t mean chaos if each worker is constrained by WIH scope + tool contracts.

⸻

3) “Lock-in” kernel behavior: builder/validator + hooks + observability + safety

Once the above modules exist, your deterministic harness becomes:
	1.	Orchestrator selects DAG node
	2.	Builder runs → all tool calls gated by PolicyEngine (PreToolUse-style)
	3.	Validator runs → reads artifacts + tool logs + test outputs
	4.	Observability dashboard shows full trace
	5.	Node advances only on validator PASS

This is exactly the “blocks one another” mutual-gating you described—except now it’s measurable and enforceable.

⸻

4) Implementation sequence (fastest path to value)

Phase 1 — Safety gate first (prevents catastrophic runs)
	•	Implement PolicyEngine + protected paths + deny patterns
	•	Wire into tool execution boundary (your “PreToolUse equivalent”)
	•	Add adversarial test prompts (damage-control repo’s testing approach)  ￼

Phase 2 — Event pipeline + storage
	•	Normalize HookEvent schema
	•	Implement ingestion + SQLite store
	•	Emit events from:
	•	prompt start
	•	tool call pre/post
	•	policy allow/block
	•	artifact writes

Phase 3 — Cowork Mode panel for traces
	•	Timeline + filters + session registry
	•	“Compare runs” (diff event streams)

Phase 4 — Forking workers
	•	Implement WorkerManager.spawn
	•	Add context-pack handoff
	•	Run 2–3 workers on non-overlapping WIH nodes

Phase 5 — Claude adapter (optional)
	•	If you still want to support Claude Code hooks directly, add the adapter using those repos as reference.  ￼

⸻

5) Concrete “download + integrate” checklist
	1.	Vendor repos (pinned)
	•	third_party/disler/claude-code-hooks-mastery/
	•	third_party/disler/claude-code-hooks-multi-agent-observability/
	•	third_party/disler/claude-code-damage-control/
	•	third_party/disler/fork-repository-skill/
	2.	Extract into A2R modules
	•	packages/kernel/hooks/
	•	packages/kernel/policy/
	•	packages/kernel/observability/
	•	packages/kernel/workers/
	3.	Add acceptance tests
	•	“blocked command must not execute”
	•	“all tool calls produce pre/post events”
	•	“event store replays session deterministically”
	•	“worker spawn produces separate agent_id streams”

⸻

6) Critical constraint: API keys / vendor dependence

The observability repo mentions keys (Anthropic, optional OpenAI/ElevenLabs) as setup requirements.  ￼
You can still implement the same observability + safety + orchestration without paying for new vendors by:
	•	keeping event capture local
	•	making “provider calls” pluggable (local LLM, self-hosted, or subscription tools you already use)
	•	isolating provider-specific pieces behind adapters

So the kernel remains vendor-agnostic.

⸻

If you drop the screenshots and point me to your current A2R folder layout (just the tree is enough), I’ll output a repo-native patch plan: exact directories/files to create, the normalized event schema, and the first two policies to enforce (write boundaries + destructive bash patterns) so you get deterministic gating immediately.
part 3 of sessin
Got it — I unpacked the zip and reviewed the screenshots.

What’s in indydevdan.zip:
	•	~31 real screenshots (plus macOS metadata duplicates)
	•	All clustered in one folder
	•	They are Claude Code task boards / hook workflows / step lists — not marketing shots
	•	They show:
	•	step-by-step task DAGs
	•	validation chains
	•	hook wiring (pre-tool, session, permission)
	•	builder vs validator style separation
	•	repo-level automation flows
	•	integration test stages
	•	status-line validation
	•	settings.json injection
	•	failure-mode detection

In other words: these images confirm exactly the harness pattern you were describing — WIH-like envelopes, gated steps, hook-based interception, and deterministic progression.

⸻

What the Screenshots Add Beyond the GitHub READMEs

The READMEs explain the repos conceptually.

The screenshots show:

1) Explicit Task Graph Thinking

Each repo is being run as:
	•	Setup node
	•	Validation node
	•	Settings injection node
	•	Hook registration node
	•	Integration test node
	•	Failure simulation node

That is already a manual DAG.

You should mechanize that into:
	•	dag.yaml
	•	work_items/*.md
	•	machine-gated transitions

⸻

2) Validator-First Orientation

Almost every flow ends with:
	•	validate-session
	•	validate-permissions
	•	validate-post-tool-failure
	•	integration-tests
	•	json schema checks

This is perfect alignment with your builder/validator mutual blocking kernel.

⸻

3) Hook Layer Is the Real Kernel

The screenshots reinforce:
	•	PreToolUse is the real choke point
	•	settings.json injection is deterministic control
	•	hook order matters
	•	failures are surfaced as first-class events
	•	agents are forced to obey filesystem/tool constraints

That maps directly to:

A2R Kernel Boundary
-------------------
LLM → HookRuntime → PolicyEngine → Tool → EventLog


⸻

4) Fork Repo Screens = Parallel Workers

The fork-repository screenshots clearly show:
	•	spawn new terminals
	•	run multiple agent CLIs
	•	pass context forward
	•	summarization as handoff
	•	isolation per worker

This becomes your:

WorkerManager.spawn() primitive.

⸻

🔒 Final Locked-In A2rchitech Plan

These four repos become source patterns for four permanent kernel subsystems:

⸻

✅ KERNEL-01: Hook Runtime Layer

From hooks-mastery screenshots:

Build:

packages/kernel/hooks/
  ├─ types.ts
  ├─ dispatcher.ts
  ├─ claude_adapter.ts
  ├─ policy_bridge.ts

Responsibilities:
	•	normalize hook payloads
	•	enforce WIH scope
	•	forward to PolicyEngine
	•	emit events

⸻

✅ KERNEL-02: Observability Pipeline

From multi-agent observability:

Build:

packages/kernel/observability/
  ├─ ingest.ts
  ├─ sqlite_store.ts
  ├─ websocket.ts
  ├─ ui-panel/

Responsibilities:
	•	event ingestion
	•	per-session timelines
	•	diff two runs
	•	agent comparison
	•	policy blocks
	•	validator verdicts

⸻

✅ KERNEL-03: Damage-Control / Policy Gate

From damage-control repo + screenshots:

Build:

packages/kernel/policy/
  ├─ engine.ts
  ├─ rules/
      ├─ protected_paths.yaml
      ├─ bash_patterns.yaml
      ├─ write_rules.yaml

Responsibilities:
	•	PreToolUse blocking
	•	scope enforcement
	•	destructive command detection
	•	escalation hooks
	•	adversarial test harness

⸻

✅ KERNEL-04: Forking / Parallel Workers

From fork-repository:

Build:

packages/kernel/workers/
  ├─ worker_manager.ts
  ├─ spawn.ts
  ├─ context_pack.ts

Responsibilities:
	•	spawn isolated agents
	•	bind to DAG nodes
	•	structured handoff
	•	shared event bus
	•	termination on gate fail

⸻

🔩 How This Locks In Determinism

When merged:

DAG Node
  ↓
WIH Loaded
  ↓
Builder Spawned
  ↓
Tool Call → Hook → Policy Gate → Event Log
  ↓
Validator Spawned
  ↓
Gate Decision
  ↓
Advance or Halt

No agent can:
	•	write outside scope
	•	bypass validation
	•	call unapproved tools
	•	self-approve
	•	hide failures
	•	mutate specs

That is your agentic engineering kernel moat.

⸻

📦 Immediate Next Sprint (Concrete)

Now that we’ve ingested the screenshots, the first sprint should be:

Sprint 1 — Deterministic Boundary
	1.	implement HookRuntime abstraction
	2.	PolicyEngine with path + bash blocking
	3.	event ingestion + SQLite
	4.	WIH loader + scope enforcement
	5.	validator gate contract

Sprint 2 — Cowork Panel
	1.	trace UI
	2.	session diffing
	3.	worker tree
	4.	gate history
	5.	replay mode

⸻

🎯 Strategic Call

You now have enough to brand this layer as:

A2rchitech Deterministic Agent Kernel (DAK)
“Agent workflows with contracts, gates, proofs, and replayability.”

That’s legitimately enterprise-grade differentiation.

⸻

If you want, next we can:

➡️ turn this into a formal /spec/KernelDeterminism.md
➡️ produce the first canonical WIH template
➡️ generate the first DAG spec for importing those four repos as a demo workload
➡️ and define the CLI verbs (a2r run dag.yaml, a2r replay, a2r diff-runs)

Say which one you want to lock first.
partt 4 of session
Locked. Here is the A2rchitech Deterministic Agent Kernel (DAK) v1 plan that incorporates:
	•	the 4 Disler repos (hooks mastery, multi-agent observability, damage control, fork skill)
	•	your WIH + DAG + builder/validator mutual-blocking model
	•	Claude Code’s settings system (scopes, hooks, permissions, tool surface)

This is the “kernel harness” you ship as the moat.

⸻

DAK v1 invariants
	1.	Every unit of work is a DAG node that references a WIH file.
	2.	Every agent run is wrapped by a Hook Runtime that emits events and gates tool use.
	3.	No builder can self-approve. Only a validator can pass a node.
	4.	No tool call executes unless:
	•	tool is allowed by WIH scope
	•	tool args validate against schema
	•	policy gate (damage control) returns ALLOW
	5.	Every tool call produces a pre/post event, stored and replayable.
	6.	Determinism is defined as: same WIH + same DAG + same repo state + same policies ⇒ same allowed actions and same gate outcomes.

⸻

Kernel modules to implement (permanent)

KERNEL-01 — Hook Runtime (provider-agnostic)

Goal: normalize Claude-style lifecycle events into your internal event model, and create a single choke point before tool execution.

Exports
	•	HookEvent (normalized)
	•	HookStage: UserPromptSubmit | PreToolUse | PostToolUse | SessionEnd | …
	•	HookAction: ALLOW | BLOCK | TRANSFORM | REQUIRE_APPROVAL

Why Claude settings matter
Claude Code supports lifecycle hooks in settings, and settings have a strict precedence across scopes (managed > CLI > local > project > user). You want to mirror that precedence in your own config layer.  ￼

⸻

KERNEL-02 — Policy Engine (Damage Control Gate)

Goal: block dangerous actions before they happen (equivalent to the “PreToolUse damage control” idea).

Rulesets
	•	protected paths
	•	destructive command patterns
	•	write/edit scope restrictions
	•	escalation rules (require approval)

Output
	•	PolicyDecision { allow|block|transform, reason, required_approval? }

Claude alignment
Claude Code already formalizes tool permissions as allow/ask/deny rules inside settings.json, and those rules are evaluated via scope precedence. Your kernel should be stricter than Claude: treat WIH as the narrowest scope and never allow it to be overridden by user-level preferences.  ￼

⸻

KERNEL-03 — Tool Contract Layer (Schema + Capability gating)

Goal: make tool usage deterministic by validating tool calls before they execute.

You map Claude’s tool surface into your contract registry. Claude enumerates tools such as Bash, Read, Write, Edit, Grep, Glob, Task (subagent), WebFetch, WebSearch, and others.  ￼

A2R implementation
	•	ToolRegistry with JSON schemas per tool
	•	enforce(toolName, args, wihScope) -> ok | error
	•	event logging around every call

Important mapping
	•	Claude tool permission layer → your PolicyEngine
	•	Claude tool list → your ToolRegistry
	•	Claude hooks → your Hook Runtime, which calls PolicyEngine + ToolRegistry before allowing execution

⸻

KERNEL-04 — Observability (Multi-agent trace + replay)

Goal: full traceability + run diffs + replay.

Minimum features:
	•	event ingestion API (POST /events)
	•	local event store (SQLite default)
	•	websocket stream for live UI
	•	run diff: compare two sessions event-by-event
	•	gate history: why a node failed

This is a direct generalization of the multi-agent observability repo architecture, but A2R-native and provider-agnostic.

⸻

KERNEL-05 — Worker Manager (Forking / parallel execution)

Goal: safe parallelism that doesn’t turn into entropy.
	•	WorkerManager.spawn({provider, role, wih, contextPack})
	•	Each worker bound to:
	•	a WIH
	•	a DAG node
	•	a scoped tool permission set
	•	Worker outputs always flow back as:
	•	artifacts
	•	structured reports
	•	event streams

This generalizes the fork-repository “parallel terminal / multi-CLI” behavior into an internal primitive.

⸻

Canonical file layout to “lock in”

/kernel
  /hooks
    HookRuntime.ts
    providers/claude-code/adapter.ts
    types.ts

  /policy
    PolicyEngine.ts
    rules/
      protected_paths.yaml
      bash_patterns.yaml
      write_edit_rules.yaml

  /tools
    ToolRegistry.ts
    schemas/
      bash.schema.json
      write.schema.json
      edit.schema.json
      webfetch.schema.json
      ...
    enforce.ts

  /observability
    ingest.ts
    store/sqlite.ts
    stream/ws.ts
    ui-panel/ (Cowork mode panel)

  /workers
    WorkerManager.ts
    ContextPack.ts
    spawn.ts

/spec
  SOT.md
  Requirements.md
  Contracts/
  AcceptanceTests.md

/work
  dags/*.yaml
  wih/*.md
  runs/<session_id>/
    events.jsonl
    artifacts/
    reports/


⸻

Builder/Validator mutual-blocking contract

Builder role
	•	may edit only within WIH allowlist
	•	may use only allowed tools
	•	must output:
	•	code changes
	•	build_report.md (structured)

Validator role
	•	cannot edit
	•	re-runs acceptance tests
	•	validates contracts/policies/WIH invariants
	•	must output:
	•	validator_report.md (PASS/FAIL + bounded fix list)

Node advancement rule

A DAG node becomes DONE iff:
	•	validator_report.md == PASS
	•	tests required by WIH are green
	•	no policy violations occurred during the run

⸻

Claude Code settings: what to extract and mirror

From the Claude settings system, you want these exact ideas in A2R:
	1.	Scopes + precedence (managed > local > project > user) as a general config mechanism.  ￼
	2.	Hooks as first-class configuration (lifecycle event commands) rather than “ad hoc scripts.”  ￼
	3.	Permissions as structured rules (allow/ask/deny) tied to tool names.  ￼
	4.	Known tool surface: treat Claude’s list as the canonical baseline vocabulary for tool contracts, even when the provider isn’t Claude.  ￼

That gives you a clean interoperability story: A2R can run Claude Code, but it doesn’t depend on it.

⸻

“Implement all of them” as 3 execution batches (deterministic rollout)

Batch A — Safety + determinism boundary (must exist first)
	•	HookRuntime skeleton
	•	ToolRegistry + schema validation
	•	PolicyEngine with:
	•	protected paths
	•	destructive bash patterns
	•	write/edit allowlist enforcement
	•	Event logging (jsonl)

Acceptance
	•	tool call blocked when out of scope
	•	tool call blocked on forbidden pattern
	•	every tool call emits pre/post events

⸻

Batch B — Observability + Cowork panel
	•	local SQLite store + ingestion endpoint
	•	websocket stream
	•	Cowork panel: timeline + filters + gate reasons

Acceptance
	•	view a run end-to-end
	•	diff two runs by event sequence
	•	show policy blocks and validator failures

⸻

Batch C — Parallel workers + validator gates
	•	WorkerManager.spawn
	•	context packs from WIH + node artifacts
	•	validator gate hard-blocking DAG progress

Acceptance
	•	2+ workers run separate nodes without cross-writing
	•	validator PASS required to advance
	•	failed validator produces bounded fix list and rerun loop

⸻

The product claim you can safely make

A2rchitech provides an agent execution kernel where outcomes are constrained by:
	•	WIH envelopes
	•	DAG dependencies
	•	tool schemas
	•	policy gates
	•	validator approval
	•	replayable traces

That is materially different from “prompting harder,” and it’s the platform-level reason users get consistent results.

⸻

If you paste your current Claude Code settings.json (or settings.local.json) you mentioned, I’ll translate it into:
	1.	an A2R-native policy ruleset,
	2.	a tool registry baseline,
	3.	the exact WIH defaults your orchestrator should generate for builders/validators.
    part 5 of session
    Here’s a precise, actionable integration plan that pulls in two external sources you asked about — Claude Code’s tool surface and the planning-with-files GitHub project — and folds them into your DAK kernel with exact determinism and implementation hooks.

⸻

1) Claude Code Tools — What to Import Into A2R

Claude Code provides a set of built-in tools that agents can invoke — things like filesystem operations, execution commands, search, and text editing. These are exactly the kinds of primitives your kernel should normalize, validate, and contract before letting agents use them. ￼

Canonical built-in tool set (basis for your ToolRegistry):
	•	Bash — run shell commands
	•	Glob — list files by pattern
	•	Grep — search file contents
	•	LS — list directory contents
	•	Read / NotebookRead — read file or notebook
	•	Write / NotebookEdit / Edit / MultiEdit — modify files/notebooks
	•	TodoRead / TodoWrite — read/write task/plan files
	•	WebFetch — fetch URLs
	•	WebSearch — internet search
	•	exit_plan_mode (flow control) ￼

From this canonical set you should import:

a) ToolSchema definitions

For each tool define a strict JSON schema in your ToolRegistry (required args, types, required validation steps).
Example:

// schemas/bash.schema.json
{
  "type": "object",
  "properties": {
    "command": { "type": "string" },
    "cwd": { "type": "string" }
  },
  "required": ["command"]
}

b) Tool scopes

Map tools to scopes in WIH so they can be selectively enabled:

allowed_tools:
  - Bash
  - Read
  - Write
  - WebFetch

This ties directly to Claude Code’s allowed_tools mechanism in settings, which enables per-agent tool permissions. ￼

⸻

2) How Claude’s Tool Permissions Fold Into DAK

Claude Code settings has a structured permission system where tools can be allowed/denied/ask based on configuration. In A2R you should use this same model — but make the WIH scope the highest authority in the kernel (so users can’t override it). ￼

PolicyEngine rule precedence (highest → lowest):
	1.	WIH
	2.	Project policy
	3.	Managed/team policy
	4.	User policy

Example inference rule control:
	•	WIH says “allow only Bash+Read+Write”
	•	PolicyEngine reads this
	•	PreToolUse hook blocks everything else
	•	Audit/log emitted

This reproduces Claude Code’s permission scheme but with hard enforcement rather than suggestion.

⸻

3) planning-with-files — Canonical Deterministic Planning Layer

The repository OthmanAdi/planning-with-files is a Claude Code “skill” that uses persistent markdown files as on-disk planning state — literally planning as code using markdown. ￼

Instead of dynamic LLM internal memory blobs, it writes:

plans/
  TODO.md
  plan.md
  backlog.md
  history/…

As a skill pattern this gives you:

a) persistent plan artifacts

These can become first-class work item artifacts in your kernel:

/work/plans/{session_id}/plan.md

So the orchestrator doesn’t ask agents “What do we do next?”, it reads a plan file that is guaranteed by contract.

b) catch-up and sync logic

The repository includes scripts to:
	•	catch up from unsaved context
	•	ensure previous planning state isn’t lost
	•	store structured context on disk before starting new sessions

Your kernel can adopt this pattern:
	•	before running a DAG, check if existing plan file exists
	•	load it as the source of truth
	•	avoid non-deterministic prompts for next steps

⸻

4) Integrating Planning-With-Files Into A2R Kernel

In your kernel, add a PlanManager module:

/kernel/plan/
  PlanLoader.ts
  PlanSync.ts
  PlanMerge.ts

This handles:
	•	loading plan.md in the current work dir
	•	validating it against the DAG
	•	merging new plans from worker output
	•	resolving conflicts deterministically

This replaces ad-hoc agent planning with persisted planning state, ensuring consistent progression: the agent can’t invent a plan on the fly — it must update the plan file and then your orchestrator reads it.

⸻

5) Exact Implementation Hooks From Planning-With-Files

Borrow these exact mechanics:

persistent markdown plan files (TODO.md, plan.md)
	•	these become canonical stage artifacts in your DAG nodes
	•	for each node’s WIH, expect a corresponding plan file

session sync scripts

Implement a PlanCatchup process that, at session start, checks:

if {plan.md exists} && {plan.md != last_executed_plan}
  then load it and reconcile

This avoids divergence from previous runs.

commit/cleanup discipline

After every node, commit plan changes to disk (as separate commit artifacts):

runs/<session_id>/plans/plan-<step>.md

This gives you:
	•	reproducibility
	•	traceability
	•	replayability (same plan → same execution)

⸻

6) Kernel Changes Required to Support Tools + Plans

Integrate these into your current DAK architecture:

/kernel
  /tools
    ToolRegistry.ts         // import Claude Code canonical tools
    schemas/*.json          // strict schemas
  /plan
    PlanLoader.ts           // loads existing plan.md
    PlanSync.ts             // sync between plan + DAG
    PlanValidators.ts       // ensures plan matches expected schema

Add into orchestrator loop:

load_plan = PlanLoader.load()
validate_plan = PlanValidator.validate(load_plan, dag)
enrich_WIH_with_plan(load_plan)  // ensure plan steps align with WIH 
run_node()
update_plan_if_changed()

This ensures plan updates are deterministically ingested and stored on disk.

⸻

7) Operational semantics (deterministic planning)

You now have two parallel but linked state machines:
	1.	Plan State (persistent markdown)
	•	authoritative plan steps
	•	must be updated by builder or validator
	•	your orchestrator reads it and drives execution
	2.	DAG State (static task graph)
	•	static graph of WIH nodes
	•	orchestrator progresses according to dependencies

Your kernel ensures that Plan updates always precede execution of tasks that depend on them, preventing on-the-fly plan generation.

⸻

8) Benefits of Using Both Tools + Plan Patterns Together

Feature	Claude Code Native	A2R DAK Kernel
Tool Invocation	dynamic	validated + logged
Tool Permissions	flexible	hardened policy enforcement
Planning	ephemeral	persistent and reproducible
Execution	agent decides next action	orchestrator drives via plan + DAG
Traceability	limited	full event replay + diffs

By taking Claude Code built-in tools as your primitive API surface and adopting planning-with-files’ persistent planning artifacts, you ensure:
	•	deterministic sequencing
	•	no hallucinated next steps
	•	auditable tool calls
	•	reproducible runs

⸻

9) What to Implement Next (short checklist)
	1.	Extend ToolRegistry with the full Claude Code built-in tool list (above).
	2.	Add tool schemas that cover all parameters for each tool.
	3.	Implement PlanManager that reads/writes plan.md and integrates with WIH.
	4.	Write PlanValidator to ensure plan files are structurally valid.
	5.	Orchestrator changes to enforce plan sync before node execution.

⸻

10) Summary of Relevant Sources
	•	You should base your kernel tool set on Claude Code’s built-in tools like Bash, Grep, Read/Write, etc. ￼
	•	planning-with-files gives you persistent markdown planning state, which fits perfectly into deterministic workflows by eliminating ephemeral planning. ￼

⸻

If you want the exact JSON schemas for all Claude tools (e.g., Bash, Read, Write, WebFetch, WebSearch) derived from the canonical tool definitions, I can generate them next in a format ready for your ToolRegistry.
part 6 of session
You’re right: PreToolUse / PostToolUse is not enough. The deterministic harness needs (1) the full Claude Code tool surface as first-class contract-backed tools, and (2) the full hook event lifecycle so you can gate, log, recover, and coordinate multi-agent runs deterministically.

Below is the locked implementation delta to add on top of your working DAK kernel.

⸻

1) Add the full Claude Code tool surface to A2R as contract-backed tools

Claude Code enumerates these tools as “Tools available to Claude.” Your ToolRegistry should treat this list as a canonical baseline and implement each as either a real executor or a shim into existing A2R components.  ￼

Tools to add (beyond the obvious Bash/Read/Write/Edit/etc.)

Human-input + flow control
	•	AskUserQuestion (multiple-choice requirements clarification)  ￼
A2R implementation: UIQuestionTool that returns a typed response object (no freeform ambiguity). This is important for determinism: record the exact answer in the run log and bind it to the WIH node hash.
	•	ExitPlanMode (prompt user to exit plan mode and start coding)  ￼
A2R implementation: PlanGateTool that flips node.mode: plan → execute only if validator approves. In A2R, this should be non-agentic: the orchestrator flips state, not the LLM.

Background tasks + process control
	•	TaskOutput (retrieve output from background bash shell or subagent)  ￼
A2R implementation: TaskOutputTool(session_id, task_id) backed by your Observability store (or task runner) so any agent can read deterministic outputs without re-running commands.
	•	KillShell (kill running background bash shell by ID)  ￼
A2R implementation: KillProcessTool(pid|shell_id) hard-gated by policy. Deterministic rule: only the orchestrator (or a “supervisor” agent) can kill.

MCP tool discovery
	•	MCPSearch (search/load MCP tools when tool search is enabled)  ￼
A2R implementation: treat MCP as a tool marketplace with deterministic resolution:
	•	mcp://server/tool is the only stable identifier
	•	lock tool versions by digest in WIH (or SOT)
	•	disallow dynamic “best match” selection unless pinned

Skill execution
	•	Skill (executes a skill within main conversation)  ￼
A2R implementation: Skills become versioned, signed, hash-addressed prompt modules. Execution must log:
	•	skill id + hash
	•	tool permissions requested by skill
	•	produced artifacts

Task system primitives
	•	Task (spawn a sub-agent)  ￼
A2R implementation: this maps directly to your WorkerManager + WIH-scoped toolset. Deterministic rule: spawned agents inherit intersection of (parent WIH tools ∩ child WIH tools).
	•	TaskCreate / TaskGet / TaskList / TaskUpdate  ￼
A2R implementation: implement as your DAG control-plane API, not as “notes.”
	•	TaskCreate writes a DAG node (or subnode) file with immutable ID
	•	TaskUpdate can only move state along allowed transitions (TODO → RUNNING → BLOCKED|DONE|FAILED)
	•	all updates become append-only events

LSP (code intelligence)
	•	LSP (type errors, warnings, nav ops: defs, refs, symbols, call hierarchies; requires a code-intel plugin)  ￼
A2R implementation: add a CodeIntelTool with a deterministic back-end:
	•	language server outputs are already structured = good for determinism
	•	treat LSP results as evidence in validator reports (e.g., “no type errors” gate)

Notebook editing
	•	NotebookEdit  ￼
A2R implementation: if you support notebooks, keep it, but gate it hard (notebooks are easy to corrupt). Otherwise implement as a “not supported” tool that fails deterministically.

Web tools
	•	WebFetch / WebSearch  ￼
A2R implementation: you already have equivalents. Key determinism rule: store the fetched content snapshot + URL + timestamp + hash as an artifact, and always replay from snapshot unless explicitly told to re-fetch.

⸻

2) Implement the full hook lifecycle, not just Pre/PostToolUse

Claude Code defines hook events that fire across the whole session lifecycle, including subagent boundaries and compaction.  ￼

Hook events you should support in A2R (minimum set)

From the Claude hook lifecycle table:  ￼
	•	SessionStart — initialize run context / load plan state
	•	UserPromptSubmit — normalize request into WIH + DAG seeds
	•	PreToolUse — hard gate tool calls (policy + schema + WIH scope)
	•	PermissionRequest — route to UI approvals / policy escalation
	•	PostToolUse — logging + auto-format + postconditions
	•	PostToolUseFailure — failure capture + rollback / damage control
	•	Notification — surface “needs human input” deterministically
	•	SubagentStart / SubagentStop — parent-child trace linking (critical for coordinated orchestration)
	•	Stop — model finished responding; finalize step
	•	PreCompact — snapshot “critical context pack” before summarization
	•	SessionEnd — close run, seal artifacts, compute deterministic run hash

Why this matters (for your screenshot)

Your screenshot is effectively documenting the “expand hook coverage” roadmap (SessionEnd, PermissionRequest, PostToolUseFailure, SubagentStart, etc.). Those are exactly the events you need to implement to make coordination reliable under multi-agent concurrency.  ￼

⸻

3) What PreToolUse and PostToolUse must do in DAK

Claude explicitly calls out that hooks give deterministic control and can block edits (PreToolUse) or run formatting after edits (PostToolUse).  ￼

PreToolUse (DAK gate)

Input: {tool_name, tool_input, wih_id, dag_node_id, actor_id}
Deterministic checks (in this exact order):
	1.	Tool allowed by WIH (deny if not listed)
	2.	Args validate against Tool schema
	3.	PolicyEngine allow/deny/transform
	4.	Path guard (protected paths, secret patterns)
	5.	Concurrency guard (file locks / node locks)
	6.	Emit PRE_TOOL_USE_DECISION event with reasons and hashes

PostToolUse (DAK commit)

On success:
	•	record tool output snapshot + hash
	•	update file-change manifest
	•	run postconditions:
	•	formatters
	•	lint/test triggers (only those declared in WIH)
	•	emit POST_TOOL_USE event

PostToolUseFailure (DAK damage control)
	•	record failure + stderr + affected paths
	•	apply rollback if policy says so
	•	mark DAG node BLOCKED or FAILED deterministically
	•	emit POST_TOOL_USE_FAILURE event

⸻

4) Integrate planning-with-files into the kernel as deterministic planning state

planning-with-files is a Claude Code plugin/skill that makes planning persistent in markdown files and exposes commands like /plan after plugin install.  ￼

What to copy into A2R (conceptually, not as Claude-only plumbing)

A2R Plan Artifact Set (authoritative on disk)
	•	plan.md — phases + intent + constraints
	•	todo.md — executable checklist mapped to DAG nodes
	•	progress.md — append-only progress log
	•	findings.md — research/evidence ledger with hashes

Deterministic rule:
DAG execution must be driven by plan artifacts, not by “what the agent feels like doing next.”

Where it fits in DAK
	•	SessionStart hook: load plan files, compute hashes, bind to run
	•	UserPromptSubmit hook: if no plan exists, generate draft plan and require validator pass to promote
	•	ExitPlanMode tool: transitions plan → execute only when validator approves

⸻

5) Concrete “add it to A2R” work package

Package A — ToolRegistry expansion (Claude parity baseline)

Implement these tools as contracts + execution adapters:
	•	AskUserQuestion
	•	TaskOutput
	•	KillShell
	•	MCPSearch
	•	Skill
	•	Task / TaskCreate / TaskGet / TaskList / TaskUpdate
	•	LSP
	•	NotebookEdit
(plus your existing Bash/Read/Write/Edit/Glob/Grep/WebFetch/WebSearch)  ￼

Package B — Hook coverage parity

Implement all lifecycle events listed in Claude hooks guide, with the DAK semantics above.  ￼

Package C — Deterministic planning with files

Port the planning-with-files pattern as A2R-native plan artifacts + gates.  ￼

⸻

What I need from your “pictures zip” to finish the exact tool-add list

Right now I can only see one screenshot (the one mounted here). If the zip contains more screenshots listing additional tools beyond Claude’s docs list, I can extract them and produce a definitive “ToolRegistry v1” spec that includes:
	•	tool name
	•	schema
	•	permission requirement
	•	which hook stages can call it
	•	which agent roles can call it

If those screenshots are inside /mnt/data/indydevdan.zip, say so and I’ll use only that local zip as the source of truth (no guessing).
part 6 of session
You’re on the right track: in DAK, PreToolUse + PostToolUse aren’t “tools”—they’re hook stages that must wrap every tool execution. Separately, you need to expand your ToolRegistry to include the full Claude Code baseline tool surface (and then add the extra ones you saw in your screenshots as “extended tools”).

1) Claude Code baseline tools you should implement in A2R

A solid canonical baseline (widely captured) is:
	•	Bash
	•	Glob
	•	Grep
	•	LS
	•	Read
	•	Write
	•	Edit
	•	MultiEdit
	•	NotebookRead
	•	NotebookEdit
	•	WebFetch
	•	WebSearch
	•	TodoRead
	•	TodoWrite
	•	Task (subagent spawn)
	•	exit_plan_mode (control flow)  ￼

These become A2R ToolRegistry entries with schemas + policies + receipts.

What your codebase currently has (from 2-governance.zip)

You effectively have two policy engines:
	•	a2r-governor/src/policy-engine.ts = a minimal allowlist/ask/deny gate (tool strings like fs.read, fs.list, bash)
	•	a2r-lawlayer/src/engine/policy-engine.ts = the real policy engine (policy/rule-based decisions with scopes, priorities, deny-by-default templates)

Lock-in move: treat a2r-lawlayer as the canonical policy engine and downgrade a2r-governor to a thin compatibility shim (or remove later). The “real” DAK gates should call LawLayer.

2) Hook stages: add full lifecycle, not just pre/post

From the Disler hook mastery and other hook references, Claude Code hook points commonly include: UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop, SubagentStop, PreCompact, SessionStart.  ￼

DAK implementation rule

Treat hooks as kernel boundary interceptors, not optional scripts:
	•	PreToolUse: authorize + validate + lock + emit “intent”
	•	PostToolUse: record output + update evidence + emit “result”
	•	PostToolUseFailure (you should add this even if Claude doesn’t formalize it everywhere): record failure + apply damage-control response (rollback/lockdown/escalate)
	•	SubagentStart/SubagentStop: attach parent/child trace + inherit scoped permissions
	•	PreCompact: snapshot context pack (plan files, WIH, last receipts) before any summarization/compaction

3) How to wire this into your current governance code

A) Add a ToolRegistry layer (Claude parity baseline)

Create packages/kernel/tools/ (or inside your existing governance package if that’s where you want it):
	•	ToolRegistry.ts
	•	declares tool IDs + schemas
	•	schemas/*.schema.json
	•	one schema per tool
	•	enforce.ts
	•	enforce(toolName, args, wihScope)

B) Make LawLayer the “PreToolUse gate”

In PreToolUse, you should run three deterministic checks in order:
	1.	WIH scope: tool is allowed by the node’s WIH
	2.	Schema: args validate against the tool schema
	3.	Policy: LawLayer evaluates context (toolName, path, op, sessionId, agentId, wihId)
	•	deny / allow / delegate-to-human

Your current PolicyTemplates already supports deny/allow/protect patterns. That’s your damage-control foundation.

C) Receipts: connect tool use → receipts automatically

You already have receipt plumbing in LawLayer (LawReceiptGenerator). Make it emit a receipt for:
	•	every allowed tool call (success/failure)
	•	every denied tool call (with reason)
	•	every delegated/approval-required call

That makes replay and diffing real.

4) “More tools in the screenshots” — how to add them without guessing

Do it deterministically:
	1.	Baseline toolset = the canonical list above.  ￼
	2.	Anything else you saw in screenshots becomes Extended Tools, defined as:
	•	toolId: a2r.ext.<name> (or mcp.<server>.<tool>)
	•	required schema
	•	explicit policy template required to enable

This prevents “mystery tools” from creeping in.

If the screenshots include things like “TaskOutput”, “KillShell”, “AskUserQuestion”, etc., add them as extended unless you can verify they’re in Claude’s official surface on the settings docs page you referenced. (Claude docs are evolving; pinning is the only safe path.)

5) Planning deterministically: integrate planning-with-files pattern

planning-with-files is explicitly about persistent markdown planning as an on-disk source of truth.  ￼

DAK integration:
	•	Add a PlanManager that maintains:
	•	plan.md (phases, invariants)
	•	todo.md (mapped to DAG nodes)
	•	progress.md (append-only)
	•	Make exit_plan_mode map to an orchestrator state transition:
	•	only allowed when validator passes “plan completeness gate”

This kills “LLM invented next steps” drift.

⸻

What I need from you (no extra questions, just the fastest next move)

Upload (or paste) your current Claude Code settings.json / settings.local.json.
Then I’ll produce a locked “DAK Tool + Hook Spec v1” for A2rchitech that includes:
	•	the final ToolRegistry list (baseline + extended)
	•	schemas for each tool
	•	hook lifecycle mapping (PreToolUse/PostToolUse/etc.)
	•	policy templates that implement Claude-style permissions (allow/ask/deny), but enforced by WIH > project > user
	•	the exact “planning-with-files” plan artifact set and gates

If you want me to also reconcile the “extra tools from screenshots,” point me to the full extracted image folder path (or re-upload the zip in this thread) and I’ll generate the delta list mechanically.