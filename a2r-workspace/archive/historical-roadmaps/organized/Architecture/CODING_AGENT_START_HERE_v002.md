# CODING_AGENT_START_HERE (v002)
**Date:** 2026-01-09

## Status update
The **Architecture corpus has changed** since v001.
It now contains **50 Markdown files** and **supersedes all prior v001 instructions**.

Any coding agent must assume:
- v001 tasklists/backlogs are **historical**
- v002 instructions are **authoritative**

---

## What this folder is (critical)
The `Architecture/` folder is a **design-direction corpus**:
- It is **NOT** part of the code repository
- It is **NOT** auto-generated documentation
- It **MUST** be read in full before implementation

The repo implements what is described here.
This folder describes *where the system is going*.

---

## Mandatory rule (non-negotiable)
Before writing code:
1. Read **all 50 Markdown files** in the Architecture folder
2. Maintain a personal read checklist
3. Reference files explicitly in PRs

A PR is invalid without:
- a `Sources:` line listing Architecture file paths
- referenced backlog/task IDs
- acknowledgment of conflicts (if any)

---

## Canonical process files (read first)
These files define *how* to work with the rest:

1. `ARCHITECTURE_FOLDER_INTEGRATION_TASKLIST_v001.md`
2. `UNIFIED/SOT.md`
3. `BACKLOG_v001.md`
4. `ACCEPTANCE/AcceptanceTests.md`

---

## Updated P0 execution target (unchanged in spirit)
You are still building **P0 – Entry Point Experience**:

**Capsule Shell + Tab/Canvas metaphor + Agent‑Generated Mini‑App Frameworks**

What changed:
- More clarity on **intent graphs**
- More explicit **UI runtime layering**
- Expanded **glide + discovery UI** expectations

What did NOT change:
- Vertical slices
- Demo-driven development
- Contracts before infrastructure

---

## P0 slices (authoritative)
### P0‑A — Capsule Runtime + Tabs
Sources:
- `UI/Capsules.md`
- `UI/Unified_UI_Merged_Spec_DCD_Directives_MiniApps.md`
- `UNIFIED/SOT.md`

### P0‑B — Canvas + View Runtime
Sources:
- `UI/CanvasProtocol.md`
- `UI/presentation/RendererCapabilities.md`
- `UI/glide_ui_runtime.md`

### P0‑C — Frameworks as Agent‑Generated Mini‑Apps
Sources:
- `UI/MiniAppRuntime.md`
- `UNIFIED/COMPILER/DirectiveCompiler.md`
- `UNIFIED/AGENTS/AdaptivePatterns.md`
- `UNIFIED/RUNTIME/Intent_graph_kernel_spec.md`

### P0‑D — Kernel Contracts (Dispatch / Journal / Artifacts)
Sources:
- `UNIFIED/RUNTIME/Kernel.md`
- `UNIFIED/RUNTIME/Intent_graph_kernel_spec.md`
- `UI/Journal.md`
- `BACKLOG/Tool Registry.md`

---

## Required demo output (still required)
- `search cats` → capsule, canvas, journal events, ObserveCapsule artifact
- `note hello` → capsule, canvas, persisted journal event

---

## Absolute constraints
- Do NOT refactor entire repo
- Do NOT collapse Architecture files into summaries
- Do NOT invent new abstractions not grounded in the corpus
- Do NOT skip reading files “because similar”

---

## How to proceed now
1. Discard v001 Start‑Here docs
2. Use this file + updated Architecture folder only
3. Begin P0‑A implementation
4. Open one PR per P0 slice
5. Include `Sources:` per PR

---

## Acknowledgment
If you cannot commit to reading the entire Architecture corpus,
**do not work on this project**.

---

## 8) Repo Anchoring Requirement (MANDATORY)

This project already has a codebase: the a2rchitech repository.

You must treat the repo as the implementation substrate.

Before writing any code:
1. Clone and inspect the a2rchitech repository.
2. Identify existing directories relevant to:
    - apps / UI
    - services / kernel
    - crates / shared logic
3. For each P0 slice (A–D), state explicitly:
    - which existing folder(s) you will modify
    - which files you will add
    - which files you will not touch

You are forbidden from:
- creating a parallel “new shell” project outside the repo
- implementing P0 in isolation from the existing structure
- ignoring existing crates/services because they are “incomplete”

Every PR must include: Repo Anchoring:
- Modified: <path>
- Added: <path>
- Unchanged but reviewed: <path>

If a required component does not exist in the repo:
- create it in the most semantically appropriate existing folder
- explain the choice in the PR
