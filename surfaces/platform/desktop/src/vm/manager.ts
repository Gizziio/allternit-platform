/**
 * Desktop VM Manager
 *
 * Main orchestrator for VM lifecycle management in the Electron desktop app.
 * Integrates the driver, transport, protocol server, health monitoring,
 * and socket server for CLI communication.
 *
 * @module manager
 * @example
 * ```typescript
 * const manager = new DesktopVMManager({
 *   dataDir: '~/.a2r/desktop',
 *   socketPath: '/var/run/a2r/desktop-vm.sock'
 * });
 *
 * await manager.initialize();
 * await manager.startVM({ cpuCount: 4, memorySize: 8 * 1024 * 1024 * 1024 });
 *
 * const result = await manager.execute('ls -la');
 * await manager.stopVM();
 * ```
 */

import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

// Import cowork components
import {
  AppleVFDriver,
  VMConfig,
  VMInstance,
  VMStatus as DriverVMStatus,
} from "../../../../1-kernel/cowork/drivers/apple-vf.js";
import { VMTransport, VMConnection } from "../../../../1-kernel/cowork/transport/transport.js";
import { ProtocolClient } from "../../../../1-kernel/cowork/protocol/client.js";

// Import local components
import { VMLifecycle, VMState } from "./lifecycle.js";
import { HealthMonitor, HealthStatus } from "./health-monitor.js";
import { SocketServer, SocketServerStatus } from "./socket-server.js";
import {
  VMOptions,
  StopOptions,
  ExecuteOptions,
  ExecutionResult,
  VMStatusInfo,
  DownloadProgress,
  ImageInfo,
  VMManagerConfig,
  PlatformInfo,
  VMDriverType,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Default VM configuration */
const DEFAULT_VM_CONFIG: Partial<VMConfig> = {
  cpuCount: 2,
  memorySize: 4 * 1024 * 1024 * 1024, // 4GB
  diskSize: 20 * 1024 * 1024 * 1024, // 20GB
  guestAgentPort: 1024,
  consoleBufferSize: 1024 * 1024,
  bootArgs:
    "console=hvc0 reboot=k panic=1 pci=off nomodules root=/dev/vda rw",
};

/** Default manager configuration */
const DEFAULT_CONFIG: Partial<VMManagerConfig> = {
  dataDir: path.join(os.homedir(), ".a2r", "desktop"),
  imagesDir: path.join(os.homedir(), ".a2r", "images"),
  socketPath: "/var/run/a2r/desktop-vm.sock",
  driverType: "apple-vf",
  healthCheck: {
    enabled: true,
    interval: 5000,
    cpuThreshold: 80,
    memoryThreshold: 90,
    diskThreshold: 85,
  },
};

// ============================================================================
// Error Classes
// ============================================================================

/**
 * VM Manager error
 */
export class VMManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "VMManagerError";
    Object.setPrototypeOf(this, VMManagerError.prototype);
  }
}

/**
 * VM not running error
 */
export class VMNotRunningError extends VMManagerError {
  constructor() {
    super("VM is not running", "VM_NOT_RUNNING");
  }
}

/**
 * VM already running error
 */
export class VMAlreadyRunningError extends VMManagerError {
  constructor() {
    super("VM is already running", "VM_ALREADY_RUNNING");
  }
}

/**
 * Image not found error
 */
export class ImageNotFoundError extends VMManagerError {
  constructor(imageName: string) {
    super(`Image not found: ${imageName}`, "IMAGE_NOT_FOUND");
  }
}

// ============================================================================
// Desktop VM Manager
// ============================================================================

/**
 * Desktop VM Manager
 *
 * Main orchestrator class that manages the complete VM lifecycle:
 * - Platform detection and driver initialization
 * - VM image management and download
 * - VM creation, start, stop, and destroy
 * - Health monitoring and automatic recovery
 * - Unix socket server for CLI communication
 * - IPC event emission for UI updates
 */
export class DesktopVMManager extends EventEmitter {
  private config: VMManagerConfig;
  private driver: AppleVFDriver | null = null;
  private vm: VMInstance | null = null;
  private lifecycle: VMLifecycle;
  private healthMonitor: HealthMonitor;
  private socketServer: SocketServer;
  private protocolClient: ProtocolClient | null = null;
  private transport: VMTransport | null = null;
  private isInitialized = false;
  private images: Map<string, ImageInfo> = new Map();
  private logs: Array<{ level: string; message: string; timestamp: Date }> = [];

  /**
   * Create a new Desktop VM Manager
   * @param config - Manager configuration
   */
  constructor(config: Partial<VMManagerConfig> = {}) {
    super();

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as VMManagerConfig;

    // Initialize lifecycle manager
    this.lifecycle = new VMLifecycle();
    this.setupLifecycleListeners();

    // Initialize health monitor
    this.healthMonitor = new HealthMonitor({
      checkInterval: this.config.healthCheck?.interval,
      cpuThreshold: this.config.healthCheck?.cpuThreshold,
      memoryThreshold: this.config.healthCheck?.memoryThreshold,
      diskThreshold: this.config.healthCheck?.diskThreshold,
    });
    this.setupHealthListeners();

    // Initialize socket server
    this.socketServer = new SocketServer(this);
    this.setupSocketListeners();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the VM manager
   * Detects platform, initializes driver, sets up directories
   * @throws {VMManagerError} If initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log("info", "Initializing Desktop VM Manager...");

    try {
      // Ensure data directories exist
      await this.ensureDirectories();

      // Detect platform and initialize driver
      await this.initializeDriver();

      // Load existing images
      await this.loadImages();

      // Transition lifecycle state
      await this.lifecycle.transition("stopped");

      this.isInitialized = true;
      this.emit("vm:initialized");
      this.log("info", "Desktop VM Manager initialized successfully");
    } catch (error) {
      this.log(
        "error",
        `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new VMManagerError(
        `Failed to initialize VM manager: ${error instanceof Error ? error.message : String(error)}`,
        "INIT_FAILED",
        error as Error
      );
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [this.config.dataDir, this.config.imagesDir];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true, mode: 0o755 });
      } catch (error) {
        throw new VMManagerError(
          `Failed to create directory ${dir}: ${error}`,
          "DIRECTORY_CREATE_FAILED",
          error as Error
        );
      }
    }
  }

  /**
   * Initialize the appropriate VM driver for the platform
   */
  private async initializeDriver(): Promise<void> {
    const platform = os.platform();

    switch (platform) {
      case "darwin":
        // Use Apple Virtualization.framework on macOS
        this.driver = new AppleVFDriver();
        this.log("info", "Initialized Apple Virtualization.framework driver");
        break;

      case "linux":
        // Firecracker would be used on Linux
        // For now, throw error as it's not implemented
        throw new VMManagerError(
          "Firecracker driver not yet implemented for Linux",
          "DRIVER_NOT_IMPLEMENTED"
        );

      default:
        throw new VMManagerError(
          `Unsupported platform: ${platform}`,
          "UNSUPPORTED_PLATFORM"
        );
    }
  }

  // ============================================================================
  // VM Lifecycle
  // ============================================================================

  /**
   * Start the VM
   * @param options - VM startup options
   * @returns The started VM instance
   * @throws {VMManagerError} If VM fails to start
   */
  async startVM(options: VMOptions = {}): Promise<VMInstance> {
    this.ensureInitialized();

    // Check if VM is already running
    if (this.vm?.status === DriverVMStatus.RUNNING) {
      throw new VMAlreadyRunningError();
    }

    try {
      // Check and download images if needed
      await this.checkAndDownloadImages(options.forceDownload);

      // Create VM configuration
      const vmConfig = await this.createVMConfig(options);

      // Create and start VM
      await this.lifecycle.transition("creating");
      this.emit("vm:starting");

      if (!this.driver) {
        throw new VMManagerError("Driver not initialized", "DRIVER_NOT_INITIALIZED");
      }

      this.vm = await this.driver.createVM(vmConfig);

      await this.lifecycle.transition("starting");
      await this.driver.startVM(this.vm);

      await this.lifecycle.transition("running");

      // Start protocol client
      await this.initializeProtocolClient();

      // Start health monitoring
      if (this.config.healthCheck?.enabled) {
        this.healthMonitor.setProtocolClient(this.protocolClient!);
        this.healthMonitor.start();
      }

      // Start socket server for CLI
      await this.socketServer.start(this.config.socketPath);

      this.emit("vm:started");
      this.log("info", `VM ${this.vm.config.id} started successfully`);

      return this.vm;
    } catch (error) {
      this.lifecycle.setError(error as Error, true);
      this.emit("vm:error", { error, recoverable: true });
      throw error;
    }
  }

  /**
   * Stop the VM
   * @param options - Stop options
   * @throws {VMManagerError} If VM fails to stop
   */
  async stopVM(options: StopOptions = {}): Promise<void> {
    this.ensureInitialized();

    if (!this.vm || this.vm.status !== DriverVMStatus.RUNNING) {
      throw new VMNotRunningError();
    }

    const timeoutMs = options.timeoutMs ?? 60000;
    const force = options.force ?? true;

    try {
      this.emit("vm:stopping");
      await this.lifecycle.transition("stopping");

      // Stop socket server
      await this.socketServer.stop();

      // Stop health monitoring
      this.healthMonitor.stop();
      this.healthMonitor.clearProtocolClient();

      // Stop protocol client
      this.protocolClient = null;

      // Stop VM
      if (this.driver) {
        await this.driver.stopVM(this.vm, timeoutMs);
      }

      await this.lifecycle.transition("stopped");
      this.emit("vm:stopped");
      this.log("info", `VM ${this.vm.config.id} stopped`);
    } catch (error) {
      if (force) {
        // Force stop on error
        this.log("warn", "Graceful shutdown failed, forcing stop...");
        if (this.driver && this.vm) {
          await this.driver.destroyVM(this.vm);
        }
        await this.lifecycle.transition("stopped");
        this.emit("vm:stopped");
      } else {
        this.lifecycle.setError(error as Error, false);
        throw error;
      }
    }
  }

  /**
   * Restart the VM
   * @param options - VM startup options
   * @throws {VMManagerError} If restart fails
   */
  async restartVM(options: VMOptions = {}): Promise<VMInstance> {
    this.ensureInitialized();

    this.emit("vm:restarting");

    try {
      // Stop if running
      if (this.vm?.status === DriverVMStatus.RUNNING) {
        await this.stopVM();
      }

      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start VM
      const vm = await this.startVM(options);

      this.emit("vm:restart:complete");
      this.log("info", "VM restarted successfully");

      return vm;
    } catch (error) {
      this.emit("vm:error", { error, recoverable: true });
      throw error;
    }
  }

  /**
   * Destroy the VM and cleanup
   * @throws {VMManagerError} If destroy fails
   */
  async destroyVM(): Promise<void> {
    this.ensureInitialized();

    try {
      // Stop if running
      if (this.vm?.status === DriverVMStatus.RUNNING) {
        await this.stopVM();
      }

      // Destroy VM instance
      if (this.driver && this.vm) {
        await this.driver.destroyVM(this.vm);
      }

      this.vm = null;
      this.protocolClient = null;

      await this.lifecycle.reset();

      this.emit("vm:destroyed");
      this.log("info", "VM destroyed");
    } catch (error) {
      this.emit("vm:error", { error, recoverable: false });
      throw error;
    }
  }

  // ============================================================================
  // Command Execution
  // ============================================================================

  /**
   * Execute a command in the VM
   * @param command - Command to execute
   * @param options - Execution options
   * @returns Execution result
   * @throws {VMNotRunningError} If VM is not running
   */
  async execute(command: string, options: ExecuteOptions = {}): Promise<ExecutionResult> {
    this.ensureInitialized();

    if (!this.protocolClient) {
      throw new VMNotRunningError();
    }

    this.emit("execution:start", { command });

    const startTime = Date.now();

    try {
      const result = await this.protocolClient.execute({
        command,
        workingDir: options.workingDir,
        timeout: options.timeout ?? 60000,
      });

      const executionResult: ExecutionResult = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
      };

      this.emit("execution:complete", executionResult);

      return executionResult;
    } catch (error) {
      this.emit("execution:error", { command, error });
      throw error;
    }
  }

  /**
   * Execute a command with streaming output
   * @param command - Command to execute
   * @param onOutput - Callback for output chunks
   * @param options - Execution options
   * @throws {VMNotRunningError} If VM is not running
   */
  async executeStream(
    command: string,
    onOutput: (chunk: { stdout?: string; stderr?: string }) => void,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    this.ensureInitialized();

    if (!this.protocolClient) {
      throw new VMNotRunningError();
    }

    // TODO: Implement streaming execution when protocol supports it
    // For now, execute and call callback with result
    const result = await this.execute(command, options);

    if (result.stdout) {
      onOutput({ stdout: result.stdout });
    }
    if (result.stderr) {
      onOutput({ stderr: result.stderr });
    }

    return result;
  }

  // ============================================================================
  // Status & Info
  // ============================================================================

  /**
   * Get current VM status
   * @returns VM status information
   */
  getStatus(): VMStatusInfo {
    const health = this.healthMonitor.currentStatus;
    const socketStatus = this.socketServer.getStatus();

    return {
      state: this.lifecycle.state,
      driverStatus: this.vm?.status ?? DriverVMStatus.UNKNOWN,
      vmId: this.vm?.config.id,
      vmName: this.vm?.config.name,
      isRunning: this.vm?.status === DriverVMStatus.RUNNING,
      health: health ?? undefined,
      createdAt: this.vm?.createdAt,
      startedAt: this.vm?.startedAt,
      uptime: this.vm?.startedAt
        ? Date.now() - this.vm.startedAt.getTime()
        : undefined,
      config: this.vm
        ? {
            cpuCount: this.vm.config.cpuCount,
            memorySize: this.vm.config.memorySize,
          }
        : undefined,
      socketServer: socketStatus,
      error: this.lifecycle.state === "error" ? health?.errors[0] : undefined,
    };
  }

  /**
   * Get platform information
   * @returns Platform information
   */
  getPlatformInfo(): PlatformInfo {
    const platform = os.platform();
    const arch = os.arch();

    return {
      platform,
      arch,
      macosVersion: platform === "darwin" ? os.release() : undefined,
      virtualizationAvailable: platform === "darwin" || platform === "linux",
      isAppleSilicon: platform === "darwin" && arch === "arm64",
      rosettaAvailable: false, // Would need to detect
      maxCPUs: os.cpus().length,
      maxMemory: os.totalmem(),
    };
  }

  /**
   * Check if VM is running
   */
  get isRunning(): boolean {
    return this.vm?.status === DriverVMStatus.RUNNING;
  }

  /**
   * Get the VM instance
   */
  get vmInstance(): VMInstance | null {
    return this.vm;
  }

  // ============================================================================
  // Image Management
  // ============================================================================

  /**
   * Check if required images exist
   * @returns Whether all images are available
   */
  async checkImages(): Promise<boolean> {
    const kernelImage = this.images.get("kernel");
    const initrdImage = this.images.get("initrd");
    const rootfsImage = this.images.get("rootfs");

    return !!(
      kernelImage?.exists &&
      initrdImage?.exists &&
      rootfsImage?.exists
    );
  }

  /**
   * Download VM images
   * @param force - Force re-download even if images exist
   * @throws {VMManagerError} If download fails
   */
  async downloadImages(force = false): Promise<void> {
    await this.lifecycle.transition("downloading");

    const images = ["kernel", "initrd", "rootfs"];

    for (const imageName of images) {
      const existingImage = this.images.get(imageName);

      if (existingImage?.exists && !force) {
        this.log("info", `Image ${imageName} already exists, skipping download`);
        continue;
      }

      this.emit("download:start", { imageName });

      try {
        // TODO: Implement actual image download
        // For now, simulate download
        await this.simulateDownload(imageName);

        this.emit("download:complete", { imageName });
        this.log("info", `Downloaded image: ${imageName}`);
      } catch (error) {
        this.emit("download:error", { imageName, error: error as Error });
        throw new VMManagerError(
          `Failed to download image ${imageName}: ${error}`,
          "DOWNLOAD_FAILED",
          error as Error
        );
      }
    }

    await this.loadImages();
  }

  /**
   * Simulate image download (placeholder for actual implementation)
   */
  private async simulateDownload(imageName: string): Promise<void> {
    const total = 100 * 1024 * 1024; // 100MB placeholder
    const steps = 10;

    for (let i = 0; i < steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const progress: DownloadProgress = {
        imageName,
        downloaded: (total / steps) * (i + 1),
        total,
        percentage: ((i + 1) / steps) * 100,
      };

      this.emit("download:progress", progress);
    }

    // Create placeholder file
    const imagePath = path.join(this.config.imagesDir, `${imageName}.img`);
    await fs.writeFile(imagePath, "");
  }

  /**
   * Load image information
   */
  private async loadImages(): Promise<void> {
    const imageNames = ["kernel", "initrd", "rootfs"];

    for (const name of imageNames) {
      const imagePath = path.join(this.config.imagesDir, `${name}.img`);

      try {
        const stats = await fs.stat(imagePath);

        this.images.set(name, {
          name,
          version: "latest",
          path: imagePath,
          exists: true,
          size: stats.size,
          modifiedAt: stats.mtime,
        });
      } catch {
        this.images.set(name, {
          name,
          version: "latest",
          path: imagePath,
          exists: false,
        });
      }
    }
  }

  /**
   * Check and download images if needed
   */
  private async checkAndDownloadImages(force = false): Promise<void> {
    const imagesExist = await this.checkImages();

    if (!imagesExist || force) {
      this.log("info", "Downloading VM images...");
      await this.downloadImages(force);
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Create VM configuration from options
   */
  private async createVMConfig(options: VMOptions): Promise<VMConfig> {
    const id = options.id ?? `vm-${Date.now()}`;
    const name = options.name ?? "A2R Desktop VM";

    const kernelImage = this.images.get("kernel");
    const initrdImage = this.images.get("initrd");
    const rootfsImage = this.images.get("rootfs");

    if (!kernelImage?.exists) {
      throw new ImageNotFoundError("kernel");
    }
    if (!initrdImage?.exists) {
      throw new ImageNotFoundError("initrd");
    }
    if (!rootfsImage?.exists) {
      throw new ImageNotFoundError("rootfs");
    }

    return {
      id,
      name,
      kernelPath: kernelImage.path,
      initrdPath: initrdImage.path,
      rootfsPath: rootfsImage.path,
      cpuCount: options.cpuCount ?? DEFAULT_VM_CONFIG.cpuCount!,
      memorySize: options.memorySize ?? DEFAULT_VM_CONFIG.memorySize!,
      diskSize: options.diskSize ?? DEFAULT_VM_CONFIG.diskSize,
      sharedDirectories: options.sharedDirectories ?? [
        {
          hostPath: path.join(this.config.dataDir, "shared"),
          vmPath: "/mnt/shared",
          readOnly: false,
        },
      ],
      enableRosetta: options.enableRosetta,
      guestAgentPort: DEFAULT_VM_CONFIG.guestAgentPort,
      consoleBufferSize: DEFAULT_VM_CONFIG.consoleBufferSize,
      bootArgs: options.bootArgs ?? DEFAULT_VM_CONFIG.bootArgs,
      autoStart: false,
    };
  }

  // ============================================================================
  // Protocol Client
  // ============================================================================

  /**
   * Initialize protocol client for VM communication
   */
  private async initializeProtocolClient(): Promise<void> {
    // TODO: Implement actual transport connection
    // This would connect to the VM's guest agent via VSOCK or VirtioSocket
    // For now, create a mock client

    // const connection = await this.transport!.connect(this.vm!.config.id, 1024);
    // this.protocolClient = new ProtocolClient(connection);

    // Mock implementation for now
    this.protocolClient = {} as ProtocolClient;
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Set up lifecycle event listeners
   */
  private setupLifecycleListeners(): void {
    this.lifecycle.on("state:changed", (entry) => {
      this.emit("state:changed", {
        from: entry.from,
        to: entry.to,
        duration: entry.duration,
      });
    });
  }

  /**
   * Set up health monitor event listeners
   */
  private setupHealthListeners(): void {
    this.healthMonitor.on("health:check", (status) => {
      this.emit("health:check", status);
    });

    this.healthMonitor.on("health:healthy", (status) => {
      this.emit("health:healthy", status);
    });

    this.healthMonitor.on("health:unhealthy", (status) => {
      this.emit("health:unhealthy", status);
    });

    this.healthMonitor.onUnhealthy(() => {
      this.log("warn", "VM health check failed - VM is unhealthy");
      // Could implement automatic restart here
    });
  }

  /**
   * Set up socket server event listeners
   */
  private setupSocketListeners(): void {
    this.socketServer.on("server:started", ({ path }) => {
      this.emit("socket:started", { path });
    });

    this.socketServer.on("server:stopped", () => {
      this.emit("socket:stopped");
    });

    this.socketServer.on("connection:open", ({ id }) => {
      this.emit("socket:connection", { clientId: id });
    });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new VMManagerError(
        "Manager not initialized. Call initialize() first.",
        "NOT_INITIALIZED"
      );
    }
  }

  /**
   * Log a message
   */
  private log(level: string, message: string): void {
    const entry = { level, message, timestamp: new Date() };
    this.logs.push(entry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // Also emit for UI
    this.emit("log", entry);
  }

  /**
   * Get recent logs
   * @param count - Number of logs to retrieve
   */
  getLogs(count = 100): Array<{ level: string; message: string; timestamp: Date }> {
    return this.logs.slice(-count);
  }

  /**
   * Dispose of the manager and cleanup resources
   */
  async dispose(): Promise<void> {
    // Stop VM if running
    if (this.isRunning) {
      await this.stopVM();
    }

    // Stop health monitoring
    this.healthMonitor.dispose();

    // Dispose socket server
    await this.socketServer.dispose();

    // Remove all listeners
    this.removeAllListeners();

    this.isInitialized = false;
  }
}

/**
 * Create a new Desktop VM Manager
 * @param config - Manager configuration
 * @returns New DesktopVMManager instance
 */
export function createDesktopVMManager(
  config?: Partial<VMManagerConfig>
): DesktopVMManager {
  return new DesktopVMManager(config);
}

export default DesktopVMManager;
