Saved. This framework is now committed to long-term memory as your default project architecture and agentic workflow law.
When you say things like “use my agentic spec framework”, “apply the SOT system”, or “build this the standard way”, I will automatically operate inside this model without re-explanation.

Below is a single, complete, copy-pasteable Markdown file you can drop into any repo or share with Claude, Codex, or other coder LLMs.

⸻

META-ORCHESTRATED SPEC-DRIVEN AGENTIC FRAMEWORK

Version: v1.0 (Living Framework)
Status: Open, append-only, upgradeable
Authoring Intent: Durable project truth without reliance on session memory

⸻

0. Purpose

This framework defines a spec-driven, agentic software architecture designed for:
    •    Multi-LLM orchestration
    •    Persistent learning across sessions
    •    Minimal re-instruction
    •    Clear separation between project truth and workflow law
    •    Safe, auditable evolution over time

The system eliminates reliance on volatile session state by converting all learning into durable, machine-readable artifacts inside the repository.

⸻

1. Core Design Principles

1.1 Baseline + Deltas (Non-Negotiable)
    •    Baseline = enduring intent, invariants, definitions
    •    Deltas = append-only changes (decisions, pivots, upgrades)

Baseline is frozen by default.
All change happens via deltas.

1.2 Absolute Source of Truth (SOT)

All agents must read from a single canonical pointer that never moves.

1.3 Session Memory Is Not Trusted

Only files in-repo are trusted memory.
Anything worth remembering must become:
    •    a policy update, or
    •    a project delta

⸻

2. Canonical Source of Truth (/SOT.md)

Every project MUST contain this file at root.

# SOURCE OF TRUTH (SOT)

## Load Order (Mandatory)

### Baseline (rarely changes)
- /spec/Baseline/Vision.md
- /spec/Baseline/Requirements.md
- /spec/Baseline/Architecture.md
- /spec/Baseline/Invariants.md
- /spec/Baseline/Glossary.md

### Deltas (append-only, applied in order)
- /spec/Deltas/CHANGELOG.md
- /spec/Deltas/ADRs/*
- /spec/Deltas/RFCs/*
- /spec/Deltas/Pivots/*

### Acceptance & Verification
- /spec/Acceptance/AcceptanceTests.md
- /spec/Acceptance/ContractTests.md

Rule:
Every agent output MUST explicitly confirm it loaded /SOT.md.

⸻

3. Minimal Orchestration Loop (Always the Same)

Research → Build Context → Plan → Act → Report

Stage Definitions
    •    Research: gather facts, constraints, unknowns (read-only)
    •    Build Context: synthesize a minimal context pack
    •    Plan: explicit steps with absolute path references
    •    Act: narrow execution only within allowed scope
    •    Report: summarize results + write deltas (not baseline)

⸻

4. Role-Based Agent Architecture

Roles

Role    Responsibilities    Allowed Writes
Orchestrator (Router)    Task routing, enforcement, aggregation    none
Researcher    Information gathering    none
Architect    Structural decisions    /spec/Deltas/*
Planner    Execution plans    /agent/plans/*
Implementer    Code changes    /src/**
Tester    Validation    /tests/**
Reviewer    Blocking / approval    none
Security/Governance    Risk gating    policy approvals
Meta Agent    Process learning    /agent/*, /spec/Deltas/*

No agent may exceed its lane.

⸻

5. /agent Directory (Workflow Law)

The /agent directory defines how work happens, not project content.

Required Files

/agent/POLICY.md
    •    DO / DO NOT rules
    •    Safety gates
    •    Dependency rules
    •    Escalation triggers
    •    “Always do this” instructions

/agent/ROUTER_RULES.md
Defines:
    •    Task classification
    •    Role assignment
    •    Model selection
    •    Tool access
    •    Escalation conditions

/agent/OUTPUT_CONTRACT.md
Every agent output MUST include:
    1.    Loaded SOT confirmation (paths)
    2.    Scope (files touched)
    3.    Constraints cited (baseline + delta IDs)
    4.    Plan or result (role-dependent)
    5.    Delta updates required (if any)

/agent/CONTEXT_PACK_RULES.md
Rules for building minimal, non-bloated context packs.

⸻

6. Meta Agent (Persistent Learning Engine)

Purpose

Convert experience → durable memory.

No reminders. No repetition.
Only written policy and deltas.

Trigger Conditions
    •    Repeated user correction
    •    Spec drift
    •    Tool misuse
    •    Test failure surprises
    •    Missing acceptance criteria
    •    Agent exceeded role
    •    Friction or inefficiency

⸻

7. Meta Agent Prompt (/agent/META_PROMPT.md)

Inputs (Required)
    •    /SOT.md
    •    Latest Report
    •    Git diff summary
    •    CI/test results
    •    Tool call logs (if available)
    •    Explicit user corrections

Output Contract
    1.    Observed failures or friction
    2.    Root cause classification:
    •    Spec gap
    •    Policy gap
    •    Router gap
    •    Tooling gap
    •    Role violation
    3.    Durable fix (choose one):
    •    Policy patch (/agent/*)
    •    Delta patch (/spec/Deltas/*)
    •    New acceptance test
    4.    Patch list (files + exact edits)
    5.    Verification method

Hard Rules
    •    Meta Agent MAY NOT modify /spec/Baseline/*
    •    Structural changes require ADR or PIVOT
    •    All fixes must be durable

⸻

8. Change Types (Deltas)

CHANGELOG

Append-only summary of what changed and why.

ADR (Architecture Decision Record)

Used for:
    •    Design decisions
    •    Tradeoffs
    •    Tool choices

RFC

Used for:
    •    Proposed features
    •    Planned refactors
    •    Experimental ideas

PIVOT

Used when:
    •    A baseline assumption is superseded
    •    Strategy materially changes

PIVOTs explicitly name which baseline sections they override.

⸻

9. Boot Sequence (Mandatory)

Every orchestration run MUST:
    1.    Load /SOT.md
    2.    Load /agent/POLICY.md
    3.    Load /agent/OUTPUT_CONTRACT.md
    4.    Load latest /spec/Deltas/CHANGELOG.md
    5.    Print a “Loaded Receipt” (paths + timestamps or hashes)

If not satisfied → execution halts.

⸻

10. How This Framework Evolves

This framework is intentionally living.

Workflow evolution
    •    Goes into /agent/PROCESS_CHANGELOG.md
    •    Append-only
    •    Describes how we work better

Project evolution
    •    Goes into /spec/Deltas/*

Baseline evolution
    •    Rare
    •    Only via explicit PIVOT

⸻

11. Referencing This Framework Elsewhere

Use any of the following phrases in other chats or tools:
    •    “Use my Meta-Orchestrated SOT Framework”
    •    “Apply the Baseline + Delta agentic architecture”
    •    “Follow my Research → Plan → Act loop with Meta Agent”
    •    “Standard SOT / Meta Agent rules apply”

I will automatically enforce this structure.

⸻

12. Final Guarantee

If it is not written:
    •    it is not remembered
    •    it is not enforced
    •    it will be repeated

This framework eliminates that failure mode.

⸻
# META-ORCHESTRATED SPEC-DRIVEN AGENTIC FRAMEWORK  
## Additive Extension — Intent, Planning, and Execution Law  
**Status:** Append-only  
**Compatibility:** Fully compatible with existing SOT / Baseline + Deltas framework  
**Methodology:** Internalized (no external naming or branding)

---

## 13. Intent Decomposition Layer (Pre-Spec System)

### Purpose

This layer converts ambiguous ideas, research, and goals into structured intent **before** architectural deltas or execution begin.

This prevents:
- Premature coding
- Scope hallucination
- Misaligned execution
- Context loss across sessions or models

### Rules

- No architectural delta may be written without intent decomposition.
- No execution task may be created without explicit intent linkage.
- Intent artifacts are read-heavy, write-light, and evolve via synthesis — not overwrites.

---

## 14. Intent Artifacts (Required Structure)

All projects MUST include the following directory: /intent/
### Required Files

#### `/intent/00_Context.md`
Canonical project context.

Must contain:
- Problem statement (non-solutioned)
- Domain definitions
- Known constraints
- Explicit non-goals
- Environmental assumptions

If this file is missing or incomplete, agents MUST halt or request clarification.

---

#### `/intent/10_Exploration.md`
Structured exploration of options.

Must contain:
- Alternatives considered
- Tradeoffs (pros / cons)
- Rejected approaches (with rationale)
- Open questions and uncertainties

Exploration may be messy but must be explicit.

---

#### `/intent/20_Objectives.md`
Authoritative intent lock.

Must contain:
- Primary objectives
- Success metrics
- Scope boundaries
- UX / API expectations (if applicable)

Once stabilized, this file becomes the anchor for all planning and execution.

---

## 15. Planning Artifacts (Execution Translation Layer)

All projects MUST include: /plan/

### Required Files

#### `/plan/30_Roadmap.md`
Milestones and sequencing.

Must contain:
- Ordered phases
- Dependencies
- Risk points
- Exit criteria per phase

---

#### `/plan/40_Backlog.md`
Executable work units.

Must contain:
- Epics
- Stories
- Explicit linkage to `/intent/*` sections
- Priority and readiness state

Nothing may enter execution unless it appears here.

---

## 16. Execution Contract Units (Task-Level Law)

All executable work MUST be defined as a single-scope execution contract.

### Directory
/tasks/

### Task Contract Requirements

Each task file MUST include:

1. **Intent Reference**
   - Exact paths to relevant `/intent/*` files
   - Exact paths to relevant `/plan/*` files

2. **Change Scope**
   - Files and directories explicitly allowed
   - Files and directories explicitly forbidden

3. **Behavioral Contract**
   - Inputs
   - Outputs
   - Edge cases

4. **Acceptance Conditions**
   - Objective, verifiable success criteria

5. **Rollback Expectations**
   - Definition of failure
   - Damage containment strategy

No task file → no execution.  
No exceptions.

---

## 17. Context Assembly Rules (Anti-Bloat Enforcement)

Agents may NOT load the entire repository by default.

### Context Pack Construction Rules

Each agent MUST:

1. Load `/SOT.md`
2. Load only:
   - Relevant `/intent/*` files
   - Relevant `/plan/*` files
   - The specific `/tasks/*` file being executed
3. Cite every loaded file by absolute path

This enforces:
- Token efficiency
- Determinism
- Cross-LLM consistency

---

## 18. Execution Gating Rules (Hard Stops)

The Orchestrator MUST halt execution if any of the following are true:

- `/intent/20_Objectives.md` is missing
- Task does not reference intent and plan artifacts
- Task scope exceeds declared file boundaries
- Acceptance conditions are missing or vague
- Required deltas are not declared post-execution

---

## 19. Verification & Learning Integration

### Verification Outputs

Verification MUST update one or more of:

- `/spec/Acceptance/*`
- `/spec/Deltas/CHANGELOG.md`
- `/agent/PROCESS_CHANGELOG.md`

### Learning Rule

If human correction was required:
- It is not a mistake
- It is a missing artifact or rule

The Meta Agent MUST convert the correction into:
- A stricter execution contract
- A clearer intent artifact
- A stronger routing or policy rule

---

## 20. New Project Initialization Protocol (Mandatory)

When starting any new project, the Orchestrator MUST:

1. Create all `/intent/*` files with draft content
2. Create `/plan/*` skeletons
3. Generate initial `/tasks/*` contracts for Phase 1 only
4. Populate `/SOT.md` pointers
5. Lock execution until intent and plan are acknowledged

This guarantees every project begins with maximal structure.

---

## 21. Naming Philosophy (Explicit)

This framework intentionally:
- Uses functional naming
- Avoids branded methodologies
- Encodes process truth, not tool allegiance
- Allows participation by any agent, model, or human without retraining

The method is the law.  
Names are irrelevant.

---

## 22. Final Reinforcement Rules

- If intent is unclear → decompose  
- If scope is unclear → contract  
- If execution drifts → gate  
- If learning repeats → write law  

---

## Final Guarantee

If intent is not written:
- it is not understood  
- it is not enforced  
- it will be repeated  

This extension completes the Meta-Orchestrated Spec-Driven Agentic Framework.
