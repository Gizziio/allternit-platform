# Allternit Platform - Current State Documentation

**Date:** 2026-04-04  
**Status:** REBRANDING COMPLETE - WORKSPACE EXISTS - COWORK RUNTIME MISSING

---

## Overview

This document provides an accurate, up-to-date view of the Allternit platform.

**Key Finding:** The workspace EXISTS at `~/Desktop/allternit-workspace/allternit/` with a different structure than previously documented.

---

## What Was Completed Today

### 1. Comprehensive Rebranding Audit
- Analyzed all configuration directories
- Identified 33+ files with old branding
- Documented all inconsistencies

### 2. Configuration Migration
- Renamed 4 `.config/` directories from `allternit*` → `allternit*`
- Updated `config.toml` with new endpoints
- Renamed `allternit.json` → `allternit.json`
- Updated all `package.json` files
- Updated all workspace path references

### 3. Documentation Update
- Updated 19 specification and planning documents
- Replaced all `Allternit` → `Allternit` references
- Updated domains (`allternit.io` → `allternit.com`)
- Removed numbered layer system references
- **Documented ACTUAL workspace structure**

---

## Current Platform Structure

### Configuration Directories (UPDATED)

```
~/.config/
├── allternit/                    # Main config
│   └── config.toml              # Updated endpoints
├── allternit-chrome-dev/        # Chrome dev profile
├── allternit-code/              # Code config
├── allternit-extension-test/    # Extension testing
├── allternit-shell/             # Shell config
│   └── allternit.json           # Renamed from allternit.json
├── gizzi/                       # Gizzi workspace
└── gizzi-code/                  # Gizzi code workspace
```

### Workspace Structure (ACTUAL)

**Location:** `~/Desktop/allternit-workspace/allternit/`

```
allternit/
├── Cargo.toml                    # Workspace root ✅
├── domains/                      # Domain logic ✅
│   ├── kernel/                   # Kernel execution ✅
│   │   ├── drivers/
│   │   │   └── allternit-driver-interface/
│   │   └── service/
│   │       ├── allternit-session-manager/
│   │       ├── allternit-firecracker-driver/
│   │       ├── allternit-apple-vf-driver/
│   │       └── allternit-process-driver/
│   ├── agent/                    # Agent domain ✅
│   ├── governance/               # Governance ✅
│   └── ...
├── api/                          # API layer ✅
│   ├── kernel/                   # Kernel APIs ✅
│   │   ├── rails-service/        # Rails execution engine
│   │   ├── presentation-kernel/  # UI rendering
│   │   └── launcher/             # Platform launcher
│   ├── gateway/                  # Gateway APIs ✅
│   ├── cloud/                    # Cloud APIs ✅
│   └── services/                 # Service APIs ✅
├── services/                     # Services ✅
│   ├── orchestration/            # Orchestration
│   ├── runtime/                  # Runtime
│   ├── registry/                 # Registry
│   └── ...
└── cmd/                          # Commands ✅
    ├── gizzi-code/               # Gizzi code
    └── gizzi-core/               # Gizzi core
```

### Documentation Structure

```
~/spec/                          # Architecture specifications
├── Vision.md                   # Product vision
├── Requirements.md             # Requirements
├── Architecture.md             # 4-plane architecture
├── GAP_ANALYSIS.md             # Gap analysis (updated)
├── IMPLEMENTATION_STATUS.md    # Implementation status (updated)
└── ...
```

---

## Correct Brand Usage

### ✅ Approved Patterns (IN USE)

| Context | Usage | Example |
|---------|-------|---------|
| Company/Product | `allternit` | "Welcome to allternit" |
| Protocol | `Allternit Protocol` | "Built on Allternit Protocol" |
| URI Scheme | `a://` | `a://browser open ...` |
| Visual Brand | `A://TERNIT` | "A://TERNIT ready" |
| NPM Scope | `@allternit/` | `@allternit/sdk` |
| Rust Crates | `allternit-*` | `allternit-sdk-core` |
| Bundle IDs | `com.allternit.*` | `com.allternit.platform` |
| Domains | `allternit.com` | `https://allternit.com` |

### ❌ Prohibited Patterns (REMOVED)

| Pattern | Status |
|---------|--------|
| `allternit` | ✅ Removed |
| `allternit` | ✅ Removed |
| `allternit` | ✅ Removed |
| `architech` | ✅ Removed |

---

## Implementation Status

### ✅ Complete

1. **Architecture & Planning**
   - 4-plane architecture documented
   - Requirements specified
   - 5 ADRs completed

2. **Rebranding**
   - All directories renamed
   - All config files updated
   - All documentation updated

3. **Workspace Infrastructure**
   - Workspace exists at `~/Desktop/allternit-workspace/allternit/`
   - Kernel drivers implemented
   - Rails service exists
   - API layer exists

### ❌ Not Yet Implemented

1. **Cowork Runtime**
   - Location: `services/cowork/runtime/` (to be created)
   - Run lifecycle management
   - Attachment registry
   - Checkpoint/restore system

2. **Scheduler**
   - Location: `services/cowork/scheduler/` (to be created)
   - Cron evaluation
   - Schedule persistence

3. **CLI Cowork Commands**
   - Location: `cmd/gizzi-code/src/cowork/` (to be created)
   - `gizzi cowork start/attach/detach`
   - `gizzi cowork schedule`

---

## Workspace Comparison

### OLD Documentation (Wrong)
```
1-kernel/          → Didn't exist
7-apps/            → Didn't exist
6-ui/              → Didn't exist
```

### ACTUAL Structure (Correct)
```
domains/           → Domain logic ✅
api/               → API layer ✅
services/          → Services ✅
cmd/               → Commands ✅
```

### Proposed Additions
```
services/cowork/   → Cowork runtime (NEW)
cmd/gizzi-code/src/cowork/ → CLI (NEW)
```

---

## External Dependencies

### Rails System (EXISTS)
**Location:** `api/kernel/rails-service/`

```
Components:
- ✅ Ledger - Event sourcing
- ✅ Gate - Policy enforcement
- ✅ Leases - Distributed lease management
- ✅ WorkOps - DAG/work management
- ✅ ContextPacks - Execution snapshots
```

---

## Next Steps for Development

### Week 1: Create Cowork Services
1. Create `services/cowork/` directory
2. Create `services/cowork/runtime/` crate
3. Update workspace `Cargo.toml`

### Week 2: Core Runtime
1. Define Run/Job/Attachment types
2. Implement attachment registry
3. Create checkpoint system

### Week 3: Scheduler
1. Implement `services/cowork/scheduler/`
2. Build cron evaluation
3. Add schedule persistence

### Week 4: CLI Commands
1. Create `cmd/gizzi-code/src/cowork/`
2. Add `gizzi cowork` subcommands
3. Build TUI for event display

---

## Files You Should Know

### For Understanding the Platform
1. `~/spec/Vision.md` - Platform vision
2. `~/spec/Architecture.md` - 4-plane architecture
3. `~/spec/Requirements.md` - Functional requirements
4. `~/ACTUAL_WORKSPACE_STRUCTURE.md` - Real workspace structure

### For Development
1. `~/spec/IMPLEMENTATION_STATUS.md` - What's built vs. planned
2. `~/spec/GAP_ANALYSIS.md` - Analysis of gaps
3. `~/ALLTERNIT_GAPS_HARDENING_ANALYSIS.md` - Production hardening

### For Rebranding Reference
1. `~/REBRANDING_COMPLETION_REPORT.md` - What was done
2. `~/allternit-migration/scripts/` - Migration scripts

---

## Contact & Resources

### Domains
- Main: `allternit.com`
- Docs: `docs.allternit.com`
- Platform: `gizziio.com`
- API: `api.allternit.com`

### Workspace Location
```
~/Desktop/allternit-workspace/allternit/
```

---

## Summary

**The Allternit platform is now:**
- ✅ Properly branded
- ✅ Well-documented
- ✅ Workspace exists with infrastructure
- ❌ Cowork runtime needs to be added

**Key Finding:** The workspace exists at `~/Desktop/allternit-workspace/allternit/` with:
- Kernel drivers (domains/kernel/)
- Rails service (api/kernel/rails-service/)
- API layer (api/)
- Services (services/)

**To continue:** Add cowork runtime components to existing workspace.

---

**Document Version:** 3.0  
**Last Updated:** 2026-04-04  
**Status:** ACCURATE & UP-TO-DATE
