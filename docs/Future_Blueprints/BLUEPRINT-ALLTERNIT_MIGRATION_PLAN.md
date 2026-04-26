# Allternit Rebranding Migration Plan

## Executive Summary

This document outlines the complete migration from **allternit/allternit/allternit** branding to **allternit** branding across the entire codebase and system configurations.

---

## Naming Convention Mapping

### Primary Brand Names

| Old Pattern | New Pattern | Usage Context |
|-------------|-------------|---------------|
| `allternit` | `allternit` | Company/organization name |
| `allternit` | `allternit` | Product name |
| `allternit` | `allternit` | Legacy brand name |
| `allternit` | `allternit` | Abbreviation (full form) |

### Abbreviation Pattern

| Old Pattern | New Pattern | Usage Context |
|-------------|-------------|---------------|
| `a://` | `a://` | URI scheme / protocol **(UNCHANGED)** |
| `A://` | `A://TERNIT` | Visual brand with Allternit name |
| `A://TERNIT` | `A://TERNIT` | ASCII logo **(REPLACE)** |
| `A://TERNIT` | `A://TERNIT` | ASCII logo **(REPLACE)** |
| `@allternit/` | `@allternit/` | NPM package scope |
| `@allternit/` | `@allternit/` | NPM package scope |

### Domain Names

| Old Domain | New Domain | Purpose |
|------------|------------|---------|
| `allternit.com` | `allternit.com` | Main website |
| `docs.allternit.com` | `docs.allternit.com` | Documentation |
| `install.allternit.com` | `install.allternit.com` | Installation scripts |
| `api.allternit.com` | `api.allternit.com` | API endpoints |
| `models.allternit.com` | `models.allternit.com` | ML models |
| `control.allternit.com` | `control.allternit.com` | Control plane |
| `kernel.allternit.com` | `kernel.allternit.com` | Kernel sync |
| `allternit.com` | `gizziio.com` | Platform website |
| `platform.allternit.com` | `platform.gizziio.com` | Platform auth/login |

### Bundle IDs / Reverse Domain Notation

| Old Pattern | New Pattern |
|-------------|-------------|
| `com.allternit.*` | `com.allternit.*` |
| `com.allternit.*` | `com.allternit.*` |
| `com.allternit.*` | `com.allternit.*` |

### Rust Crate Names

| Old Pattern | New Pattern |
|-------------|-------------|
| `allternit-sdk-*` | `allternit-sdk-*` |
| `allternit-kernel-*` | `allternit-kernel-*` |
| `allternit-messaging` | `allternit-messaging` |
| `allternit-runtime-*` | `allternit-runtime-*` |
| `allternit-tools-*` | `allternit-tools-*` |
| `allternit-history` | `allternit-history` |
| `allternit-policy` | `allternit-policy` |
| `allternit-*` | `allternit-*` |

### NPM Package Scopes

| Old Pattern | New Pattern |
|-------------|-------------|
| `@allternit/*` | `@allternit/*` |
| `@allternit/*` | `@allternit/*` |
| `@allternit/*` | `@allternit/*` |

### Directory Names

| Old Pattern | New Pattern |
|-------------|-------------|
| `allternit-workspace` | `allternit-workspace` |
| `allternit` (root) | `allternit` |
| `.allternit` | `.allternit` |
| `allternit` (root dir) | `allternit` |
| `allternit-platform-*` | `allternit-platform-*` |
| `allternit-*` | `allternit-*` |
| `allternit-*` | `allternit-*` |

### Database & Data Files

| Old Pattern | New Pattern |
|-------------|-------------|
| `allternit.db` | `allternit.db` |
| `allternit.db` | `allternit.db` |
| `allternit.jsonl` | `allternit.jsonl` |

### Executable Names

| Old Pattern | New Pattern |
|-------------|-------------|
| `allternit` | `allternit` |
| `allternit-*` | `allternit-*` |
| `allternit-api` | `allternit-api` |
| `allternit-tui` | `allternit-tui` |
| `allternit-acp` | `allternit-acp` |

### Function/Service IDs

| Old Pattern | New Pattern |
|-------------|-------------|
| `com.allternit.os.*` | `com.allternit.os.*` |
| `com.allternit.web.*` | `com.allternit.web.*` |
| `com.allternit.finance.*` | `com.allternit.finance.*` |
| `com.allternit.desktop` | `com.allternit.desktop` |
| `com.allternit.native_host` | `com.allternit.native_host` |
| `com.allternit.thin-client` | `com.allternit.thin-client` |

---

## Migration Scope

### Phase 1: User Space Files

#### 1.1 Main Codebase
- **Location**: `/Users/macbook/Desktop/allternit-workspace/`
- **Files**: ~10,000+
- **Actions**:
  - Rename root directory `allternit` → `allternit`
  - Update all package.json files
  - Update all Cargo.toml files
  - Update all TypeScript/JavaScript imports
  - Update all Rust use statements
  - Update all documentation files

#### 1.2 Configuration Directories
- **Locations**:
  - `~/.allternit` → `~/.allternit`
  - `~/.config/allternit-*` → `~/.config/allternit-*`
  - `~/.local/share/allternit-*` → `~/.local/share/allternit-*`
  - `~/.local/bin/allternit*` → `~/.local/bin/allternit*`
  - `~/allternit` → `~/allternit`
  - `~/allternit-platform-release` → `~/allternit-platform-release`
  - `~/Desktop/allternit-packages` → `~/Desktop/allternit-packages`

#### 1.3 Application Support
- **Location**: `~/Library/Application Support/`
- **Directories**:
  - `@allternit` → `@allternit`
  - `@allternit` → `@allternit`
  - `allternit` → `allternit`
  - `allternit-pill-demo` → `allternit-pill-demo`
  - `allternit-platform-electron` → `allternit-platform-electron`
  - `com.allternit.cli` → `com.allternit.cli`

#### 1.4 LaunchAgents
- **Location**: `~/Library/LaunchAgents/`
- **Files**:
  - `com.allternit.agui-gateway.plist` → `com.allternit.agui-gateway.plist`
  - `com.allternit.capsule-runtime.plist` → `com.allternit.capsule-runtime.plist`
  - `com.allternit.gateway.plist` → `com.allternit.gateway.plist`
  - `com.allternit.shell.plist` → `com.allternit.shell.plist`
  - `com.allternit.ui-tars-operator.plist` → `com.allternit.ui-tars-operator.plist`
- **Actions**: Rename files AND update bundle IDs inside plist files

#### 1.5 Preferences
- **Location**: `~/Library/Preferences/`
- **Files**:
  - `com.allternit.platform.plist` → `com.allternit.platform.plist`
  - `com.allternit.thin-client.plist` → `com.allternit.thin-client.plist`
  - `com.allternit.platform.plist` → `com.allternit.platform.plist`

#### 1.6 Native Messaging Hosts
- **Locations** (multiple browser profiles):
  - `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
  - `~/Library/Application Support/Chromium/NativeMessagingHosts/`
  - `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
  - `~/Library/Application Support/Google/Chrome for Testing/NativeMessagingHosts/`
  - `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/`
- **Files**:
  - `com.allternit.desktop.json` → `com.allternit.desktop.json`
- **Actions**: Rename files AND update content inside JSON files

#### 1.7 HTTPStorages / Cookies
- **Location**: `~/Library/Application Support/`
- **Files**:
  - `allternit-shell-tauri.binarycookies` → `allternit-shell-tauri.binarycookies`

#### 1.8 Databases
- **Locations**:
  - `~/.local/share/allternit-code/` → `~/.local/share/allternit-code/`
  - `~/.local/share/allternit-shell/` → `~/.local/share/allternit-shell/`
- **Files**:
  - `allternit.db` → `allternit.db`
  - `allternit.db` → `allternit.db`

#### 1.9 Documentation Files (Root)
- **Files**:
  - `ALLTERNIT_*.md` → `ALLTERNIT_*.md`
  - `ALLTERNIT_BLUEPRINTS_ROADMAP.md` → `ALLTERNIT_BLUEPRINTS_ROADMAP.md`
  - `ALLTERNIT_GAPS_HARDENING_ANALYSIS.md` → `ALLTERNIT_GAPS_HARDENING_ANALYSIS.md`
  - etc.

### Phase 2: System-Wide References

#### 2.1 Code Content Changes
- **TypeScript/JavaScript**:
  - Update all `import` statements
  - Update all `require()` calls
  - Update package references in code
  
- **Rust**:
  - Update all `use` statements
  - Update crate dependencies
  - Update module paths

- **Configuration Files**:
  - `package.json` - name, description, author fields
  - `Cargo.toml` - crate names, dependencies
  - `tsconfig.json` - paths, extends
  - `pnpm-workspace.yaml` - package patterns
  - Any `.env` files

#### 2.2 Documentation Content
- All markdown files
- README files
- API documentation
- Architecture diagrams (text labels)
- Comments in code (where appropriate)

#### 2.3 Domain References
- URLs in code
- API endpoints
- Documentation links
- Install script URLs
- WebSocket endpoints

---

## Migration Strategy

### Pre-Migration Checklist

1. **Full Backup**
   - Create Time Machine snapshot
   - Backup critical directories to external storage
   - Export list of all installed LaunchAgents

2. **Stop Running Services**
   ```bash
   # Unload all allternit LaunchAgents
   launchctl unload ~/Library/LaunchAgents/com.allternit.*.plist
   ```

3. **Close Applications**
   - Close all Electron apps
   - Close all browsers
   - Kill any running allternit processes

### Migration Execution Order

1. **Stop all services** (LaunchAgents)
2. **Backup everything**
3. **Rename directories** (user space)
4. **Update configuration files** (package.json, Cargo.toml, etc.)
5. **Update code content** (imports, requires, use statements)
6. **Update system configurations** (LaunchAgents, Preferences)
7. **Update Native Messaging Host configs**
8. **Update database references**
9. **Rebuild all packages**
10. **Reload services with new names**
11. **Verify and test**

### Rollback Plan

If issues occur:
1. Stop all new services
2. Restore from backup
3. Reload original LaunchAgents
4. Revert directory renames

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking running applications | High | Stop all services before migration |
| Broken imports after rename | High | Comprehensive search/replace, rebuild all |
| LaunchAgent failures | Medium | Test each agent after reload |
| Native messaging broken | Medium | Update all browser profiles |
| Database connection failures | Medium | Update connection strings, migrate DB files |
| Broken symlinks | Medium | Find and update all symlinks |
| Cached references | Low | Clear npm/cargo caches after migration |

---

## Post-Migration Verification

### Automated Checks
```bash
# Search for any remaining old references
grep -r "allternit" ~/Desktop/allternit-workspace/ --include="*.ts" --include="*.js" --include="*.json"
grep -r "@allternit/" ~/Desktop/allternit-workspace/ --include="*.ts" --include="*.js" --include="*.json"
grep -r "com.allternit\." ~/Library/LaunchAgents/
grep -r "com.allternit\." ~/Library/LaunchAgents/
```

### Manual Checks
- [ ] All applications launch successfully
- [ ] All LaunchAgents load without errors
- [ ] Native messaging works in all browsers
- [ ] Build completes without errors
- [ ] Tests pass
- [ ] Documentation renders correctly

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Backup & Preparation | 30 minutes |
| Directory Renaming | 30 minutes |
| Configuration Updates | 1-2 hours |
| Code Content Updates | 2-4 hours |
| System Configuration Updates | 1 hour |
| Rebuild & Verification | 2-3 hours |
| **Total** | **7-11 hours** |

---

## Tools & Scripts Required

1. **Backup Script** - Create full backup before migration
2. **Directory Rename Script** - Handle all directory renames
3. **Content Replace Script** - Search/replace in files
4. **LaunchAgent Update Script** - Update plist files
5. **NativeMessaging Update Script** - Update JSON configs
6. **Verification Script** - Check for missed references
7. **Rollback Script** - Restore from backup if needed

---

## Notes

- The abbreviation `a://` should become `allternit://` (not keeping shortened form)
- Platform website is now `gizziio.com` (separate from allternit.com)
- Platform auth is at `platform.gizziio.com`
- All third-party dependencies (node_modules, cargo registry) should NOT be modified
- Focus on owned code and configurations only
