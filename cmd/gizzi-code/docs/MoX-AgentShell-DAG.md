# MoX DAG: Agent-Shell TUI + Usage Guard

**Target Codebase**: `allternit/7-apps/agent-shell/allternit-shell/packages/allternit-shell/`
**Tech Stack**: TypeScript, SolidJS, Bun
**Scope**: TUI features + Usage Guard (all in TypeScript)

---

## Architecture Correction

### What Agent-Shell Is
- **TypeScript/SolidJS TUI application**
- Runs in terminal via Bun
- Uses `@opentui/solid` for rendering
- Located at: `src/cli/cmd/tui/`

### What Agent-Shell Is NOT
- Not the Rust CLI in `7-apps/cli/`
- Not the web platform in `6-ui/allternit-platform/`

### External Integrations (Subprocess)
- May spawn Rust CLI for handoff operations
- Reads usage data from `~/.allternit/cache/usage/`
- Writes batons to `/.allternit/handoff/`

---

## Stream 1: TUI Foundation (Agent-Shell Native)

### Task: MoX-SHELL-001 | Collapsible Message Sections
**Location**: `src/cli/cmd/tui/routes/session/index.tsx`
**Type**: New hook + UI modification
**Duration**: 8h

**Implementation**:
```typescript
// New file: src/cli/cmd/tui/hooks/useMessageState.ts
export function useMessageState(sessionID: string) {
  const [state, setState] = createStore<Record<string, { collapsed?: boolean }>>({})
  // Persist to localStorage: `allternit-msg-${sessionID}`
  return { state, toggle: (msgID: string) => ... }
}
```

**Files**:
- Create: `src/cli/cmd/tui/hooks/useMessageState.ts`
- Modify: `src/cli/cmd/tui/routes/session/index.tsx` (MessageCard)

**Acceptance**:
- [ ] Fold indicator renders per message
- [ ] `Space` toggles fold on focused message
- [ ] Persist to localStorage per session

---

### Task: MoX-SHELL-002 | In-Session Text Search
**Location**: `src/cli/cmd/tui/component/dialog-search.tsx`
**Type**: New component
**Duration**: 12h
**Depends**: MoX-SHELL-001

**Files**:
- Create: `src/cli/cmd/tui/component/dialog-search.tsx`
- Create: `src/cli/cmd/tui/hooks/useSearch.ts`
- Modify: `src/cli/cmd/tui/routes/session/index.tsx` (add command)

**Acceptance**:
- [ ] `/search` opens dialog
- [ ] Fuzzy search with fuzzysort
- [ ] Match highlighting
- [ ] `n`/`N` navigation

---

### Task: MoX-SHELL-003 | Copy Code Block Action
**Location**: `src/cli/cmd/tui/routes/session/index.tsx`
**Type**: Keyboard handler addition
**Duration**: 4h

**Acceptance**:
- [ ] `y` copies focused code block
- [ ] Toast confirmation

---

### Task: MoX-SHELL-004 | Message Bookmarking
**Location**: `src/cli/cmd/tui/component/dialog-bookmarks.tsx`
**Type**: New component
**Duration**: 8h
**Depends**: MoX-SHELL-001

**Files**:
- Create: `src/cli/cmd/tui/component/dialog-bookmarks.tsx`
- Create: `src/cli/cmd/tui/hooks/useBookmarks.ts`

---

### Task: MoX-SHELL-005 | Scroll Position Memory
**Location**: `src/cli/cmd/tui/hooks/useScrollMemory.ts`
**Type**: New hook
**Duration**: 4h

**Files**:
- Create: `src/cli/cmd/tui/hooks/useScrollMemory.ts`

---

### Task: MoX-SHELL-006 | Improved Empty States
**Location**: `src/cli/cmd/tui/routes/home.tsx`
**Type**: UI enhancement
**Duration**: 6h

---

## Stream 2: Usage Guard (Agent-Shell Native)

### Task: MoX-GUARD-001 | Usage Collector (TypeScript)
**Location**: `src/usage/collector.ts`
**Type**: New module
**Duration**: 16h

**Note**: Port logic from openusage/ccusage patterns to TypeScript

**Files**:
- Create: `src/usage/collector.ts`
- Create: `src/usage/types.ts`
- Create: `src/usage/parsers/opencode.ts`
- Create: `src/usage/parsers/claude.ts`
- Create: `src/usage/parsers/codex.ts`

**Reads from**:
- `~/.allternit/cache/usage/` (usage snapshots)
- Session message tokens (in-memory)

**Calculates**:
- context_ratio = tokens_used / context_window
- slope (Δ per minute)

---

### Task: MoX-GUARD-002 | TUI Context Integration
**Location**: `src/cli/cmd/tui/context/usage.tsx`
**Type**: New context provider
**Duration**: 8h
**Depends**: MoX-GUARD-001

**Files**:
- Create: `src/cli/cmd/tui/context/usage.tsx`

**Exposes**:
```typescript
const usage = useUsage() // Returns UsageSnapshot
// Updates every 5 seconds
```

---

### Task: MoX-GUARD-003 | Enhanced Status Bar
**Location**: `src/ui/allternit/status-bar.tsx`
**Type**: Modify existing
**Duration**: 6h
**Depends**: MoX-GUARD-002

**Display**:
```
Context: 63% ▲+4%/m | Guard: OK
```

**Color coding**:
- Green (<70%), Yellow (70-85%), Orange (85-92%), Red (>92%)

---

### Task: MoX-GUARD-004 | Guard Policy Engine
**Location**: `src/guard/engine.ts`
**Type**: New module
**Duration**: 12h
**Depends**: MoX-GUARD-002

**Files**:
- Create: `src/guard/engine.ts`
- Create: `src/guard/policy.ts`

**Thresholds**:
```typescript
const THRESHOLDS = {
  warn: 0.70,      // Yellow banner
  compact: 0.85,   // Orange + auto-compact
  handoff: 0.92,   // Red + auto-handoff
}
```

**Emits events**:
- `Allternit_GUARD_WARN`
- `Allternit_GUARD_COMPACT`
- `Allternit_GUARD_HANDOFF`

---

### Task: MoX-GUARD-005 | Guard Banners
**Location**: `src/ui/allternit/guard-banner.tsx`
**Type**: New component
**Duration**: 6h
**Depends**: MoX-GUARD-004

---

### Task: MoX-GUARD-006 | Usage Details Dialog (Hotkey U)
**Location**: `src/cli/cmd/tui/component/dialog-usage.tsx`
**Type**: New component
**Duration**: 8h
**Depends**: MoX-GUARD-002

**Shows**:
- Token breakdown
- Context window bar
- Estimated cost
- Historical graph

---

## Stream 3: Continuity (Agent-Shell Native)

### Task: MoX-CONT-001 | Compaction Engine (TypeScript)
**Location**: `src/continuity/compaction.ts`
**Type**: New module
**Duration**: 20h

**Note**: Port cli-continues baton logic to TypeScript

**Files**:
- Create: `src/continuity/baton.ts` (SessionContext types)
- Create: `src/continuity/compaction.ts` (markdown generation)
- Create: `src/continuity/handoff.ts` (handoff trigger)

**Writes to**:
- `/.allternit/compact/compact-*.md`
- `/.allternit/handoff/latest.md`
- `/.allternit/state/state.json`

---

### Task: MoX-CONT-002 | Manual Compaction (Hotkey C)
**Location**: `src/cli/cmd/tui/routes/session/index.tsx`
**Type**: Keyboard handler
**Duration**: 6h
**Depends**: MoX-CONT-001

---

### Task: MoX-CONT-003 | Handoff Dialog (Hotkey H)
**Location**: `src/cli/cmd/tui/component/dialog-handoff.tsx`
**Type**: New component
**Duration**: 8h
**Depends**: MoX-CONT-001

**Note**: May spawn Rust CLI as subprocess for actual handoff

---

### Task: MoX-CONT-004 | Baton Viewer
**Location**: `src/cli/cmd/tui/component/baton-viewer.tsx`
**Type**: New component
**Duration**: 8h
**Depends**: MoX-CONT-001

---

## Dependency DAG

```
Stream 1: TUI Foundation (All parallel)
├── MoX-SHELL-001 (Collapsible)
├── MoX-SHELL-002 (Search) ──► MoX-SHELL-004 (Bookmarks)
├── MoX-SHELL-003 (Copy Code)
├── MoX-SHELL-005 (Scroll Memory)
└── MoX-SHELL-006 (Empty States)

Stream 2: Usage Guard
└── MoX-GUARD-001 (Collector)
    └── MoX-GUARD-002 (Context)
        ├── MoX-GUARD-003 (Status Bar)
        ├── MoX-GUARD-004 (Policy Engine)
        │   └── MoX-GUARD-005 (Banners)
        └── MoX-GUARD-006 (Usage Dialog)

Stream 3: Continuity
└── MoX-CONT-001 (Compaction Engine)
    ├── MoX-CONT-002 (Hotkey C)
    ├── MoX-CONT-003 (Handoff Dialog)
    └── MoX-CONT-004 (Baton Viewer)
```

## File Structure (Agent-Shell)

```
src/
├── cli/cmd/tui/
│   ├── component/
│   │   ├── dialog-search.tsx       # MoX-SHELL-002
│   │   ├── dialog-bookmarks.tsx    # MoX-SHELL-004
│   │   ├── dialog-usage.tsx        # MoX-GUARD-006
│   │   ├── dialog-handoff.tsx      # MoX-CONT-003
│   │   └── baton-viewer.tsx        # MoX-CONT-004
│   ├── context/
│   │   └── usage.tsx               # MoX-GUARD-002
│   ├── hooks/
│   │   ├── useMessageState.ts      # MoX-SHELL-001
│   │   ├── useSearch.ts            # MoX-SHELL-002
│   │   ├── useBookmarks.ts         # MoX-SHELL-004
│   │   └── useScrollMemory.ts      # MoX-SHELL-005
│   └── routes/
│       ├── home.tsx                # MoX-SHELL-006
│       └── session/index.tsx       # MoX-SHELL-001,003,005
├── ui/allternit/
│   ├── status-bar.tsx              # MoX-GUARD-003
│   └── guard-banner.tsx            # MoX-GUARD-005
├── usage/                          # MoX-GUARD-001
│   ├── collector.ts
│   ├── types.ts
│   └── parsers/
│       ├── opencode.ts
│       ├── claude.ts
│       └── codex.ts
└── continuity/                     # MoX-CONT-001
    ├── baton.ts
    ├── compaction.ts
    └── handoff.ts
```

## Total: 14 Tasks, 126 Hours

| Stream | Tasks | Hours |
|--------|-------|-------|
| TUI Foundation | 6 | 42h |
| Usage Guard | 6 | 56h |
| Continuity | 4 | 58h |
| **Total** | **16** | **156h** |

## All Code Stays in Agent-Shell

- ✅ TypeScript/SolidJS only
- ✅ No Rust crate creation
- ✅ All in `packages/allternit-shell/src/`
- ✅ May call external CLI as subprocess (handoff only)
