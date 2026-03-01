⸻

PROJECT_LAW.md

Canonical Project Law for Monorepo & Agentic Systems

Status: TIER-0 AUTHORITY
Scope: All projects, agents, specs, tools, CI, and contributors
Precedence: Overrides all other documents unless explicitly stated
Change Control: Append-only via ADR; breaking changes allowed but must be explicit

⸻

PREAMBLE — WHAT THIS DOCUMENT IS

This document defines the constitutional law of the project.

It governs:
    •    How work is allowed to happen
    •    How agents behave
    •    How projects are structured
    •    How systems evolve over time

If any output, code, plan, or agent action conflicts with this document,
this document wins.

This file supersedes the following source frameworks, which are now considered canonicalized into this law:
    •    Guardrails (anti-entropy, anti-silent compromise)
    •    Project Organization Law (PRD-first, command-ified work)
    •    Meta-Orchestrated Spec-Driven Agentic Framework

⸻

DEFINITIONS (GLOBAL)
    •    HARD — mandatory; violation invalidates output
    •    SOFT — default expectation; deviation must be justified
    •    OPTIONAL — allowed, not required
    •    Agent — any automated or semi-automated actor
    •    Human — any contributor or operator
    •    Spec — a document that defines intent before execution
    •    SOT — single source of truth for a system
    •    ADR — architecture decision record

⸻

ARTICLE I — GUARDRAILS (LAW-GRD)

LAW-GRD-001 (HARD) — No Silent Assumptions

No agent or human may assume:
    •    requirements
    •    intent
    •    constraints
    •    permissions

All assumptions must be explicitly stated or derived from a spec.

⸻

LAW-GRD-002 (HARD) — No Silent State Mutation

No system may:
    •    mutate state
    •    learn
    •    summarize
    •    optimize
without producing an explicit artifact or record.

⸻

LAW-GRD-003 (HARD) — No Backwards Compatibility by Default

Breaking changes are allowed and encouraged if they improve clarity or correctness.

Backwards compatibility must be explicitly justified, never assumed.

⸻

LAW-GRD-004 (HARD) — Plan ≠ Execute

Planning, reasoning, and execution are separate phases.

No execution may occur inside:
    •    planning
    •    exploration
    •    discussion
    •    UI drafting

⸻

LAW-GRD-005 (HARD) — No “Just Make It Work”

Temporary hacks, placeholders, or “we’ll fix it later” logic are forbidden unless:
    •    explicitly labeled
    •    scoped
    •    tracked
    •    scheduled for removal

⸻

ARTICLE II — PROJECT ORGANIZATION LAW (LAW-ORG)

LAW-ORG-001 (HARD) — PRD-First Development

Every meaningful unit of work must begin with a spec or PRD.

Code without a governing spec is invalid.

⸻

LAW-ORG-002 (HARD) — Command-ify Everything

All work must be reducible to explicit commands:
    •    inputs
    •    outputs
    •    side effects

If it cannot be commanded, it is not ready to be executed.

⸻

LAW-ORG-003 (HARD) — Context Reset Discipline

Context must be:
    •    discoverable
    •    reloadable
    •    reconstructible

No work may rely on implicit conversational memory.

⸻

LAW-ORG-004 (SOFT) — Modular Rules Architecture

Rules, constraints, and logic should be:
    •    modular
    •    composable
    •    independently testable

⸻

LAW-ORG-005 (SOFT) — System Evolution Mindset

Failures are inputs to system evolution, not exceptions.

Fixes must become:
    •    rules
    •    tests
    •    specs
not tribal knowledge.

⸻

ARTICLE III — META-ORCHESTRATED AGENTIC FRAMEWORK (LAW-META)

LAW-META-001 (HARD) — Baseline + Deltas Model

There must exist:
    •    a Baseline (canonical truth)
    •    Deltas (explicit changes)

No mutation of the baseline without a delta.

⸻

LAW-META-002 (HARD) — Single Source of Truth

Every system must declare exactly one SOT.

Duplicated truth is a defect.

⸻

LAW-META-003 (HARD) — Role-Bound Agents

Agents operate in explicit roles (e.g. Researcher, Planner, Implementer, Reviewer).

No agent may:
    •    self-assign roles
    •    cross roles silently

⸻

LAW-META-004 (HARD) — Deterministic Loop

All agent workflows must follow a visible loop:

Research → Context → Plan → Act → Report

Skipping steps requires justification.

⸻

LAW-META-005 (HARD) — Meta-Learning Is Structural

Learning may:
    •    produce new specs
    •    update rules
    •    add tests

Learning may not silently alter runtime behavior.

⸻

ARTICLE IV — ENFORCEMENT & AUTOMATION (LAW-ENF)

LAW-ENF-001 (HARD) — Mandatory Load Order

Agents and tools must load, in order:
    1.    PROJECT_LAW.md
    2.    SOT.md
    3.    Relevant Specs

No execution before load.

⸻

LAW-ENF-002 (HARD) — Auditability

All actions must be:
    •    attributable
    •    reproducible
    •    explainable

If it cannot be audited, it cannot run.

⸻

LAW-ENF-003 (SOFT) — CI & Gatekeeping

Where possible, enforcement should be automated via:
    •    linting
    •    spec checks
    •    acceptance tests

⸻

ARTICLE V — CHANGE CONTROL

LAW-CHG-001 (HARD) — Modifying Project Law

Changes to this document require:
    •    an ADR
    •    explicit rationale
    •    version increment

⸻

LAW-CHG-002 (HARD) — Append-Only Mentality

Rewrites must preserve:
    •    history
    •    intent
    •    traceability

⸻

OPERATIONAL CHEAT SHEET (NON-NORMATIVE)

If you are…
    •    Writing code → read LAW-ORG-001 to 003
    •    Building agents → read LAW-META-001 to 005
    •    Designing workflows → read LAW-GRD-004
    •    Refactoring → read LAW-GRD-003
    •    Automating decisions → read LAW-ENF-001

⸻

FINAL CLAUSE

This document exists to protect clarity, enable speed, and prevent entropy.

If something feels cumbersome:
    •    simplify the system
    •    not the law

⸻

 What this accomplishes
    •    One top-of-repo authority
    •    Zero loss of rigor
    •    Clear enforcement hooks
    •    Builders know exactly what to read first
    •    Agents can be forced to load and obey it
    •    Future MDs integrate cleanly under it

⸻

