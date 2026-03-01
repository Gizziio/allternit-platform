# ROLLBACK PLAN

This document contains the exact steps to restore the repository to its original state if needed.

## Backup Locations
- All audit files are in: `_reorg_audit/`
- Original directory structure is documented in: `_reorg_audit/before.tree.txt`

## Rollback Steps

### 1. Restore Directory Structure
If directories have been moved, use git to restore:
```bash
git checkout .
git clean -fd
```

### 2. Restore pnpm workspace
```bash
cp _reorg_audit/before.pnpm-workspace.yaml pnpm-workspace.yaml
```

### 3. Restore Cargo workspace
```bash
cp _reorg_audit/before.cargo-workspace.txt Cargo.toml  # if needed
```

### 4. Restore tsconfig paths
```bash
cp _reorg_audit/before.tsconfig.paths.json tsconfig.json  # if needed
```

### 5. Verify Build
```bash
pnpm install
pnpm typecheck
```

## Safety Checks
- All original files should be recoverable from git
- If git doesn't work, manual restoration from backups in `_reorg_audit/`
- Verify all original functionality works before proceeding with any irreversible changes