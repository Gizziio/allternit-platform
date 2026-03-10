# MoX DAG Tasks: TUI UX + Usage Guard Integration

## Executive Summary
This plan integrates:
1. **6 TUI UX improvements** (collapsible messages, search, bookmarks, etc.)
2. **Usage Guard** from spec (context monitoring, compaction, handoff)
3. **Existing infrastructure**:
   - `a2r-usage` platform (in `/a2rchitech/6-ui/a2r-platform/src/a2r-usage/`)
   - A2R CLI (in `/a2rchitech/7-apps/cli/`)
   - a2r-shell TUI (current workspace)

**Strategy**: Fork/wrap existing code rather than rebuild.

---

## External Dependencies (Fork/Integrate)

### 1. openusage → a2r-usage-collector
**Source**: External tool (opencode-stats, ccusage, tokscale patterns)
**Location**: New crate `crates/a2r-usage-collector/`
**What to Fork**:
- Provider-specific parsers (Claude, OpenCode, Codex, Copilot)
- Token counting algorithms
- OTel GenAI metrics format

**Integration Points**:
- Reads from: `~/.a2r/cache/usage/`
- Writes to: `/.a2r/usage/usage-*.json`
- Emits: OTel metrics to local collector

### 2. cli-continues → a2r-continuity
**Source**: Handoff/resume mechanism
**Location**: New crate `crates/a2r-continuity/`
**What to Fork**:
- Session serialization format
- Baton (handoff artifact) generation
- Cross-runner resume protocol

**Integration Points**:
- Reads from: `/.a2r/state/state.json`, `/.a2r/handoff/latest.md`
- Writes to: `/.a2r/compact/compact-*.md`
- Triggers: CLI exec for handoff

---

## MoX DAG Task Breakdown

### Stream 1: TUI Foundation (UX Improvements)

#### Task: MoX-TUI-001 | Collapsible Message Sections
**Status**: Ready
**Duration**: 8h
**Assignee**: TBD
**Depends**: None
**Files**:
- `src/cli/cmd/tui/hooks/useMessageState.ts` (new)
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)
- `src/cli/cmd/tui/component/message-card.tsx` (modify)

**Acceptance**:
- [ ] Fold indicator (▶/▼) renders per message
- [ ] `Space` toggles fold on focused message
- [ ] Collapsed state persists to localStorage
- [ ] Visual: First 60 chars + "..." when collapsed

---

#### Task: MoX-TUI-002 | In-Session Text Search
**Status**: Ready
**Duration**: 12h
**Assignee**: TBD
**Depends**: MoX-TUI-001
**Files**:
- `src/cli/cmd/tui/component/dialog-search.tsx` (new)
- `src/cli/cmd/tui/hooks/useSearch.ts` (new)
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)

**Acceptance**:
- [ ] `/search` opens search dialog
- [ ] Fuzzy search across all message text
- [ ] Match highlighting with theme accent
- [ ] `n`/`N` navigates matches
- [ ] Shows "3/12" match counter

---

#### Task: MoX-TUI-003 | Copy Code Block Action
**Status**: Ready
**Duration**: 4h
**Assignee**: TBD
**Depends**: None
**Files**:
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)

**Acceptance**:
- [ ] `y` on focused code block copies content
- [ ] Toast confirmation: "Copied!"
- [ ] Works with keyboard only

---

#### Task: MoX-TUI-004 | Message Bookmarking
**Status**: Ready
**Duration**: 8h
**Assignee**: TBD
**Depends**: MoX-TUI-001
**Files**:
- `src/cli/cmd/tui/component/dialog-bookmarks.tsx` (new)
- `src/cli/cmd/tui/hooks/useBookmarks.ts` (new)
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)

**Acceptance**:
- [ ] `m` toggles bookmark on message
- [ ] Bookmark indicator (🔖) in gutter
- [ ] `/bookmarks` opens bookmark list
- [ ] Persist bookmarks per session

---

#### Task: MoX-TUI-005 | Scroll Position Memory
**Status**: Ready
**Duration**: 4h
**Assignee**: TBD
**Depends**: None
**Files**:
- `src/cli/cmd/tui/hooks/useScrollMemory.ts` (new)
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)

**Acceptance**:
- [ ] Store scroll offset on session switch
- [ ] Restore position when returning
- [ ] Smooth scroll animation

---

#### Task: MoX-TUI-006 | Improved Empty States
**Status**: Ready
**Duration**: 6h
**Assignee**: TBD
**Depends**: None
**Files**:
- `src/cli/cmd/tui/routes/home.tsx` (modify)

**Acceptance**:
- [ ] Visual A2R logo illustration
- [ ] Clear CTA buttons
- [ ] Quick-start templates
- [ ] Progressive disclosure

---

### Stream 2: Usage Infrastructure (Fork/Integrate)

#### Task: MoX-USAGE-001 | Fork openusage → a2r-usage-collector
**Status**: Ready
**Duration**: 16h
**Assignee**: TBD
**Depends**: None
**Files**: New crate `crates/a2r-usage-collector/`

**What to Port**:
```
From: openusage/ccusage/tokscale patterns
To: crates/a2r-usage-collector/
  - src/parsers/
    - claude.rs      (ccusage patterns)
    - opencode.rs    (opencode stats)
    - codex.rs       (codex patterns)
    - copilot.rs     (copilot patterns)
  - src/metrics.rs   (OTel GenAI format)
  - src/snapshot.rs  (UsageSnapshot type)
```

**Acceptance**:
- [ ] Parses provider-specific usage data
- [ ] Emits OTel GenAI metrics
- [ ] Calculates context_ratio
- [ ] Writes to `~/.a2r/cache/usage/`

---

#### Task: MoX-USAGE-002 | Integrate Usage Collector with TUI
**Status**: Blocked on MoX-USAGE-001
**Duration**: 8h
**Assignee**: TBD
**Depends**: MoX-USAGE-001
**Files**:
- `src/usage/collector.ts` (new)
- `src/cli/cmd/tui/context/usage.tsx` (new)

**Acceptance**:
- [ ] TUI subscribes to usage snapshots
- [ ] Updates every 5 seconds
- [ ] Exposes `useUsage()` hook

---

### Stream 3: Continuity (Fork/Integrate)

#### Task: MoX-CONT-001 | Fork cli-continues → a2r-continuity
**Status**: Ready
**Duration**: 20h
**Assignee**: TBD
**Depends**: None
**Files**: New crate `crates/a2r-continuity/`

**What to Port**:
```
From: cli-continues patterns
To: crates/a2r-continuity/
  - src/baton.rs      (SessionContext/Baton)
  - src/compact.rs    (Compaction engine)
  - src/handoff.rs    (Handoff actuator)
  - src/state.rs      (State management)
```

**Artifacts**:
- `/.a2r/receipts/receipt.jsonl` (append-only)
- `/.a2r/state/state.json`
- `/.a2r/handoff/latest.md`
- `/.a2r/compact/compact-*.md`

**Acceptance**:
- [ ] Can generate baton from session
- [ ] Compaction produces markdown
- [ ] Handoff writes correct artifacts
- [ ] Resume reads baton correctly

---

#### Task: MoX-CONT-002 | TUI Baton Visualization
**Status**: Blocked on MoX-CONT-001
**Duration**: 8h
**Assignee**: TBD
**Depends**: MoX-CONT-001
**Files**:
- `src/cli/cmd/tui/component/baton-viewer.tsx` (new)

**Acceptance**:
- [ ] Reads `/.a2r/handoff/latest.md`
- [ ] Renders baton sections:
  - Objective
  - Progress summary
  - Files changed
  - Next actions
- [ ] Option to resume from baton

---

### Stream 4: Guard Integration (Policy Engine)

#### Task: MoX-GUARD-001 | Guard Policy Engine
**Status**: Blocked on MoX-USAGE-001, MoX-CONT-001
**Duration**: 12h
**Assignee**: TBD
**Depends**: MoX-USAGE-001, MoX-CONT-001
**Files**:
- `src/guard/policy.ts` (new)
- `src/guard/engine.ts` (new)

**Thresholds**:
```typescript
const DEFAULT_THRESHOLDS = {
  warn: 0.70,      // Yellow: Compaction recommended
  compact: 0.85,   // Orange: Force compaction
  handoff: 0.92,   // Red: Force handoff
}
```

**Actions**:
- **WARN**: Emit event, TUI shows banner
- **COMPACT**: Auto-trigger compaction
- **HANDOFF**: Compact + trigger handoff

**Acceptance**:
- [ ] Evaluates context_ratio against thresholds
- [ ] Emits guard events (A2R_GUARD_WARN, etc.)
- [ ] Triggers correct actions
- [ ] Configurable thresholds

---

#### Task: MoX-GUARD-002 | Enhanced Status Bar
**Status**: Blocked on MoX-GUARD-001
**Duration**: 6h
**Assignee**: TBD
**Depends**: MoX-GUARD-001
**Files**:
- `src/ui/a2r/status-bar.tsx` (modify)

**Display**:
```
Model: gpt-5.2 | Context: 63% ▲+4%/m | Guard: OK | Session: abc123
```

**Color coding**:
- Green: <70%
- Yellow: 70-85%
- Orange: 85-92%
- Red: >92%

**Acceptance**:
- [ ] Shows context ratio
- [ ] Shows slope (Δ/min)
- [ ] Shows guard state
- [ ] Color-coded indicators

---

#### Task: MoX-GUARD-003 | Guard Banners
**Status**: Blocked on MoX-GUARD-001
**Duration**: 6h
**Assignee**: TBD
**Depends**: MoX-GUARD-001
**Files**:
- `src/ui/a2r/guard-banner.tsx` (new)
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)

**Banners**:
- **WARN** (≥70%): Yellow "Compaction recommended" (hotkey: C)
- **COMPACT** (≥85%): Orange "Compacting..." (auto)
- **HANDOFF** (≥92%): Red "Handoff required" (auto)

**Acceptance**:
- [ ] Banner appears at threshold
- [ ] Correct color per level
- [ ] Hotkey works for manual

---

#### Task: MoX-GUARD-004 | Usage Details Dialog
**Status**: Blocked on MoX-USAGE-002
**Duration**: 8h
**Assignee**: TBD
**Depends**: MoX-USAGE-002
**Files**:
- `src/cli/cmd/tui/component/dialog-usage.tsx` (new)

**Content**:
- Token breakdown (input/output/cache/tool)
- Context window progress bar
- Estimated cost
- Session duration
- Messages count
- Historical graph (10 snapshots)

**Acceptance**:
- [ ] `U` hotkey opens dialog
- [ ] Shows all metrics
- [ ] Updates live

---

#### Task: MoX-GUARD-005 | Manual Compaction (Hotkey C)
**Status**: Blocked on MoX-CONT-001
**Duration**: 6h
**Assignee**: TBD
**Depends**: MoX-CONT-001
**Files**:
- `src/cli/cmd/tui/routes/session/index.tsx` (modify)

**Flow**:
1. User presses `C`
2. Show "Compacting..." indicator
3. Call compaction engine
4. Show result summary
5. Option to continue with compacted context

**Acceptance**:
- [ ] `C` triggers compaction
- [ ] Progress indicator shown
- [ ] Result displayed

---

#### Task: MoX-GUARD-006 | Handoff Dialog (Hotkey H)
**Status**: Blocked on MoX-CONT-001
**Duration**: 8h
**Assignee**: TBD
**Depends**: MoX-CONT-001
**Files**:
- `src/cli/cmd/tui/component/dialog-handoff.tsx` (new)

**Content**:
- Target runner options
- Baton preview
- Confirmation required
- Progress during handoff

**Acceptance**:
- [ ] `H` opens handoff dialog
- [ ] Shows target options
- [ ] Confirms before executing
- [ ] Shows progress

---

## Dependency DAG

```
Stream 1: TUI Foundation (Parallelizable)
├── MoX-TUI-001 (Collapsible) ─┬── MoX-TUI-002 (Search)
│                              └── MoX-TUI-004 (Bookmarks)
├── MoX-TUI-003 (Copy Code)
├── MoX-TUI-005 (Scroll Memory)
└── MoX-TUI-006 (Empty States)

Stream 2: Usage Infrastructure
└── MoX-USAGE-001 (Fork openusage) ─── MoX-USAGE-002 (TUI Integration)
                                          │
Stream 3: Continuity                     │
└── MoX-CONT-001 (Fork cli-continues) ───┤
       │                                 │
       └── MoX-CONT-002 (Baton Viewer)   │
                                          │
Stream 4: Guard Integration               │
└── MoX-GUARD-001 (Policy) ◄─────────────┘
       │
       ├── MoX-GUARD-002 (Status Bar)
       ├── MoX-GUARD-003 (Banners)
       ├── MoX-GUARD-004 (Usage Dialog)
       ├── MoX-GUARD-005 (Manual Compact)
       └── MoX-GUARD-006 (Handoff Dialog)
```

## Execution Order

### Phase 1: Parallel Foundation (Week 1)
**Parallel tasks**:
- MoX-TUI-001 through MoX-TUI-006 (can all run in parallel)
- MoX-USAGE-001 (fork openusage)
- MoX-CONT-001 (fork cli-continues)

### Phase 2: Integration (Week 2)
**Sequential**:
- MoX-USAGE-002 (integrate usage)
- MoX-CONT-002 (baton viewer)

### Phase 3: Guard (Week 3)
**Sequential**:
- MoX-GUARD-001 (policy engine)
- MoX-GUARD-002 through MoX-GUARD-006 (can parallelize after 001)

## Total Estimates

| Stream | Tasks | Hours |
|--------|-------|-------|
| TUI Foundation | 6 | 42h |
| Usage Infra | 2 | 24h |
| Continuity | 2 | 28h |
| Guard Integration | 6 | 46h |
| **Total** | **16** | **140h** |

## Recommended Team

- **1 TUI Engineer**: Stream 1 (Week 1)
- **1 Systems Engineer**: Stream 2 + 3 (Week 1-2)
- **1 Integration Engineer**: Stream 4 (Week 2-3)

Or single developer: 3-4 weeks sequential.
