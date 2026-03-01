# A2R Session Summary — Workflow Enforcement Layer (Compound Engineering Plugin)

**Date:** 2026-02-04  
**Scope:** Evaluating `EveryInc/compound-engineering-plugin` as a workflow enforcement layer for agentic software engineering; mapping to A2rchitech deterministic orchestration and “law layer” primitives.

---

## 1) Session Inputs (Raw References)

- Repo (primary): `https://github.com/EveryInc/compound-engineering-plugin`  
- Context: User framing — “helps agents be more careful” and asks if it’s useful.

---

## 2) Core Claim

`compound-engineering-plugin` is useful *when* you are already operating an agent-driven engineering loop and you want **procedural guardrails** that:
- force explicit **planning before action**,
- enforce a **review step** (self/peer/agent review),
- and **compound learnings** into reusable guidance so mistakes don’t recur.

This is not “more prompting.” It is a **workflow enforcement layer**: a thin operational protocol that sits above tools and below project goals.

---

## 3) Why It Matters (First-Principles Failure Modes It Targets)

### 3.1 Primary agent failure modes
1. **Unplanned execution:** agent starts editing before requirements are stabilized.
2. **Local optimization:** agent changes one file in isolation and breaks invariants elsewhere.
3. **No verification:** edits ship without tests/acceptance checks.
4. **No learning loop:** same errors recur because “lessons” never become enforceable policy.

### 3.2 What an enforcement layer changes
- Converts **implicit** good practice into **explicit steps**.
- Makes “stop and check” behavior non-optional.
- Produces a stable place to store and re-inject operational lessons.

---

## 4) Fit with A2rchitech (Mapping to Your Existing Law Layer)

### 4.1 Direct alignment
Your existing primitives already describe the “why”:
- `/SOT.md` as canonical truth anchor
- `/spec` baseline + append-only `/spec/Deltas/*`
- `/agent/POLICY.md` as gatekeeper
- `/spec/Contracts/*` as executable truth
- `/spec/AcceptanceTests.md` as verification oracle
- WIH front matter for deterministic task headers + constraints
- Boot order (B0): read SOT → policy → relevant specs → then act

The Compound plugin conceptually adds the “how”:
- **Plan → Work → Review → Compound**
- A repeatable discipline that can be enforced through hooks / orchestration.

### 4.2 Where it plugs in (conceptual)
- **Plan** maps to: create/validate WIH + spec delta + acceptance criteria.
- **Work** maps to: implement under permission constraints (tools + paths).
- **Review** maps to: reviewer role checks spec drift + tests + contracts.
- **Compound** maps to: update `/agent/POLICY.md` and/or append a `/spec/Deltas/*` rule or add an ADR, capturing the lesson in enforceable form.

---

## 5) Integration Blueprint (Minimal, Deterministic)

### 5.1 Implement as protocol, not as “plugin dependency”
Even if you do not adopt the plugin verbatim, the useful part is the **protocol**. You can implement the same steps as a hard-gated loop in your orchestrator:

#### Step A — PLAN (Hard Gate)
Required artifacts before code edits:
- WIH created (role, paths, tools, contracts, acceptance refs)
- Spec delta drafted (or confirmed “no spec change”)
- Acceptance criteria enumerated (tests, contracts, invariants)

Fail condition: If these are missing, execution is blocked.

#### Step B — WORK (Constrained Execution)
- Implementer can only write within allowed paths.
- No contract changes unless explicitly authorized in WIH.
- Tool permissions enforced (read-only vs write vs destructive).

Fail condition: Writes outside allowed paths or unapproved tool use.

#### Step C — REVIEW (Second Gate)
- Reviewer role validates:
  - spec alignment / no drift
  - contract compatibility
  - acceptance tests pass (or test plan is updated and justified)

Fail condition: drift, missing tests, failing checks.

#### Step D — COMPOUND (Learning & Policy)
- Every failure mode yields one of:
  - `/agent/POLICY.md` rule addition (durable guardrail)
  - `/spec/Deltas/*` addition (product/system truth change)
  - ADR entry (decision + rationale)
  - a new acceptance test (prevent regressions)

Fail condition: lesson not recorded when a failure occurs.

---

## 6) Concrete “A2rchitech Delta” Recommendations (Action Items)

### 6.1 Add a “Compound Loop” section to `/agent/POLICY.md`
- Define the four stages and hard gates.
- Define role separation: Implementer vs Reviewer vs Security.
- Define “no plan, no tool” rule: tools can’t run until PLAN gate passes.

### 6.2 Hook placements (if you’re using Claude Code / agent hooks)
- **PreToolUse:** assert PLAN gate satisfied (WIH + SOT + relevant spec loaded).
- **PostToolUse:** require state checkpoint + verification notes.
- **UserPromptSubmit:** seed context, but do not rely on it for long workflows.
- Optional: enforce that any “error recovery” path ends in COMPOUND.

### 6.3 Create a “Learning Capture” sink
Pick one canonical place:
- `/agent/LESSONS.md` append-only (then promote to POLICY/DELTA)
or
- `/spec/Deltas/*` only (stronger, but may be too heavy for small ops lessons)

### 6.4 Verification default
- Always run: unit tests + contract tests + any acceptance harness relevant to WIH.
- If tests can’t run, require an explicit “Verification Exception” block in WIH.

---

## 7) Decision Snapshot

**Decision:** Treat “Compound Engineering” as a **workflow enforcement layer** conceptually compatible with A2rchitech.  
**Adoption strategy:** Prefer adopting the protocol (and optionally the repo) by mapping it onto your existing law layer and deterministic hooks.

---

## 8) Open Questions / Constraints

1. Which runtime is the “enforcer”: kernel/orchestrator vs editor plugin vs hooks-only?
2. Where should COMPOUND updates land by default: POLICY vs DELTAS vs ADRs?
3. How strict should gates be for rapid prototyping vs production changes?  
   (Possible answer: add “modes” in WIH: `mode: prototype|prod` that changes gate strictness.)

---

## 9) Next Steps (Execution Order)

1. Add Compound Loop gates to `/agent/POLICY.md`.
2. Add WIH fields that explicitly map to gates:
   - `plan_complete: true/false`
   - `review_required: true/false`
   - `verification_required: true/false`
   - `compound_required: true/false`
3. Implement PreToolUse and PostToolUse enforcement checks.
4. Add a single “regression capture” acceptance test template.
5. (Optional) Fork/adapt the plugin if it reduces implementation time inside Claude Code/OpenCode flows.

---

## 10) Reusable Prompt (for any future “workflow enforcement” evaluation)

**Role:** Systems auditor for agentic engineering workflows  
**Context:** We need deterministic, enforceable loops to prevent drift, regressions, and repeated failure modes  
**Command:** Evaluate the candidate workflow/plugin as an enforcement layer; map to our law layer; propose minimal integration steps and concrete policy/spec deltas  
**Format:** (1) failure modes targeted (2) mapping to SOT/spec/policy/contracts/tests (3) hard gates (4) action items + deltas (5) open questions

Short answer: this file belongs with the separate Agent Runner / Agents system session — not inside Rails.

It should not be implemented in a2r-agent-system-rails.

⸻

Why (based strictly on the file)

The document you uploaded is explicitly about:

“workflow enforcement layer for agentic software engineering; mapping to A2rchitech deterministic orchestration and ‘law layer’ primitives”  ￼

Throughout the file it repeatedly frames itself as:
	•	an orchestration / enforcement protocol
	•	living above tools
	•	enforcing Plan → Work → Review → Compound loops
	•	mutating /agent/POLICY.md, /spec/Deltas/*, ADRs, acceptance tests
	•	hooking PreToolUse / PostToolUse
	•	controlling roles (Implementer / Reviewer / Security)

Examples:

“This is not ‘more prompting.’ It is a workflow enforcement layer: a thin operational protocol that sits above tools and below project goals.”  ￼

and:

“Add a ‘Compound Loop’ section to /agent/POLICY.md”  ￼

and:

“Hook placements … PreToolUse … PostToolUse … UserPromptSubmit …”  ￼

Those concerns map directly to:

• agent lifecycle
• orchestration
• prompt injection
• role separation
• learning compaction
• law-layer updates
• spec deltas
• ADR generation
• acceptance harnesses
• iterative execution control

⸻

What Rails is responsible for (and what it is not)

Rails is now clearly scoped to:
	•	DAG + WIH
	•	Ledger
	•	Gate enforcement
	•	Vault
	•	Leases
	•	Bus transport
	•	Runner automation
	•	Deterministic pipeline execution

Rails:

✔ executes
✔ enforces
✔ records
✔ pipelines
✔ archives
✔ coordinates

Rails is not:

✘ responsible for planning methodology
✘ agent role choreography
✘ prompt packs
✘ spec mutation policy
✘ ADR generation
✘ learning compaction
✘ orchestration heuristics
✘ swarm spawning
✘ context refresh strategy
✘ summarization strategy
✘ memory injection rules

Those are Agent Runner / Agents Folder territory.

⸻

Where this file belongs

This file should be moved into:

Agent Runner design session / Agents system track

It becomes part of:

• Agent Runner spec
• Orchestrator architecture
• /agents/ folder blueprint
• /agent/POLICY.md rules
• prompt-pack architecture
• compaction logic
• Ralph-loop orchestration layer
• subagent spawning policy
• review enforcement
• compound-learning engine

⸻

Clean separation going forward

You were exactly right to pause.

What is emerging is:

System 1 — Rails

Deterministic execution substrate:
	•	ledger
	•	gates
	•	vault
	•	runner
	•	bus
	•	DAG/WIH
	•	leases
	•	turn closeout
	•	autopipeline

System 2 — Agent Runner / Agents Framework

Cognitive + orchestration system:
	•	prompt packs
	•	AGENTS.md lifecycle
	•	swarm logic
	•	Ralph loops
	•	fresh-context spawning
	•	summarization / compaction
	•	learning extraction
	•	ADR synthesis
	•	policy mutation
	•	spec deltas
	•	cookbook
	•	enforcement protocols

Rails executes what the Agent Runner decides.

The Agent Runner decides how work is done.

⸻

Final answer

This file goes with the Agent Runner session — not Rails.

It describes orchestration law, enforcement loops, and learning capture systems that sit above Rails and drive it, rather than belonging inside the Rails implementation itself.

⸻

When you spin the next chat for the Agent Runner track, this file should be one of the seed documents.

In this Rails thread, you should now stay focused on:

• runner stability
• ledger semantics
• gate invariants
• vault determinism
• bus transports
• closeout enforcement
• replay safety
• crash recovery

Everything cognitive/orchestrational goes to the Agent Runner system.