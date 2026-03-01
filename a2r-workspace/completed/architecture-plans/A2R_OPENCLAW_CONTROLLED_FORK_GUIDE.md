# A2R × OpenClaw Controlled Fork Integration Guide (Agent-Ready)
date: 2026-01-31
timezone: America/Chicago

## Objective
Integrate the OpenClaw codebase into the A2rchitech platform OS while:
1) Shipping a functioning product quickly (rebrand + UI consolidation).
2) Preserving A2rchitech kernel authority (WIH/Beads/Law Layer/Receipts/Inspector).
3) Keeping upstream updateability with low-merge pain (controlled fork + upstream mirror + isolated diffs).

This guide tells you exactly what to do and where to put changes.

---

## Non‑Negotiables (Hard Rules)
### R1 — Keep upstream compatibility
- Maintain `upstream` remote pointing to the original OpenClaw repo.
- Maintain an `upstream-main` branch that mirrors upstream and is never edited directly.
- Merge upstream into our product branch in controlled, repeatable steps.

### R2 — Isolate our diffs
Prefer adding new modules over editing upstream code.
Allowed “safe divergence zones” (additive changes):
- `packages/` (new `a2r-*` packages)
- `apps/` (new `a2r-*` apps)
- `extensions/` (new enforcement/bridge extensions)
- `skills/` (new gated deterministic skills)
- `patches/` (minimal patch queue only when unavoidable)

Avoid touching unless necessary (high-conflict zones):
- `src/`
- `ui/` (only touch when rebranding or for required integration seams)

### R3 — A2rchitech kernel remains the engine
OpenClaw is a runtime substrate (sessions/tools/sandbox).
A2rchitech is the governing kernel (WIH/Beads/Law Layer/Receipts/Inspector/UI Shell).

---

## Deliverables (What you must produce)
### D1 — Repo integration artifacts
- `docs/integration/A2R_OPENCLAW_INTEGRATION_PLAN.md`
- `docs/integration/FORK_SYNC_POLICY.md`
- `docs/integration/VENDOR_MAP.md` (entrypoints + seams)
- `docs/integration/UI_CONSOLIDATION_MAP.md` (screen IA + mapping)

### D2 — Code scaffolding (additive)
- `packages/a2r-kernel/`  
  Implements: WIH parsing, Beads loading, Law Layer policy engine, receipt schema.
- `packages/a2r-runtime-openclaw/`  
  Adapter: A2R WorkItem → OpenClaw sessions/tasks, status, receipts, artifacts.
- `apps/a2r-shell/`  
  UI: Work Items, Agent Roster, Inspector, Scheduler.
- `extensions/a2r-lawlayer/`  
  Hook points: pre-tool checks, write-gate enforcement, path routing, receipts emission.
- `skills/a2r/*`  
  Deterministic skills that enforce canonical file creation and safe tool usage.

### D3 — Upstream update workflow implemented
- remotes + branches + merge process documented and runnable.

---

## Work Plan (Execution Order)
### Phase 0 — Baseline fork + upstream mirror
1) Fork OpenClaw into your org.
2) Add remotes:
   - `origin` → your fork
   - `upstream` → original repo
3) Create branches:
   - `upstream-main` tracking `upstream/main`
   - `a2r-main` as your product branch starting from `upstream/main`
4) Enable conflict learning:
   - `git config rerere.enabled true`

Acceptance: `upstream-main` equals `upstream/main` byte-for-byte.

### Phase 1 — Vendor map + seam discovery
Goal: identify where to hook law-layer and routing without invasive edits.

1) Produce `docs/integration/VENDOR_MAP.md` with:
   - entrypoints (CLI / gateway / server)
   - session APIs
   - tool invocation path
   - file IO utilities
   - extension/skills loading path
   - UI entrypoints
2) Identify “seams” (preferred hook points):
   - tool execution wrapper
   - skill registry / dispatcher
   - filesystem write functions
   - request routing / session spawn layer

Acceptance: A newcomer can locate all critical seams in <10 minutes.

### Phase 2 — Establish A2R kernel contracts
1) Define minimal contracts:
   - WorkItem Header (WIH) schema
   - Receipt schema (tool calls, outputs, file writes)
   - Artifact routing table (type → canonical path)
2) Add `packages/a2r-kernel/` with:
   - WIH parser
   - policy checks
   - receipt writer
   - routing function `route_artifact(wih, artifact_meta) -> path`

Acceptance: A2R kernel can compute canonical paths and deny noncompliant writes.

### Phase 3 — OpenClaw runtime adapter
1) Add `packages/a2r-runtime-openclaw/` that exposes a stable interface:
   - spawn agent/session
   - execute WorkItem
   - stream receipts
   - collect artifacts
   - raise NEEDS_HUMAN for auth
2) Ensure adapter never writes directly; it asks `a2r-kernel` for routes.

Acceptance: One WorkItem can be executed end-to-end and produces receipts + routed outputs.

### Phase 4 — Deterministic file governance (no sprawl)
1) Implement a “write gate” at the seam:
   - every write checks allowed roots
   - all outputs must be routed through `a2r-kernel`
2) Add quarantine:
   - anything uncertain goes to `work/inbox/` with `ROUTE_ME.json`
3) Add organizer agent (cron):
   - scans inbox
   - proposes moves (plan)
   - executes moves above confidence threshold
   - logs every move

Acceptance: No file ends up outside workspace root when tools run.

### Phase 5 — UI consolidation (rebrand + upgrade)
1) Create `docs/integration/UI_CONSOLIDATION_MAP.md` with:
   - OpenClaw screens/features → A2R Shell screens
2) Implement `apps/a2r-shell/`:
   - Work Items view
   - Agent Roster view
   - Inspector view (receipts, diffs, memory candidates)
   - Scheduler view

Acceptance: A2R Shell can operate core workflows without using OpenClaw UI.

### Phase 6 — Upstream update pipeline
1) Document in `FORK_SYNC_POLICY.md`:
   - how to refresh `upstream-main`
   - how to merge into `a2r-main`
   - how to resolve conflicts (rerere)
2) Add CI gates:
   - vendor build + tests
   - a2r-kernel tests
   - adapter contract tests
   - smoke test: run one WorkItem and verify receipts + routed artifacts

Acceptance: Upstream merge fails fast if breaking changes occur.

---

## Command snippets (reference)
### Initial remotes
- `git remote add upstream https://github.com/openclaw/openclaw.git`
- `git fetch --all --prune`

### Mirror upstream into upstream-main
- `git checkout upstream-main`
- `git fetch upstream`
- `git reset --hard upstream/main`
- `git push --force-with-lease origin upstream-main`

### Merge upstream into product
- `git checkout a2r-main`
- `git merge --no-ff upstream-main`
- resolve conflicts (should be small if diffs isolated)
- `git push`

---

## Definition of Done (integration)
You are done when:
- A2R Shell runs core workflows.
- WorkItems execute through the OpenClaw runtime adapter.
- All outputs are routed deterministically and receipts are produced.
- Upstream merges are repeatable and low-conflict.
