# Agent File Output Guidelines

**CRITICAL**: All agent-created files MUST go in `a2r-workspace/` (visible directory).

## ❌ NEVER DO

```bash
# NEVER write to repository root
touch NEW_PLAN.md                    # ❌ WRONG
touch spec/SPEC_new.md               # ❌ WRONG (direct to spec/)
touch docs/ANALYSIS.md               # ❌ WRONG (direct to docs/)
```

## ✅ CORRECT WORKFLOW

```bash
# 1. Create file in inbox/
touch a2r-workspace/inbox/PLAN_new_feature.md

# 2. Or use the staging tool
./bin/a2r-stage inbox PLAN_new_feature.md

# Human reviews and finalizes:
./bin/a2r-stage finalize a2r-workspace/output/specs/PLAN_new_feature.md
```

## Naming Convention

```
[PREFIX]_[descriptive-name].md
```

| Prefix | Type | Final Destination |
|--------|------|-------------------|
| `PLAN_` | Migration/implementation plans | `docs/plans/` or `docs_active/` |
| `SPEC_` | Specification drafts | `spec/` (numbered) |
| `PROG_` | Progress reports | `docs_active/` |
| `ANALYSIS_` | Analysis documents | `docs/` |
| `AUDIT_` | Audit reports | `docs/` |
| `N#_` | N-layer specific (N0-N8) | `docs_active/` |

## Workspace Structure

```
a2r-workspace/
├── inbox/              # ⬅️ CREATE FILES HERE
├── output/
│   ├── specs/          # Spec drafts
│   ├── docs/           # Doc drafts
│   └── progress/       # Work tracking
├── archive/            # Old files
├── receipts/           # Execution logs (auto)
├── artifacts/          # Generated files (auto)
└── ...
```

## Staging Commands

```bash
./bin/a2r-stage status              # View workspace status
./bin/a2r-stage inbox <file>        # Move to inbox
./bin/a2r-stage to-spec <file>      # Move to output/specs/
./bin/a2r-stage to-docs <file>      # Move to output/docs/
./bin/a2r-stage to-progress <file>  # Move to output/progress/
./bin/a2r-stage finalize <file>     # Move to permanent location
./bin/a2r-stage archive <file>      # Archive old file
```

## Root Directory Rules

**Human-maintained files only**:
- `README.md` - Project overview
- `ARCHITECTURE.md` - System architecture  
- `SYSTEM_LAW.md` - System laws
- `AGENTS.md` - This file
- `Cargo.toml`, `package.json` - Workspace configs

**No new root files without human approval.**
