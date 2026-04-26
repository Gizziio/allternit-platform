# Documentation Structure Consolidation Plan

## Current Problem

| Location | Files | Purpose | Status |
|----------|-------|---------|--------|
| `docs/_active/` | 179 | Old agent workspace | ❌ REDUNDANT |
| `docs/_completed/` | 149 | Finished work | ⚠️ Overlap with `allternit-workspace/` |
| `docs/_archive/` | 805 | Archived docs | ⚠️ Massive bloat |
| `docs_active/` (root) | 3 | Orphaned | ❌ REDUNDANT |
| `allternit-workspace/output/` | 19 | New agent workspace | ✅ CURRENT |

**Total redundancy: 1,155 files in overlapping structures**

## Proposed Clean Structure

### 1. Human-Curated Documentation: `docs/`
```
docs/
├── README.md                    # Index
├── ARCHITECTURE.md             # (move from root if needed)
├── guides/                      # User guides
├── reference/                   # API reference
└── internal/                    # Internal docs (was _active)
    └── README.md               # Index of internal docs
```

**NO `_active`, `_completed`, `_archive` subdirs**

### 2. Agent Workspace: `allternit-workspace/` (EXISTS)
```
allternit-workspace/
├── inbox/                       # New agent files
├── output/
│   ├── specs/                   # Draft specs → spec/
│   ├── docs/                    # Draft docs → docs/
│   └── progress/                # Work tracking → review → archive
├── archive/                     # Old agent outputs (clean monthly)
├── receipts/                    # Execution logs
├── artifacts/                   # Generated files
└── ...                          # System dirs
```

### 3. Specifications: `spec/` (EXISTS, numbered)
```
spec/
├── 1_contracts/
├── 2_architecture/
├── ...
└── (numbered specs from output/specs/)
```

### 4. Active Work Tracking: `docs_active/` → MERGE
Move contents to `allternit-workspace/output/progress/`

## Migration Plan

### Phase 1: Deduplicate Root
```bash
# Move docs_active/ contents
mv docs_active/* allternit-workspace/output/progress/
rmdir docs_active/
```

### Phase 2: Clean docs/_archive/
```bash
# Review and delete old files
# Keep only: evergreen reference, important decisions
# Delete: old progress reports, outdated plans
# Target: 805 → ~50 files
```

### Phase 3: Merge docs/_active/ → allternit-workspace/
```bash
# Recent active work → allternit-workspace/output/progress/
# Old active work → allternit-workspace/archive/ or delete
```

### Phase 4: Review docs/_completed/
```bash
# Keep important: specs, architecture decisions
# Move to archive: progress reports, old plans
```

### Phase 5: Simplify docs/ structure
```bash
# Remove _active, _completed, _archive subdirs
# Keep only curated, current documentation
# Move useful content to appropriate locations
```

## Decision Matrix

| If file is... | Move to | Example |
|---------------|---------|---------|
| Agent progress report | `allternit-workspace/output/progress/` | `N5_execution_final.md` |
| Spec draft | `allternit-workspace/output/specs/` → `spec/` | `SPEC_protocol.md` |
| Architecture decision | `docs/internal/` | `ARCHITECTURE_v2.md` |
| Outdated progress | `allternit-workspace/archive/` or delete | `PROG_week1_old.md` |
| Evergreen reference | Keep in `docs/` | `API_REFERENCE.md` |
| Generated artifact | `allternit-workspace/artifacts/` | diagram.png |

## Final State

| Directory | Purpose | Owner |
|-----------|---------|-------|
| `docs/` | Curated human docs | Humans |
| `allternit-workspace/` | Agent outputs, drafts | Agents → Humans review |
| `spec/` | Numbered specifications | Humans |
| `allternit-workspace/archive/` | Old agent outputs | Auto-cleaned |

**No more `_active`, `_completed`, `_archive` in docs/**
