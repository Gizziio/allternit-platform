# ONTOLOGY_LAW.md
**Canonical Names, Layers, and Authority Boundaries for Allternit**
_Tier-0 — Non-negotiable_

---

## 0. Purpose

Define canonical names for layers, processes, and responsibilities.

Prevent ambiguous terms ("brain", "kernel", "agent") from causing architectural drift.

If this document is violated, the system loses coherence.

---

## 1. Canonical Entities

### 1.1 IO (Execution Authority)

> **IO is the only component permitted to cause side effects.**

| Attribute | Value |
|-----------|-------|
| **Owns** | Time, state persistence, skill execution, journaling, artifacts, policy enforcement |
| **Runs as** | Long-lived daemon (CLI-first); local/VM/container/browser sandbox |
| **Must** | Record every action in journal with inputs, outputs, and artifact refs |
| **Must not** | Be called "Gizzi" or conflated with persona |

**Concrete identity:**
- Binary: `/opt/allternit/bin/io` (or `gizziio`)
- State: `/var/gizzi/` (journal, capsules, evidence, artifacts)
- Transport: stdio NDJSON-RPC

**IO = the only thing allowed to touch reality.**

---

### 1.2 Kernel (Deterministic Logic Core)

> **Kernel is pure, deterministic decision logic.**

| Attribute | Value |
|-----------|-------|
| **Owns** | State transitions, intent routing, compilation, invariant checks |
| **Must not** | Perform IO, execute tools, write files, call network directly |
| **Must** | Be replayable given the same inputs |

**Examples of Kernel operations:**
- `Intent → CapsuleSpec` compilation
- Policy evaluation (allow/deny/escalate)
- State machine transitions
- Deterministic planning

**Kernel has no side effects. Ever.**

---

### 1.3 Models (Probabilistic Proposers)

> **Models (LLMs/VLMs) produce proposals, never execute.**

| Attribute | Value |
|-----------|-------|
| **Owns** | Perception, synthesis, heuristic planning suggestions |
| **Must not** | Execute side effects directly |
| **Outputs** | Proposals with confidence + rationale; never "do it now" authority |

**Examples:**
- UI-TARS: `screenshot → ActionProposal[]`
- LLM planner: `goal + context → Plan`
- Summarizer: `evidence → Summary`

**Models are advisory. IO decides whether to act.**

---

### 1.4 Shell (Presentation Surface)

> **Shell renders IO state and collects user input.**

| Attribute | Value |
|-----------|-------|
| **Owns** | UX, capsule canvas, tabs, controls, orb container |
| **Must not** | Be source of truth |
| **Must** | Be restartable without loss of state |

**Shell is a mirror, not a controller.**

If Shell crashes:
- IO continues
- State is preserved
- Shell reconnects and rehydrates from IO

---

### 1.5 Gizzi (Persona / Presence)

> **Gizzi is the user-facing identity across surfaces.**

| Attribute | Value |
|-----------|-------|
| **Implemented as** | Presence layer subscribing to IO journal/events |
| **Owns** | Narration, avatar/orb state, approvals UX, voice |
| **Must not** | Be conflated with IO or Kernel |
| **Has** | No direct execution power |

**Gizzi is what the user sees.**
**IO is what actually runs.**

```
IO emits → journal events
Gizzi subscribes → renders presence
User sees → orb/avatar/voice
```

---

## 2. Non-Negotiable Laws

### Law 1: Authority Law
> **Only IO can execute side effects.**

No Shell, no Model, no Kernel bypass. Every effect flows through IO.

### Law 2: Determinism Law
> **Kernel must remain deterministic and replayable.**

Given the same inputs, Kernel produces the same outputs. Always.

### Law 3: Proposal Law
> **Models only propose; IO decides and executes.**

UI-TARS says "click here with 87% confidence."
IO decides whether to execute.

### Law 4: Truth Law
> **IO journal + persisted state are the source of truth.**

Not the UI. Not the model's memory. Not cached state.

### Law 5: Surface Law
> **Shell is a renderer; it may be replaced without affecting IO state.**

Shell can crash, restart, be rewritten. IO continues.

### Law 6: Persona Law
> **Gizzi is presence; never a privileged executor.**

Gizzi narrates, explains, asks. Gizzi never runs `rm -rf`.

---

## 3. Naming Restrictions

| Do NOT | Because |
|--------|---------|
| Call IO "Gizzi" | Conflates authority with persona |
| Call Shell "Kernel" | Conflates rendering with logic |
| Call Models "Runner" or "IO" | Conflates proposals with execution |
| Use "brain" ambiguously | Could mean Kernel, Model, or IO |
| Use "agent" for a single process | Agent = composite behavior across layers |

**Correct usage:**
- "The IO executed the action"
- "The Kernel compiled the intent"
- "UI-TARS proposed a click"
- "Gizzi is narrating the progress"
- "The Shell is rendering capsules"

---

## 4. Contract Namespaces

| Namespace | Owner | Purpose |
|-----------|-------|---------|
| `io.*` | IO | Execution requests, streams, events |
| `skill.*` | IO | Callable capabilities executed by IO |
| `kernel.*` | Kernel | Deterministic transforms/decisions |
| `model.*` | Models | Proposal generation only |
| `presence.*` | Gizzi | Orb/voice/avatar behavior |
| `shell.*` | Shell | UI state and user input |

---

## 5. Authority Flow (Visual)

```
User / World
     │
     ▼
┌──────────────┐
│   Shell      │  ← interaction (intents, clicks, voice)
│  (Capsules)  │
└──────┬───────┘
       │ intents / user input
       ▼
┌──────────────┐
│   Kernel     │  ← logic / planning (deterministic)
└──────┬───────┘
       │ commands
       ▼
┌──────────────┐
│   IO         │  ← execution authority (THE boundary)
│  (gizziio)   │
│  - Skills    │
│  - Journal   │
│  - Time      │
└──────┬───────┘
       │ journal events / state stream
       ▼
┌──────────────┐
│   Gizzi      │  ← persona / presence (subscribes, renders)
│  (orb/voice) │
└──────────────┘
```

---

## 6. Where UI-TARS Lives

UI-TARS is a **Model** (probabilistic proposer).

It is invoked as a **Skill** by IO.

```
IO calls → skill.invoke("model.ui_tars.propose", { screenshot, task })
UI-TARS returns → { proposals: ActionProposal[], confidence, reasoning }
IO evaluates → Kernel policy check
IO executes → gui.execute(action) if approved
IO journals → before/after screenshots, action, result
Gizzi narrates → "I clicked the login button"
```

UI-TARS never executes. IO always executes.

---

## 7. Upgrade and Migration

When changing these definitions:
1. Update this document first
2. Migrate code to match
3. Rename binaries/configs if needed
4. Never break the Laws

**Identity continuity > naming preferences.**

---

## 8. Status

This document is **Tier-0 ontology law**.

All other specs must conform to these definitions.

If a spec contradicts this document, this document wins.
