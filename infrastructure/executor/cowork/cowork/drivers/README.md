# Apple Virtualization.framework Driver

Production-ready TypeScript driver for macOS VM management using Apple's native Virtualization.framework.

## Requirements

- macOS 11.0+ (Big Sur) or later
- Node.js 16.0+
- Xcode Command Line Tools
- Apple Silicon (ARM64) or Intel Mac

## Installation

```bash
npm install
npm run build:all
```

## Features

- **VM Lifecycle Management**: Create, start, stop, pause, resume, and destroy VMs
- **Linux VM Support**: Full support for Linux VMs via VZLinuxBootLoader
- **Socket Communication**: VZVirtioSocketDevice for host↔VM communication
- **File Sharing**: VZVirtioFileSystemDevice for directory sharing
- **Guest Agent Protocol**: Built-in support for allternit-guest-agent
- **Console Access**: Real-time log streaming
- **Rosetta 2 Support**: x86_64 translation on Apple Silicon

## Quick Start

```typescript
import { AppleVFDriver, VMConfig } from './apple-vf';

const driver = new AppleVFDriver();

// Check platform compatibility
const caps = driver.getPlatformCapabilities();
console.log(`macOS ${caps.macosVersion}, Virtualization: ${caps.virtualizationAvailable}`);

// Create VM configuration
const config: VMConfig = {
  id: "vm-001",
  name: "Ubuntu 22.04",
  kernelPath: "~/.allternit/images/vmlinux-6.5.0-allternit-arm64",
  initrdPath: "~/.allternit/images/initrd.img-6.5.0-allternit-arm64",
  rootfsPath: "~/.allternit/images/ubuntu-22.04.ext4",
  cpuCount: 4,
  memorySize: 8 * 1024 * 1024 * 1024, // 8GB
  sharedDirectories: [
    {
      hostPath: "~/projects",
      vmPath: "/mnt/projects",
      readOnly: false
    }
  ]
};

// Create and start VM
const vm = await driver.createVM(config);
await driver.startVM(vm);

// Execute commands
const result = await driver.executeCommand(vm, "uname -a");
console.log(result.stdout);

// Stream logs
for await (const line of driver.streamLogs(vm, true)) {
  console.log(line);
}

// Stop VM
await driver.stopVM(vm);
```

## API Reference

### AppleVFDriver

Main driver class for VM management.

#### Constructor

```typescript
const driver = new AppleVFDriver();
```

Throws `PlatformError` if not running on macOS or Virtualization.framework unavailable.

#### Methods

##### `getPlatformCapabilities(): PlatformCapabilities`

Returns platform capability information including macOS version, virtualization availability, CPU/memory limits, and Rosetta 2 support.

##### `validatePlatform(): Promise<{ compatible: boolean; issues: string[] }>`

Validates platform compatibility and returns any issues found.

##### `createVM(config: VMConfig): Promise<VMInstance>`

Creates a new VM instance with the specified configuration.

##### `startVM(vm: VMInstance): Promise<void>`

Starts a stopped VM.

##### `stopVM(vm: VMInstance, timeoutMs?: number): Promise<void>`

Gracefully stops a running VM. Falls back to force stop on timeout.

##### `destroyVM(vm: VMInstance): Promise<void>`

Force stops and destroys a VM.

##### `pauseVM(vm: VMInstance): Promise<void>`

Pauses a running VM.

##### `resumeVM(vm: VMInstance): Promise<void>`

Resumes a paused VM.

##### `getVMStatus(vm: VMInstance): VMStatus`

Returns the current VM status.

##### `executeCommand(vm: VMInstance, command: string, options?: CommandOptions): Promise<CommandResult>`

Executes a command inside the VM via the guest agent.

##### `streamLogs(vm: VMInstance, follow?: boolean): AsyncGenerator<string>`

Streams VM console logs.

##### `getVMs(): VMInstance[]`

Returns all managed VMs.

##### `getVM(vmId: string): VMInstance | undefined`

Returns a specific VM by ID.

##### `cleanup(): Promise<void>`

Stops all VMs and cleans up resources. Should be called on process exit.

### Interfaces

#### VMConfig

```typescript
interface VMConfig {
  id: string;                    // Unique VM identifier
  name: string;                  // Human-readable name
  kernelPath: string;            // Path to kernel image
  initrdPath: string;            // Path to initrd image
  rootfsPath: string;            // Path to root filesystem
  cpuCount: number;              // Number of CPU cores (1-64)
  memorySize: number;            // Memory in bytes
  diskSize?: number;             // Optional disk size
  sharedDirectories?: Array<{    // File sharing configuration
    hostPath: string;
    vmPath: string;
    readOnly?: boolean;
  }>;
  enableRosetta?: boolean;       // Enable x86_64 translation
  guestAgentPort?: number;       // Guest agent socket port
  autoStart?: boolean;           // Auto-start on creation
  bootArgs?: string;             // Kernel boot arguments
}
```

#### CommandOptions

```typescript
interface CommandOptions {
  workingDir?: string;           // Working directory in VM
  env?: Record<string, string>;  // Environment variables
  timeout?: number;              // Timeout in milliseconds
  user?: string;                 // Run as specific user
  stream?: boolean;              // Stream output
}
```

#### CommandResult

```typescript
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}
```

### Error Classes

- `AppleVError` - Base error class
- `PlatformError` - Platform compatibility issues
- `VMConfigError` - Configuration validation errors
- `VMLifecycleError` - VM lifecycle operation errors
- `CommandExecutionError` - Command execution errors
- `SocketError` - Socket communication errors
- `TimeoutError` - Operation timeout errors

## Events

The driver extends EventEmitter and emits the following events:

- `vm:created` - VM created
- `vm:configured` - VM configuration completed
- `vm:starting` - VM starting
- `vm:started` - VM started
- `vm:stopping` - VM stopping
- `vm:stopped` - VM stopped
- `vm:pausing` - VM pausing
- `vm:paused` - VM paused
- `vm:resuming` - VM resuming
- `vm:resumed` - VM resumed
- `vm:destroying` - VM destroying
- `vm:destroyed` - VM destroyed
- `vm:guestAgentConnected` - Guest agent connected
- `vm:event` - Guest agent event received
- `vm:stopTimeout` - VM stop timeout occurred
- `vm:error` - VM error occurred
- `error` - General error

```typescript
driver.on('vm:started', ({ vmId }) => {
  console.log(`VM ${vmId} started`);
});
```

## Development Mode

To test without the native module:

```bash
Allternit_MOCK_VIRTUALIZATION=1 npm test
```

## Building Native Module

```bash
# Install dependencies
npm install

# Build native module
npm run build:native

# Build TypeScript
npm run build
```

## Troubleshooting

### Virtualization.framework not available

Ensure you're running on macOS 11.0+ (Big Sur) or later:

```bash
sw_vers -productVersion
```

### Rosetta 2 not available

Install Rosetta 2 on Apple Silicon:

```bash
softwareupdate --install-rosetta --agree-to-license
```

### Build errors

Ensure Xcode Command Line Tools are installed:

```bash
xcode-select --install
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AppleVFDriver (TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│  VM Lifecycle │ Commands │ Logs │ File Sharing │ Socket     │
├─────────────────────────────────────────────────────────────┤
│              Native Binding (Node-API)                       │
├─────────────────────────────────────────────────────────────┤
│         Objective-C++ Bridge (apple-vf-native.mm)            │
├─────────────────────────────────────────────────────────────┤
│              Virtualization.framework                          │
│  ┌──────────┬──────────┬──────────┬──────────┬─────────────┐ │
│  │ VZVM     │ VZLinux  │ VZSocket │ VZFile   │ VZMemory    │ │
│  │ Config   │ BootLoad │ Device   │ System   │ Balloon     │ │
│  └──────────┴──────────┴──────────┴──────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
