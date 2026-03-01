# A2rchitech Execution Backlog
**Status:** ACTIVE
**Source Corpus:** `Desktop/A2rchitech Workspace/Architecture/` (v002)

This backlog is the executable translation of the Architecture Corpus.
**Rule:** No task may be started without reading its source files.

---

## P0 — Entry Point Experience (Capsule Shell)
**Goal:** Ship the "Entry Point": Capsule Shell + Tab/Canvas metaphor + Agent-Generated Frameworks.

### P0-A: Capsule Runtime + Tab Bar
**Repo Anchoring:**
- **Modified:** `apps/shell/src/runtime/capsuleRuntime.ts`, `apps/shell/src/ui/tabbar.ts`
- **Added:** `apps/shell/src/runtime/persistence.ts` (if needed)
- **Unchanged but reviewed:** `apps/shell/package.json`, `apps/shell/src/app.ts`

**Scope:** `apps/shell`, `apps/ui`
**DoD:**
- [ ] Capsule instance store supports open/close/activate
- [ ] Tab bar reflects capsule instances; active capsule controls active canvas
- [ ] Canvas mount renders CanvasSpec; switching tabs switches canvas
- [ ] Persistence flags in UI state: ephemeral/docked/pinned (v0 storage is memory)
**Sources:**
- `UI/Capsules.md`
- `UI/CapsuleProtocol.md`
- `UI/CanvasProtocol.md`
- `UI/PresentationKernel.md`
- `UNIFIED/SOT.md`

### P0-B: Canvas Protocol + Renderer
**Repo Anchoring:**
- **Modified:** `apps/shared/contracts.ts`, `apps/ui/src/index.ts`
- **Added:** `apps/ui/src/view_registry.ts` (TS implementation first, as crates/ui is empty)
- **Unchanged but reviewed:** `apps/ui/package.json`

**Scope:** `apps/ui`
**DoD:**
- [ ] Canonical `CanvasSpec` + `ViewSpec` types defined in `apps/shared/contracts.ts`
- [ ] Implement minimum views: `timeline_view`, `list_view`, `object_view`, `search_lens`
- [ ] Render loop: active capsule -> active canvas -> renderer
- [ ] Renderer supports "view registry" for extensibility
**Sources:**
- `UI/CanvasProtocol.md`
- `UI/presentation/RendererCapabilities.md`
- `UI/PresentationKernel.md`
- `UI/Journal.md`

### P0-C: Frameworks (Agent-Generated Mini-Apps)
**Repo Anchoring:**
- **Modified:** `apps/shell/src/runtime/frameworks.ts`
- **Added:** `apps/shell/src/runtime/router.ts` (Intent routing)
- **Unchanged but reviewed:** `apps/shared/contracts.ts`

**Scope:** `contracts`, `shell runtime`
**DoD:**
- [ ] `FrameworkSpec` schema: allowed intents, default canvases, tool scope
- [ ] Shell can spawn a capsule from a framework (template -> instance)
- [ ] Naive routing: intent prefix selects framework (e.g., "note ...")
- [ ] Every spawn appends journal events (local journal)
**Sources:**
- `UI/MiniAppRuntime.md`
- `UNIFIED/COMPILER/DirectiveCompiler.md`
- `UNIFIED/AGENTS/AdaptivePatterns.md`
- `BACKLOG/Tool Registry.md`

### P0-D: Intent Dispatch + Journal Contracts
**Repo Anchoring:**
- **Modified:** `apps/shell/src/runtime/journal.ts`, `apps/shell/src/runtime/capsuleRuntime.ts`
- **Added:** `apps/shell/src/runtime/dispatch.ts` (Stub client)
- **Unchanged but reviewed:** `apps/shared/contracts.ts`

**Scope:** `kernel contracts`, `shell adapter`
**DoD:**
- [ ] Define `/v1/intent/dispatch` request/response (returns capsule + events + artifacts)
- [ ] Define `/v1/journal/stream` shape
- [ ] Define Artifact types: `ObserveCapsule`, `DistillateCapsule`
- [ ] Journal events are append-only and visible in UI
**Sources:**
- `UNIFIED/RUNTIME/Kernel.md`
- `UNIFIED/IR/MarkdownIR.md`
- `UI/Journal.md`
- `ACCEPTANCE/AcceptanceTests.md`

---

## P1 — Kernel & Governance ("Make it Real")

### P1-01: Server-Backed Framework Registry
**Repo Anchoring:**
- **Modified:** `services/control-plane/registry-apps/src/main.rs`

### P1-02: Journal Persistence Boundary
**Repo Anchoring:**
- **Modified:** `services/state/history/src/lib.rs`

### P1-03: Tool Registry & Gating
**Repo Anchoring:**
- **Modified:** `services/compute/executor/src/lib.rs`, `crates/kernel/tools-gateway/src/lib.rs`

---

## P2 — Context & Distillation
*(Mapping to be refined during P1 phase)*

---

## P3 — Integrations
*(Mapping to be refined during P2 phase)*

---

## P4 — Robotics
*(Mapping to be refined during P3 phase)*