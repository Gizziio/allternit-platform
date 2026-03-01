# A2rchitech Master Execution Roadmap
**Status:** PLAN MODE
**Target:** Full Agentic Operating System (UI Shell → Kernel → Context → Embodiment)
**Source Corpus:** `Desktop/A2rchitech Workspace/Architecture/` (v002)

This document outlines the end-to-end execution plan for the A2rchitech project, anchoring the design direction (Architecture) into the implementation substrate (Repo).

---

## Phase 0: The Entry Point (Capsule Shell)
**Goal:** Ship a working, visual "Shell" that validates the Core UX (Capsules + Tabs + Canvases) without needing the full backend yet.

### P0-A: Capsule Runtime (COMPLETE)
*   **What:** Logic for spawning, docking, and pinning capsules.
*   **Where:** `apps/shell` (TypeScript).
*   **Repo Anchoring:** Modified `capsuleRuntime.ts`, `tabbar.ts`, `contracts.ts`.
*   **Status:** Done.

### P0-B: Canvas Protocol & Renderer (NEXT)
*   **What:** The renderer that turns data into UI. Defines `CanvasSpec` and `ViewSpec` types.
*   **Where:** `apps/ui` (Web Renderer).
    *   *Note:* `crates/ui` is empty, so we build the TS implementation first.
*   **Architecture:** `UI/CanvasProtocol.md`, `UI/presentation/RendererCapabilities.md`.
*   **DoD:** Canonical types defined; minimum views (`timeline`, `list`, `object`, `search`) implemented.

### P0-C: Frameworks (Agent-Generated Mini-Apps)
*   **What:** The "templates" agents use to spawn capsules (e.g., "Search", "Note").
*   **Where:** `apps/shell/src/runtime/frameworks.ts` and new `router.ts` for intent routing.
*   **Architecture:** `UI/MiniAppRuntime.md`, `UNIFIED/AGENTS/AdaptivePatterns.md`.
*   **DoD:** FrameworkSpec schema; shell spawning from template; intent routing.

### P0-D: Dispatch & Journal Stubs
*   **What:** Connecting the UI to a "Journal" (local mock initially) so every action is recorded.
*   **Where:** `apps/shell/src/runtime/journal.ts`.
*   **Architecture:** `UI/Journal.md`, `UNIFIED/RUNTIME/Kernel.md`.
*   **DoD:** `/v1/intent/dispatch` stub; Artifact types (`ObserveCapsule`, `DistillateCapsule`) defined.

---

## Phase 1: The Kernel & Governance ("Make it Real")
**Goal:** Replace the shell's local mocks with the real Rust-based Service Architecture.

### P1-01: Server-Backed Registry
*   **What:** Central storage for Frameworks and Apps.
*   **Where:** `services/control-plane/registry-apps` & `registry-server`.
*   **Architecture:** `UNIFIED/RUNTIME/Kernel.md`.

### P1-02: Journal Persistence
*   **What:** The immutable "Source of Truth" database (SQLite/Postgres).
*   **Where:** `services/state/history` (aligning with v002 spec).
*   **Architecture:** `UI/Journal.md`, `UNIFIED/CONTEXT/ContextSystem.md`.

### P1-03: Tool Gating & Safety
*   **What:** Security layer preventing dangerous tool use without `ActionPreview`.
*   **Where:** `services/compute/executor` & `crates/kernel/tools-gateway`.
*   **Architecture:** `BACKLOG/Tool Registry.md`, `LAW/Guardrails.md`.

---

## Phase 2: Context & Intelligence ("The Brain")
**Goal:** Enable the system to remember, learn, and distill information over time.

### P2-01: Context Packing
*   **What:** Selecting what information fits into the agent's context window.
*   **Where:** `crates/control/context-router` & `services/state/memory`.
*   **Architecture:** `UNIFIED/CONTEXT/Context.md`.

### P2-02: Markdown IR (Intermediate Representation)
*   **What:** Standardizing content format for consistent UI rendering.
*   **Where:** `crates/kernel/kernel-contracts` (Schemas) & `packages/sdk-core`.
*   **Architecture:** `UNIFIED/IR/MarkdownIR.md`.

### P2-03: Distillation Pipeline
*   **What:** Background processes summarizing threads into "Distillate Capsules".
*   **Where:** `services/state/memory`.
*   **Architecture:** `UI/Research_Synthesis_Discovery_UI.md`.

---

## Phase 3: Integrations (Workflow Graph)
**Goal:** Connect the OS to the outside world.

### P3-01: Linear & GitHub
*   **What:** Mapping external "Issues" and "PRs" into Capsules/Canvases.
*   **Where:** `crates/providers` & `services/gateways`.
*   **Architecture:** `INTEGRATIONS/Linear.md`.

### P3-02: Glide & Dynamic UI
*   **What:** Advanced UI transitions and interactive mini-apps.
*   **Where:** `apps/ui` (Advanced Renderer).
*   **Architecture:** `INTEGRATIONS/Glide.md`.

---

## Phase 4: Embodiment (Physical World)
**Goal:** Extend the OS to control hardware/robotics.

### P4-01: Robotics Capsules
*   **What:** Interfaces for teleoperation and sensor streams.
*   **Where:** `crates/embodiment/robotics`.
*   **Architecture:** `UNIFIED/ROBOTICS/Robotics.md`.

---

## Critical Path Risks & Mitigations
1.  **Empty `crates/ui`:**
    *   *Risk:* No shared Rust UI library.
    *   *Mitigation:* Build TypeScript implementation in `apps/ui` first.
2.  **`Cargo.toml` Misalignment:**
    *   *Risk:* Build failure due to missing `packages/` path.
    *   *Mitigation:* Correct `Cargo.toml` or move crates in Phase 1 cleanup.
3.  **Service Alignment:**
    *   *Risk:* Existing services diverging from v002 spec.
    *   *Mitigation:* Strict audit of `history` and `registry` services against `UI/Journal.md` before P1 implementation.
