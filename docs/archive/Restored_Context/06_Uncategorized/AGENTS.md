# Agent File Output Guidelines

**CRITICAL**: All agent-created files MUST go in `allternit-workspace/` (visible directory).

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
touch allternit-workspace/inbox/PLAN_new_feature.md

# 2. Or use the staging tool
./bin/allternit-stage inbox PLAN_new_feature.md

# Human reviews and finalizes:
./bin/allternit-stage finalize allternit-workspace/output/specs/PLAN_new_feature.md
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
allternit-workspace/
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
./bin/allternit-stage status              # View workspace status
./bin/allternit-stage inbox <file>        # Move to inbox
./bin/allternit-stage to-spec <file>      # Move to output/specs/
./bin/allternit-stage to-docs <file>      # Move to output/docs/
./bin/allternit-stage to-progress <file>  # Move to output/progress/
./bin/allternit-stage finalize <file>     # Move to permanent location
./bin/allternit-stage archive <file>      # Archive old file
```

## Root Directory Rules

**Human-maintained files only**:
- `README.md` - Project overview
- `ARCHITECTURE.md` - System architecture  
- `SYSTEM_LAW.md` - System laws
- `AGENTS.md` - This file
- `Cargo.toml`, `package.json` - Workspace configs

**No new root files without human approval.**
