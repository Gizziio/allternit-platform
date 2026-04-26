# Allternit Pattern Mapping: Incumbent UI Patterns → Allternit Implementation (v1.1)

## Executive Summary

This document maps incumbent interaction patterns (Claude Artifacts, Codex App, Cursor Review) to existing Allternit components and identifies required refactors.

**CRITICAL FIXES IN v1.1:**
- ShellFrame is 2-pane currently (not 3-pane) - needs extension
- Added Pattern 0: Remove floating widgets (duplicates)
- Normalized all paths to real repo paths
- All Date types → ISO string types

---

## 0. Pattern 0: Cleanup (Do First)

### Problem: Floating Widget Duplication

**Current State:**
- `ModeSwitcherWidget` - floating overlay
- `SidebarToggleWidget` - floating overlay
- Both duplicate controls already in `ShellHeader` and `ShellRail`

**Required Action:**
```bash
# Remove from ShellApp.tsx:
- <SidebarToggleWidget />
- <ModeSwitcherWidget />

# Keep in ShellFrame:
- <ShellRail /> (has collapse toggle)
- <ShellHeader /> (has mode switcher)
```

**Why:** Single source of truth. Floating widgets violate the 3-pane shell contract.

---

## 1. Pattern Map: Incumbent → Allternit

### Pattern A: Claude "Artifacts + Sidecar Output Surface"

| Claude Concept | Allternit Equivalent | Current Status | Gap Analysis |
|----------------|----------------|----------------|--------------|
| **Artifact Panel** | `views/code/InspectorStack.tsx` | ✅ Exists (Code-only) | Must promote to global sidecar |
| **Artifact Rendering** | `components/ai-elements/artifact.tsx` | ✅ Exists | Add streaming states |
| **Sidecar Toggle** | Header controls in `shell/ShellHeader.tsx` | ⚠️ Partial | Add always-visible toggle |
| **Keyboard Shortcut** | `vendor/hotkeys.ts` | ✅ Exists | Add `Cmd+Shift+A` |
| **Chat → Artifact Routing** | `views/chat/ChatMessageParts.tsx` | ⚠️ Partial | Route large outputs to sidecar |

**Required Refactors:**
1. Move `InspectorStack` from Code-only to global ShellFrame right panel
2. Add artifact sidecar toggle to ShellHeader (always visible)
3. Implement artifact streaming states in `artifact.tsx`
4. Add keyboard shortcut for artifact visibility toggle

---

### Pattern B: Codex App "Projects + Diff Review + Terminal"

| Codex Concept | Allternit Equivalent | Current Status | Gap Analysis |
|---------------|----------------|----------------|--------------|
| **Project Switcher** | Mode switcher in `shell/ShellHeader.tsx` | ⚠️ Partial | Need project dropdown in header |
| **Project-Scoped Context** | `views/chat/ChatStore.ts` (ChatProject) | ✅ Exists | Need context pack visualization |
| **Per-Project Thread List** | `shell/ShellRail.tsx` sessions section | ✅ Exists | Already project-scoped |
| **Diff Review Panel** | `PatchGate.tsx` + `views/code/InspectorStack.tsx` | ⚠️ Partial | Promote to global ChangeSet review |
| **Terminal Drawer** | `drawers/ConsoleDrawer.tsx` → `views/code/ConsoleDrawer/DrawerRoot.tsx` | ✅ Exists | Has terminal tab |
| **Universal Drawer Shortcut** | `vendor/hotkeys.ts` `PLATFORM_SHORTCUTS` | ⚠️ Partial | Add `Cmd+J` for terminal |

**Required Refactors:**
1. Make Project switcher first-class in header (add dropdown)
2. Promote `PatchGate` to `ChangeSetReview` global component
3. Ensure `Cmd+J` always opens Terminal tab in drawer
4. Add project-scoped context pack UI

---

### Pattern C: Cursor "Agent Review + Accept/Reject"

| Cursor Concept | Allternit Equivalent | Current Status | Gap Analysis |
|----------------|----------------|----------------|--------------|
| **ChangeSet** | Implicit in `PatchGate.tsx` | ⚠️ Missing | Need formal ChangeSet type |
| **Per-File Accept/Reject** | `PatchGate.tsx` hunks | ✅ Exists | Works but needs state persistence |
| **Batch Apply** | Not implemented | ❌ Missing | Need "apply all accepted" action |
| **Review Navigation** | Not implemented | ❌ Missing | Need prev/next file navigation |
| **Risk Tiering** | Not implemented | ❌ Missing | Need policy framework |
| **No Silent Auto-Apply** | Partial (manual apply) | ⚠️ Partial | Need policy enforcement |

**Required Refactors:**
1. Create formal `ChangeSet` type with file items + states
2. Build `ChangeSetReview` component (replaces/enhances PatchGate)
3. Add batch operations (accept all, reject all, apply accepted)
4. Implement risk tiering in policy system
5. Add review navigation (next/prev file, next/prev hunk)

---

## 2. Component Inventory

### ✅ Existing Components (Reusable)

| Component | Location | Purpose | Notes |
|-----------|----------|---------|-------|
| `ShellFrame` | `shell/ShellFrame.tsx` | 2-pane layout | **EXTEND to 3-pane** |
| `ShellRail` | `shell/ShellRail.tsx` | Left navigation | 284px width, GlassSurface |
| `ShellHeader` | `shell/ShellHeader.tsx` | Top controls | Add project switcher |
| `ShellCanvas` | `shell/ShellCanvas.tsx` | Center content | Simple container |
| `ViewHost` | `views/ViewHost.tsx` | View renderer | Pass sidecar context |
| `ConsoleDrawer` | `drawers/ConsoleDrawer.tsx` | Bottom drawer | Delegates to DrawerRoot |
| `DrawerRoot` | `views/code/ConsoleDrawer/DrawerRoot.tsx` | Drawer implementation | Tabs: Queue, Terminal, Logs, etc. |
| `InspectorStack` | `views/code/InspectorStack.tsx` | Right panel (Code) | **PROMOTE to global** |
| `PatchGate` | `PatchGate.tsx` | Diff review | Refactor to ChangeSetReview |
| `ai-elements/*` | `components/ai-elements/` | AI UI primitives | Add streaming |
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
| `AgentRunPanel` | Agent execution tracking | Sidecar |

---

## 3. File-Level Refactor Targets (Real Paths)

### Priority 0: Cleanup
**Files:**
- `shell/ShellApp.tsx` - Remove floating widgets

### Priority 1: Header Unification
**Files:**
- `shell/ShellHeader.tsx` - Add project switcher, artifact toggle
- `shell/ShellApp.tsx` - Manage sidecar state

### Priority 2: Sidecar Promotion (CRITICAL)
**Files:**
- `shell/ShellFrame.tsx` - **Add right panel slot (3rd pane)**
- `views/code/InspectorStack.tsx` - Refactor to mode-agnostic `Sidecar`
- `views/ViewHost.tsx` - Pass sidecar context

### Priority 3: ChangeSet System
**Files:**
- Create `core/contracts/changeset.ts` - Core ChangeSet types
- Create `components/ChangeSetReview/` - Review UI
- Refactor `PatchGate.tsx` - Delegate to ChangeSetReview

### Priority 4: AI Elements Enhancement
**Files:**
- `components/ai-elements/message.tsx` - Add streaming states
- `components/ai-elements/tool.tsx` - Enhance tool visualization
- `components/ai-elements/artifact.tsx` - Add streaming

### Priority 5: Schema Renderer
**Files:**
- Create `components/schema-renderer/` - JSON → UI system
- `views/cowork/CoworkRoot.tsx` - Integrate schema-driven forms

---

## 4. ShellFrame Reality Check

### Current (2-Pane)
```
ShellFrame
├── Left: ShellRail (300px)
└── Center: ShellCanvas (1fr)
```

### Target (3-Pane)
```
ShellFrame
├── Left: ShellRail (300px)
├── Center: ShellCanvas (1fr)
└── Right: ArtifactSidecar (350px, collapsible)
```

**Code Change:**
```tsx
// Current (shell/ShellFrame.tsx line 15)
gridTemplateColumns: isRailCollapsed ? '0px 1fr' : 'auto 1fr'

// Target
gridTemplateColumns: isRailCollapsed 
  ? `0px 1fr ${sidecar.isOpen ? sidecar.width : '0px'}`
  : `auto 1fr ${sidecar.isOpen ? sidecar.width : '0px'}`
```

---

## 5. Pattern Implementation Priority

### Phase 0: Cleanup (Day 1)
1. Remove floating widgets from ShellApp
2. Verify no duplicate controls

### Phase 1: Foundation (Days 2-3)
1. Create `core/contracts/*.ts` with types
2. Create `stores/sidecar-store.ts`
3. Create `stores/changeset-store.ts`

### Phase 2: Sidecar Shell (Days 4-6)
1. Extend ShellFrame to 3-column
2. Create `shell/ArtifactSidecar.tsx`
3. Add header toggle + keyboard shortcut

### Phase 3: ChangeSet Review (Days 7-9)
1. Formalize ChangeSet types
2. Build ChangeSetReview UI
3. Integrate with drawer

### Phase 4: AI Elements + Schema (Days 10-12)
1. Streaming states for messages
2. Schema renderer for Cowork

---

## 6. Target Architecture

```
ShellFrame (3-pane layout)
├── Left: ShellRail (navigation)
├── Center: ShellCanvas (ViewHost)
│   └── Active View (chat/cowork/code/artifact)
└── Right: ArtifactSidecar (collapsible)
    ├── Artifact Panel (preview/edit/run)
    ├── Context Panel (thread/model/token)
    ├── Agent Status (runs/queue)
    └── ChangeSet Review (diff/accept/reject)

Global Drawer (bottom)
├── Queue (Kanban board)
├── Terminal
├── Logs
├── Context
└── Receipts

Header
├── Project Switcher (dropdown)
├── Mode Switcher (Chat/Cowork/Code)
├── Artifact Toggle (always visible)
└── Control Center / Theme / User
```

---

## 7. Critical Path Reminder

```
1. Cleanup (remove floating widgets)
   ↓
2. Contracts (types)
   ↓
3. Sidecar State Management
   ↓
4. ShellFrame 3-Column Layout
   ↓
5. Header Unification
   ↓
6. ArtifactSidecar Component
   ↓
7. ChangeSet Types + Review UI
```

**Why this order:**
- Cleanup prevents confusion about control locations
- Types must exist before components use them
- Sidecar state must exist before ShellFrame can render it
- ShellFrame layout must be updated before sidecar can be added

---

## 8. Acceptance Criteria by Pattern

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

*Allternit Pattern Clone v1.1 - Corrected for agent execution*
