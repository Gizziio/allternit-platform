# Archive Review Guide

The `archive/` directory contains 805 files from old structures.
**Review before permanent deletion.**

## Archive Contents

```
archive/
├── _audit/                     # Audit records with analysis
├── audit_/                     # A2R audit outputs (sessions, memory)
│   ├── a2r-audit-output/
│   ├── a2r-sessions-output/
│   └── a2rchitech_memory_v2_full/
├── audit-legacy/               # Legacy audit files
├── cleanup-audits/             # Cleanup operation records
├── issues/                     # Old issue tracking
├── legacy-specs/               # Old specifications
│   ├── a2r-phase0-input/
│   ├── a2rchitech-notice/
│   ├── organized/
│   └── tasks/
├── migration/                  # Migration records
├── orphaned-plans/             # Abandoned/abandoned plans
├── session-transcripts/        # Session logs and transcripts
│   ├── a2r chatgpt sessions fo integration/
│   └── unfinished/
├── vault-files/                # Vault contents
└── workspace-legacy/           # Old workspace data
    ├── finished/
    └── ongoing/
```

## Review Strategy

### 1. Quick Wins (Safe to Delete)
- Old session transcripts (if captured elsewhere)
- Duplicate audit outputs
- Cleanup operation logs (old)
- Empty or near-empty directories

### 2. Review Carefully (May Contain Value)
- `legacy-specs/` - May have early design decisions
- `orphaned-plans/` - May have good ideas that were abandoned
- `migration/` - Historical migration records
- `vault-files/` - May contain important stored data

### 3. Keep (Historical Value)
- `_audit/analysis/` - Audit analysis may be reference
- `workspace-legacy/finished/` - Completed work history

## Commands to Review

```bash
# See what's in a subdirectory
ls -la a2r-workspace/archive/legacy-specs/

# Count files in each top-level dir
for dir in a2r-workspace/archive/*/; do
    echo "$(basename $dir): $(find $dir -type f | wc -l) files"
done

# Find large files (potential value)
find a2r-workspace/archive -type f -size +100k

# Search for specific content
grep -r "important concept" a2r-workspace/archive/legacy-specs/
```

## Decision Log

As you review, document decisions here:

| Directory | Reviewed By | Decision | Date |
|-----------|-------------|----------|------|
| _audit/ | | | |
| audit_/ | | | |
| audit-legacy/ | | | |
| cleanup-audits/ | | | |
| issues/ | | | |
| legacy-specs/ | | | |
| migration/ | | | |
| orphaned-plans/ | | | |
| session-transcripts/ | | | |
| vault-files/ | | | |
| workspace-legacy/ | | | |
