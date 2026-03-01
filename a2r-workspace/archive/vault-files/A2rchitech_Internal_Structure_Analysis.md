# A2rchitech Internal Structure Analysis

**Date:** 2026-01-18
**Status:** ANALYSIS COMPLETE

## Current Directory Inventory

### Top-Level Directories (21 total)

```
Infrastructure & Build:
├── infra/           # Infrastructure as code (Docker, etc.)
├── target/          # Rust build artifacts
├── dist/            # Distribution artifacts
├── node_modules/    # NPM dependencies
├── .venv/           # Python virtual environment
└── .beads/          # Beads tracking data

Development & Code:
├── crates/          # 29 Rust crates (core logic)
├── packages/        # 11 TypeScript packages
├── apps/            # 3 applications (shell, cli, ui)
├── services/         # 9 microservices
├── types/           # Shared TypeScript types
├── spec/            # 7 Architecture specifications
├── scripts/          # 11 Utility scripts
├── examples/         # Example usage
└── tests/           # Test suites

Special Purpose:
├── docs/            # Documentation (already consolidated)
├── workspace/        # Runtime workspace data
├── intent/          # Intent graph service
├── .github/          # GitHub workflows
├── launchd/         # macOS service configs
├── bin/              # Compiled binaries
└── plan/            # Plan documents
```

## Categorization

### 1. Core Development (✅ Well-Organized)
**Directories:** crates/, packages/, apps/
**Status:** Standard workspace structure, well-organized

### 2. Build Artifacts & Dependencies (✅ Properly Ignored)
**Directories:** target/, dist/, node_modules/, .venv/, .beads/
**Status:** Should be in .gitignore, not reviewed

### 3. Infrastructure (✅ Appropriate)
**Directory:** infra/
**Status:** Docker compose, Kubernetes configs - appropriate

### 4. Specifications (⚠️ Mixed)
**Directory:** spec/
**Status:** Contains 7 spec files, needs review
**Subdirectories:**
- law/ - Law specifications
- kernel/ - Kernel contracts
- execution/ - Execution models
- etc.

### 5. Documentation (✅ Recently Consolidated)
**Directory:** docs/
**Status:** 20+ files moved here during cleanup, good structure

### 6. Special Purpose (⚠️ Needs Review)
**Directories:** workspace/, intent/, plan/
**Status:** Runtime data and old planning docs, needs organization

### 7. Tests (✅ Organized)
**Directory:** tests/
**Status:** Organized by type (acceptance, api, integration, load, performance, unit)

### 8. Scripts & Examples (✅ Appropriate)
**Directories:** scripts/, examples/
**Status:** Utility scripts and usage examples - appropriate

### 9. GitHub & Config (✅ Standard)
**Directories:** .github/, launchd/
**Status:** CI/CD and service configs - standard

## Issues Identified

### High Priority
1. **spec/ directory** - 7 spec files need review for current relevance
2. **workspace/ directory** - Runtime data, should not be in repo
3. **plan/ directory** - Old planning docs, may need archiving

### Medium Priority
1. **target/ in git** - Build artifacts should be ignored
2. **dist/ in git** - Distribution artifacts should be ignored
3. **.beads/ content** - Beads tracking data, should be ignored
4. **intent/ directory** - Separate service at root, consider moving to services/

### Low Priority
1. **node_modules/** - Check if properly ignored
2. **.venv/** - Check if properly ignored

## Recommendations

### Immediate Actions
1. **Review spec/ directory** - Determine which specs are still relevant
2. **Archive old planning docs** - Move plan/ to archive if obsolete
3. **Review runtime data** - workspace/ should probably be ignored
4. **Verify .gitignore** - Ensure all artifacts ignored

### Future Actions
1. **Consolidate specs** - Keep relevant specs in docs/spec/ or archive/
2. **Organize special directories** - Document purpose of workspace/, intent/
3. **Review build config** - Ensure target/, dist/ properly ignored

---

## Summary

**Total Directories:** 21
**Well-Organized:** 14 (crates, packages, apps, infra, tests, scripts, examples, types, spec, docs, .github, launchd, bin)
**Needs Review:** 3 (workspace/, intent/, plan/)
**Build Artifacts:** 4 (target, dist, node_modules, .venv, .beads)

**Recommendation:** Directory structure is generally well-organized. Minor cleanup needed for runtime data and old planning documents.