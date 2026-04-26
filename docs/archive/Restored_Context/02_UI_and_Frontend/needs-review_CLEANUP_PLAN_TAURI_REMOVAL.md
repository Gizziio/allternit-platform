# Tauri Cleanup Plan

**Created**: 2024-01-16
**Status**: Phase 5 - Gated on Acceptance
**Based on Ledger**: `TAURI_TO_ELECTRON_LEDGER.md`

---

## Pre-Cleanup Checklist

Before removing any Tauri code, verify:

- [ ] `apps/shell-electron/` exists and builds
- [ ] All acceptance tests pass (`ACCEPTANCE_TESTS_ELECTRON.md`)
- [ ] No Tauri references in built Electron app
- [ ] Feature parity achieved between Tauri and Electron
- [ ] Team approval for Tauri removal

---

## 1. Directories to Remove

### 1.1 Primary Removals (Safe)

| Directory | Size | Migration Status | Notes |
|---|---|---|---|
| `apps/shell-tauri/` | ~1MB | `deprecated` | Main Tauri host - fully replaced |
| `apps/shell-tauri/src-tauri/` | ~500KB | `deprecated` | Rust Tauri code - fully replaced |
| `apps/shell-tauri/target/` | ~500MB | `deprecated` | Build artifacts - can regenerate |

**Command**:
```bash
rm -rf apps/shell-tauri/target
rm -rf apps/shell-tauri/src-tauri/target
# Only after verification:
rm -rf apps/shell-tauri
```

### 1.2 Conditional Removals

| Directory | Size | Condition | Notes |
|---|---|---|---|
| `crates/intent-graph-kernel/` | ~1MB | Not used by shell | Verify no dependencies |
| `crates/presentation-kernel/` | ~500KB | Not used by shell | Verify no dependencies |
| `crates/security/*/` | ~2MB | Not used by shell | Verify no dependencies |
| `crates/provider-adapter/` | ~200KB | Not used by shell | Verify no dependencies |
| `crates/extension-adapter/` | ~200KB | Not used by shell | Verify no dependencies |

**Command** (after verification):
```bash
rm -rf crates/intent-graph-kernel
rm -rf crates/presentation-kernel
rm -rf crates/security
rm -rf crates/provider-adapter
rm -rf crates/extension-adapter
```

---

## 2. Configuration Files to Remove

| File | Location | Migration Status | Notes |
|---|---|---|---|
| `apps/shell-tauri/Cargo.toml` | Workspace root | `deprecated` | Part of shell-tauri removal |
| `apps/shell-tauri/src-tauri/Cargo.toml` | Tauri src | `deprecated` | Part of shell-tauri removal |
| `apps/shell-tauri/src-tauri/tauri.conf.json` | Tauri config | `deprecated` | Part of shell-tauri removal |
| `apps/shell-tauri/test-shell.sh` | Test script | `deprecated` | Replace with Electron tests |

---

## 3. Dependencies to Remove

### 3.1 From `apps/shell/package.json`

After verifying `apps/shell-electron` works:

```json
// Remove if exists - Tauri was not in shell package.json
// But remove any @tauri-apps references if found
```

### 3.2 From Root package.json

Check for any Tauri-related scripts or dependencies:

```bash
grep -r "tauri\|Tauri" package.json
```

If found, remove:
```json
{
  "scripts": {
    "tauri": "...",  // Remove
    "dev:tauri": "..."  // Remove
  }
}
```

---

## 4. CI/CD Scripts to Update

### 4.1 GitHub Actions

Check `.github/workflows/` for Tauri builds:

```yaml
# Remove steps like:
- name: Build Tauri
  run: cd apps/shell-tauri && cargo tauri build
```

### 4.2 Package.json Scripts

In `package.json`, remove:
```json
{
  "scripts": {
    "tauri": "echo 'Use electron instead'",
    "build:tauri": "echo 'Use electron instead'"
  }
}
```

---

## 5. Documentation to Update

### 5.1 Files to Review

| File | Update Required |
|---|---|
| `README.md` | Remove Tauri references, add Electron |
| `docs/DEVELOPMENT.md` | Update dev commands |
| `docs/BUILD.md` | Remove Tauri build, add Electron |
| `docs/ARCHITECTURE.md` | Update host section |

### 5.2 Docs to Remove

| File | Reason |
|---|---|
| `docs/TAURI_MIGRATION_NOTES.md` | (if exists) - Outdated |

---

## 6. References in Code to Update

### 6.1 Runtime Feature Flags

Search for hardcoded Tauri references:

```bash
grep -r "TAURI\|tauri\|__TAURI__" apps/ --include="*.ts" --include="*.tsx"
```

**Update pattern**:
```typescript
// Before
const isTauri = window.__TAURI__ !== undefined;

// After  
const HOST = import.meta.env.VITE_HOST || 'electron';
const isElectron = HOST === 'electron';
```

### 6.2 Import Statements

```bash
grep -r "from.*tauri\|import.*tauri" apps/ --include="*.ts" --include="*.tsx"
```

Remove any remaining Tauri imports.

---

## 7. Data Migration (If Needed)

### 7.1 User Data

If Tauri stored user preferences:
- Location: `~/.config/allternit-shell/` (Linux/macOS)
- Location: `%APPDATA%\allternit-shell\` (Windows)

**Action**: Verify Electron app uses same location or migrate data.

### 7.2 Browser Profiles

If Tauri created browser profiles:
- Location: `~/.config/allternit-shell/Browser/` or similar

**Action**: Document profile migration path or use same location.

---

## 8. Rollback Plan (If Needed)

If cleanup causes issues:

```bash
# Restore from git
git checkout HEAD -- apps/shell-tauri/

# Revert package changes
git checkout HEAD -- package.json

# Revert CI changes
git checkout HEAD -- .github/workflows/
```

---

## 9. Post-Cleanup Verification

After cleanup, verify:

- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter @allternit/shell-electron build` succeeds
- [ ] `pnpm --filter @allternit/shell-electron start` launches app
- [ ] All acceptance tests pass
- [ ] Repo size decreased (especially `node_modules`)
- [ ] No `target/` directories remain for Tauri

---

## 10. Execution Timeline

### Phase 1: Preparation (Day 1)
- [ ] Complete all acceptance tests
- [ ] Document remaining Tauri references
- [ ] Team review and approval

### Phase 2: Backup (Day 2)
- [ ] Create git tag: `v1.0.0-tauri-final`
- [ ] Document any data migration needed
- [ ] Backup any custom Tauri configuration

### Phase 3: Cleanup (Day 3)
- [ ] Remove Tauri directories
- [ ] Update package.json
- [ ] Update CI/CD
- [ ] Update docs

### Phase 4: Verification (Day 4)
- [ ] Run full test suite
- [ ] Verify build
- [ ] Team sign-off

---

## Estimated Savings

| Metric | Before | After | Savings |
|---|---|---|---|
| Repo Size | ~2GB | ~1.5GB | ~500MB |
| Build Time | ~5 min (Tauri) | ~2 min (Electron) | ~3 min |
| Dependencies | ~2000 | ~1500 | ~500 |

---

*Document maintained as part of Tauri → Electron migration. Execute only after all acceptance tests pass.*
