---
title: "A2rchitech Session Summary — BrowserSkill + Artifacts + Extensions"
date: "2026-01-26_221919"
scope: "a2rchitech"
topic: "browser-skill / artifact-first / controlled extensions"
status: "canonical-session-summary"
---

# Canonical Focus
This session narrows A2rchitech’s near-term build focus to a **complete modern agent stack** with strict separation of concerns:

1. **Execution** — local + background + parallel (including browser execution)
2. **Coordination** — sessions, task graphs, verification gates
3. **Presentation** — canvas + GenTabs + artifact viewer (never panes, empty-by-default)

The emphasis is on making **browser control + artifact viewing + controlled skills/connectors** first-class, with additive integration only.

---

# 1) BrowserSkill (Seamless Chrome Control) — Contract
**BrowserSkill** is the canonical skill interface for web control, designed to run in both foreground and background contexts.

## Minimal API (v1)
- `open(url)`
- `click(selector)`
- `type(selector, text)`
- `screenshot()`

## Reliability additions (required for real web variance)
- `waitFor(selector | timeoutMs)`
- `extract(selector | script)` → DOM snapshot or extracted text
- `url()` → current URL
- optional: `html()` and later `networkLog()`

## Standard tool result
Every BrowserSkill call returns a structured `BrowserResult`:
- `ok` boolean
- `step_id`
- `url`
- `screenshot_artifact_id?`
- `dom_artifact_id?`
- `extracted?`
- `error?` (structured)

---

# 2) Execution Contexts
BrowserSkill must be executable with the **same contract** across:

## Foreground (interactive)
- User-visible, low-latency
- Streams incremental artifacts

## Background (headless)
- Used for parallel runs and unattended workflows
- Determinism + sandbox + verification prioritized
- Produces coherent artifact bundles per run

**Invariant:** the **executor changes**, not the tool contract.

---

# 3) Artifact System (First-Class, Immutable)
Artifacts are the stable boundary between execution and presentation.

## Artifact (v1)
- `id`
- `type`: `diff | preview | doc | image | log | table | dom | trace | verification`
- `source_agent`
- `session_id`
- `created_at`
- `payload_ref` (file/blob/url pointer)
- optional: `summary`, `metadata`

## Production rules
- Browser actions generate artifacts when meaningful:
  - screenshot → `image`
  - DOM snapshot / html → `dom`
  - preview URL → `preview`
- Artifacts are **immutable**; new state produces a new artifact.

---

# 4) Event Topics (Execution → Presentation Binding)
Canvas/GenTabs never render raw tool output; they render by artifact IDs.

## Browser topics
- `render.browser.preview` → `{ artifact_id }`
- `render.browser.screenshot` → `{ artifact_id }`
- `render.browser.dom` → `{ artifact_id }`
- `status.browser` → `{ state, reason? }`

## Artifact viewer topics
- `render.artifact.open` → `{ artifact_id }`
- `render.artifact.list` → `{ session_id, filter?, sort? }`

**Invariant:** If the canvas monitor is absent, events are ignored and execution must not fail.

---

# 5) Extensions & Connectors Marketplace (Controlled)
A2rchitech treats tools/skills as **extensions** with explicit constraints.

## Extension (v1)
- `name`, `version`
- `capabilities[]`
- `execution_scope`: `local | background | browser | any`
- `safety_level`: `read_only | write | destructive`
- `allowed_in_background` (bool)
- `requires_browser` (bool)
- `requires_network` (bool)
- optional: `rate_limits`, `auth_requirements`

## Enforcement at dispatch time
- `requires_browser=true` → route to BrowserExecutor
- `allowed_in_background=false` → deny background execution
- `requires_network=true` → enforce sandbox network policy
- `destructive` → requires explicit security/consent gate

Purpose: enable safe background runs, prevent skill misuse, and support marketplaces later.

---

# 6) Minimal Implementation Units
To deliver this slice, the minimum required units are:

- **BrowserExecutor**: implements BrowserSkill contract and produces artifacts
- **ArtifactStore**: append-only storage + retrieval by `artifact_id` + session indexing
- **Event Publisher**: emits `CanvasEvent` topics referencing artifact IDs only

Everything else (CLI, canvas monitor, background orchestrator) consumes these contracts.

---

# 7) Acceptance Tests (Proof of Real Integration)
- BrowserSkill open → waitFor → screenshot produces an `image` artifact and returns `BrowserResult.ok=true`
- DOM snapshot produces a `dom` artifact and can be opened by `artifact_id`
- Artifact immutability enforced (no overwrite semantics)
- Extension enforcement:
  - denies background runs when `allowed_in_background=false`
  - denies browser tools when browser executor absent
  - enforces `requires_network` policies

---

# Note (explicit)
A coder-agent “prompt to look for something” was discussed as useful operational tooling, but it is **not the primary objective** of this session; the primary objective is the **BrowserSkill + Artifact + Extension control plane** integration described above.
