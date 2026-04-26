# WEBVM_CHEERPX_INTEGRATION.md
**CheerpX Integration Spec for Allternit WebVM Runtime**
_version 2.0 — aligned with IO Ontology_

---

## 0. Purpose

This document specifies how to integrate CheerpX (WebVM) as the browser-based Linux runtime for Allternit. It covers:

- VM initialization and configuration
- Filesystem mounting strategy
- stdio bridge implementation
- Graphics (KMS) integration for GUI skills
- Persistent state management

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER TAB                                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  index.html + main.js                                         │ │
│  │  - CheerpX loader                                             │ │
│  │  - Bridge coordinator                                         │ │
│  │  - UI shell (React)                                           │ │
│  └──────────────────┬────────────────────────────────────────────┘ │
│                     │                                               │
│         ┌───────────┴───────────┐                                   │
│         │                       │                                   │
│  ┌──────▼──────┐    ┌───────────▼────────────┐                     │
│  │  Terminal   │    │  KMS Canvas            │                     │
│  │  (xterm.js) │    │  (graphical output)    │                     │
│  └─────────────┘    └────────────────────────┘                     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  CheerpX.Linux Instance                                       │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  ext2 Root Filesystem (HttpBytesDevice + OverlayDevice) │  │ │
│  │  │  /bin, /usr, /lib, /etc, /opt/allternit               │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  IDBDevice: /var/gizzi (persistent IndexedDB)           │  │ │
│  │  │  journal/, capsules/, evidence/, artifacts/             │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  DataDevice: /tmp/bridge (JS↔VM data exchange)          │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  Running: /opt/allternit/init/boot.sh → io                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Browser Storage                                              │ │
│  │  - IndexedDB: gizzi-state (persistent VM data)               │ │
│  │  - IndexedDB: cheerpx-cache (disk image cache)               │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. CheerpX Initialization

### 2.1 Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>Allternit OS</title>
  <script src="https://cxrtnc.leaningtech.com/1.0.5/cx.js"></script>
</head>
<body>
  <div id="shell-ui"></div>
  <canvas id="kms-display" width="1024" height="768"></canvas>
  <div id="terminal"></div>

  <script type="module" src="./main.js"></script>
</body>
</html>
```

### 2.2 VM Creation

```typescript
// main.js
import { AllternitBridge } from './bridge.js';
import { ShellUI } from './shell-ui.js';

interface AllternitConfig {
  diskImageUrl: string;           // URL to ext2 disk image
  stateDbName: string;            // IndexedDB name for /var/gizzi
  enableGraphics: boolean;        // Enable KMS canvas
  terminalElement?: HTMLElement;  // Terminal container
  kmsCanvas?: HTMLCanvasElement;  // Graphics output canvas
}

async function initAllternit(config: AllternitConfig): Promise<AllternitRuntime> {
  // 1. Create persistent state device (for /var/gizzi)
  const stateDevice = await CheerpX.IDBDevice.create(config.stateDbName);

  // 2. Create data exchange device (for JS↔VM communication)
  const dataDevice = await CheerpX.DataDevice.create();

  // 3. Create the disk image device (root filesystem)
  const diskDevice = await CheerpX.HttpBytesDevice.create(config.diskImageUrl);

  // 4. Create overlay for write support on root
  const overlayDevice = await CheerpX.OverlayDevice.create(
    diskDevice,
    await CheerpX.IDBDevice.create("allternit-overlay")
  );

  // 5. Initialize CheerpX Linux
  const cx = await CheerpX.Linux.create({
    mounts: [
      { type: "ext2", path: "/", dev: overlayDevice },
      { type: "dir", path: "/var/gizzi", dev: stateDevice },
      { type: "dir", path: "/tmp/bridge", dev: dataDevice },
      { type: "devs", path: "/dev" }
    ]
  });

  // 6. Setup console/terminal
  if (config.terminalElement) {
    const terminal = new Terminal({
      cursorBlink: true,
      theme: { background: '#1a1a2e' }
    });
    terminal.open(config.terminalElement);

    cx.setCustomConsole({
      write: (data) => terminal.write(new TextDecoder().decode(data)),
      read: () => null // We'll handle input via bridge
    });
  }

  // 7. Setup KMS (graphics) if enabled
  if (config.enableGraphics && config.kmsCanvas) {
    cx.setKmsCanvas(config.kmsCanvas);
  }

  // 8. Create the bridge
  const bridge = new AllternitBridge(cx, dataDevice);

  return {
    cx,
    bridge,
    dataDevice,
    stateDevice
  };
}
```

### 2.3 Configuration Object

```typescript
interface CheerpXMountConfig {
  type: "ext2" | "dir" | "devs";
  path: string;
  dev?: CheerpXDevice;
}

interface CheerpXCreateOptions {
  mounts: CheerpXMountConfig[];
  networkInterface?: NetworkConfig;
}

// Full configuration for Allternit
const Allternit_CONFIG: AllternitConfig = {
  diskImageUrl: "/images/allternit-v1.0.ext2",
  stateDbName: "gizzi-state-v1",
  enableGraphics: true,
  terminalElement: document.getElementById("terminal"),
  kmsCanvas: document.getElementById("kms-display") as HTMLCanvasElement
};
```

---

## 3. Filesystem Strategy

### 3.1 Mount Points

| Mount Point | Device Type | Persistence | Contents |
|-------------|-------------|-------------|----------|
| `/` | OverlayDevice (HttpBytes + IDB) | Session | Base OS, binaries |
| `/var/gizzi` | IDBDevice | Permanent | Journal, capsules, artifacts |
| `/tmp/bridge` | DataDevice | None | JS↔VM data exchange |
| `/dev` | devs | None | Device nodes |

### 3.2 Disk Image Structure

```dockerfile
# Dockerfile for Allternit base image
FROM debian:bookworm-slim

# Install base system
RUN apt-get update && apt-get install -y \
    busybox \
    xvfb \
    x11vnc \
    openbox \
    && rm -rf /var/lib/apt/lists/*

# Create Allternit directories
RUN mkdir -p /opt/allternit/{bin,registry,policy,init}
RUN mkdir -p /var/gizzi/{journal,capsules,evidence,artifacts}

# Copy IO binary
COPY build/io /opt/allternit/bin/io
COPY build/gui-input-injector /opt/allternit/bin/gui-input-injector

# Copy configuration
COPY config/registry.json /opt/allternit/registry/registry.json
COPY config/policy.json /opt/allternit/policy/policy.json

# Copy boot script
COPY scripts/boot.sh /opt/allternit/init/boot.sh
RUN chmod +x /opt/allternit/init/boot.sh

# Set entrypoint
CMD ["/opt/allternit/init/boot.sh"]
```

### 3.3 Building the Disk Image

```bash
#!/bin/bash
# build-disk-image.sh

# Build Docker image
docker build -t allternit-base:latest -f Dockerfile.allternit .

# Export as tar
docker export $(docker create allternit-base:latest) > allternit-rootfs.tar

# Create ext2 filesystem
dd if=/dev/zero of=allternit.ext2 bs=1M count=512
mkfs.ext2 allternit.ext2

# Mount and extract
mkdir -p /tmp/allternit-mnt
sudo mount -o loop allternit.ext2 /tmp/allternit-mnt
sudo tar -xf allternit-rootfs.tar -C /tmp/allternit-mnt
sudo umount /tmp/allternit-mnt

# Compress for distribution
gzip -9 allternit.ext2
```

---

## 4. Stdio Bridge Implementation

### 4.1 Bridge Architecture

```typescript
// bridge.ts

type MessageHandler = (message: BridgeMessage) => Promise<BridgeResponse>;

interface BridgeMessage {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: { code: string; message: string };
}

class AllternitBridge {
  private cx: CheerpXLinux;
  private dataDevice: CheerpXDataDevice;
  private pendingRequests: Map<string, {
    resolve: (r: BridgeResponse) => void;
    reject: (e: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private outputBuffer: string = "";
  private ioReady: boolean = false;
  private onReady?: () => void;

  constructor(cx: CheerpXLinux, dataDevice: CheerpXDataDevice) {
    this.cx = cx;
    this.dataDevice = dataDevice;
    this.setupConsoleCapture();
  }

  private setupConsoleCapture(): void {
    const decoder = new TextDecoder();

    this.cx.setCustomConsole({
      write: (data: Uint8Array) => {
        const text = decoder.decode(data);
        this.outputBuffer += text;
        this.processOutputBuffer();
      },
      read: (): Uint8Array | null => {
        // Return pending input if any
        return this.getNextInput();
      }
    });
  }

  private processOutputBuffer(): void {
    // Process complete lines
    const lines = this.outputBuffer.split('\n');

    // Keep incomplete line in buffer
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      // Check for readiness token
      if (line.startsWith("IO_READY ")) {
        this.handleReadyToken(line);
        continue;
      }

      // Try to parse as JSON response
      try {
        const response = JSON.parse(line) as BridgeResponse;
        this.handleResponse(response);
      } catch {
        // Not JSON, might be debug output
        console.debug("[IO]", line);
      }
    }
  }

  private handleReadyToken(line: string): void {
    const jsonPart = line.slice("IO_READY ".length);
    try {
      const info = JSON.parse(jsonPart);
      console.log("IO ready:", info);
      this.ioReady = true;
      this.onReady?.();
    } catch (e) {
      console.error("Failed to parse ready token:", e);
    }
  }

  private handleResponse(response: BridgeResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);
      pending.resolve(response);
    }
  }

  // Send request to IO
  async request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number = 30000
  ): Promise<BridgeResponse> {
    if (!this.ioReady) {
      throw new Error("IO not ready");
    }

    const id = this.generateId();
    const message: BridgeMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Write to stdin via DataDevice
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message) + "\n");
      this.inputQueue.push(data);
    });
  }

  // Convenience methods
  async ping(): Promise<boolean> {
    const response = await this.request("io.ping", {});
    return response.result === "pong";
  }

  async dispatchIntent(intent: Intent): Promise<DispatchResult> {
    const response = await this.request("intent.dispatch", { intent });
    return response.result as DispatchResult;
  }

  async getCapsule(capsuleId: string): Promise<Capsule> {
    const response = await this.request("capsule.get", { capsule_id: capsuleId });
    return response.result as Capsule;
  }

  async invokeSkill(skillId: string, params: unknown): Promise<SkillResult> {
    const response = await this.request("skill.invoke", {
      skill_id: skillId,
      params
    });
    return response.result as SkillResult;
  }

  // Wait for IO to be ready
  waitForReady(): Promise<void> {
    if (this.ioReady) return Promise.resolve();
    return new Promise(resolve => { this.onReady = resolve; });
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private inputQueue: Uint8Array[] = [];

  private getNextInput(): Uint8Array | null {
    return this.inputQueue.shift() || null;
  }
}
```

### 4.2 Boot Sequence

```typescript
// boot.ts

async function bootAllternit(): Promise<void> {
  const config = Allternit_CONFIG;

  // 1. Show loading UI
  showLoadingScreen("Initializing Allternit OS...");

  // 2. Initialize CheerpX
  updateLoadingStatus("Loading virtual machine...");
  const runtime = await initAllternit(config);

  // 3. Boot the VM
  updateLoadingStatus("Booting Linux kernel...");
  await runtime.cx.run("/opt/allternit/init/boot.sh");

  // 4. Wait for IO ready signal
  updateLoadingStatus("Starting IO...");
  await runtime.bridge.waitForReady();

  // 5. Verify connection
  updateLoadingStatus("Verifying connection...");
  const pong = await runtime.bridge.ping();
  if (!pong) {
    throw new Error("IO ping failed");
  }

  // 6. Initialize Shell UI
  updateLoadingStatus("Loading interface...");
  const shell = new ShellUI(runtime.bridge);
  await shell.initialize();

  // 7. Hide loading, show main UI
  hideLoadingScreen();
  shell.show();

  console.log("Allternit OS ready");
}
```

---

## 5. Graphics (KMS) Integration

### 5.1 KMS Canvas Setup

```typescript
// graphics.ts

interface KMSConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  scaleFactor?: number;
}

class AllternitGraphics {
  private canvas: HTMLCanvasElement;
  private cx: CheerpXLinux;
  private width: number;
  private height: number;

  constructor(cx: CheerpXLinux, config: KMSConfig) {
    this.cx = cx;
    this.canvas = config.canvas;
    this.width = config.width;
    this.height = config.height;

    // Set canvas size
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Connect to CheerpX
    this.cx.setKmsCanvas(this.canvas);
  }

  // Capture current frame as screenshot
  async captureScreenshot(): Promise<Screenshot> {
    // Force a render flush
    await new Promise(resolve => requestAnimationFrame(resolve));

    const dataUri = this.canvas.toDataURL("image/png");
    const hash = await this.hashDataUri(dataUri);

    return {
      id: hash,
      timestamp: Date.now(),
      width: this.width,
      height: this.height,
      format: "png",
      data_uri: dataUri,
      scale_factor: 1,
      viewport: {
        display_width: this.width,
        display_height: this.height,
        model_width: 1024,
        model_height: 768
      }
    };
  }

  // Scale screenshot for UI-TARS (1024x768)
  scaleForModel(screenshot: Screenshot): Screenshot {
    const targetW = 1024;
    const targetH = 768;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const ctx = tempCanvas.getContext('2d')!;

    // Calculate scaling to fit with letterboxing
    const scale = Math.min(
      targetW / screenshot.width,
      targetH / screenshot.height
    );

    const scaledW = screenshot.width * scale;
    const scaledH = screenshot.height * scale;
    const offsetX = (targetW - scaledW) / 2;
    const offsetY = (targetH - scaledH) / 2;

    // Black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetW, targetH);

    // Draw scaled image
    const img = new Image();
    img.src = screenshot.data_uri;

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

        resolve({
          ...screenshot,
          id: `scaled_${screenshot.id}`,
          width: targetW,
          height: targetH,
          data_uri: tempCanvas.toDataURL('image/png'),
          scale_factor: scale,
          viewport: {
            display_width: screenshot.width,
            display_height: screenshot.height,
            model_width: targetW,
            model_height: targetH
          }
        });
      };
    });
  }

  private async hashDataUri(dataUri: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataUri);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
}
```

### 5.2 Desktop Environment Setup

```bash
#!/bin/bash
# /opt/allternit/init/start-desktop.sh

# Start virtual framebuffer
Xvfb :0 -screen 0 1024x768x24 &
export DISPLAY=:0

# Wait for X to start
sleep 1

# Start window manager
openbox &

# Start IO with GUI support
exec /opt/allternit/bin/io \
  --transport stdio \
  --state-dir /var/gizzi \
  --registry /opt/allternit/registry/registry.json \
  --policy /opt/allternit/policy/policy.json \
  --gui-enabled \
  --display :0
```

---

## 6. Data Exchange (JS↔VM)

### 6.1 DataDevice Usage

```typescript
// data-exchange.ts

class DataExchange {
  private dataDevice: CheerpXDataDevice;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(dataDevice: CheerpXDataDevice) {
    this.dataDevice = dataDevice;
  }

  // Write file accessible from VM at /tmp/bridge/<filename>
  async writeToVM(filename: string, content: string | Uint8Array): Promise<void> {
    const data = typeof content === 'string'
      ? this.encoder.encode(content)
      : content;

    await this.dataDevice.writeFile(filename, data);
  }

  // Write screenshot for UI-TARS consumption
  async writeScreenshot(screenshot: Screenshot): Promise<string> {
    const filename = `screenshot_${screenshot.id}.png`;

    // Convert data URI to binary
    const base64 = screenshot.data_uri.split(',')[1];
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    await this.dataDevice.writeFile(filename, binary);

    return `/tmp/bridge/${filename}`;
  }

  // Write JSON data for IO
  async writeJSON(filename: string, data: unknown): Promise<string> {
    await this.writeToVM(filename, JSON.stringify(data, null, 2));
    return `/tmp/bridge/${filename}`;
  }
}
```

### 6.2 Artifact Retrieval

```typescript
// artifact-retrieval.ts

class ArtifactRetriever {
  private stateDevice: CheerpXIDBDevice;

  constructor(stateDevice: CheerpXIDBDevice) {
    this.stateDevice = stateDevice;
  }

  // Read artifact from /var/gizzi/artifacts
  async getArtifact(artifactId: string): Promise<Blob | null> {
    const path = `artifacts/${artifactId}`;

    try {
      const blob = await this.stateDevice.readFileAsBlob(path);
      return blob;
    } catch (e) {
      console.error(`Failed to read artifact ${artifactId}:`, e);
      return null;
    }
  }

  // Read screenshot artifact
  async getScreenshot(screenshotId: string): Promise<string | null> {
    const blob = await this.getArtifact(`screenshots/${screenshotId}.png`);
    if (!blob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  // Read journal entries
  async getJournalEntries(
    runId: string,
    limit: number = 100
  ): Promise<JournalEntry[]> {
    const blob = await this.stateDevice.readFileAsBlob(`journal/${runId}.jsonl`);
    if (!blob) return [];

    const text = await blob.text();
    const lines = text.trim().split('\n');

    return lines
      .slice(-limit)
      .map(line => JSON.parse(line) as JournalEntry);
  }
}
```

---

## 7. State Persistence

### 7.1 IndexedDB Schema

```typescript
// persistence.ts

interface GizziStateDB {
  journal: JournalEntry[];
  capsules: Map<string, Capsule>;
  evidence: Map<string, Evidence>;
  artifacts: Map<string, ArtifactMetadata>;
  settings: UserSettings;
}

class PersistenceManager {
  private dbName: string;
  private stateDevice: CheerpXIDBDevice;

  constructor(dbName: string, stateDevice: CheerpXIDBDevice) {
    this.dbName = dbName;
    this.stateDevice = stateDevice;
  }

  // Check if state exists (first boot detection)
  async hasExistingState(): Promise<boolean> {
    try {
      const blob = await this.stateDevice.readFileAsBlob("journal/.initialized");
      return blob !== null;
    } catch {
      return false;
    }
  }

  // Initialize fresh state
  async initializeFreshState(): Promise<void> {
    // Directories are created by boot.sh in VM
    // Just mark as initialized
    const encoder = new TextEncoder();
    await this.stateDevice.writeFile(
      ".initialized",
      encoder.encode(new Date().toISOString())
    );
  }

  // Clear all state (factory reset)
  async clearState(): Promise<void> {
    await this.stateDevice.reset();
    console.log("State cleared - next boot will be fresh");
  }

  // Export state for backup
  async exportState(): Promise<Blob> {
    // This would need to iterate through IDB and create a tar/zip
    // Implementation depends on what backup format you want
    throw new Error("Not implemented - use IO's export command");
  }
}
```

### 7.2 State Recovery

```typescript
// recovery.ts

class StateRecovery {
  private bridge: AllternitBridge;
  private persistence: PersistenceManager;

  async checkIntegrity(): Promise<IntegrityReport> {
    // Ask IO to verify state integrity
    const response = await this.bridge.request("state.verify", {});
    return response.result as IntegrityReport;
  }

  async repairState(issues: IntegrityIssue[]): Promise<RepairResult> {
    const response = await this.bridge.request("state.repair", { issues });
    return response.result as RepairResult;
  }
}

interface IntegrityReport {
  healthy: boolean;
  issues: IntegrityIssue[];
  journal_entries: number;
  capsules: number;
  artifacts: number;
}

interface IntegrityIssue {
  type: "missing_artifact" | "orphaned_reference" | "corrupt_entry";
  path: string;
  description: string;
  repairable: boolean;
}
```

---

## 8. Error Handling

### 8.1 CheerpX Error Types

```typescript
enum CheerpXErrorCode {
  DISK_LOAD_FAILED = "CX_E001",
  IDB_INIT_FAILED = "CX_E002",
  BOOT_TIMEOUT = "CX_E003",
  IO_CRASH = "CX_E004",
  MEMORY_EXHAUSTED = "CX_E005",
  NETWORK_FAILED = "CX_E006",
}

class CheerpXErrorHandler {
  async handle(error: Error, context: RuntimeContext): Promise<RecoveryAction> {
    const code = this.classifyError(error);

    switch (code) {
      case CheerpXErrorCode.DISK_LOAD_FAILED:
        return {
          action: "retry_with_cache_clear",
          message: "Disk image load failed. Clearing cache and retrying..."
        };

      case CheerpXErrorCode.IDB_INIT_FAILED:
        return {
          action: "prompt_storage_permission",
          message: "Storage access denied. Please allow storage access."
        };

      case CheerpXErrorCode.BOOT_TIMEOUT:
        return {
          action: "increase_timeout_and_retry",
          message: "Boot taking longer than expected. Retrying with extended timeout..."
        };

      case CheerpXErrorCode.IO_CRASH:
        return {
          action: "restart_io",
          message: "IO crashed. Restarting..."
        };

      case CheerpXErrorCode.MEMORY_EXHAUSTED:
        return {
          action: "suggest_close_tabs",
          message: "Memory exhausted. Please close other tabs and reload."
        };

      default:
        return {
          action: "show_error",
          message: `Unexpected error: ${error.message}`
        };
    }
  }

  private classifyError(error: Error): CheerpXErrorCode {
    const msg = error.message.toLowerCase();

    if (msg.includes("fetch") || msg.includes("network")) {
      return CheerpXErrorCode.DISK_LOAD_FAILED;
    }
    if (msg.includes("indexeddb") || msg.includes("storage")) {
      return CheerpXErrorCode.IDB_INIT_FAILED;
    }
    if (msg.includes("timeout")) {
      return CheerpXErrorCode.BOOT_TIMEOUT;
    }
    if (msg.includes("memory") || msg.includes("oom")) {
      return CheerpXErrorCode.MEMORY_EXHAUSTED;
    }

    return CheerpXErrorCode.IO_CRASH;
  }
}
```

---

## 9. Performance Optimization

### 9.1 Disk Image Caching

```typescript
// caching.ts

class DiskImageCache {
  private cacheName = "allternit-disk-cache";

  async getCachedImage(url: string): Promise<Response | null> {
    const cache = await caches.open(this.cacheName);
    return cache.match(url);
  }

  async cacheImage(url: string, response: Response): Promise<void> {
    const cache = await caches.open(this.cacheName);
    await cache.put(url, response.clone());
  }

  async clearCache(): Promise<void> {
    await caches.delete(this.cacheName);
  }

  // Preload disk image in background
  async preload(url: string): Promise<void> {
    const cached = await this.getCachedImage(url);
    if (cached) {
      console.log("Disk image already cached");
      return;
    }

    console.log("Preloading disk image...");
    const response = await fetch(url);
    await this.cacheImage(url, response);
    console.log("Disk image cached");
  }
}
```

### 9.2 Memory Management

```typescript
// memory.ts

class MemoryMonitor {
  private warningThreshold = 0.8;  // 80% of available
  private criticalThreshold = 0.95; // 95% of available

  startMonitoring(onWarning: () => void, onCritical: () => void): void {
    if (!('memory' in performance)) {
      console.warn("Memory monitoring not available");
      return;
    }

    setInterval(() => {
      const memory = (performance as any).memory;
      const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (usage > this.criticalThreshold) {
        onCritical();
      } else if (usage > this.warningThreshold) {
        onWarning();
      }
    }, 5000);
  }

  suggestGC(): void {
    // Can't force GC, but can suggest by clearing references
    console.log("Memory pressure detected - suggesting cleanup");
  }
}
```

---

## 10. Security Considerations

### 10.1 Sandboxing

CheerpX runs in the browser sandbox, providing:
- No direct filesystem access to host
- No network access without explicit bridges
- Memory isolation from other tabs

### 10.2 Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval' https://cxrtnc.leaningtech.com;
  connect-src 'self' https://cxrtnc.leaningtech.com blob:;
  img-src 'self' data: blob:;
  style-src 'self' 'unsafe-inline';
  worker-src 'self' blob:;
">
```

### 10.3 State Encryption (Optional)

```typescript
// encryption.ts

class StateEncryption {
  private key: CryptoKey | null = null;

  async initializeKey(password: string): Promise<void> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    this.key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("allternit-salt"),
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async encryptState(data: Uint8Array): Promise<Uint8Array> {
    if (!this.key) throw new Error("Key not initialized");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      data
    );

    // Prepend IV to ciphertext
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return result;
  }
}
```

---

## 11. Status

This document is **implementation-ready**.

Dependencies:
- CheerpX SDK (v1.0.5+)
- Modern browser with WebAssembly support
- IndexedDB support

Next steps:
- Build disk image with IO
- Implement Shell UI
- Test boot sequence
```