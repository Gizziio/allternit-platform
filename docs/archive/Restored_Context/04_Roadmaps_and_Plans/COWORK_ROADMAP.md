# Allternit Cowork Runtime - Implementation Roadmap

## Overview

The **Cowork Runtime** is the VM-based code execution system. The Cron Scheduler (just completed) is the job scheduler that triggers Cowork tasks.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  CLI         │  │  Desktop App │  │  Shell UI    │  │  Cron Jobs   │     │
│  │  (gizzi)     │  │  (Electron)  │  │  (React)     │  │  (Scheduler) │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │              │
│         └─────────────────┴─────────┬───────┴─────────────────┘              │
│                                     │                                        │
│                         ┌───────────▼───────────┐                           │
│                         │   Cowork Runtime      │  ◄── What we build next    │
│                         │   (VM Orchestrator)   │                           │
│                         └───────────┬───────────┘                           │
│                                     │                                        │
│         ┌───────────────────────────┼───────────────────────────┐           │
│         │                           │                           │           │
│         ▼                           ▼                           ▼           │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │  Apple VF    │          │  Firecracker │          │  Docker      │      │
│  │  (macOS)     │          │  (Linux)     │          │  (Fallback)  │      │
│  └──────┬───────┘          └──────┬───────┘          └──────┬───────┘      │
│         │                         │                         │              │
│         ▼                         ▼                         ▼              │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │  Linux VM    │          │  MicroVM     │          │  Container   │      │
│  │  (VZ)        │          │  (FC)        │          │  (Docker)    │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## What We Just Built (Cron Scheduler)

✅ **Job Scheduling System**
- SQLite persistence
- Natural language parsing
- Multiple job types (shell, http, agent, cowork)
- Timezone support
- Retry logic
- Event system
- HTTP API

This feeds jobs **into** the Cowork Runtime.

---

## What We Build Next (Cowork Runtime)

### Phase 1: VM Drivers (Priority: CRITICAL)

#### 1.1 Apple Virtualization Driver (macOS)
```typescript
// domains/kernel/cowork/drivers/apple-vf.ts
export class AppleVFDriver implements VMDriver {
  async createVM(config: VMConfig): Promise<VM> {
    // Uses Apple Virtualization.framework
    // - VZVirtualMachineConfiguration
    // - VZLinuxBootLoader
    // - VZVirtioSocket for communication
  }
  
  async startVM(vm: VM): Promise<void> {
    // Start VM with kernel + initrd + rootfs
  }
  
  async execute(vm: VM, command: string): Promise<ExecutionResult> {
    // Send command via VZVirtioSocket
  }
}
```

**Files to Create:**
- `domains/kernel/cowork/drivers/apple-vf.ts` - macOS VM driver
- `domains/kernel/cowork/drivers/firecracker.ts` - Linux VM driver
- `domains/kernel/cowork/drivers/docker.ts` - Fallback container driver

#### 1.2 VM Image Management
```typescript
// domains/kernel/cowork/images/manager.ts
export class VMImageManager {
  async downloadImage(version: string): Promise<string> {
    // Download from GitHub Releases:
    // - vmlinux-6.5.0-allternit-arm64
    // - initrd.img-6.5.0-allternit-arm64
    // - ubuntu-22.04-allternit-v1.0.0.ext4.zst
  }
  
  async buildImage(options: BuildOptions): Promise<string> {
    // Linux only: Use debootstrap to build from scratch
  }
  
  async verifyImage(path: string): Promise<boolean> {
    // Checksum verification
  }
}
```

**Files to Create:**
- `domains/kernel/cowork/images/manager.ts` - Download/build/verify images
- `domains/kernel/cowork/images/registry.ts` - Track available images
- `.github/workflows/vm-images.yml` - CI/CD for image building

---

### Phase 2: VM Executor (Priority: CRITICAL)

#### 2.1 allternit-vm-executor (Rust Binary)
```rust
// domains/kernel/execution/allternit-vm-executor/src/main.rs
#[tokio::main]
async fn main() {
    // Runs INSIDE the VM
    // Listens on VSOCK (port 8080)
    // Receives commands from host via allternit-guest-agent-protocol
    // Executes in bubblewrap sandboxes
    // Returns results
}
```

**Already Created:**
- ✅ `domains/kernel/execution/allternit-vm-executor/` - VM agent binary

#### 2.2 Host ↔ VM Communication
```typescript
// domains/kernel/cowork/transport/vsock.ts (macOS: VZVirtioSocket)
export class VSockTransport {
  async connect(vmId: string, port: number): Promise<Connection> {
    // macOS: VZVirtioSocketListener
    // Linux: AF_VSOCK socket
  }
  
  async send(message: AgentMessage): Promise<void> {
    // Send via allternit-guest-agent-protocol
  }
  
  async receive(): Promise<AgentResponse> {
    // Receive response
  }
}
```

**Files to Create:**
- `domains/kernel/cowork/transport/vsock.ts` - VM socket communication
- `domains/kernel/cowork/protocol/codec.ts` - Message encoding/decoding

---

### Phase 3: Desktop Integration (Priority: HIGH)

#### 3.1 Desktop App VM Manager
```typescript
// surfaces/desktop/src/vm/manager.ts
export class VmManager {
  private driver: VMDriver;
  private vm: VM | null = null;
  
  async initialize(): Promise<void> {
    // Detect platform (macOS/Linux)
    // Initialize appropriate driver
    // Download VM images if needed
  }
  
  async startVM(): Promise<void> {
    // Start persistent VM
    // Launch allternit-vm-executor inside
    // Start socket server for CLI connections
  }
  
  async execute(command: string): Promise<ExecutionResult> {
    // Send to VM executor
    // Stream results back
  }
}
```

**Files to Create:**
- ✅ `surfaces/desktop/src/vm/manager.ts` - VM lifecycle management
- ✅ `surfaces/desktop/src/vm/socket-server.ts` - Unix socket server
- `surfaces/desktop/src/vm/ipc.ts` - Electron IPC handlers

#### 3.2 CLI Socket Client
```typescript
// cmd/gizzi-code/src/cli/sessions/vm.ts
export class VMSession implements Session {
  async execute(command: string): Promise<Result> {
    // Connect to /var/run/allternit/desktop-vm.sock
    // Send command via allternit-guest-agent-protocol
    // Fallback to LocalSession if desktop not running
  }
}
```

**Files to Create:**
- `cmd/gizzi-code/src/cli/sessions/vm.ts` - VM session client
- `cmd/gizzi-code/src/cli/daemon-client.ts` - Desktop daemon client

---

### Phase 4: Onboarding (Priority: HIGH)

#### 4.1 First-Time Setup Wizard
```typescript
// surfaces/desktop/src/components/onboarding/Wizard.tsx
export function OnboardingWizard() {
  // Step 1: Internet connectivity check
  // Step 2: Platform detection (macOS/Linux)
  // Step 3: Download VM images (~500MB)
  // Step 4: Initialize VM (first boot)
  // Step 5: Verify everything works
}
```

**Files to Create:**
- ✅ `surfaces/ONBOARDING_WIZARD_SPEC.md` - UI specification
- ✅ `surfaces/desktop/src/components/onboarding/Wizard.tsx` - React component
- `surfaces/desktop/src/components/onboarding/steps/*.tsx` - Individual steps

---

### Phase 5: Advanced Features (Priority: MEDIUM)

#### 5.1 File Sync
```typescript
// domains/kernel/cowork/sync/filesync.ts
export class FileSync {
  async syncToVM(hostPath: string, vmPath: string): Promise<void> {
    // Use VirtioFS (macOS) or 9P (Linux)
    // Or rsync for initial sync
  }
  
  async syncFromVM(vmPath: string, hostPath: string): Promise<void> {
    // Bidirectional sync
  }
  
  watch(hostPath: string, callback: (event) => void): Watcher {
    // File system watcher
  }
}
```

#### 5.2 Session Multiplexing
```typescript
// domains/kernel/cowork/sessions/manager.ts
export class SessionManager {
  private sessions = new Map<string, Session>();
  
  async createSession(id: string): Promise<Session> {
    // Multiple concurrent sessions
    // Each with isolated environment
  }
  
  async forkSession(fromId: string, toId: string): Promise<Session> {
    // Copy session state
  }
}
```

---

## Implementation Order

### Week 1-2: VM Drivers
1. Apple Virtualization driver (macOS)
2. Firecracker driver (Linux)
3. Docker fallback driver
4. VM image download/management

### Week 3: Communication
1. VSOCK/VZVirtioSocket transport
2. allternit-vm-executor integration
3. Protocol codec

### Week 4: Desktop Integration
1. Desktop VM manager
2. Socket server
3. CLI client

### Week 5: Onboarding
1. Setup wizard UI
2. Image download progress
3. First-run initialization

### Week 6: Polish
1. File sync
2. Session multiplexing
3. Error handling
4. Testing

---

## Key Files Status

### Already Created
- ✅ `cmd/gizzi-code/src/runtime/automation/cron/` - Cron scheduler
- ✅ `domains/kernel/execution/allternit-vm-executor/` - VM agent binary
- ✅ `domains/kernel/execution/allternit-vm-image-builder/` - Image builder
- ✅ `surfaces/desktop/src/vm/manager.ts` - VM manager skeleton
- ✅ `surfaces/desktop/src/vm/socket-server.ts` - Socket server skeleton
- ✅ `surfaces/ONBOARDING_WIZARD_SPEC.md` - Onboarding spec

### To Be Created
- 🔄 `domains/kernel/cowork/drivers/` - VM drivers
- 🔄 `domains/kernel/cowork/transport/` - VM communication
- 🔄 `cmd/gizzi-code/src/cli/sessions/vm.ts` - CLI VM client
- 🔄 `surfaces/desktop/src/components/onboarding/` - Onboarding UI

---

## Integration Points

### Cron → Cowork
```typescript
// Cron job triggers Cowork execution
const job = CronServiceEnhanced.create({
  name: "Nightly Tests",
  type: "cowork",
  schedule: "0 2 * * *",
  config: {
    runtime: "vm",           // Run in VM
    image: "ubuntu-22.04",   // Use this VM image
    commands: ["npm test"],  // Execute tests
    resources: {
      cpus: 4,
      memory: "8g",
    },
  },
});
```

### CLI → Cowork
```bash
# Run command in VM
allternit run "npm test"

# Execute in specific VM
allternit run --vm ubuntu-22.04 "python script.py"

# Interactive session
allternit shell
```

### Desktop → Cowork
- Desktop app manages persistent VM
- File watcher syncs changes
- IDE integration via extensions

---

## Success Criteria

1. ✅ **Cron Scheduler** - DONE
2. 🔄 **VM Execution** - Can run commands in isolated VMs
3. 🔄 **Desktop Integration** - Works with Electron app
4. 🔄 **CLI Integration** - Commands go to VM by default
5. 🔄 **Onboarding** - New users can set up in <5 minutes
6. 🔄 **File Sync** - Changes sync bidirectionally

---

## Next Action

**Start with:** `domains/kernel/cowork/drivers/apple-vf.ts`

This is the macOS VM driver using Apple Virtualization.framework. It's the foundation everything else builds on.

```bash
# First, research Apple Virtualization API
# Then implement:
# - VM configuration (kernel, initrd, rootfs)
# - VM lifecycle (create, start, stop)
# - Socket communication (VZVirtioSocket)
```
