# A2R Pattern Mapping: Incumbent UI Patterns → A2R Implementation

## Executive Summary

This document maps incumbent interaction patterns (Claude Artifacts, Codex App, Cursor Review) to existing A2R components and identifies required refactors.

---

## 1. Pattern Map: Incumbent → A2R

### Pattern A: Claude "Artifacts + Sidecar Output Surface"

| Claude Concept | A2R Equivalent | Current Status | Gap Analysis |
|----------------|----------------|----------------|--------------|
| **Artifact Panel** | `InspectorStack` (Code mode) | ✅ Exists | Needs promotion to global sidecar (all modes) |
| **Artifact Rendering** | `ai-elements/artifact.tsx`, `ai-elements/artifact-panel.tsx` | ✅ Exists | Needs streaming states |
| **Sidecar Toggle** | Header controls in `ShellHeader.tsx` | ⚠️ Partial | Needs always-visible artifact toggle |
| **Keyboard Shortcut** | `useA2RHotkeys` in `vendor/hotkeys.ts` | ✅ Exists | Needs `Cmd+Shift+A` for artifacts |
| **Chat → Artifact Routing** | `ChatMessageParts.tsx` | ⚠️ Partial | Needs explicit "open in sidecar" action |

**Required Refactors:**
1. Move `InspectorStack` from Code-only to global ShellFrame right panel
2. Add artifact sidecar toggle to ShellHeader (always visible)
3. Implement artifact streaming states in `ai-elements/artifact.tsx`
4. Add keyboard shortcut for artifact visibility toggle

---

### Pattern B: Codex App "Projects + Diff Review + Terminal"

| Codex Concept | A2R Equivalent | Current Status | Gap Analysis |
|---------------|----------------|----------------|--------------|
| **Project Switcher** | Mode switcher in `ShellHeader.tsx` | ⚠️ Partial | Projects exist but need first-class switcher |
| **Project-Scoped Context** | `ChatStore.ts` (ChatProject) | ✅ Exists | Needs context pack visualization |
| **Per-Project Thread List** | `ShellRail.tsx` sessions section | ✅ Exists | Already project-scoped |
| **Diff Review Panel** | `PatchGate.tsx` + `InspectorStack.tsx` | ⚠️ Partial | Needs promotion to global ChangeSet review |
| **Terminal Drawer** | `ConsoleDrawer.tsx` → `DrawerRoot.tsx` | ✅ Exists | Has terminal tab, needs universal shortcut |
| **Universal Drawer Shortcut** | `PLATFORM_SHORTCUTS` in `vendor/hotkeys.ts` | ⚠️ Partial | Has shortcuts, needs `Cmd+J` for terminal |

**Required Refactors:**
1. Make Project switcher first-class in header (add dropdown)
2. Promote `PatchGate` to `ChangeSetReview` global component
3. Ensure `Cmd+J` always opens Terminal tab in drawer
4. Add project-scoped context pack UI

---

### Pattern C: Cursor "Agent Review + Accept/Reject"

| Cursor Concept | A2R Equivalent | Current Status | Gap Analysis |
|----------------|----------------|----------------|--------------|
| **ChangeSet** | Implicit in `PatchGate.tsx` | ⚠️ Missing | Needs formal ChangeSet type |
| **Per-File Accept/Reject** | `PatchGate.tsx` hunks | ✅ Exists | Works but needs state persistence |
| **Batch Apply** | Not implemented | ❌ Missing | Needs "apply all accepted" action |
| **Review Navigation** | Not implemented | ❌ Missing | Needs prev/next file navigation |
| **Risk Tiering** | Not implemented | ❌ Missing | Needs policy framework |
| **No Silent Auto-Apply** | Partial (manual apply) | ⚠️ Partial | Needs policy enforcement |

**Required Refactors:**
1. Create formal `ChangeSet` type with file items + states
2. Build `ChangeSetReview` component (replaces/enhances PatchGate)
3. Add batch operations (accept all, reject all, apply accepted)
4. Implement risk tiering in policy system
5. Add review navigation (next/prev file, next/prev hunk)

---

## 2. Component Inventory: What Exists vs What's Needed

### ✅ Existing Components (Reusable)

| Component | Location | Purpose | Notes |
|-----------|----------|---------|-------|
| `ShellFrame` | `shell/ShellFrame.tsx` | 3-pane layout | Extend for right sidecar |
| `ShellRail` | `shell/ShellRail.tsx` | Left navigation | Add project switcher integration |
| `ShellHeader` | `shell/ShellHeader.tsx` | Top controls | Add artifact toggle, project dropdown |
| `ViewHost` | `views/ViewHost.tsx` | View renderer | Already supports sidecar context |
| `ConsoleDrawer` | `drawers/ConsoleDrawer.tsx` | Bottom drawer | Add universal shortcut |
| `DrawerRoot` | `views/code/ConsoleDrawer/DrawerRoot.tsx` | Drawer implementation | Terminal tab exists |
| `InspectorStack` | `views/code/InspectorStack.tsx` | Right panel (Code) | Promote to global |
| `PatchGate` | `PatchGate.tsx` | Diff review | Refactor to ChangeSetReview |
| `ai-elements/*` | `components/ai-elements/` | AI UI primitives | Add streaming, tool calls |
| `ChatStore` | `views/chat/ChatStore.ts` | Project/Thread state | Already has ChatProject |

### ❌ Missing Components (To Build)

| Component | Purpose | Pattern Source |
|-----------|---------|----------------|
| `ArtifactSidecar` | Global right panel for artifacts | Claude |
| `ChangeSetReview` | Formal diff review with batch ops | Cursor |
| `ProjectSwitcher` | Header dropdown for project switching | Codex |
| `ApprovalPolicyUI` | Risk-tier approval configuration | AI SDK 6 |
| `SchemaRenderer` | JSON → UI renderer for forms | json-render |
| `StreamingMessage` | Real-time streaming message UI | AI Elements |
| `ToolCallCard` | Tool execution visualization | AI Elements |

---

## 3. File-Level Refactor Targets

### Priority 1: Header Unification
**Files:**
- `shell/ShellHeader.tsx` - Add project switcher, artifact toggle
- `shell/ShellApp.tsx` - Manage sidecar state

### Priority 2: Sidecar Promotion
**Files:**
- `shell/ShellFrame.tsx` - Add right panel slot
- `views/code/InspectorStack.tsx` - Refactor to mode-agnostic `Sidecar`
- `views/ViewHost.tsx` - Pass sidecar context

### Priority 3: ChangeSet System
**Files:**
- Create `types/changeset.ts` - Core ChangeSet types
- Create `components/ChangeSetReview/` - Review UI
- Refactor `PatchGate.tsx` - Delegate to ChangeSetReview

### Priority 4: AI Elements Enhancement
**Files:**
- `components/ai-elements/message.tsx` - Add streaming states
- `components/ai-elements/tool.tsx` - Enhance tool visualization
- `components/ai-elements/artifact.tsx` - Add streaming, expand/collapse

### Priority 5: Schema Renderer
**Files:**
- Create `components/schema-renderer/` - JSON → UI system
- `views/cowork/CoworkRoot.tsx` - Integrate schema-driven forms

---

## 4. Pattern Implementation Priority

### Phase 1: Foundation (Week 1)
1. **UI Contracts** - Define TypeScript interfaces (Project, ChangeSet, Artifact, ApprovalPolicy)
2. **Header Unification** - Add project switcher, remove duplicate controls
3. **Sidecar Shell** - Extend ShellFrame with right panel slot

### Phase 2: Sidecar + Artifacts (Week 2)
1. **ArtifactSidecar Component** - Mode-agnostic right panel
2. **Header Toggle** - Always-visible artifact button + Cmd+Shift+A
3. **Chat Integration** - Route large outputs to sidecar

### Phase 3: ChangeSet Review (Week 3)
1. **ChangeSet Types** - Formalize change tracking
2. **ChangeSetReview UI** - Per-file accept/reject + batch ops
3. **Policy Framework** - Risk tiering + approval rules

### Phase 4: AI Elements + Schema (Week 4)
1. **Streaming States** - Enhance message/tool components
2. **Schema Renderer** - JSON → UI for Cowork forms
3. **Approval UI** - Policy configuration interface

---

## 5. Component Architecture: Target State

```
ShellFrame (3-pane layout)
├── Left: ShellRail (navigation)
├── Center: ShellCanvas (ViewHost)
│   └── Active View (chat/cowork/code/artifact)
└── Right: ArtifactSidecar (collapsible)
    ├── Artifact Panel (preview/edit/run)
    ├── Context Panel (thread/model/token)
    └── Agent Status (runs/queue)

Global Drawer (bottom)
├── Queue (Kanban board)
├── Terminal
├── Logs
├── ChangeSet Review (diff/accept/reject)
└── Context

Header
├── Project Switcher (dropdown)
├── Mode Switcher (Chat/Cowork/Code)
├── Artifact Toggle (always visible)
└── Control Center / Theme / User
```

---

## 6. Acceptance Criteria by Pattern

### Claude Artifacts Pattern
- [ ] Right sidecar visible in all modes (not just Code)
- [ ] Header has artifact toggle (not hidden in menus)
- [ ] `Cmd+Shift+A` toggles sidecar visibility
- [ ] Large code outputs auto-route to sidecar
- [ ] Artifacts support preview/edit/run states

### Codex Projects Pattern
- [ ] Header has project switcher dropdown
- [ ] Project context visible in header
- [ ] Threads auto-scope to selected project
- [ ] `Cmd+J` opens Terminal tab in drawer
- [ ] Drawer persists terminal session

### Cursor Review Pattern
- [ ] Every file write creates ChangeSet
- [ ] ChangeSetReview shows per-file diffs
- [ ] Accept/Reject per hunk + per file
- [ ] Batch apply: "apply all accepted"
- [ ] Risk tiers: safe edits auto-stage, risky require approval
- [ ] No silent auto-apply for high-risk actions

---

*Generated for A2R Shell Architecture Refactor*
