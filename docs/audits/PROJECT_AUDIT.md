# Allternit CMD Directory Audit

## Executive Summary

This directory (`/Users/macbook/Desktop/allternit-workspace/allternit/cmd/`) contains multiple CLI projects that have evolved and overlapped. There's confusion about which is the "real" Gizzi Code and which files should be consolidated.

---

## Directory Inventory

### 1. `a2r/` - A2R System Config
**Purpose:** A2R (Agent to Runtime) configuration
**Language:** JSON/Config
**Status:** ✅ Active - Config only
```
a2r/
├── config.json          # A2R system configuration
└── system/              # System-level A2R settings
```

---

### 2. `allternit-api/` - Rust API Layer
**Purpose:** Core Allternit API (Rust)
**Language:** Rust
**Status:** ✅ Active - Production
```
allternit-api/
├── Cargo.lock
├── Cargo.toml
├── src/                 # Rust source
├── target/              # Build output
└── tests/               # Rust tests
```

---

### 3. `allternit-auth/` - Auth Package
**Purpose:** Authentication module
**Language:** TypeScript
**Status:** 🟡 Minimal - Just package.json
```
allternit-auth/
└── package.json
```

---

### 4. `allternit-cloud-api/` - Cloud API
**Purpose:** Cloud-hosted Allternit API
**Language:** Rust
**Status:** ✅ Active - Production
```
allternit-cloud-api/
├── API.md
├── Cargo.toml
├── migrations/          # DB migrations
├── QUICKSTART.md
├── src/                 # Rust source
└── tests/
```

---

### 5. `allternit-cloud-wizard/` - Cloud Setup Wizard
**Purpose:** Cloud deployment wizard
**Language:** Rust
**Status:** ✅ Active
```
allternit-cloud-wizard/
├── Cargo.toml
└── src/                 # Rust source
```

---

### 6. `api/` - Empty/Orphaned
**Purpose:** Unknown/Empty
**Status:** 🔴 Orphaned - Contains only `.a2r/` subfolder
```
api/
└── .a2r/                # Empty directory?
```

---

### 7. `cli/` - A2R CLI (Current?)
**Purpose:** A2R Command Line Interface
**Language:** TypeScript
**Status:** 🟡 Unclear - May be superseded
```
cli/
├── bin/                 # Compiled output
├── dist/                # Build output
├── node_modules/
├── src/                 # TypeScript source
├── package.json         # Name: @allternit/cli
└── tsconfig.json
```
**Package name:** `@allternit/cli`  
**Binary:** `a2r`

---

### 8. `cli-rust-archive/` - Old Rust CLI
**Purpose:** Archived Rust CLI implementation
**Language:** Rust
**Status:** 🔴 Archived/Deprecated
```
cli-rust-archive/
├── Cargo.toml
├── cli_registry.json
├── commands.json
├── COWORK.md
├── HANDOFF.md
└── src/                 # Rust source
```

---

### 9. `cli-typescript/` - TypeScript CLI
**Purpose:** TypeScript CLI wrapper
**Language:** TypeScript
**Status:** 🟡 Minimal
```
cli-typescript/
└── cli/                 # Single folder
```

---

### 10. `cloud-backend/` - Cloud Backend Node
**Purpose:** Cloud backend services
**Language:** TypeScript/Bun
**Status:** ✅ Active
```
cloud-backend/
├── bun.lock
├── node_modules/
├── package.json
├── src/                 # TypeScript source
└── tsconfig.json
```

---

### 11. `gizzi-code/` - ORIGINAL Gizzi Code CLI
**Purpose:** Original Allternit TUI/CLI (BEFORE Claude Code import)
**Language:** TypeScript/Bun
**Status:** ✅ Active - This is the "real" original Gizzi Code
```
gizzi-code/
├── .build/              # Build artifacts
├── .build-production/   # Production builds
├── .build-transformed/  # Transformed builds
├── .github/             # GitHub workflows
├── .gizzi/              # Gizzi workspace
├── .husky/              # Git hooks
├── bin/                 # CLI binaries
├── cli-package/         # CLI packaging
├── dist/                # Distribution
├── docs/                # Documentation
├── github/              # GitHub integration
├── infra/               # Infrastructure code
├── migration/           # Migration scripts
├── nix/                 # Nix packaging
├── node_modules/
├── output/              # Build output
├── packages/            # Workspace packages
├── patches/             # Package patches
├── script/              # Build scripts
├── sdks/                # SDKs
├── spec/                # Specifications
├── specs/               # More specs
├── src/                 # MAIN SOURCE CODE
├── test/                # Tests
├── tests/               # More tests
├── package.json         # Name: @allternit/gizzi-code
└── ... (many config files)
```

**Package name:** `@allternit/gizzi-code`  
**This is the ORIGINAL working Gizzi CLI**

---

### 12. `gizzi-code-claude/` - Claude Code Import
**Purpose:** Claude Code source imported for rebranding
**Language:** TypeScript
**Status:** 🟡 In Progress - Integration attempt
```
gizzi-code-claude/
├── .git/                # Git history from import
├── .gizzi/              # Workspace
├── node_modules/
├── src/                 # Claude Code source (incomplete)
├── BUILD_ERRORS_ANALYSIS.md
├── COMPREHENSIVE_FILE_MAPPING.md
├── FULL_BUILD_FIX_PLAN.md
├── GIZZI_INTEGRATION.md
├── GIZZI_REBRANDING_COMPLETE.md
├── GIZZI_TO_CLAUDE_MAPPING.md
├── MIGRATION_STRATEGY.md
├── MINIMAL_V1_PLAN.md
├── MISSING_20_PERCENT_ANALYSIS.md
├── REBRANDING_COMPLETE_FINAL.md
├── package.json
└── README.md
```

**This is where we've been working - trying to fix Claude Code import**

---

### 13. `gizzi-core/` - Gizzi Core Package
**Purpose:** Core primitives (Brand, Bus, Workspace)
**Language:** TypeScript
**Status:** ✅ Active - Working
```
gizzi-core/
├── bun.lock
├── dist/                # Built output
├── node_modules/
├── package.json         # Name: @allternit/gizzi-core
├── src/                 # Source (working)
├── test/                # Tests
└── tsconfig.json
```

**Package name:** `@allternit/gizzi-core`  
**Status:** ✅ Clean build, tests passing

---

### 14. `launcher/` - CLI Launcher
**Purpose:** Entry point launcher
**Language:** Rust
**Status:** ✅ Active
```
launcher/
├── Cargo.toml
└── src/                 # Rust source
```

---

## Critical Findings

### 🚨 The Problem

1. **Two Gizzi Code Projects:**
   - `gizzi-code/` - Original, working Allternit CLI
   - `gizzi-code-claude/` - Imported Claude Code (broken, 8k+ errors)

2. **Multiple CLI Projects:**
   - `cli/` - A2R CLI (@allternit/cli)
   - `cli-rust-archive/` - Old Rust CLI (archived)
   - `cli-typescript/` - TS wrapper
   - `gizzi-code/` - Original Gizzi CLI
   - `gizzi-code-claude/` - Claude import

3. **Orphaned/Empty:**
   - `api/` - Empty except `.a2r/`

### ✅ What's Working

| Project | Status | Build |
|---------|--------|-------|
| `gizzi-code/` | ✅ Working | Original Gizzi CLI |
| `gizzi-core/` | ✅ Working | Core primitives |
| `allternit-api/` | ✅ Working | Rust API |
| `allternit-cloud-api/` | ✅ Working | Cloud API |
| `launcher/` | ✅ Working | Launcher |

### 🔧 What's Broken/In Progress

| Project | Status | Issues |
|---------|--------|--------|
| `gizzi-code-claude/` | 🟡 Broken | 8,219 TypeScript errors |
| `cli/` | 🟡 Unknown | May be superseded by gizzi-code |
| `cli-rust-archive/` | 🔴 Archived | Deprecated |
| `api/` | 🔴 Empty | Orphaned |

---

## Recommended Consolidation Plan

### Option 1: Abandon Claude Import, Enhance Original
**Use `gizzi-code/` as base, add features from Claude Code selectively**

Pros:
- Start from working codebase
- No 8k errors to fix
- Original Allternit architecture

Cons:
- Miss some Claude Code features
- Need to manually port desired features

### Option 2: Merge Selectively
**Take working SDK from `gizzi-code-claude/`, integrate into `gizzi-code/`**

Pros:
- Keep working Gizzi Code base
- Get SDKs we built (Computer Use, etc.)
- Production quality

Cons:
- Integration work required
- Need to reconcile architectures

### Option 3: Continue Claude Fix
**Fix all 8,219 errors in `gizzi-code-claude/`**

Pros:
- Full Claude Code feature set
- Complete migration

Cons:
- ~5 weeks of work
- May introduce instability

---

## File Structure Decision Matrix

| Folder | Keep | Merge | Delete | Notes |
|--------|------|-------|--------|-------|
| `a2r/` | ✅ | | | Config needed |
| `allternit-api/` | ✅ | | | Core API |
| `allternit-auth/` | | ✅ | | Merge into main CLI |
| `allternit-cloud-api/` | ✅ | | | Cloud API |
| `allternit-cloud-wizard/` | ✅ | | | Wizard tool |
| `api/` | | | 🔴 | Empty - delete |
| `cli/` | 🟡 | | | Evaluate vs gizzi-code |
| `cli-rust-archive/` | | | 🔴 | Archive - delete |
| `cli-typescript/` | 🟡 | ✅ | | Merge or delete |
| `cloud-backend/` | ✅ | | | Cloud services |
| `gizzi-code/` | ✅ | | | **PRIMARY CLI** |
| `gizzi-code-claude/` | 🟡 | ✅ | | Merge SDKs, then delete |
| `gizzi-core/` | ✅ | | | Core package |
| `launcher/` | ✅ | | | Entry point |

---

## Next Steps Decision

**Before continuing work, we need to decide:**

1. **Which is the canonical Gizzi Code?**
   - `gizzi-code/` (original, working)
   - `gizzi-code-claude/` (imported, broken)

2. **What to do with the SDKs we built?**
   - They're in `gizzi-code-claude/src/sdk/` and `src/gizzi/`
   - They work (0 errors)
   - Need to decide where they live

3. **Do we delete or merge the broken Claude import?**
   - Fix it (5 weeks)
   - Merge SDKs into working gizzi-code (1 week)
   - Abandon it (now)

---

## Questions for You

1. **Is `gizzi-code/` the original working CLI that Allternit users currently use?**

2. **Do you want to keep the Claude Code import (`gizzi-code-claude/`) or scrap it?**

3. **Should the SDKs (Computer Use, MCP, etc.) we built live in `gizzi-core/` or as separate packages?**

4. **What's the relationship between `cli/` and `gizzi-code/`? Which is the "real" CLI?**

5. **Can we delete `api/` and `cli-rust-archive/`?**

6. **What's your vision: Original Gizzi + enhancements, or Full Claude migration?**
