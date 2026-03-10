# A2R Architecture Parity with Claude Code

## Goal
Achieve feature parity with Claude Code's VM-based code execution architecture.

---

## Naming Distinction (IMPORTANT)

To avoid confusion in the codebase:

| Name | What It Is | Location |
|------|------------|----------|
| **A2RCHITECH** | The AI agent system that runs on the host | Host (macOS/Linux) |
| **a2r-vm-executor** | Daemon that runs INSIDE the Linux VM | Inside VM |
| **a2r-guest-agent-protocol** | Protocol for host ↔ VM communication | Shared library |
| **a2r-vm-image-builder** | Tool to build/download VM images | Host |

---

## VM Image Distribution

### Platform Support

| Platform | Download | Build Local | Notes |
|----------|----------|-------------|-------|
| **macOS** | ✅ Yes | ❌ No | Uses Apple Virtualization.framework |
| **Linux** | ✅ Yes | ✅ Yes | Uses Firecracker |
| **Windows** | 🚧 Planned | ❌ No | WSL2 support planned |

### Download Mode (All Platforms)

Pre-built images hosted on GitHub Releases:
```
https://github.com/a2r-platform/vm-images/releases

Images:
├── vmlinux-6.5.0-a2r-{arch}           # Linux kernel
├── initrd.img-6.5.0-a2r-{arch}        # Initial ramdisk  
├── ubuntu-22.04-a2r-v{version}.ext4.zst  # Rootfs (compressed)
└── version-{version}-{arch}.json      # Metadata + checksums

Architectures: x86_64 (amd64), aarch64 (arm64)
Size: ~500 MB download, ~2 GB uncompressed
```

### Build Mode (Linux Only)

For users who want full transparency or custom images:
```bash
# Linux only - requires debootstrap
a2r-vm-image-builder build --ubuntu-version 22.04

Requirements:
- Linux system (Ubuntu/Debian recommended)
- debootstrap package
- sudo access
- 10 GB free disk space
- 15-30 minutes build time
```

---

## Claude Code Full Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLAUDE CODE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DESKTOP APP (Electron)                          │   │
│  │                                                                     │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │   │
│  │  │ Main Window │    │  VM Manager │    │   File System       │   │   │
│  │  │             │◄──►│             │◄──►│   Watcher           │   │   │
│  │  └─────────────┘    └──────┬──────┘    └─────────────────────┘   │   │
│  │                            │                                      │   │
│  │                            ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │            PERSISTENT VM (macOS: Apple VF)                  │ │   │
│  │  │                     (Linux: Firecracker)                    │ │   │
│  │  │                                                             │ │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │   │
│  │  │  │ a2r-vm-     │  │  Toolchains │  │   Workspace Mount   │ │ │   │
│  │  │  │ executor    │  │node,python,│  │   /workspace        │ │ │   │
│  │  │  │  (daemon)   │  │   docker    │  │                     │ │ │   │
│  │  │  └──────┬──────┘  └─────────────┘  └─────────────────────┘ │ │   │
│  │  │         │                                                  │ │   │
│  │  └─────────┼──────────────────────────────────────────────────┘ │   │
│  │            │                                                    │   │
│  │            │  Unix Socket (/var/run/a2r/desktop-vm.sock)        │   │
│  └────────────┼────────────────────────────────────────────────────┘   │
│               │                                                          │
│  ┌────────────┼────────────────────────────────────────────────────┐    │
│  │            ▼           CLI (Separate Process)                   │    │
│  │  ┌─────────────────────────────────────────────────────────────┐│    │
│  │  │  $ a2r run "npm test"                                      ││    │
│  │  │                                                            ││    │
│  │  │  1. Check socket exists                                   ││    │
│  │  │  2. Connect to desktop VM via Unix socket                 ││    │
│  │  │  3. Send command to a2r-vm-executor                       ││    │
│  │  │  4. Stream results back                                   ││    │
│  │  │                                                            ││    │
│  │  │  If socket not found:                                     ││    │
│  │  │     - Start desktop app OR                                ││    │
│  │  │     - Use local mode (limited features)                   ││    │
│  │  └─────────────────────────────────────────────────────────────┘│    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## A2R Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              A2R CURRENT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DESKTOP APP (Electron) 🟡 ALMOST DONE           │   │
│  │                                                                     │   │
│  │  Status: UI components exist, VM integration needed                │   │
│  │                                                                     │   │
│  │  Missing:                                                           │   │
│  │  - VM Manager integration ❌                                       │   │
│  │  - Onboarding wizard (internet check, download UI) ❌              │   │
│  │  - Unix socket server ❌                                           │   │
│  │  - File system watcher ❌                                          │   │
│  │  - a2r-vm-executor spawner ❌                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CLI ✅ BUILT                                │   │
│  │                                                                     │   │
│  │  ✅ Local execution (bubblewrap)                                   │   │
│  │  ✅ AppleVfDriver (dedicated thread)                               │   │
│  │  ✅ FirecrackerDriver (Linux VMs)                                  │   │
│  │  ✅ a2r-guest-agent-protocol v1.1.0                                │   │
│  │  ✅ Session multiplexing                                           │   │
│  │                                                                     │   │
│  │  ❌ Desktop app integration (socket connection)                    │   │
│  │  ❌ VM image distribution (builder just created)                   │   │
│  │  ❌ a2r-vm-executor binary (just created)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    VM IMAGES ✅ CREATED                             │   │
│  │                                                                     │   │
│  │  NEW: a2r-vm-image-builder                                          │   │
│  │                                                                     │   │
│  │  Download Mode (all platforms):                                     │   │
│  │  - Downloads from GitHub Releases (~500MB)                         │   │
│  │  - Progress UI in onboarding wizard                                │   │
│  │                                                                     │   │
│  │  Build Mode (Linux only):                                           │   │
│  │  - Builds from Ubuntu base + debootstrap                           │   │
│  │  - Full transparency and customization                             │   │
│  │  - Requires Linux, debootstrap, 10GB space                         │   │
│  │  - 15-30 minutes build time                                        │   │
│  │                                                                     │   │
│  │  NO Docker builder (removed per user request)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    a2r-vm-executor ✅ CREATED                       │   │
│  │                                                                     │   │
│  │  Binary that runs INSIDE the VM:                                    │   │
│  │  - Listens on VSOCK (port 8080)                                    │   │
│  │  - Receives commands from host                                     │   │
│  │  - Executes in bubblewrap sandboxes                                │   │
│  │  - Returns results via a2r-guest-agent-protocol                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gap Analysis

### 1. Desktop App Integration

| Component | Claude Code | A2R | Status |
|-----------|-------------|-----|--------|
| VM Lifecycle Manager | ✅ Persistent VM | 🟡 Needs integration | Required |
| Unix Socket Server | ✅ Exposes socket | ❌ Not implemented | **BLOCKER** |
| File System Watcher | ✅ Watches workspace | ❌ Not implemented | Required |
| a2r-vm-executor Spawner | ✅ Starts agent in VM | ❌ Not implemented | **BLOCKER** |
| Onboarding Wizard | ✅ Built-in | 🟡 Spec created, needs UI | **BLOCKER** |

### 2. CLI ↔ Desktop Communication

| Feature | Claude Code | A2R | Status |
|---------|-------------|-----|--------|
| Socket discovery | ✅ /var/run/claude-desktop.sock | ❌ Need to implement | **BLOCKER** |
| Protocol over socket | ✅ Proprietary | ✅ a2r-guest-agent-protocol ready | Done |
| Fallback to local | ✅ Auto-fallback | ✅ Already works | Done |
| Start desktop from CLI | ✅ Spawns app | ❌ Not implemented | Nice to have |

### 3. VM Images

| Component | Claude Code | A2R | Status |
|-----------|-------------|-----|--------|
| Linux kernel (macOS) | ✅ Bundled | 🟡 a2r-vm-image-builder downloads | Needs hosting |
| Rootfs base image | ✅ Ubuntu 22.04 | 🟡 Builder creates | Needs hosting |
| a2r-vm-executor inside | ✅ Inside VM | ✅ Builder installs | Done |
| Pre-installed tools | ✅ node, python, docker | ✅ Configured in builder | Done |
| A2R environment | ✅ Configured | ✅ Configured in builder | Done |

### 4. a2r-vm-executor

| Feature | Claude Code | A2R | Status |
|---------|-------------|-----|--------|
| Protocol implementation | ✅ Custom | ✅ a2r-guest-agent-protocol | Done |
| Binary that runs in VM | ✅ Go/Rust binary | ✅ a2r-vm-executor crate | Done |
| Session management | ✅ | ✅ | Done |
| Command execution | ✅ | ✅ | Done |
| File operations | ✅ | 🟡 Partial | Needs work |

### 5. Cron/Scheduler (NEW - Unified Implementation)

| Feature | Claude Code | A2R (Old) | A2R (New) | Status |
|---------|-------------|-----------|-----------|--------|
| Schedule jobs | ❌ Not a feature | ✅ Rust + TS (dual) | ✅ TypeScript only | **DONE** |
| SQLite persistence | ❌ N/A | ✅ (Rust) | ✅ (Bun native) | Done |
| HTTP API | ❌ N/A | ✅ (Rust) | ✅ (enhanced) | Done |
| Natural language | ❌ N/A | ❌ | ✅ "every 5 mins" | Done |
| Multiple job types | ❌ N/A | cowork only | shell, http, agent, cowork | Done |
| CLI commands | ❌ N/A | ❌ | ✅ Full CLI | Done |
| Daemon mode | ❌ N/A | ✅ (Rust) | ✅ TypeScript | Done |

**Migration:** See `CRON_MIGRATION.md` for details on consolidating from dual Rust/TS to unified TypeScript.

**Key Features:**
- Natural language: `a2r cron add "backup every day at 2am"`
- Multiple types: shell, HTTP, agent tasks, cowork sessions
- Rich CLI: list, logs, run, status, wake
- HTTP API: Port 3031 for remote management
- SQLite persistence: `~/.a2r/cron.db`

---

## Implementation Plan

### Phase 1: GitHub Releases Setup (Priority: CRITICAL)

1. **Create repo** `a2r-platform/vm-images`
2. **Run CI/CD** to build initial images
3. **Upload** v1.1.0 release with x86_64 and ARM64 images
4. **Test** download with `a2r-vm-image-builder`

### Phase 2: Desktop App VM Manager (Priority: CRITICAL)

```rust
// 6-ui/desktop/src/vm/manager.ts (CREATED)
// - VmManager class
// - Platform-specific drivers (Apple VF / Firecracker)
// - Socket server for CLI connections
// - Health monitoring
```

### Phase 3: Onboarding Wizard (Priority: CRITICAL)

**File:** `/Users/macbook/6-ui/ONBOARDING_WIZARD_SPEC.md`

**Key features:**
1. Internet connectivity check
2. Download progress UI (all platforms)
3. VM initialization status
4. Local mode fallback

**Platform-specific behavior:**
- macOS: Shows download mode only
- Linux: Shows download mode, mentions build option

### Phase 4: CLI Socket Integration (Priority: HIGH)

```rust
// 7-apps/cli/src/sessions/macos.rs (UPDATE)
// - Connect to /var/run/a2r/desktop-vm.sock
// - Send commands via a2r-guest-agent-protocol
// - Fallback to LocalSession if socket unavailable
```

---

## VM Image Builder

### Download Mode (All Platforms)

```bash
# Download pre-built images
a2r-vm-image-builder download

# Check for updates
a2r-vm-image-builder check-update

# Force re-download
a2r-vm-image-builder download --force

# Verify images
a2r-vm-image-builder verify
```

### Build Mode (Linux Only)

```bash
# Build from scratch (Linux only)
a2r-vm-image-builder build --ubuntu-version 22.04

# With custom packages
a2r-vm-image-builder build --packages "awscli,golang"

# Without toolchains (smaller image)
a2r-vm-image-builder build --no-toolchains
```

### Platform Restrictions

| Command | macOS | Linux |
|---------|-------|-------|
| `download` | ✅ | ✅ |
| `build` | ❌ Error | ✅ |
| `check-update` | ✅ | ✅ |
| `verify` | ✅ | ✅ |
| `clean` | ✅ | ✅ |

### Build Prerequisites (Linux)

```bash
# Ubuntu/Debian
sudo apt-get install debootstrap qemu-utils e2fsprogs zstd

# Check prerequisites
a2r-vm-image-builder build --dry-run
```

---

## Implementation Checklist

### CI/CD (`.github/workflows/vm-images.yml`)

- [x] Build x86_64 images on Ubuntu
- [x] Build ARM64 images on Ubuntu with QEMU
- [x] Upload to GitHub Releases
- [x] Create version manifests
- [ ] Create `a2r-platform/vm-images` repo
- [ ] Run initial build

### Desktop App (6-ui/)

- [x] VmManager module created
- [x] SocketServer created
- [x] Onboarding Wizard UI spec
- [x] Onboarding Wizard React components
- [ ] Integrate VmManager with Electron main process
- [ ] Add IPC handlers for wizard
- [ ] File system watcher

### CLI (7-apps/cli/)

- [x] Socket connection skeleton
- [ ] Actually connect and communicate
- [ ] Handle connection failures gracefully
- [ ] Better fallback logic
- [ ] Setup command (`a2r setup`)

### VM Image Builder (1-kernel/execution/a2r-vm-image-builder/)

- [x] Download mode
- [x] Build mode (Linux only)
- [x] Platform detection
- [x] Clear error messages for unsupported platforms
- [ ] GitHub Releases hosting

### a2r-vm-executor (1-kernel/execution/a2r-vm-executor/)

- [x] Binary crate
- [x] VSOCK listener (Linux)
- [x] Session management
- [x] Bubblewrap sandbox
- [ ] VZVirtioSocket listener (macOS VMs)

---

## Next Steps

1. **Create GitHub repo** `a2r-platform/vm-images`
2. **Run CI/CD** to build and upload initial images
3. **Test download** works on macOS and Linux
4. **Integrate desktop app** components
5. **Test full flow**: Desktop app → VM → CLI → Command execution

---

## Resources Created

- `/Users/macbook/ARCHITECTURE_PARITY.md` - This document
- `/Users/macbook/6-ui/ONBOARDING_WIZARD_SPEC.md` - Onboarding UI spec
- `/Users/macbook/1-kernel/execution/a2r-vm-executor/` - VM executor binary
- `/Users/macbook/1-kernel/execution/a2r-vm-image-builder/` - Image builder tool
- `/Users/macbook/1-kernel/infrastructure/a2r-guest-agent-protocol/` - Protocol library
- `/Users/macbook/.github/workflows/vm-images.yml` - CI/CD pipeline
- `/Users/macbook/6-ui/desktop/src/vm/manager.ts` - Desktop VM manager
- `/Users/macbook/6-ui/desktop/src/vm/socket-server.ts` - Unix socket server
- `/Users/macbook/6-ui/desktop/src/components/onboarding/Wizard.tsx` - Onboarding UI
- `/Users/macbook/cmd/gizzi-code/src/runtime/automation/cron/` - Unified TypeScript Cron
  - `types.ts` - Core type definitions
  - `parser.ts` - Natural language schedule parsing
  - `database.ts` - SQLite persistence layer
  - `service.ts` - Core CronService with job execution
  - `daemon.ts` - HTTP daemon for background scheduling
  - `index.ts` - Public API exports
- `/Users/macbook/cmd/gizzi-code/src/cli/commands/cron.ts` - CLI commands for cron
- `/Users/macbook/CRON_MIGRATION.md` - Migration guide from Rust to TypeScript

---

## Summary of Changes

**Removed:**
- ❌ Docker-based builder (user requested)

**Simplified:**
- macOS: Download mode only
- Linux: Download (default) or build (advanced)

**Result:** Cleaner architecture, less maintenance, clearer platform boundaries.
