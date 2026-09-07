# Phase 2: Missing Dependency Audit
## Foundation Files Analysis

### Audit Scope
Analyzed 4 foundation nodes with highest fan-out:
1. `src/main.tsx` - Entry point
2. `src/Tool.ts` - Base tool class
3. `src/QueryEngine.ts` - Query orchestration
4. `src/commands.ts` - Command registry

---

## Audit Results

### Total Files in Claude Landing
- **1,884** TypeScript files landed

### Missing Dependencies Identified

#### Category 1: Missing Command Modules (17 files)
These command directories have `index.js` but not `index.ts`:

| Missing Import | Status |
|----------------|--------|
| `./commands/ant-trace/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/autofix-pr/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/backfill-sessions/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/break-cache/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/bughunter/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/ctx_viz/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/debug-tool-call/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/env/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/good-claude/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/issue/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/mock-limits/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/oauth-refresh/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/onboarding/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/perf-issue/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/reset-limits/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/share/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/summary/index.js` | Has `index.js`, missing `index.ts` |
| `./commands/teleport/index.js` | Has `index.js`, missing `index.ts` |

**Root Cause:** These directories have `index.js` files but imports expect `.ts` files.

#### Category 2: Missing Core Type Files (4 files)

| Missing Import | Impact |
|----------------|--------|
| `./types/message.js` | **CRITICAL** - Used everywhere |
| `./types/tools.js` | High - Tool system |
| `./types/utils.js` | Medium - Utilities |
| `./constants/querySource.js` | Medium - Query engine |

---

## Dependency Graph Summary

### main.tsx Fan-Out
- **Total imports:** ~60 internal modules
- **Missing:** 21 (mostly command index files + core types)
- **Present:** ~39

### Tool.ts Fan-Out
- **Total imports:** ~20 type imports
- **Missing:** types/message.js, types/tools.js
- **Present:** ~18

### QueryEngine.ts Fan-Out
- **Total imports:** ~25 internal modules
- **Missing:** types/message.js
- **Present:** ~24

### commands.ts Fan-Out
- **Total imports:** ~70 command modules
- **Missing:** 18 command index files
- **Present:** ~52

---

## Missing 20% Breakdown

| Category | Count | Priority |
|----------|-------|----------|
| Command index files | 18 | Low (commands work without them) |
| Core type files | 4 | **CRITICAL** |
| Constants | 1 | Medium |

**Total Missing:** ~23 files (1.2% of 1,884)

**Note:** The "20% missing" mentioned earlier appears to be:
1. Some files are `.js` instead of `.ts` (source mismatch)
2. The SDK directory (`src/sdk/`) we created earlier is not in Claude source
3. Some utility files may be missing in deeper dependency trees

---

## Critical Path to Build

### Phase 2A: Fix Core Types (Must Have)
1. Create `src/types/message.ts`
2. Create `src/types/tools.ts`
3. Create `src/types/utils.ts`
4. Create `src/constants/querySource.ts`

### Phase 2B: Fix Command Indices (Nice to Have)
- Rename or create `index.ts` for the 18 command directories
- OR update imports to use `.js` extension

### Phase 2C: Deep Dependency Audit
- Run `tsc --noEmit` to find all missing dependencies
- Analyze imports in all 1,884 files
- Build complete dependency tree

---

## Reconstruction Sources

| Missing File | Source Options |
|--------------|----------------|
| `types/message.ts` | Gizzi Code has message types |
| `types/tools.ts` | Gizzi Code has tool types |
| `types/utils.ts` | May need fresh implementation |
| `constants/querySource.ts` | May need fresh implementation |

---

## Next Steps

1. **Extract types from Gizzi Code** - `gizzi-code/src/types/`
2. **Map Claude's type expectations** - Analyze what properties/methods are expected
3. **Create type shims** - Minimal implementations to get to compile state
4. **Full type check** - Run `tsc --noEmit` on all 1,884 files
5. **Identify deeper missing deps** - What do the type files import?

---

## Immediate Action

Check if Gizzi Code has compatible types:

```bash
ls /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code/src/types/
grep -r "Message" /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code/src/types/ | head -10
```
