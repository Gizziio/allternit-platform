# A2R Pattern Clone Summary

## Overview

This document summarizes the complete analysis and implementation plan for cloning incumbent UI patterns (Claude, Codex, Cursor) into A2R, plus Vercel Labs integration.

---

## Deliverables Created

### 1. Pattern Map (`PATTERN_MAP.md`)
Maps incumbent patterns to A2R components:
- **Claude Artifacts** → `InspectorStack` (promoted to global sidecar)
- **Codex Projects** → `ChatStore` with project switcher in header
- **Cursor Review** → `PatchGate` refactored to `ChangeSetReview`

**Key Finding:** A2R already has most components needed. Main work is:
1. Promoting Code-mode inspector to global sidecar
2. Adding project switcher to header
3. Formalizing ChangeSet types and review UI

### 2. UI Contracts (`UI_CONTRACTS.ts`)
TypeScript interfaces for all patterns:
- `Project` - Codex-style project management
- `Thread` - Claude-style conversations
- `Artifact` - Claude Artifacts with versions
- `ChangeSet` - Cursor-style diff review
- `ApprovalPolicy` - AI SDK 6 risk tiers
- `SchemaUI` - json-render generative UI

**Key Feature:** Predefined approval policies (`cautious`, `balanced`, `autonomous`) ready to use.

### 3. Vercel Stack Integration (`VERCEL_STACK_INTEGRATION.md`)
Plan for integrating Vercel Labs components:
- **AI Elements** - Streaming message, tool call visualization
- **AI SDK** - Tool approval middleware
- **json-render** - Schema-driven UI for Cowork mode
- **UI Guidelines** - Accessibility, motion design

**Key Decision:** Can either use `@vercel/ai-elements` package or port components into `ai-elements/`.

### 4. Implementation Plan (`IMPLEMENTATION_PLAN.md`)
8-week phased approach:
- **Week 1:** Type definitions, store setup
- **Week 2:** Header unification, sidecar shell
- **Week 3:** ChangeSet review system
- **Week 4:** AI Elements & streaming
- **Week 5-6:** Schema renderer
- **Week 7-8:** Polish, accessibility, docs

**Key Milestone:** Sidecar working in all modes by end of Week 2.

---

## Current A2R Architecture Strengths

### ✅ What's Already Working
1. **3-Pane Layout** - `ShellFrame` with rail + canvas
2. **View System** - Registry pattern with 75+ view types
3. **Mode Switching** - Chat/Cowork/Code modes
4. **Project/Thread Management** - `ChatStore` with projects
5. **Drawer System** - `ConsoleDrawer` with tabs
6. **AI Elements** - Message, artifact, tool components
7. **Diff Review** - `PatchGate` with accept/reject

### ⚠️ What Needs Refactoring
1. **Sidecar is Code-Only** - Promote to global
2. **No Project Switcher in Header** - Add dropdown
3. **PatchGate is Informal** - Formalize to ChangeSetReview
4. **No Streaming States** - Add to messages
5. **No Schema Renderer** - Build for Cowork

---

## Quick Wins (Start Here)

### 1. Header Unification (1-2 days)
**Files:** `shell/ShellHeader.tsx`, `shell/ShellApp.tsx`

**Changes:**
```tsx
// Add to ShellHeader
<ProjectSwitcher />
<ArtifactToggle shortcut="Cmd+Shift+A" />

// Remove from floating overlay
// Remove duplicate mode switcher
```

### 2. Sidecar Promotion (2-3 days)
**Files:** `shell/ShellFrame.tsx`, `shell/ArtifactSidecar.tsx`

**Changes:**
```tsx
// ShellFrame: 3-column grid
gridTemplateColumns: 'auto 1fr 300px'

// ArtifactSidecar: Extract from InspectorStack
// Make it work in all modes
```

### 3. ChangeSet Types (1 day)
**File:** `types/changeset.ts`

**Core Type:**
```typescript
export interface ChangeSet {
  id: string;
  changes: FileChange[];
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  riskTier: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}
```

---

## Critical Path

The order matters for smooth integration:

```
1. UI Contracts (types)
   ↓
2. Sidecar State Management
   ↓
3. ShellFrame 3-Column Layout
   ↓
4. Header Unification
   ↓
5. ArtifactSidecar Component
   ↓
6. ChangeSet Types + Review UI
   ↓
7. AI Elements Enhancement
   ↓
8. Schema Renderer
```

**Why this order:**
- Types must exist before components use them
- Sidecar state must exist before ShellFrame can render it
- ShellFrame layout must be updated before sidecar can be added
- Header must be unified before sidecar toggle is added

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing views | Medium | High | Feature flags |
| Performance regression | Low | Medium | Lazy loading |
| User confusion | Medium | Medium | Gradual rollout |
| Scope creep | High | Medium | Strict phases |

**Recommended:** Start with Phase 1 & 2 only. Validate before proceeding.

---

## Immediate Next Steps

### For Implementation Agent

1. **Read Current Code**
   ```bash
   cat 6-ui/a2r-platform/src/shell/ShellFrame.tsx
   cat 6-ui/a2r-platform/src/shell/ShellHeader.tsx
   cat 6-ui/a2r-platform/src/shell/ShellApp.tsx
   cat 6-ui/a2r-platform/src/views/code/InspectorStack.tsx
   ```

2. **Create Foundation**
   ```bash
   mkdir -p types
   touch types/project.ts types/changeset.ts types/artifact.ts
   touch types/approval.ts types/schema-ui.ts types/sidecar.ts
   ```

3. **Implement Sidecar State**
   ```bash
   touch stores/sidecar-store.ts
   # Implement Zustand store with isOpen, activePanel, width
   ```

4. **Extend ShellFrame**
   ```bash
   # Modify ShellFrame.tsx for 3-column layout
   # Add sidecar slot
   ```

5. **Build ArtifactSidecar**
   ```bash
   mkdir -p components/artifact-sidecar
   touch components/artifact-sidecar/ArtifactSidecar.tsx
   # Extract from InspectorStack, make mode-agnostic
   ```

### For Review

- Check `PATTERN_MAP.md` for component mapping
- Review `UI_CONTRACTS.ts` for type definitions
- Follow `IMPLEMENTATION_PLAN.md` for phase order

---

## Key Design Decisions

### 1. Sidecar vs Drawer
- **Sidecar (right panel):** Artifacts, Context, Agent Status, ChangeSet review
- **Drawer (bottom):** Terminal, Logs, Queue, Approval queue

**Rationale:** Sidecar is for reference/context; drawer is for tools/output.

### 2. ChangeSet Scope
- One ChangeSet per assistant message
- Contains all file changes from that message
- Review happens after generation, before apply

**Rationale:** Matches Cursor's review pattern. Clear unit of work.

### 3. Approval Policy
- Three built-in policies: cautious, balanced, autonomous
- Per-project configuration
- Risk tier assessment for each change

**Rationale:** Matches AI SDK 6 philosophy. Users choose risk tolerance.

### 4. Schema Renderer
- JSON schema → UI components
- Used for Cowork forms, WIH editors, MCP miniapps
- Component registry for extensibility

**Rationale:** Enables agent-generated UI without hardcoding.

---

## Files at a Glance

### Documentation
- `PATTERN_MAP.md` - Component mapping
- `UI_CONTRACTS.ts` - TypeScript interfaces
- `VERCEL_STACK_INTEGRATION.md` - Vercel integration
- `IMPLEMENTATION_PLAN.md` - Phased implementation
- `PATTERN_CLONE_SUMMARY.md` - This file

### Implementation (to create)
- `types/*.ts` - Type definitions
- `stores/sidecar-store.ts` - Sidecar state
- `stores/changeset-store.ts` - ChangeSet state
- `components/artifact-sidecar/*.tsx` - Sidecar UI
- `components/changeset-review/*.tsx` - Review UI
- `components/schema-renderer/*.tsx` - Schema UI

### Refactor (to modify)
- `shell/ShellFrame.tsx` - 3-column layout
- `shell/ShellHeader.tsx` - Project/artifact controls
- `shell/ShellApp.tsx` - State management
- `views/code/InspectorStack.tsx` - Extract sidecar

---

## Questions for Stakeholders

1. **Sidecar Default Width?** 
   - Suggested: 320px (minimum), 400px (default), 600px (maximum)

2. **Project Switcher Location?**
   - Option A: Left of mode switcher (Codex style)
   - Option B: In rail header (VS Code style)

3. **ChangeSet Auto-Apply?**
   - Option A: Never auto-apply (always review)
   - Option B: Policy-based (safe changes auto-apply)
   - Option C: User preference per project

4. **Vercel AI Elements?**
   - Option A: Use npm package
   - Option B: Port components into codebase
   - Option C: Keep current components, enhance selectively

5. **Schema Renderer Priority?**
   - Option A: Critical (needed for Cowork)
   - Option B: Nice to have (can use hardcoded forms)
   - Option C: Future phase (after core patterns)

---

## Conclusion

A2R is well-positioned to clone these patterns. The architecture already supports:
- 3-pane layout (just need to add right panel)
- Project/thread management (just need project switcher)
- Diff review (just need to formalize ChangeSet)
- AI UI elements (just need streaming states)

**Recommended Start:** Phase 1 (types) + Phase 2 (sidecar). This gives immediate visual progress and validates the architecture.

---

*Generated for A2R Pattern Clone Initiative*
