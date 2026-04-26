# Integration Analysis: Moved Files vs Existing Codebase

## Executive Summary

Files were moved from `/Users/macbook/domains/kernel/` and `/Users/macbook/cmd/` to the allternit workspace. **These are NOT duplicates** - they represent a parallel Rust-based implementation (Allternit) alongside the existing TypeScript/Rust hybrid codebase.

---

## 1. 7-APPS/CLI - Two Different CLIs

### Existing: `allternit-cli` (Original)
- **Binary name**: `allternit`
- **Language**: Rust
- **Purpose**: Allternit platform control (voice, webvm, marketplace integration)
- **Dependencies**: 
  - `voice-service`
  - `webvm-service` 
  - `marketplace`
  - `allternit-skill-portability`
  - SQLite, ratatui, axum

### Moved: `allternit-cli` (New)
- **Binary name**: `allternit`
- **Language**: Rust
- **Purpose**: VM-based code execution (Claude Code competitor)
- **Dependencies**:
  - `allternit-driver-interface` ✅ EXISTS
  - `allternit-session-manager` ❌ MISSING
  - `allternit-firecracker-driver` ✅ EXISTS
  - `allternit-apple-vf-driver` ❌ MISSING

**Conflict Level**: ⚠️ MEDIUM - Different binaries but overlapping functionality

---

## 2. 1-KERNEL/COWORK - Two Different Implementations

### Existing: TypeScript-Based Cowork System
| Component | Language | Purpose |
|-----------|----------|---------|
| `drivers/` | TS + C++ (native) | VM drivers (Apple VF, Firecracker) |
| `protocol/` | TypeScript | Wire protocol for guest agent |
| `sessions/` | TypeScript | Session lifecycle management |
| `sync/` | TypeScript | File sync between host/guest |
| `transport/` | TypeScript | VSOCK, virtio transports |

### Moved: Rust-Based Cowork System
| Component | Language | Purpose |
|-----------|----------|---------|
| `allternit-scheduler/` | Rust | Job/task scheduling |
| `allternit-cowork-runtime/` | Rust | Runtime for cowork sessions |

**Conflict Level**: 🔴 HIGH - Same functionality, different languages

---

## 3. Missing Dependencies (Blocking Builds)

### For cmd/cli (allternit-cli)
| Crate | Expected Location | Status | Impact |
|-------|------------------|--------|--------|
| `allternit-session-manager` | `domains/kernel/execution/allternit-session-manager` | ❌ MISSING | 🔴 HIGH - Required for session lifecycle |
| `allternit-apple-vf-driver` | `domains/kernel/execution/allternit-apple-vf-driver` | ❌ MISSING | 🟡 MEDIUM - macOS VM support |

### For domains/kernel/cowork
| Crate | Expected Location | Status | Impact |
|-------|------------------|--------|--------|
| `allternit-driver-interface` | Used by runtime | ✅ EXISTS | Already has interface |
| `allternit-vm-executor` | Used by runtime | ⚠️ CHECK | Referenced but commented out |
| `allternit-scheduler` deps | Standalone | ✅ OK | Uses standard crates only |

**Note**: `allternit-cowork-runtime` already has internal dependencies commented out - developers knew they were missing:
```toml
# Internal dependencies (add back when they exist)
# allternit-driver-interface = { workspace = true }
# allternit-vm-executor = { workspace = true }
```

---

## 4. Architecture Mismatch

### Current Allternit Architecture
```
surfaces/allternit-platform/ (Next.js + TypeScript)
  ↓ REST/WebSocket
services/gateway/ (Python)
  ↓ gRPC/HTTP
domains/kernel/ (Mixed TS + Rust)
  - cowork/ (TypeScript VM management)
  - execution/ (Rust drivers)
```

### Moved Allternit Architecture  
```
cmd/cli/ (Rust CLI)
  ↓ Direct library calls
domains/kernel/execution/ (Rust drivers)
  - allternit-session-manager (MISSING)
  - allternit-firecracker-driver (exists)
  - allternit-apple-vf-driver (MISSING)
```

**Gap**: No API layer - CLI talks directly to drivers instead of going through kernel services.

---

## 5. Integration Options

### Option A: Merge Implementations (Recommended)
**Keep the best of both:**

1. **CLI**: Merge allternit-cli features into allternit-cli
   - Add `allternit run` command to allternit CLI
   - Reuse existing driver infrastructure
   - Skip missing allternit-session-manager, use existing session system

2. **Cowork**: Keep TypeScript drivers, add Rust scheduler
   - TS drivers are more mature (apple-vf.ts, firecracker.ts)
   - Rust scheduler can be a microservice
   - Use protocol/ folder for communication

### Option B: Side-by-Side (Requires More Work)
**Keep both implementations:**

1. Create missing crates:
   - `domains/kernel/execution/allternit-session-manager`
   - `domains/kernel/execution/allternit-apple-vf-driver`

2. Add API gateway integration:
   - CLI → services/gateway → domains/kernel/drivers

3. Rename to avoid confusion:
   - `allternit-cli` → `allternit-executor`
   - Keep `allternit-cli` as main CLI

### Option C: Replace (High Risk)
**Replace TypeScript with Rust:**

1. Move `allternit-scheduler` and `allternit-cowork-runtime` to replace `cowork/sessions/`
2. Create missing driver crates
3. Update all references in surfaces/allternit-platform

**Risk**: Breaks existing UI, requires massive testing

---

## 6. Immediate Actions Required

### To Build allternit-cli:
```bash
# Need to create:
mkdir -p domains/kernel/execution/allternit-session-manager/src
mkdir -p domains/kernel/execution/allternit-apple-vf-driver/src

# Or remove from Cargo.toml dependencies
```

### To Integrate with Existing System:
```bash
# Option 1: Add cowork commands to allternit-cli
cp cmd/cli/src/cowork/* cmd/cli/src/commands/cowork/

# Option 2: Rename to avoid conflict
mv cmd/cli cmd/allternit-executor
```

---

## 7. File Inventory

### Moved Files Status
| File | Location | Status | Action Needed |
|------|----------|--------|---------------|
| HANDOFF.md | cmd/cli/ | ✅ Document | Reference only |
| COWORK.md | cmd/cli/ | ⚠️ Overlap | Merge with existing docs |
| allternit-cli source | cmd/cli/src/ | ⚠️ Conflict | Decide integration option |
| allternit-scheduler | domains/kernel/cowork/ | ✅ New | Check dependencies |
| allternit-cowork-runtime | domains/kernel/cowork/ | ✅ New | Check dependencies |

---

## 8. Recommendation

**Go with Option A (Merge)**, specifically:

1. **Keep allternit-cli as the main CLI**
   - It has better integration (voice, webvm, marketplace)
   - Uses existing workspace dependency system

2. **Port allternit-cli's unique features**
   - `allternit run` → `allternit run` (VM execution)
   - `allternit sessions` → `allternit sessions` 
   - Cowork commands → Integrate with existing cowork system

3. **Use existing drivers**
   - `domains/kernel/execution/allternit-firecracker-driver` ✅
   - `domains/kernel/cowork/drivers/` (TypeScript) ✅
   - Skip missing `allternit-apple-vf-driver` (use TS version)

4. **Archive or repurpose moved files**
   - allternit-cli: Port features, then archive
   - allternit-scheduler: Keep as standalone service
   - allternit-cowork-runtime: Evaluate vs existing cowork/

---

*Generated: 2026-03-13*
