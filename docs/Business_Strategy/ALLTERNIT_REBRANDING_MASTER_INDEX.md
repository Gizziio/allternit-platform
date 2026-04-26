# ALLTERNIT REBRANDING - MASTER INDEX

**Complete documentation for the allternit → allternit rebranding**

**Date:** 2026-03-29  
**Status:** READY FOR EXECUTION

---

## 📚 DOCUMENTATION OVERVIEW

This rebranding effort is supported by comprehensive documentation to ensure:
1. **Complete migration** - No old branding remains
2. **Zero regressions** - Agents don't revert to old naming
3. **Clear guidance** - Everyone knows what to use
4. **Risk mitigation** - Breakage is anticipated and planned for

---

## 📖 DOCUMENTATION HIERARCHY

### Level 1: Definitive Authority (MUST READ)

**`~/ALLTERNIT_BRAND_AUTHORITY.md`** ⭐⭐⭐
- **THE SINGLE SOURCE OF TRUTH**
- Legally binding brand standards
- Prohibited vs. approved patterns
- Usage by context
- Enforcement mechanisms
- **READ THIS FIRST before any work**

---

### Level 2: Quick Reference (KEEP HANDY)

**`~/allternit-migration/BRAND_QUICK_REFERENCE.md`** ⭐⭐⭐
- One-page cheat sheet
- ✅ Use This / ❌ Never Use This tables
- Quick examples by context
- Pre-commit checklist
- **KEEP OPEN WHILE WORKING**

---

### Level 3: Migration Execution

**`~/ALLTERNIT_MIGRATION_PLAN.md`** ⭐⭐
- Complete migration plan
- Naming convention mapping
- Phase-by-phase execution
- System configuration updates
- **FOR MIGRATION EXECUTION**

**`~/allternit-migration/00-master-migration.sh`** ⭐⭐
- Automated migration script
- Runs all sub-scripts
- Creates backups
- **RUN THIS TO MIGRATE**

---

### Level 4: Risk Assessment

**`~/allternit-migration/BREAKAGE_RISK_ASSESSMENT.md`** ⭐⭐
- Complete breakage analysis
- Risk matrix (Critical/High/Medium/Low)
- File-by-file impact assessment
- Mitigation strategies
- Rollback procedures
- **READ BEFORE MIGRATING**

---

### Level 5: Brand Guidelines

**`~/allternit-migration/BRAND_GUIDELINES.md`** ⭐
- Visual identity standards
- Color palette
- Typography
- Voice & tone
- Usage examples
- **FOR DESIGN/UX WORK**

**`~/allternit-migration/A_PROTOCOL_BRANDING.md`** ⭐
- A://TERNIT concept explanation
- Why A://TERNIT (not "A Protocol")
- Brand architecture
- Usage guidelines
- **FOR UNDERSTANDING THE BRAND**

**`~/allternit-migration/BRAND_EVOLUTION.md`** ⭐
- Brand journey visualization
- Before/after comparisons
- Why the change matters
- **FOR CONTEXT**

---

### Level 6: Analysis & Reference

**`~/allternit-migration/A_PROTOCOL_USAGE.md`** ⭐
- Where a:// is used
- Functional vs. visual usage
- Code examples
- **FOR TECHNICAL CONTEXT**

**`~/allternit-migration/THIS_SUMMARY.md`** ⭐
- Quick summary of everything
- Migration scope
- Success criteria
- **FOR QUICK OVERVIEW**

**`~/allternit-migration/README.md`** ⭐
- Migration scripts reference
- Quick start guide
- Troubleshooting
- **FOR RUNNING MIGRATION**

---

## 🎯 BRANDING SUMMARY

### The Hierarchy

```
allternit (company/product name)
    ↓
Allternit Protocol (formal protocol name)
    ↓
a:// (URI scheme / protocol symbol - like http://)
    ↓
A://TERNIT (visual brand lockup)
```

### What Changes

| Old | New | Context |
|-----|-----|---------|
| allternit, allternit, allternit | allternit | Company/product |
| A://TERNIT, A://TERNIT | A://TERNIT | Visual brand |
| "A://TERNIT ready..." | "A://TERNIT ready..." | UI messages |
| @allternit/*, @allternit/* | @allternit/* | NPM scope |
| allternit-*, allternit-* | allternit-* | Rust crates |
| com.allternit.*, com.allternit.* | com.allternit.* | Bundle IDs |
| allternit.com | allternit.com | Main domain |
| docs.allternit.com | docs.allternit.com | Docs domain |
| allternit.com | gizziio.com | Platform website |

### What Stays

| Pattern | Why | Example |
|---------|-----|---------|
| `a://` | Functional URI scheme | `a://browser open ...` |
| `Allternit Protocol` | Formal name | "Built on Allternit Protocol" |

---

## 📊 MIGRATION SCOPE

### Files Affected

| Category | Count | Risk Level |
|----------|-------|------------|
| **Critical configs** | ~2,400+ | 🔴 CRITICAL |
| **User-visible** | ~340+ | 🟠 HIGH |
| **Runtime logic** | ~335+ | 🟡 MEDIUM |
| **Documentation** | ~10,000+ | 🟢 LOW |
| **TOTAL** | **~13,000+** | **HIGH** |

### Key Files

- **5,072** package.json files
- **180** Cargo.toml files
- **8,951** markdown documentation files
- **1,476** @allternit/ or @allternit/ imports
- **17** LaunchAgent plists
- **5** native messaging host configs
- **306** domain references
- **30** visual branding occurrences

---

## 🚀 EXECUTION

### Prerequisites

1. ✅ Read `~/ALLTERNIT_BRAND_AUTHORITY.md`
2. ✅ Review `~/allternit-migration/BREAKAGE_RISK_ASSESSMENT.md`
3. ✅ Close all applications
4. ✅ Stop all running services
5. ✅ Ensure 10GB+ free disk space
6. ✅ Set aside 7-11 hours

### Run Migration

```bash
# Navigate to migration scripts
cd ~/allternit-migration/

# Make all scripts executable
chmod +x *.sh

# Run the master migration script
./00-master-migration.sh
```

### Post-Migration

```bash
# Rebuild everything
cd ~/Desktop/allternit-workspace/allternit

# TypeScript
rm -rf node_modules
pnpm install
pnpm build

# Rust
cargo clean
cargo build

# Test
pnpm test
cargo test

# Verify branding
./allternit-migration/05-verify.sh
```

---

## ✅ SUCCESS CRITERIA

Migration is successful when:

- ✅ All `pnpm install` completes without errors
- ✅ All `cargo build` completes without errors
- ✅ All tests pass
- ✅ Application launches successfully
- ✅ UI shows "A://TERNIT" (not "A://TERNIT")
- ✅ No import errors
- ✅ All LaunchAgents load
- ✅ Native messaging works in browsers
- ✅ Database connections work
- ✅ All URLs resolve correctly
- ✅ Zero old branding references remain

---

## 🛡️ ENFORCEMENT

### For AI Agents

**DIRECTIVE:** When working with this codebase:

1. ALWAYS use approved naming from `ALLTERNIT_BRAND_AUTHORITY.md`
2. NEVER suggest or use old branding patterns
3. Check `BRAND_QUICK_REFERENCE.md` before making changes
4. If unsure, ask the user or check documentation

**PROHIBITED:**
- Using allternit, allternit, allternit, allternit
- Using A://TERNIT, A://TERNIT
- Using @allternit/, @allternit/
- Using A Protocol (ambiguous)
- Reverting branding changes
- Suggesting old naming conventions

### For Developers

**Code Review Checklist:**
- [ ] No old company names (allternit, etc.)
- [ ] No old NPM scopes (@allternit/, etc.)
- [ ] No old Rust crates (allternit-*, etc.)
- [ ] No old bundle IDs (com.allternit.*, etc.)
- [ ] No old ASCII logos (A://TERNIT)
- [ ] No old domains (allternit.com, etc.)
- [ ] Visual brand is A://TERNIT
- [ ] Protocol is "Allternit Protocol"

### Automated Checks

Add to CI/CD:
```yaml
name: Brand Compliance
on: [push, pull_request]
jobs:
  check-branding:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check for old branding
        run: |
          ! grep -r "allternit" --include="*.ts" --include="*.tsx" --include="*.json" . || exit 1
          ! grep -r "A://TERNIT" --include="*.ts" --include="*.tsx" . || exit 1
          ! grep -r "@allternit/" --include="*.ts" --include="*.tsx" --include="*.json" . || exit 1
```

---

## 🔄 ROLLBACK

If migration fails:

```bash
# Find backup
BACKUP_DIR=$(ls -td ~/allternit-backup-* | head -1)

# Restore workspace
rm -rf ~/Desktop/allternit-workspace
cp -R "$BACKUP_DIR/allternit-workspace" ~/Desktop/

# Restore configs
rm -rf ~/.allternit
cp -R "$BACKUP_DIR/.allternit" ~/.allternit

# Restore LaunchAgents
rm ~/Library/LaunchAgents/com.allternit.*.plist 2>/dev/null || true
cp "$BACKUP_DIR/launchagents/"*.plist ~/Library/LaunchAgents/

# Reload old services
for f in ~/Library/LaunchAgents/com.allternit.*.plist; do
  launchctl load "$f"
done
```

---

## 📞 SUPPORT & REFERENCE

### Primary Documents

| Document | Purpose | Priority |
|----------|---------|----------|
| `~/ALLTERNIT_BRAND_AUTHORITY.md` | Definitive brand standards | ⭐⭐⭐ MUST READ |
| `~/allternit-migration/BRAND_QUICK_REFERENCE.md` | Quick cheat sheet | ⭐⭐⭐ KEEP OPEN |
| `~/allternit-migration/BREAKAGE_RISK_ASSESSMENT.md` | Risk analysis | ⭐⭐ READ BEFORE |
| `~/ALLTERNIT_MIGRATION_PLAN.md` | Migration plan | ⭐⭐ EXECUTION |

### Migration Scripts

| Script | Purpose |
|--------|---------|
| `00-master-migration.sh` | Run this - orchestrates everything |
| `01-backup.sh` | Creates comprehensive backup |
| `02-rename-directories.sh` | Renames directories |
| `03-replace-content.sh` | Replaces text in files |
| `04-database-special-files.sh` | Handles databases |
| `05-verify.sh` | Verifies migration success |

### Additional Reference

| Document | Purpose |
|----------|---------|
| `BRAND_GUIDELINES.md` | Visual identity, voice & tone |
| `A_PROTOCOL_BRANDING.md` | A://TERNIT concept |
| `BRAND_EVOLUTION.md` | Brand journey |
| `A_PROTOCOL_USAGE.md` | Where a:// is used |
| `THIS_SUMMARY.md` | Quick overview |
| `README.md` | Script reference |

---

## 📈 TIMELINE

| Phase | Duration | Activity |
|-------|----------|----------|
| **Preparation** | 30 min | Read docs, close apps, stop services |
| **Backup** | 30 min | Create comprehensive backup |
| **Migration** | 4-6 hours | Run scripts, update files |
| **Rebuild** | 2-3 hours | Rebuild all packages |
| **Testing** | 1-2 hours | Verify, fix issues |
| **TOTAL** | **7-11 hours** | **Complete migration** |

---

## 🎯 KEY INSIGHTS

### Why A://TERNIT?

- ✅ Keeps the iconic `A://` protocol symbol
- ✅ Clearly shows "TERNIT" (Allternit)
- ✅ Unique, memorable, distinctive
- ✅ Technically meaningful (protocol + name)
- ✅ Visual continuity with past branding

### Why Not "A Protocol"?

- ❌ Looks like a variable name
- ❌ Too ambiguous/generic
- ❌ Doesn't clearly say "Allternit"
- ❌ Loses the `A://` visual

### Why Keep `a://`?

- ✅ It's the functional URI scheme (like http://)
- ✅ Technically meaningful
- ✅ Short, memorable, functional
- ✅ Follows standard protocol pattern

---

## 📝 FINAL CHECKLIST

### Before Starting Work

- [ ] Read `ALLTERNIT_BRAND_AUTHORITY.md`
- [ ] Open `BRAND_QUICK_REFERENCE.md`
- [ ] Understand the brand hierarchy
- [ ] Know what to use vs. what to avoid

### Before Committing Code

- [ ] No old branding in code
- [ ] No old branding in configs
- [ ] No old branding in comments
- [ ] Imports use @allternit/
- [ ] UI uses A://TERNIT
- [ ] Domains are updated

### Before Releasing

- [ ] All tests pass
- [ ] Build completes successfully
- [ ] UI shows correct branding
- [ ] Documentation is updated
- [ ] No old branding remains

---

## 🌟 THE BOTTOM LINE

**Old Brand → New Brand**

```
allternit    →    allternit
allternit    →    allternit
A://TERNIT  →    A://TERNIT
A://TERNIT  →    A://TERNIT
@allternit/*        →    @allternit/*
allternit-*         →    allternit-*
com.allternit.*     →    com.allternit.*
allternit.com        →    allternit.com
```

**Preserved**

```
a://          →    a:// (protocol symbol)
Allternit Protocol  →  Allternit Protocol (formal name)
```

---

**READY TO BEGIN?**

1. Read `~/ALLTERNIT_BRAND_AUTHORITY.md`
2. Review `~/allternit-migration/BREAKAGE_RISK_ASSESSMENT.md`
3. Run `./allternit-migration/00-master-migration.sh`

---

**Version:** 1.0  
**Date:** 2026-03-29  
**Status:** READY FOR EXECUTION

**END OF MASTER INDEX**
