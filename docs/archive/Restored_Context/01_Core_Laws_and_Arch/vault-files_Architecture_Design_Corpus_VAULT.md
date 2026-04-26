# Architecture Folder - Vault Summary

**Original Folder:** `Architecture/`  
**Date:** 2026-01-18  
**Status:** DESIGN CORPUS - Separated from code repo, requires review

## Context

The Architecture folder is a **design-direction corpus** delivered separately from the code repo as `Architecture.zip`. It contains specifications, backlog items, UI patterns, and architectural constraints that should be reviewed before project direction changes.

**Critical Note:** This corpus is **separate from the actual codebase** and represents design intent that may or may not have been implemented.

## Folder Structure

### UI Specifications
- PresentationKernel.md - Kernel for presentation layer
- Architecture_and_Prompt_Suites.md - Prompt system design
- UTI.md - Unified Terminal Interface
- Unified_UI_Merged_Spec_DCD_Directives_MiniApps.md - UI merge strategy
- CanvasProtocol.md - Canvas protocol specification
- glide_architecture.md - Glide architecture patterns
- caspuleshell_kernelcontractsPrompt.md - Kernel contracts for CapsuleShell
- Journal.md - Journal system design
- Capsules.md - Capsule specifications
- Research_Synthesis_Discovery_UI.md - Research to UI synthesis
- presentation/RendererCapabilities.md - Rendering capabilities
- presentation/ViewSpec.schema.json - View spec schema
- CapsuleProtocol.md - Capsule protocol spec
- glide_ui_runtime.md - UI runtime design
- MiniAppRuntime.md - Miniapp runtime architecture

### Backlog & Tasks
- BACKLOG/Tool Registry.md - Tool registry backlog
- PR_TEMPLATE.md - Pull request template
- CODING_AGENT_START_HERE_v001.md - Coding agent start guide

## Key Decisions Extracted

### Architecture Strategy
1. **Separation of Concerns:** Corpus separate from code repo
2. **Design-First Approach:** Specs written before implementation
3. **Multi-Layer Architecture:** UI, presentation, capsule, kernel layers
4. **Protocol-Driven Design:** CanvasSpec, ViewSpec, CapsuleProtocol schemas

### UI Architecture Patterns
1. **Presentation Kernel:** Central rendering coordinator
2. **Canvas Protocol:** Declarative UI definition
3. **View Registry:** Extensible view system
4. **Miniapp Runtime:** Framework for agent-generated UI

### Integration Requirements
1. **Corpus Reading:** Must read entire Architecture folder before implementation
2. **Source Documentation:** List all Architecture files referenced
3. **Backlog Mapping:** Reference backlog task IDs in PRs
4. **Acceptance Coverage:** State how acceptance tests satisfied

### P0 Implementation Strategy
**Four Slices (vertical, demo-driven):**

#### P0-A: Capsule Shell + Tab/Canvas Metaphor
**Deliverables:**
- Capsule store supports open/close/activate
- Tab bar reflects capsule instances; active capsule controls active canvas
- Canvas mount renders CanvasSpec; switching tabs switches canvas
- Persistence flags exist in UI state: ephemeral/docked/pinned (UI-only for v0)

#### P0-B: Canvas Protocol + Minimum View Taxonomy
**Deliverables:**
- Canonical CanvasSpec + ViewSpec types used by renderer
- Minimum views: timeline_view, list_view, object_view, search_lens
- View registry exists so new view types can be added without rewriting shell

#### P0-C: FrameworkSpec + Capsule Spawn as Agent-Generated Templates
**Deliverables:**
- FrameworkSpec schema exists (allowed intents, default canvases, tool scope, persistence)
- Shell can spawn a capsule from a framework (template → instance)
- Naive routing (intent prefix) is acceptable in v0
- Every spawn appends journal events (local v0 ok)

#### P0-D: Kernel Contracts: Intent Dispatch
**Deliverables:**
- Contracts exist for:
  - `GET /v1/workspaces/{ws}/frameworks`
  - `POST /v1/intent/dispatch`
  - `GET /v1/journal/stream`
- Dispatch response includes:
  - capsule instance
  - events[] (append-only)
  - artifacts[] (ObserveCapsule + DistillateCapsule)
  - canvas spec
- Shell adapts to contract (backend can be mocked/stubbed)

## Research Outcomes

### UI Patterns Identified
1. **Declarative UI:** CanvasSpec defines rendering declaratively
2. **View Taxonomy:** Extensible view system with minimum set
3. **Protocol-Based Communication:** Well-defined contracts between layers
4. **Agent-Generated UI:** Frameworks support capsule generation by agents

### Design Principles
1. **Vertical Slices:** Implement P0 in A/B/C/D phases
2. **Demo-Driven:** Each slice produces runnable demo
3. **No Refactor Rule:** Do NOT refactor whole repo during P0
4. **Contract-First:** Define contracts before implementation
5. **Stub Acceptance:** Mocks/stubs acceptable for initial P0

## Actionable Items Extracted

### Backlog Items (from BACKLOG/Tool Registry.md)
- [ ] Review and prioritize Tool Registry backlog
- [ ] Map backlog items to current Allternit architecture
- [ ] Create task entries in issue tracker

### Implementation Gaps
1. **Corpus Reading:** Current code may not reflect all Architecture specs
2. **Source Tracking:** Hard to verify which specs were implemented
3. **Acceptance:** Need to map current acceptance tests to Architecture specs

## Session Context

This Architecture corpus represents a comprehensive design system for the original Allternit UI approach. The specs define protocols, schemas, and implementation strategies for a multi-layer architecture.

**Relationship to Current Code:**
The Architecture folder is **separate from implementation** and may represent design that was:
- Fully implemented in current codebase
- Partially implemented
- Not implemented at all
- Superseded by new architecture

**Decision Point:**
Review this corpus to determine which specs are still relevant, which have been implemented, and which should be archived as obsolete.

---

## Original Files Status

**Location:** `archive/for-deletion/Architecture/` (entire folder)  
**Reason for Archive:** This is a design corpus that must be reviewed before implementation. Key learnings, patterns, and actionable items have been extracted above. Original specs should be preserved for reference but organized separately from code.  
**Deletion Approved:** ❌ **DO NOT DELETE** - Contains valuable design specs that may still be relevant

**Recommendation:** Keep in archive/ for reference, extract any remaining useful items during next major feature development.

---

**Impact on Current Allternit:**
- Design principles (protocol-driven, contract-first, declarative UI)
- UI patterns (Canvas protocol, view taxonomy, capsule spawning)
- P0 implementation strategy (vertical slices, demo-driven)
- Backlog items from Tool Registry

The current Allternit implementation may incorporate many of these patterns, but requires verification against the Architecture corpus to ensure consistency.