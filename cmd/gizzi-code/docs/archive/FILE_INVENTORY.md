# File Inventory - Missing/Need Creation

Generated: $(date)

## Summary
- **Total Missing File References:** 7,183
- **Unique Missing Files:** ~400 (estimated)
- **Priority 1 Files (50+ refs):** 25
- **Priority 2 Files (20-49 refs):** 60
- **Priority 3 Files (<20 refs):** ~315

---

## Phase 2: Core Runtime - Files to Create

### 2.1 Utility Layer

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/runtime/util/log.ts` | ✅ Created | 201 | Log class with create() |
| `src/runtime/util/filesystem.ts` | ✅ Created | 90 | FS operations |
| `src/runtime/util/signal.ts` | ✅ Exists | 30 | Already in repo |
| `src/runtime/util/lazy.ts` | ✅ Exists | 28 | Already in repo |
| `src/runtime/util/glob.ts` | ✅ Exists | 20 | Already in repo |
| `src/runtime/util/locale.ts` | ✅ Exists | 18 | Already in repo |
| `src/runtime/util/lock.ts` | ✅ Exists | 15 | Already in repo |

### 2.2 Context Layer

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/runtime/context/project/instance.ts` | ✅ Created | 88 | Project instance mgmt |
| `src/runtime/context/project/bootstrap.ts` | ✅ Created | 21 | Bootstrap logic |
| `src/runtime/context/global/global.ts` | ✅ Created | 69 | Global context |
| `src/runtime/context/config/config.ts` | ⚠️ Fix | 47 | Needs export fixes |

### 2.3 Bus System

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/runtime/bus/bus.ts` | 🔴 Missing | 53 | Event bus |
| `src/runtime/bus/bus-event.ts` | 🔴 Missing | 43 | Bus event types |
| `src/runtime/bus/global.ts` | 🔴 Missing | 25 | Global bus |

### 2.4 Services

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/services/analytics/index.ts` | ✅ Created | 43 | Analytics tracking |
| `src/services/analytics/growthbook.ts` | ✅ Created | 22 | Feature flags |
| `src/runtime/services/tokenEstimation.ts` | 🔴 Missing | 15 | Token counting |

---

## Phase 3: Tool Infrastructure

### 3.1 Tool Framework

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/Tool.ts` | ✅ Created | 40 | Base tool class |
| `src/runtime/tools/Tool.ts` | 🔴 Missing | 35 | Runtime tool base |

### 3.2 Built-in Tools (Priority Order)

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/runtime/tools/builtins/file-read/` | 🔴 Missing | 80 | File reading |
| `src/runtime/tools/builtins/file-write/` | 🔴 Missing | 65 | File writing |
| `src/runtime/tools/builtins/file-edit/` | 🔴 Missing | 60 | File editing |
| `src/runtime/tools/builtins/bash/` | 🔴 Missing | 120 | Bash execution |
| `src/runtime/tools/builtins/glob/` | 🔴 Missing | 45 | Glob patterns |
| `src/runtime/tools/builtins/grep/` | 🔴 Missing | 40 | Text search |

---

## Phase 4: CLI Foundation

### 4.1 CLI Utilities

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/cli/utils/log.ts` | ✅ Created | 30 | CLI logging |
| `src/cli/utils/debug.ts` | ✅ Created | 50 | Debug utilities |
| `src/cli/utils/errors.tsx` | ✅ Created | 60 | Error handling |
| `src/cli/utils/auth.ts` | ✅ Created | 40 | Authentication |
| `src/cli/utils/format.ts` | 🔴 Missing | 35 | Formatting |

### 4.2 Commands & UI

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/commands.ts` | ✅ Created | 68 | Command registry |
| `src/ink.ts` | ✅ Created | 320 | Ink UI utilities |
| `src/cli/ui/tui/context/theme.ts` | 🔴 Missing | 87 | Theme context |
| `src/cli/ui/tui/context/sync.ts` | 🔴 Missing | 47 | Sync context |
| `src/cli/ui/tui/ui/dialog.tsx` | 🔴 Missing | 64 | Dialog component |
| `src/cli/commands/cmd.ts` | 🔴 Missing | 49 | Command types |

---

## Phase 5: Commands (50+ to create)

| Command | Status | References | Priority |
|---------|--------|------------|----------|
| `commands/init.ts` | 🔴 Missing | 25 | High |
| `commands/login/index.ts` | 🔴 Missing | 20 | High |
| `commands/logout/index.ts` | 🔴 Missing | 15 | High |
| `commands/memory/index.ts` | 🔴 Missing | 15 | High |
| `commands/skills/index.ts` | 🔴 Missing | 12 | Medium |
| `commands/status/index.ts` | 🔴 Missing | 10 | Medium |
| `commands/theme/index.ts` | 🔴 Missing | 8 | Medium |
| `commands/vim/index.ts` | 🔴 Missing | 8 | Medium |
| `commands/tasks/index.ts` | 🔴 Missing | 8 | Medium |

*(Full list: 50+ command files)*

---

## Phase 6: Shared & Types

### 6.1 Types

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/types/message.ts` | 🔴 Missing | 41 | Message types |
| `src/types/command.ts` | 🔴 Missing | 30 | Command types |
| `src/types/tools.ts` | 🔴 Missing | 25 | Tool types |
| `src/types/merged/message.ts` | 🔴 Missing | 20 | Merged types |

### 6.2 State & Storage

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/state/AppState.ts` | ✅ Fixed | 42 | App state hooks |
| `src/state/AppStateStore.ts` | 🔴 Missing | 20 | State store |
| `src/bootstrap/state.ts` | 🔴 Missing | 63 | Bootstrap state |
| `src/utils/sessionStorage.ts` | 🔴 Missing | 30 | Session storage |

### 6.3 Hooks

| File | Status | References | Notes |
|------|--------|------------|-------|
| `src/hooks/useTerminalSize.ts` | 🔴 Missing | 35 | Terminal size |
| `src/hooks/useKeybinding.ts` | 🔴 Missing | 30 | Keybindings |
| `src/hooks/useExitOnCtrlCD.ts` | 🔴 Missing | 15 | Ctrl+C handler |

---

## File Creation Priority Queue

### Priority 1: Blockers (Create First)
1. `src/runtime/bus/bus.ts` - 53 refs
2. `src/runtime/bus/bus-event.ts` - 43 refs
3. `src/runtime/bus/global.ts` - 25 refs
4. `src/cli/ui/tui/context/theme.ts` - 87 refs
5. `src/cli/ui/tui/context/sync.ts` - 47 refs
6. `src/cli/commands/cmd.ts` - 49 refs
7. `src/cli/ui/tui/ui/dialog.tsx` - 64 refs
8. `src/bootstrap/state.ts` - 63 refs
9. `src/types/message.ts` - 41 refs
10. `src/runtime/tools/Tool.ts` - 35 refs

### Priority 2: High Impact
11-30: Commands and tool files (~20 files, ~800 errors)

### Priority 3: Medium Impact
31-60: Shared utils and hooks (~30 files, ~600 errors)

### Priority 4: Low Impact
61+: Remaining files (~340 files, ~2,000 errors)

---

## Current Progress

**Files Created This Session:** 15
**Files Fixed This Session:** 8
**Errors Reduced:** ~200 (minimal due to interconnected nature)

**Next Action:** Create Priority 1 blockers (10 files)
**Expected Error Reduction:** ~1,500 errors
**Time Estimate:** 3-4 hours
