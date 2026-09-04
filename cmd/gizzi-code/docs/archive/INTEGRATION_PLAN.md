# Integration Fix Plan: Claude + Gizzi

## Error Pattern Analysis

| Error Code | Count | Pattern | Root Cause |
|------------|-------|---------|------------|
| TS2307 | 7,183 | Cannot find module | Missing files (don't exist yet) |
| TS2339 | 2,585 | Property does not exist | Wrong exports (case sensitivity, missing methods) |
| TS2305 | 743 | Module has no exported member | Missing named exports from existing files |
| TS2322 | 1,613 | Type not assignable | Type definition mismatches |
| TS2786 | 714 | JSX element type errors | React component prop mismatches |
| TS2835 | 359 | Need .js extension | Import path issues |

## Phase 1: Path Resolution Infrastructure ✅

**Goal:** Ensure path aliases work correctly

**Tasks:**
1. ✅ Configure tsconfig.json with correct paths
2. ✅ Verify `@/runtime/*` maps to `src/runtime/*`
3. ✅ Verify `@/cli/*` maps to `src/cli/*`
4. Fix import extensions for NodeNext module resolution

**Status:** Configuration complete, but 359 files need .js extensions added

## Phase 2: Core Runtime Files (High Impact)

**Goal:** Create files with 50+ import references

**Priority Files:**
1. `@/runtime/util/log` (201 references) - ✅ Created
2. `@/runtime/util/filesystem` (90 references) - ✅ Created
3. `@/runtime/context/project/instance` (88 references) - ✅ Created
4. `@/cli/ui/tui/context/theme` (87 references) - Need to create
5. `@/runtime/context/global/global` (69 references) - ✅ Created
6. `@/cli/ui/tui/ui/dialog` (64 references) - Need to create
7. `@/runtime/bus/bus` (53 references) - Need to create
8. `@/cli/commands/cmd` (49 references) - Need to create
9. `@/runtime/context/config/config` (47 references) - Need to create
10. `@/cli/ui/tui/context/sync` (47 references) - Need to create

## Phase 3: Export Alignment

**Goal:** Fix case sensitivity and missing exports

**Issues Found:**
1. `src/runtime/util/log.ts` exports `log` (lowercase) but imports expect `Log` (uppercase)
2. `src/utils/config.ts` missing `getGlobalConfig` (5+ files need it)
3. `src/state/AppState.ts` missing `useSetAppState`, `useAppState`
4. Many files expect default exports but don't have them

**Fix Strategy:**
- Export both casings for compatibility
- Add missing exports to existing files
- Export all named exports as default

## Phase 4: CLI Infrastructure

**Goal:** Create CLI-specific utilities

**Missing Files:**
- `src/cli/utils/log.ts` - ✅ Created
- `src/cli/utils/debug.ts` - ✅ Created
- `src/cli/utils/errors.tsx` - ✅ Created
- `src/cli/utils/auth.ts` - ✅ Created
- `src/commands.ts` - ✅ Created

**Missing Exports to Add:**
- `logError` function in log.ts
- `toError` function in errors.ts
- `isUsing3PServices` in auth.ts
- `isClaudeAISubscriber` in auth.ts

## Phase 5: Command Directory Structure

**Goal:** Create command stubs for 30+ commands

Commands needing creation:
- `src/cli/commands/good-claude/index.ts`
- `src/cli/commands/commit.ts`
- `src/cli/commands/memory/index.ts`
- `src/cli/commands/logout/index.ts`
- `src/cli/commands/mobile/index.ts`
- `src/cli/commands/onboarding/index.ts`
- ... (25 more)

## Phase 6: Type Definition Alignment

**Goal:** Fix type mismatches

**Issues:**
- `src/buddy/types.ts` Theme type doesn't include 'inactive', 'success', etc.
- React component prop types mismatched
- Message type properties undefined issues

## Execution Strategy

### Wave 1: Fix Existing File Exports (Quick Wins)
- Add missing exports to files that exist
- Fix case sensitivity issues
- Add default exports

### Wave 2: Core Runtime (High Impact)
- Create top 20 most referenced files
- Each file creation eliminates 50-200 errors

### Wave 3: CLI Commands
- Create command stubs with proper exports
- Focus on files blocking commands-claude.ts

### Wave 4: UI Components
- Create Ink/React components
- Align prop types with usage

### Wave 5: Remaining Files
- Generate stubs for remaining files
- Auto-fix remaining issues

## Success Metrics

| Phase | Target Error Reduction |
|-------|----------------------|
| Wave 1 | -2,000 errors (export fixes) |
| Wave 2 | -3,000 errors (core files) |
| Wave 3 | -2,000 errors (commands) |
| Wave 4 | -1,500 errors (UI components) |
| Wave 5 | -1,000 errors (stubs) |
| **Total** | **~9,500 errors fixed** |

## Remaining Errors After Fix

Expected: ~6,000 errors remaining
These will be:
- Complex type mismatches requiring manual review
- Missing third-party types
- Actual bugs that need fixing
