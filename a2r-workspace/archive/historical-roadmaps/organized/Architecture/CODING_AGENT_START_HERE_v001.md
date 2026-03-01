# CODING_AGENT_START_HERE (v001)
**Date:** 2026-01-09

## What you are looking at
You have been given a **design-direction corpus** called the **Architecture folder** (delivered as `Architecture.zip`).  
This corpus is **separate from the code repo**. It is *not* a subfolder of the repo and should not be treated as such.

**Non-negotiable:** You must read the entire Architecture corpus before implementing the project direction.

---

## 1) Inputs you must use (in order)

### A) Integration Tasklist (read-first)
Use:
- `ARCHITECTURE_FOLDER_INTEGRATION_TASKLIST_v001.md`

This file contains:
- full-corpus reading checklist (one checkbox per file)
- integration workflow (P0 → P4)
- rules for avoiding missing context

### B) Executable Backlog (do-second)
Use:
- `BACKLOG_v001.md`

This file contains:
- the engineering task list with Definition-of-Done (DoD)
- explicit **Sources** (file paths in Architecture corpus) per task

---

## 2) Enforcement (how we prevent gaps)
A PR is invalid unless it includes:

1) **Read Log**
   - Confirm you read every Architecture file (or provide a justified exception list—rare)
   - Include the list of files read in the PR description

2) **Sources line**
   - Every PR description must include:  
     `Sources: <Architecture/path1.md>, <Architecture/path2.md>, ...`

3) **Backlog mapping**
   - Reference which backlog task IDs you are closing (e.g., `Closes: P0-A, P0-B`)

4) **Acceptance coverage note**
   - State how acceptance tests are satisfied (or why not applicable)

---

## 3) What to build first (P0 only)
Do not implement P1/P2/P3/P4 until P0 runs end-to-end in a demo.

### P0 = Entry point experience
**Capsule Shell + Tab/Canvas metaphor + agent-generated frameworks (templates)**

Implement in 4 slices (vertical, demo-driven):

#### P0-A — Capsule instances + tab canvas metaphor (shell)
**DoD**
- Capsule store supports open/close/activate.
- Tab bar reflects capsule instances; active capsule controls active canvas.
- Canvas mount renders CanvasSpec; switching tabs switches canvas.
- Persistence flags exist in UI state: ephemeral/docked/pinned (UI-only for v0).

#### P0-B — Canvas protocol + minimum view taxonomy (renderer)
**DoD**
- Canonical CanvasSpec + ViewSpec types used by renderer.
- Minimum views: timeline_view, list_view, object_view, search_lens (simple cards acceptable).
- View registry exists so new view types can be added without rewriting shell.

#### P0-C — FrameworkSpec + capsule spawn as agent-generated templates
**DoD**
- FrameworkSpec schema exists (allowed intents, default canvases, tool scope, persistence).
- Shell can spawn a capsule from a framework (template → instance).
- Naive routing (intent prefix) is acceptable in v0.
- Every spawn appends journal events (local v0 ok).

#### P0-D — Kernel contracts: intent dispatch returns events + artifacts + canvas
**DoD**
- Contracts exist for:
  - `GET /v1/workspaces/{ws}/frameworks`
  - `POST /v1/intent/dispatch`
  - `GET /v1/journal/stream`
- Dispatch response includes:
  - capsule instance
  - events[] (append-only)
  - artifacts[] (ObserveCapsule + DistillateCapsule schemas exist)
  - canvas spec
- Shell adapts to contract (backend can be mocked/stubbed).

---

## 4) Required end-to-end demo output for P0 completion
You must produce a runnable demo where:

- Typing `search cats`:
  - opens/activates a Search capsule tab
  - renders a Search canvas
  - journal shows: intent → tool_call → tool_result → canvas_update
  - tool result produces an ObserveCapsule artifact (mock ok)

- Typing `note hello`:
  - opens Notes capsule
  - renders Notes canvas with note content (from journal/artifact)

---

## 5) Implementation constraints (do not violate)
- Do NOT refactor the whole repo.
- Do NOT introduce a new “spec system” beyond what’s in the Architecture corpus.
- Do NOT add large dependencies.
- Do NOT implement deep backend systems in P0; contracts + stubs are acceptable.

---

## 6) Where the Architecture corpus is used
Use the Architecture folder to:
- define primitives (capsule, framework, journal, artifact, canvas, view)
- define contracts (dispatch, registry, journal)
- define acceptance expectations

The code repo should implement those primitives/contracts in P0 without redesign.

---

## 7) Handoff checklist (copy into PR description)
- [ ] Read all Architecture corpus docs (see tasklist)
- [ ] `Sources:` line included
- [ ] Backlog IDs referenced (P0-A..P0-D)
- [ ] Demo steps provided (search + note)
- [ ] Acceptance coverage noted

