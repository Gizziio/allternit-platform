# Allternit Full Rebrand - Complete Migration Plan

**Date:** 2026-04-04  
**Scope:** Complete workspace rebrand (Option B)  
**Estimated Time:** 4-6 hours  
**Risk Level:** HIGH (touches build system)

---

## Pre-Migration Checklist

- [ ] Close all IDE windows (VSCode, Cursor, etc.)
- [ ] Stop all running services
- [ ] Close Terminal tabs using the workspace
- [ ] Backup workspace: `cp -R allternit-workspace allternit-workspace-backup-$(date +%Y%m%d)`
- [ ] Ensure 10GB free disk space
- [ ] Set aside 4-6 hours uninterrupted

---

## Phase 1: Cleanup & Preparation (30 min)

### 1.1 Remove Old Workspace
```bash
rm -rf ~/Desktop/allternit-workspace
```

### 1.2 Create Backup
```bash
cd ~/Desktop
cp -R allternit-workspace allternit-workspace-backup-$(date +%Y%m%d)
```

### 1.3 Stop Services
```bash
# Kill any running allternit processes
pkill -f "allternit"
pkill -f "allternit"

# Unload launch agents
launchctl unload ~/Library/LaunchAgents/com.allternit.* 2>/dev/null || true
```

---

## Phase 2: Directory & File Renames (1 hour)

### 2.1 Rename Data Directory
```bash
cd ~/Desktop/allternit-workspace/allternit/
mv .allternit .allternit
```

### 2.2 Rename Binaries
```bash
cd ~/Desktop/allternit-workspace/allternit/bin/
mv allternit allternit
mv allternit-stage allternit-stage
mv a2-test allternit-test
```

### 2.3 Clean Old Distribution Files
```bash
cd ~/Desktop/allternit-workspace/allternit/distribution/
rm -f allternit-platform-*.tar.gz
rm -f allternit.sh
```

### 2.4 Rename Documentation
```bash
cd ~/Desktop/allternit-workspace/allternit/docs/
mv MCP_APPS_Allternit_INTEGRATION.md MCP_APPS_ALLTERNIT_INTEGRATION.md
```

---

## Phase 3: Code Updates - Rust (1.5 hours)

### 3.1 Update Rust Crate Names

Files to update in each `Cargo.toml`:
```toml
# OLD
name = "allternit-*"
# NEW
name = "allternit-*"
```

Crates to rename:
- `allternit-session-manager` → `allternit-session-manager` (already done)
- `allternit-vm-executor` → `allternit-vm-executor` (already done)
- Check all crates in `domains/kernel/service/`

### 3.2 Update Rust Source Code

Update in all `.rs` files:
```rust
// OLD comments
//! # Allternit Session Manager

// NEW comments  
//! # Allternit Session Manager

// OLD paths
let path = dirs::data_dir().map(|d| d.join("allternit"));

// NEW paths
let path = dirs::data_dir().map(|d| d.join("allternit"));
```

Files to check:
- `domains/kernel/service/*/src/*.rs`
- `domains/agent-swarm/*/src/*.rs`
- `api/kernel/*/src/*.rs`

### 3.3 Update Cargo.toml Workspace References

Check `Cargo.toml` for old crate names and update.

---

## Phase 4: Code Updates - TypeScript/JavaScript (1.5 hours)

### 4.1 Update Package Names

In all `package.json` files, update:
```json
{
  "name": "@allternit/package-name"
}
// TO:
{
  "name": "@allternit/package-name"
}
```

### 4.2 Update Imports

In all `.ts`, `.tsx`, `.js` files:
```typescript
// OLD
import { something } from '@allternit/package-name';

// NEW
import { something } from '@allternit/package-name';
```

### 4.3 Update References

Update strings referencing old branding:
```typescript
// OLD
const BRAND = "Allternit";
const DOMAIN = "allternit.io";

// NEW
const BRAND = "Allternit";
const DOMAIN = "allternit.com";
```

---

## Phase 5: Build Scripts & Configuration (1 hour)

### 5.1 Update Build Scripts

Update all scripts in `distribution/`:
- `build-electron.sh`
- `build-app-bundle.sh`
- `build-portable.sh`
- `build-single-binary.sh`
- `build.sh`

Changes needed:
- Update binary names (`allternit` → `allternit`)
- Update directory references (`.allternit` → `.allternit`)
- Update package names

### 5.2 Update Environment Files

Check and update:
- `.env`
- `.env.example`
- `.env.local` files

### 5.3 Update Config Files

Update any config files referencing old paths:
- `.allternit/` → `.allternit/` (inside the renamed dir)
- Path references in config

---

## Phase 6: Verification & Testing (1 hour)

### 6.1 Verify No Old References
```bash
cd ~/Desktop/allternit-workspace/allternit/

# Check for remaining allternit references
grep -r "allternit" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules | grep -v ".git" | head -20

# Check for Allternit references
grep -r "Allternit" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules | head -20
```

### 6.2 Test Build
```bash
cd ~/Desktop/allternit-workspace/allternit/

# Test Rust build
cargo check

# Test TypeScript build (if applicable)
pnpm install
pnpm build
```

### 6.3 Test Binaries
```bash
./bin/allternit --help
./bin/allternit-stage --help
```

---

## Phase 7: Post-Migration (30 min)

### 7.1 Update Shell Aliases
```bash
# Update .zshrc or .bashrc
alias allternit='allternit'
```

### 7.2 Update IDE Workspaces
- Reopen workspace in VSCode/Cursor
- Reindex files
- Update run configurations

### 7.3 Restart Services
```bash
# Reload launch agents
launchctl load ~/Library/LaunchAgents/com.allternit.* 2>/dev/null || true
```

### 7.4 Clean Up
```bash
# Remove backup after verification (optional)
rm -rf ~/Desktop/allternit-workspace-backup-YYYYMMDD
```

---

## Rollback Plan

If issues occur:
```bash
# Stop everything
pkill -f allternit

# Restore from backup
cd ~/Desktop
rm -rf allternit-workspace
cp -R allternit-workspace-backup-YYYYMMDD allternit-workspace

# Reload old launch agents
launchctl load ~/Library/LaunchAgents/com.allternit.* 2>/dev/null || true
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Build breaks | Full backup before starting |
| NPM packages fail | Keep @allternit packages available during transition |
| Runtime errors | Test each phase before proceeding |
| IDE confusion | Close all editors during migration |
| Data loss | Multiple backups at each phase |

---

## Scripts Available

See `~/allternit-migration/scripts/`:
- `07-rename-workspace-dirs.sh` - Phase 2
- `08-update-rust-code.sh` - Phase 3
- `09-update-typescript.sh` - Phase 4
- `10-update-build-scripts.sh` - Phase 5
- `11-full-rebrand.sh` - Run all phases

---

## Success Criteria

- [ ] No `allternit` references in source code (except node_modules)
- [ ] No `Allternit` references in source code
- [ ] No `allternit` references
- [ ] Binaries renamed and working
- [ ] Data directory renamed
- [ ] Build completes successfully
- [ ] Tests pass
- [ ] Application launches

---

## Next Steps

1. **Review this plan**
2. **Decide on NPM package strategy** (see below)
3. **Run migration scripts** or do manually
4. **Verify and test**

---

## NPM Package Strategy

**Option A: Gradual Transition**
- Keep @allternit packages installed
- Add @allternit packages alongside
- Update imports incrementally
- Remove @allternit when complete

**Option B: Big Bang**
- Republish all @allternit as @allternit
- Update all imports at once
- Update package.json files
- Rebuild everything

**Recommendation:** Option A (gradual) is safer but takes longer. Option B (big bang) is riskier but cleaner.

---

**Ready to proceed?** Run the scripts or follow this plan manually.
