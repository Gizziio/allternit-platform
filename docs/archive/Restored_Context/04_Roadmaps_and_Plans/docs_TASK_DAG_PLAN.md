# Allternit Platform - Error Analysis and DAG Task Plan

**Generated:** 2026-02-23  
**Goal:** Fix all blocking errors to make `allternit start` work correctly

---

## Executive Summary

**Total Blocking Errors:** 14  
**Affected Components:** 4 (CLI, API, Services Config, Electron)  
**Estimated Fix Complexity:** Medium (all are code fixes, no architectural changes)

---

## Error Inventory

### Category 1: Rust Compilation Errors (CLI)

| ID | Error Code | Location | Description | Priority |
|----|------------|----------|-------------|----------|
| CLI-001 | E0583 | `cmd/cli/src/command_registry/` | File not found for module `client` | P0 |
| CLI-002 | E0433 | `cmd/cli/src/command_registry/mod.rs` | Unresolved import `lazy_static` | P0 |
| CLI-003 | E0425 | `cmd/cli/src/command_registry/mod.rs` | Cannot find value `REGISTRY` | P0 |
| CLI-004 | E0624 | `cmd/cli/src/commands/tui.rs` | Method `push_system` is private (3 occurrences) | P0 |

### Category 2: Rust Compilation Errors (API)

| ID | Error Code | Location | Description | Priority |
|----|------------|----------|-------------|----------|
| API-001 | E0432 | `domains/kernel/infrastructure/allternit-openclaw-host/` | Unresolved imports `ChatChunk`, `ChunkType` | P0 |
| API-002 | E0382 | `domains/kernel/infrastructure/allternit-openclaw-host/` | Borrow of moved value | P0 |
| API-003 | E0599 | `domains/kernel/infrastructure/allternit-openclaw-host/` | Method `get_session_mut` not found | P0 |
| API-004 | E0616 | `domains/kernel/infrastructure/allternit-openclaw-host/` | Field `0` of `SessionId` is private | P0 |
| API-005 | E0308 | `domains/kernel/infrastructure/allternit-openclaw-host/` | Mismatched types (2 occurrences) | P0 |
| API-006 | E0592 | `domains/kernel/infrastructure/allternit-openclaw-host/` | Duplicate definitions with name `to_sse_event` | P0 |

### Category 3: Services Configuration

| ID | Issue | Location | Description | Priority |
|----|-------|----------|-------------|----------|
| SVC-001 | Circular dependency | `.allternit/services.json` | API service runs `allternit up` which runs orchestrator | P0 |
| SVC-002 | Missing service | `.allternit/services.json` | Gateway not in startup graph | P1 |
| SVC-003 | Wrong binary path | `.allternit/services.json` | API binary path incorrect | P1 |

### Category 4: Electron Desktop App

| ID | Issue | Location | Description | Priority |
|----|-------|----------|-------------|----------|
| ELE-001 | Install failure | `cmd/shell-electron/` | Electron not installed correctly | P0 |
| ELE-002 | Wrong binary path | `main/sidecar-integration.cjs` | Looks for API in wrong location | P1 |

---

## DAG Task Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: Foundation (P0)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ TASK-CLI-001  │           │ TASK-API-001  │           │ TASK-ELE-001  │
│ Fix CLI       │           │ Fix API       │           │ Fix Electron  │
│ lazy_static   │           │ openclaw-host │           │ install       │
│ REGISTRY      │           │ session mgmt  │           │               │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: Integration (P1)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   TASK-SVC-001        │
                        │   Fix services.json   │
                        │   - Remove circular   │
                        │   - Add gateway       │
                        └───────────┬───────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 3: Verification (P2)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   TASK-VERIFY-001     │
                        │   Test allternit start      │
                        │   All services up     │
                        └───────────────────────┘
```

---

## Task Definitions

### TASK-CLI-001: Fix CLI Compilation Errors

**Files:**
- `cmd/cli/src/command_registry/mod.rs`
- `cmd/cli/src/commands/tui.rs`

**Fixes Required:**
1. Add missing `client.rs` file or fix module path
2. Add `lazy_static` dependency to `Cargo.toml`
3. Define or import `REGISTRY` value
4. Make `push_system` method public or use correct API

**Estimated Time:** 30 minutes

---

### TASK-API-001: Fix API Service Compilation

**Files:**
- `domains/kernel/infrastructure/allternit-openclaw-host/src/*.rs`

**Fixes Required:**
1. Fix imports for `ChatChunk`, `ChunkType`
2. Fix borrow checker issues (moved value)
3. Fix `get_session_mut` method call
4. Fix `SessionId` field access (use getter method)
5. Fix type mismatches
6. Remove duplicate `to_sse_event` definition

**Estimated Time:** 60 minutes

---

### TASK-ELE-001: Fix Electron Installation

**Files:**
- `cmd/shell-electron/package.json`
- `pnpm-workspace.yaml`

**Fixes Required:**
1. Add proper postinstall script for Electron
2. Add Electron to allowed build dependencies
3. Fix workspace patterns if needed

**Estimated Time:** 15 minutes

---

### TASK-SVC-001: Fix Services Configuration

**Files:**
- `.allternit/services.json`

**Fixes Required:**
1. Remove `allternit up` from API service command
2. Add gateway service to startup graph
3. Fix binary paths (use debug/release correctly)
4. Fix health check endpoints

**Estimated Time:** 20 minutes

---

### TASK-VERIFY-001: Verify Full Platform Start

**Success Criteria:**
- `allternit start` completes without errors
- All services show healthy in `allternit status`
- Electron app spawns automatically
- Gateway accessible on port 3210
- Kernel accessible on port 3004

**Estimated Time:** 15 minutes

---

## Execution Order

```
1. TASK-CLI-001  ─┐
                  │
2. TASK-API-001  ─┼──▶ 3. TASK-ELE-001  ─▶  4. TASK-SVC-001  ─▶  5. TASK-VERIFY-001
                  │
   (Can run in parallel)
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API errors cascade | Medium | High | Fix one error at a time, compile after each |
| Breaking changes | Low | Medium | Test each fix with existing tests |
| Dependency conflicts | Low | Low | Use workspace versions consistently |

---

## Success Metrics

1. ✅ `cargo build -p allternit-cli` succeeds
2. ✅ `cargo build -p allternit-api` succeeds
3. ✅ `pnpm install` succeeds without errors
4. ✅ `allternit start` launches all services
5. ✅ `allternit status` shows all services healthy
6. ✅ Electron app spawns automatically

---

## Next Steps

1. **Assign TASK-CLI-001** - Highest priority (blocks CLI)
2. **Assign TASK-API-001** - Parallel with CLI
3. **Assign TASK-ELE-001** - Quick win
4. **Assign TASK-SVC-001** - After Rust fixes
5. **Run TASK-VERIFY-001** - Final verification

---

**Document Owner:** Systems Architect  
**Review Cycle:** After each task completion
