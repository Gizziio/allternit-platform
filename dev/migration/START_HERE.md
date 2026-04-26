# Allternit Full Rebrand - Start Here

**Date:** 2026-04-04  
**Status:** Ready to Execute

---

## What You're About to Do

This is a **COMPLETE REBRAND** of the Allternit workspace from old `allternit/allternit` branding to new `allternit` branding.

**Scope:** Everything in `~/Desktop/allternit-workspace/allternit/`

---

## Quick Start

### Option 1: Run Master Script (Automated)

```bash
# 1. BACKUP FIRST (important!)
cd ~/Desktop
cp -R allternit-workspace allternit-workspace-backup-$(date +%Y%m%d)

# 2. Run the master rebrand script
cd ~/allternit-migration/scripts/
./11-full-rebrand.sh
```

### Option 2: Run Phases Manually

```bash
cd ~/allternit-migration/scripts/

# Phase 1: Directories and Files
./07-rename-workspace-dirs.sh

# Phase 2: Rust Code
./08-update-rust-code.sh

# Phase 3: TypeScript/JavaScript
./09-update-typescript.sh

# Phase 4: Build Scripts
./10-update-build-scripts.sh
```

### Option 3: Do It Manually

See `FULL_REBRAND_PLAN.md` for step-by-step manual instructions.

---

## What Gets Changed

| Component | Before | After |
|-----------|--------|-------|
| Data directory | `.allternit/` | `.allternit/` |
| CLI binary | `bin/allternit` | `bin/allternit` |
| Staging binary | `bin/allternit-stage` | `bin/allternit-stage` |
| NPM scope | `@allternit/*` | `@allternit/*` |
| Package names | `allternit-*` | `allternit-*` |
| Rust comments | `# Allternit` | `# Allternit` |
| Paths in code | `/tmp/allternit` | `/tmp/allternit` |
| Old workspace | `allternit-workspace/` | **DELETED** |

---

## Phases Breakdown

### Phase 1: Cleanup (Already Done ✓)
- ✅ Config directories renamed
- ✅ Documentation updated

### Phase 2: Directories & Files (Script: 07-rename-workspace-dirs.sh)
- Rename `.allternit` → `.allternit`
- Rename binaries (`allternit` → `allternit`)
- Delete old workspace
- Clean distribution files

### Phase 3: Rust Code (Script: 08-update-rust-code.sh)
- Update comments (`Allternit` → `Allternit`)
- Update paths (`allternit` → `allternit`)
- Update Cargo.toml files

### Phase 4: TypeScript/JavaScript (Script: 09-update-typescript.sh)
- Update imports (`@allternit/` → `@allternit/`)
- Update package.json files
- Update strings

### Phase 5: Build Scripts (Script: 10-update-build-scripts.sh)
- Update build scripts
- Update environment files
- Update configuration

---

## Critical: NPM Packages

**The scripts do NOT handle NPM package republishing.**

After running the scripts, you still need to:

1. **Republish packages** with `@allternit` scope:
   ```bash
   # For each package currently @allternit/*
   npm publish --access public
   ```

2. **Or use local overrides** during transition:
   ```json
   {
     "dependencies": {
       "@allternit/package": "file:./local-packages/package"
     }
   }
   ```

---

## Verification Checklist

After running scripts, verify:

```bash
cd ~/Desktop/allternit-workspace/allternit/

# 1. Check no allternit references
grep -r "allternit" --include="*.rs" --include="*.ts" . | grep -v node_modules | head -10

# 2. Check no @allternit references
grep -r "@allternit" --include="*.ts" --include="*.tsx" . | grep -v node_modules | head -10

# 3. Check binaries exist
ls -la bin/allternit

# 4. Check data directory
ls -la .allternit/

# 5. Test Rust build
cargo check

# 6. Test TS build
pnpm install
pnpm build
```

---

## Rollback

If something goes wrong:

```bash
# Stop everything
pkill -f allternit

# Restore from backup
cd ~/Desktop
rm -rf allternit-workspace
cp -R allternit-workspace-backup-YYYYMMDD allternit-workspace
```

---

## Timeline Estimate

| Phase | Time |
|-------|------|
| Backup | 10 min |
| Phase 2 (Directories) | 5 min |
| Phase 3 (Rust) | 30 min |
| Phase 4 (TypeScript) | 30 min |
| Phase 5 (Build Scripts) | 15 min |
| Verification | 30 min |
| **Total** | **~2 hours** |

---

## What You Need

- [ ] Terminal access
- [ ] 10GB free disk space (for backup)
- [ ] 2 hours uninterrupted time
- [ ] Rust toolchain installed
- [ ] Node.js/pnpm installed

---

## Questions?

See:
- `FULL_REBRAND_PLAN.md` - Detailed plan
- `REMAINING_REBRANDING_ISSUES.md` - What gets changed
- `ACTUAL_WORKSPACE_STRUCTURE.md` - Current workspace structure

---

## Ready?

**Start with backup:**
```bash
cp -R ~/Desktop/allternit-workspace ~/Desktop/allternit-workspace-backup-$(date +%Y%m%d)
```

**Then run:**
```bash
cd ~/allternit-migration/scripts/
./11-full-rebrand.sh
```

---

**Good luck!**
