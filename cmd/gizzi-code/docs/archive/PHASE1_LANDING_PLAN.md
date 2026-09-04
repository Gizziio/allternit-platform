# Phase 1: Full Claude Landing Plan
## Strict Preservation Protocol

### Goal
Land all Claude Code files into `gizzi-code/` with **minimal distortion**.
No architecture decisions. No relocation. No feature work.

---

## Landing Rules

### 1. What Stays Unchanged
- **File paths preserved exactly** (relative to `src/`)
- **File contents unchanged** (no edits, no patches)
- **Import statements unchanged** (broken imports are OK in Phase 1)
- **Directory structure mirrored exactly**

### 2. What CAN Be Patched During Landing
| Allowed | Example |
|---------|---------|
| Add `.js` extension to imports | `from './foo'` → `from './foo.js'` |
| Fix case sensitivity | `Import` → `import` |
| Add shebang if missing | `#!/usr/bin/env node` |

### 3. What Is FORBIDDEN During Landing
| Forbidden | Why |
|-----------|-----|
| Moving files to different paths | Breaks internal references |
| Editing file contents | Loses donor semantics |
| Fixing import paths to external deps | Phase 2 work |
| Creating new product code | Migration must not grow |
| Making architecture decisions | Decisions come after landing |
| Merging with Gizzi code | Convergence is Phase 4+ |

---

## Landing Location

```
gizzi-code/
├── src/                              # EXISTING GIZZI CODE (untouched)
│   └── (current working gizzi-code)
│
└── migration/                        # NEW - Phase 1 only
    └── claude/                       # Claude files land HERE
        ├── src/                      # Mirror of claude-code/src/
        │   ├── assistant/
        │   ├── bootstrap/
        │   ├── bridge/
        │   ├── buddy/
        │   ├── cli/
        │   ├── commands.ts           # Root-level files preserved
        │   ├── main.tsx              # Root-level preserved
        │   ├── QueryEngine.ts        # Root-level preserved
        │   ├── Tool.ts               # Root-level preserved
        │   ├── components/
        │   ├── screens/
        │   ├── services/
        │   ├── tools/
        │   ├── types/
        │   └── ... (all 1,962 files)
        │
        ├── package.json              # Claude's package.json (reference only)
        └── tsconfig.json             # Claude's tsconfig (reference only)
```

---

## Pre-Landing Audit Checklist

Before copying ANY file, verify:

### Step 1: Source Exists
```bash
# Verify each file exists in claude-code before claiming it
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code-claude

# Check claimed files actually exist:
ls -la src/assistant/sessionDiscovery.ts     # VERIFY BEFORE CLAIMING
ls -la src/services/compact/reactiveCompact.ts  # VERIFY
ls -la src/utils/featureFlags.ts             # VERIFY
ls -la src/sdk/allternit-api/                # VERIFY
```

### Step 2: List ACTUAL Files
```bash
# Generate verified file manifest
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | sort > /tmp/verified_claude_files.txt
wc -l /tmp/verified_claude_files.txt  # Actual count, not guess
```

### Step 3: Identify Foundation Nodes
Find files with highest fan-out (imported by many others):
```bash
# Top-level entry points
grep -r "from '../main'" src/ | wc -l
grep -r "from '../Tool'" src/ | wc -l
grep -r "from '../QueryEngine'" src/ | wc -l

# Most imported internal modules
grep -r "from './types" src/ | wc -l
grep -r "from './utils" src/ | wc -l
```

---

## Landing Procedure

### Phase 1A: Foundation Files (Hour 1)
Copy files that are imported by many others:

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd

# Create landing zone
mkdir -p gizzi-code/migration/claude/src

# Copy with PRESERVATION (not rsync -av, just cp -r)
cp -r gizzi-code-claude/src/* gizzi-code/migration/claude/src/

# Verify structure preserved
diff <(ls gizzi-code-claude/src | sort) <(ls gizzi-code/migration/claude/src | sort)
```

### Phase 1B: Verification (Hour 2)
Verify landing integrity:

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code/migration/claude

# Count files - should match source
find src -type f | wc -l
# Expected: [actual count from audit]

# Check for corruption
find src -type f -size 0  # Should be empty (no zero-byte files)

# Verify key foundation files preserved
test -f src/main.tsx && echo "OK: main.tsx"
test -f src/Tool.ts && echo "OK: Tool.ts"
test -f src/QueryEngine.ts && echo "OK: QueryEngine.ts"
```

---

## Forbidden During Phase 1

### Do NOT Create
- `src/migration/merged/`
- `src/migration/gizzi/`
- Any new product code
- Any "bridge" or "adapter" modules

### Do NOT Edit
- Import paths (even if broken)
- File contents
- Type definitions
- Export statements

### Do NOT Decide
- Final ownership
- Consolidation paths
- Architecture choices
- "Winner" of subsystems

---

## Success Criteria for Ending Phase 1

| Criterion | Verification |
|-----------|--------------|
| All files landed | `find migration/claude/src -type f \| wc -l` matches source |
| Structure preserved | `diff` of directory listings passes |
| No edits made | `git diff --stat` shows only new files, no modifications |
| No new code | `find migration/claude -name "*.ts" -newer [timestamp]` empty |
| Foundation files present | `main.tsx`, `Tool.ts`, `QueryEngine.ts` exist |

---

## Phase 1 Exit Condition

**Phase 1 ends when:**
1. All Claude files are in `migration/claude/src/`
2. Directory structure matches source exactly
3. Zero modifications to file contents
4. Audit manifest generated (actual file list)

**Phase 1 does NOT include:**
- Fixing any imports
- Making anything build
- Any architecture decisions
- Any consolidation

---

## Next Phase Preview (Not This Phase)

### Phase 2: Missing Dependency Reconstruction
- Identify what `main.tsx` needs that's missing
- Reconstruct using verified sources only
- Still no relocation, still in `migration/`

### Phase 3: Functional Parity
- Get `migration/claude/` to build
- Prove end-to-end behavior
- Still no relocation

### Phase 4: Model Selection
- NOW use the convergence matrix
- Decide canonical owners
- Plan final paths

### Phase 5: Consolidation
- Move to final locations
- Delete `migration/`

---

## Risk Mitigation

### Risk: Migration becomes permanent fork
**Mitigation:** Hard rule - no edits to `migration/claude/` after landing

### Risk: Uncertainty about what exists
**Mitigation:** Pre-landing audit - verify every claimed file

### Risk: Foundation files missing
**Mitigation:** Check `main.tsx`, `Tool.ts`, `QueryEngine.ts` exist BEFORE landing

---

## Immediate Next Action

1. **Run pre-landing audit** (verify claimed files exist)
2. **Generate verified manifest** (actual file list, not guess)
3. **Check foundation files** (main.tsx, Tool.ts, QueryEngine.ts)
4. **Execute landing** (copy with preservation)
5. **Verify landing** (structure intact, count matches)

**Only then proceed to Phase 2.**
