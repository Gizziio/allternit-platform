# VM Runtime (vfkit-based)

Replaces the Swift VM Manager + Node wrapper with a pure TypeScript/Bun solution.

## Why vfkit?

The original stack required building **three things locally**, all of which fail on this machine:

| Component | Build Tool | Local Status |
|-----------|-----------|--------------|
| VM image | `debootstrap`, cross-compile Rust | ❌ macOS can't run debootstrap |
| Guest agent | `cargo` (Linux target) | ❌ Needs GBs of RAM + Linux toolchain |
| VM manager | `swift build` | ❌ OOM (~50MB free, needs 2-4GB) |

**vfkit** (from Red Hat's CRC team) is a pre-built binary that exposes Apple Virtualization.framework via CLI. It handles VM lifecycle, VSOCK → Unix socket forwarding, virtio-fs mounts, and networking. No compilation needed.

## Architecture

```
Host (macOS)
  └── vfkit process (brew install vfkit)
        ├── boots Apple VZ VM with kernel + initrd + rootfs
        ├── exposes VSOCK port 8080 as Unix socket
        └── mounts workspace via virtio-fs
  └── GuestAgentClient (TypeScript)
        └── connects to Unix socket
        └── speaks length-prefixed JSON protocol
              └── Linux VM
                    └── allternit-vm-executor (Rust, systemd)
                          └── bubblewrap sessions
```

## Files

| File | Purpose |
|------|---------|
| `vfkit-manager.ts` | Spawns vfkit, monitors process, connects guest agent |
| `guest-agent-client.ts` | VSOCK-over-Unix-socket client with request/response matching |
| `vm-image-download.ts` | Downloads CI-built VM images from GitHub Releases |
| `index.ts` | Public exports |

## Protocol

Messages are length-prefixed JSON:

```
[4 bytes: payload length, big-endian][N bytes: JSON payload]
```

This matches the Rust `serialize_message` / `deserialize_message` in `allternit-guest-agent-protocol`.

## Usage

```typescript
import { createVFKitManager } from "@/runtime/vm"

const vm = createVFKitManager({
  cpuCount: 4,
  memorySizeMB: 4096,
})

// Start VM (downloads images if needed)
await vm.start()

// Execute command inside VM via guest agent
const result = await vm.execute("node", ["--version"])
console.log(result.stdout) // v20.x.x

// Use guest agent directly for sessions
const sessionId = await vm.guestAgent!.createSession("tenant-1", {
  working_dir: "/workspace",
  limits: { max_memory_mb: 512, max_cpu_percent: 50, max_execution_time_secs: 60, max_file_size_mb: 100 },
})

await vm.stop()
```

## Setup

```bash
# 1. Install vfkit (one time)
brew install vfkit

# 2. Download VM images
bun run vm:download

# 3. Start VM
bun run -e "
  const { createVFKitManager } = await import('./src/runtime/vm');
  const vm = createVFKitManager();
  await vm.start();
  console.log('VM running');
  const r = await vm.execute('uname', ['-a']);
  console.log(r.stdout);
  await vm.stop();
"
```

## What Got Deleted

- `surfaces/allternit-desktop/native/vm-manager/` (Swift code)
- `surfaces/allternit-desktop/native/vm-manager-node/` (Node wrapper around Swift CLI)
- `.github/workflows/build-swift-cli.yml`

## What Stayed

- `domains/kernel/service/allternit-vm-executor/` (Rust guest agent)
- `domains/kernel/drivers/allternit-guest-agent-protocol/` (shared protocol)
- `.github/workflows/vm-images.yml` (CI builds images with guest agent embedded)
