/**
 * Allternit Firecracker Driver for Linux
 *
 * Production-ready TypeScript driver for managing Linux microVMs using AWS Firecracker.
 * Provides VM lifecycle management, Firecracker API integration, and VSOCK communication
 * with the allternit-vm-executor guest agent.
 *
 * @module firecracker
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * const driver = new FirecrackerDriver({
 *   firecrackerBinary: "/usr/local/bin/firecracker",
 * });
 *
 * const vm = await driver.createVM({
 *   id: "vm-001",
 *   name: "Ubuntu 22.04",
 *   kernelPath: "~/.allternit/images/vmlinux-6.5.0-x86_64",
 *   rootfsPath: "~/.allternit/images/ubuntu-22.04.ext4",
 *   cpuCount: 2,
 *   memorySize: 1024 * 1024 * 1024,
 * });
 *
 * await driver.startVM(vm);
 * const result = await driver.executeCommand(vm, "uname -a");
 * await driver.stopVM(vm);
 * ```
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as net from "net";
import { EventEmitter } from "events";
import { promisify } from "util";

// ============================================================================
// Constants
// ============================================================================

/** Firecracker release URL template */
const FIRECRACKER_RELEASE_URL =
  "https://github.com/firecracker-microvm/firecracker/releases/download";

/** Default Firecracker version to download */
const DEFAULT_FIRECRACKER_VERSION = "v1.7.0";

/** Default VSOCK port for guest agent communication */
const DEFAULT_VSOCK_PORT = 8080;

/** Default guest CID for VSOCK */
const DEFAULT_GUEST_CID = 3;

/** VM boot timeout in milliseconds */
const VM_BOOT_TIMEOUT_MS = 60000;

/** VM shutdown timeout in milliseconds */
const VM_SHUTDOWN_TIMEOUT_MS = 30000;

/** Health check interval in milliseconds */
const HEALTH_CHECK_INTERVAL_MS = 5000;

/** Maximum message size for VSOCK protocol (10 MB) */
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

/** Protocol version for guest agent communication */
const PROTOCOL_VERSION = "1.1.0";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Firecracker driver configuration options
 */
export interface FirecrackerDriverOptions {
  /** Path to firecracker binary (will download if not provided) */
  firecrackerBinary?: string;
  /** Path to firecracker-jailer binary (optional) */
  jailerBinary?: string;
  /** Directory for VM data (sockets, configs) */
  dataDir?: string;
  /** Firecracker version to download if not present */
  firecrackerVersion?: string;
  /** Whether to use jailer for enhanced security */
  useJailer?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom logger function */
  logger?: (level: LogLevel, message: string, meta?: unknown) => void;
}

/**
 * Firecracker VM configuration
 */
export interface FirecrackerConfig {
  /** Unique VM identifier */
  id: string;
  /** Human-readable VM name */
  name: string;
  /** Path to kernel image (vmlinux) */
  kernelPath: string;
  /** Path to root filesystem (ext4) */
  rootfsPath: string;
  /** Number of vCPUs */
  cpuCount: number;
  /** Memory size in bytes */
  memorySize: number;
  /** Optional initrd path */
  initrdPath?: string;
  /** Network configuration */
  network?: NetworkConfig;
  /** VSOCK configuration */
  vsock?: VsockConfig;
  /** Additional drives */
  drives?: DriveConfig[];
  /** Kernel boot arguments */
  bootArgs?: string;
  /** Enable SMT (simultaneous multithreading) */
  smt?: boolean;
  /** CPU template for optimizations */
  cpuTemplate?: string;
  /** Enable Hyperthreading */
  htEnabled?: boolean;
  /** Track dirty pages for snapshots */
  trackDirtyPages?: boolean;
}

/**
 * Network interface configuration
 */
export interface NetworkConfig {
  /** TAP device name on host */
  tapDevice: string;
  /** MAC address for guest interface */
  macAddress: string;
  /** Interface ID */
  ifaceId?: string;
  /** RX rate limiter (bytes/sec) */
  rxRateLimiter?: RateLimiterConfig;
  /** TX rate limiter (bytes/sec) */
  txRateLimiter?: RateLimiterConfig;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Bandwidth limit in bytes/sec */
  bandwidth: number;
  /** Operations per second limit */
  ops: number;
}

/**
 * VSOCK configuration
 */
export interface VsockConfig {
  /** Guest Context ID */
  guestCid?: number;
  /** Unix domain socket path on host */
  udsPath?: string;
  /** Port for allternit-vm-executor */
  port?: number;
}

/**
 * Additional drive configuration
 */
export interface DriveConfig {
  /** Unique drive ID */
  driveId: string;
  /** Path to drive image on host */
  pathOnHost: string;
  /** Is this the root device */
  isRootDevice?: boolean;
  /** Mount as read-only */
  isReadOnly?: boolean;
  /** Part UUID for mounting */
  partuuid?: string;
  /** Rate limiter for I/O */
  rateLimiter?: RateLimiterConfig;
}

/**
 * VM instance managed by the driver
 */
export interface VMInstance {
  /** VM configuration */
  config: FirecrackerConfig;
  /** VM process */
  process?: ChildProcess;
  /** Path to API socket */
  apiSocketPath: string;
  /** Path to VSOCK socket */
  vsockSocketPath: string;
  /** VM state */
  state: VMState;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Process PID */
  pid?: number;
  /** Jailer info (if used) */
  jailer?: JailerInfo;
  /** Health check interval */
  healthCheckInterval?: NodeJS.Timeout;
  /** VSOCK connection */
  vsockConnection?: net.Socket;
  /** Event emitter for VM events */
  eventEmitter: EventEmitter;
}

/**
 * Jailer information
 */
export interface JailerInfo {
  /** Jailer process */
  process: ChildProcess;
  /** Chroot directory */
  chrootDir: string;
  /** UID inside jail */
  uid: number;
  /** GID inside jail */
  gid: number;
}

/**
 * VM lifecycle states
 */
export type VMState =
  | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Command execution result
 */
export interface CommandResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * VM resource metrics
 */
export interface VMMMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory total in bytes */
  memoryTotal: number;
  /** Network RX bytes */
  networkRx: number;
  /** Network TX bytes */
  networkTx: number;
  /** Disk read bytes */
  diskRead: number;
  /** Disk write bytes */
  diskWrite: number;
}

/**
 * Firecracker API error response
 */
interface FirecrackerErrorResponse {
  fault_message: string;
}

/**
 * Firecracker machine configuration
 */
interface MachineConfig {
  vcpu_count: number;
  mem_size_mib: number;
  smt?: boolean;
  cpu_template?: string;
  ht_enabled?: boolean;
  track_dirty_pages?: boolean;
}

/**
 * Firecracker boot source configuration
 */
interface BootSourceConfig {
  kernel_image_path: string;
  initrd_path?: string;
  boot_args?: string;
}

/**
 * Firecracker drive configuration
 */
interface FirecrackerDrive {
  drive_id: string;
  path_on_host: string;
  is_root_device: boolean;
  is_read_only: boolean;
  partuuid?: string;
  rate_limiter?: RateLimiter;
}

/**
 * Rate limiter for Firecracker API
 */
interface RateLimiter {
  bandwidth?: TokenBucket;
  ops?: TokenBucket;
}

/**
 * Token bucket configuration
 */
interface TokenBucket {
  size: number;
  refill_time: number;
}

/**
 * Firecracker network interface
 */
interface NetworkInterface {
  iface_id: string;
  host_dev_name: string;
  guest_mac?: string;
  rx_rate_limiter?: RateLimiter;
  tx_rate_limiter?: RateLimiter;
}

/**
 * Firecracker VSOCK configuration
 */
interface FirecrackerVsock {
  guest_cid: number;
  uds_path: string;
}

/**
 * Firecracker action request
 */
interface ActionRequest {
  action_type: "InstanceStart" | "SendCtrlAltDel" | "FlushMetrics";
}

/**
 * Protocol message types for guest agent communication
 */
interface ProtocolMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Command request for guest agent
 */
interface CommandRequest extends ProtocolMessage {
  type: "command_request";
  request_id: string;
  session_id?: string;
  command: string;
  args: string[];
  working_dir?: string;
  env: Record<string, string>;
  timeout_ms?: number;
}

/**
 * Command response from guest agent
 */
interface CommandResponse extends ProtocolMessage {
  type: "command_response";
  request_id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for Firecracker driver errors
 */
export class FirecrackerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "FirecrackerError";
    Object.setPrototypeOf(this, FirecrackerError.prototype);
  }
}

/**
 * Error thrown when platform requirements are not met
 */
export class PlatformError extends FirecrackerError {
  constructor(message: string, cause?: Error) {
    super(message, "PLATFORM_ERROR", cause);
    this.name = "PlatformError";
    Object.setPrototypeOf(this, PlatformError.prototype);
  }
}

/**
 * Error thrown when VM operations fail
 */
export class VMOperationError extends FirecrackerError {
  constructor(
    message: string,
    public readonly vmId: string,
    cause?: Error
  ) {
    super(message, "VM_OPERATION_ERROR", cause);
    this.name = "VMOperationError";
    Object.setPrototypeOf(this, VMOperationError.prototype);
  }
}

/**
 * Error thrown when API communication fails
 */
export class APIError extends FirecrackerError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, "API_ERROR", cause);
    this.name = "APIError";
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Error thrown when binary operations fail
 */
export class BinaryError extends FirecrackerError {
  constructor(message: string, cause?: Error) {
    super(message, "BINARY_ERROR", cause);
    this.name = "BinaryError";
    Object.setPrototypeOf(this, BinaryError.prototype);
  }
}

/**
 * Error thrown when resource limits are exceeded
 */
export class ResourceLimitError extends FirecrackerError {
  constructor(
    message: string,
    public readonly limit: string,
    public readonly current: number,
    public readonly maximum: number
  ) {
    super(message, "RESOURCE_LIMIT_ERROR");
    this.name = "ResourceLimitError";
    Object.setPrototypeOf(this, ResourceLimitError.prototype);
  }
}

/**
 * Error thrown when VSOCK communication fails
 */
export class VsockError extends FirecrackerError {
  constructor(message: string, cause?: Error) {
    super(message, "VSOCK_ERROR", cause);
    this.name = "VsockError";
    Object.setPrototypeOf(this, VsockError.prototype);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if running on Linux platform
 * @returns True if Linux
 */
function isLinux(): boolean {
  return os.platform() === "linux";
}

/**
 * Check if running on x86_64 architecture
 * @returns True if x86_64
 */
function isX86_64(): boolean {
  return os.arch() === "x64";
}

/**
 * Expand tilde in paths to home directory
 * @param filePath - Path potentially containing tilde
 * @returns Expanded path
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Generate a unique ID
 * @returns Unique identifier string
 */
function generateId(): string {
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @returns Human readable string
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// ============================================================================
// Platform Checks
// ============================================================================

/**
 * Check platform compatibility for Firecracker
 * @returns Promise resolving to platform check results
 */
export async function checkPlatform(): Promise<{
  supported: boolean;
  linux: boolean;
  x86_64: boolean;
  kvm: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const linux = isLinux();
  const x86_64 = isX86_64();

  if (!linux) {
    errors.push("Firecracker requires Linux platform");
  }

  if (!x86_64) {
    errors.push("Firecracker requires x86_64 architecture");
  }

  // Check for KVM support
  let kvm = false;
  if (linux) {
    try {
      await fs.access("/dev/kvm", fs.constants.R_OK | fs.constants.W_OK);
      kvm = true;
    } catch {
      errors.push("KVM not available (/dev/kvm not accessible)");
    }
  }

  return {
    supported: linux && x86_64 && kvm,
    linux,
    x86_64,
    kvm,
    errors,
  };
}

/**
 * Verify platform requirements or throw error
 * @throws PlatformError if requirements not met
 */
async function verifyPlatform(): Promise<void> {
  const check = await checkPlatform();
  if (!check.supported) {
    throw new PlatformError(
      `Platform not supported: ${check.errors.join(", ")}`
    );
  }
}

// ============================================================================
// Firecracker API Client
// ============================================================================

/**
 * HTTP client for Firecracker API over Unix socket
 */
class FirecrackerAPIClient {
  private socketPath: string;
  private requestId: number = 0;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /**
   * Make HTTP request to Firecracker API
   * @param method - HTTP method
   * @param path - API path
   * @param body - Request body
   * @returns Response data
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      const bodyJson = body ? JSON.stringify(body) : "";

      const headers = [
        `${method} ${path} HTTP/1.1`,
        `Host: localhost`,
        `Content-Type: application/json`,
        body ? `Content-Length: ${Buffer.byteLength(bodyJson)}` : "",
        "Connection: close",
        "",
        "",
      ]
        .filter(Boolean)
        .join("\r\n");

      const requestData = body
        ? `${headers}${bodyJson}`
        : headers.slice(0, -2); // Remove extra newlines for no body

      const socket = net.createConnection(this.socketPath);
      let responseData = "";

      socket.on("connect", () => {
        socket.write(requestData);
      });

      socket.on("data", (data) => {
        responseData += data.toString();
      });

      socket.on("end", () => {
        try {
          const parsed = this.parseResponse(responseData);
          if (parsed.statusCode >= 200 && parsed.statusCode < 300) {
            resolve(parsed.body as T);
          } else {
            const errorMsg =
              (parsed.body as FirecrackerErrorResponse)?.fault_message ||
              `HTTP ${parsed.statusCode}`;
            reject(
              new APIError(
                `Firecracker API error: ${errorMsg}`,
                parsed.statusCode
              )
            );
          }
        } catch (error) {
          reject(
            new APIError(
              `Failed to parse API response: ${error}`,
              undefined,
              error instanceof Error ? error : undefined
            )
          );
        }
      });

      socket.on("error", (error) => {
        reject(
          new APIError(
            `API connection error: ${error.message}`,
            undefined,
            error
          )
        );
      });

      // Timeout
      setTimeout(() => {
        socket.destroy();
        reject(new APIError(`API request timeout (request ${requestId})`));
      }, 30000);
    });
  }

  /**
   * Parse HTTP response
   * @param response - Raw HTTP response
   * @returns Parsed response
   */
  private parseResponse(response: string): {
    statusCode: number;
    body: unknown;
  } {
    const lines = response.split("\r\n");
    const statusLine = lines[0];
    const statusMatch = statusLine.match(/HTTP\/1\.1 (\d+)/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    // Find body (after empty line)
    const emptyLineIndex = lines.findIndex((line) => line === "");
    const bodyStr =
      emptyLineIndex >= 0 ? lines.slice(emptyLineIndex + 1).join("") : "";

    let body: unknown = null;
    if (bodyStr.trim()) {
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }
    }

    return { statusCode, body };
  }

  // API Methods

  /**
   * Get Firecracker version
   */
  async getVersion(): Promise<{ firecracker_version: string }> {
    return this.request("GET", "/");
  }

  /**
   * Configure machine resources
   */
  async putMachineConfig(config: MachineConfig): Promise<void> {
    await this.request("PUT", "/machine-config", config);
  }

  /**
   * Configure boot source
   */
  async putBootSource(config: BootSourceConfig): Promise<void> {
    await this.request("PUT", "/boot-source", config);
  }

  /**
   * Add a drive
   */
  async putDrive(drive: FirecrackerDrive): Promise<void> {
    await this.request("PUT", `/drives/${drive.drive_id}`, drive);
  }

  /**
   * Add network interface
   */
  async putNetworkInterface(iface: NetworkInterface): Promise<void> {
    await this.request("PUT", `/network-interfaces/${iface.iface_id}`, iface);
  }

  /**
   * Configure VSOCK
   */
  async putVsock(config: FirecrackerVsock): Promise<void> {
    await this.request("PUT", "/vsock", config);
  }

  /**
   * Send action to VM
   */
  async sendAction(action: ActionRequest): Promise<void> {
    await this.request("PUT", "/actions", action);
  }

  /**
   * Get VM state
   */
  async getVmState(): Promise<{ state: string }> {
    return this.request("GET", "/vm");
  }

  /**
   * Get machine configuration
   */
  async getMachineConfig(): Promise<MachineConfig> {
    return this.request("GET", "/machine-config");
  }
}

// ============================================================================
// VSOCK Transport
// ============================================================================

/**
 * VSOCK client for host-guest communication
 */
class VsockClient extends EventEmitter {
  private socketPath: string;
  private socket?: net.Socket;
  private connected: boolean = false;
  private messageQueue: Buffer[] = [];
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();

  constructor(socketPath: string) {
    super();
    this.socketPath = socketPath;
  }

  /**
   * Connect to VSOCK socket
   * @returns Promise that resolves when connected
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Wait for socket to be created by Firecracker
      const waitForSocket = async () => {
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts) {
          try {
            await fs.access(this.socketPath);
            return true;
          } catch {
            attempts++;
            await sleep(1000);
          }
        }
        return false;
      };

      waitForSocket().then((found) => {
        if (!found) {
          reject(new VsockError("VSOCK socket not found after timeout"));
          return;
        }

        this.socket = net.createConnection(this.socketPath);

        this.socket.on("connect", () => {
          this.connected = true;
          this.emit("connect");
          resolve();
        });

        this.socket.on("data", (data) => {
          this.handleData(data);
        });

        this.socket.on("error", (error) => {
          this.emit("error", error);
          if (!this.connected) {
            reject(new VsockError(`Connection error: ${error.message}`, error));
          }
        });

        this.socket.on("close", () => {
          this.connected = false;
          this.emit("disconnect");
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.socket?.destroy();
            reject(new VsockError("VSOCK connection timeout"));
          }
        }, 10000);
      });
    });
  }

  /**
   * Handle incoming data from VSOCK
   * @param data - Raw data buffer
   */
  private handleData(data: Buffer): void {
    this.messageQueue.push(data);
    this.processMessages();
  }

  /**
   * Process queued messages
   */
  private processMessages(): void {
    while (this.messageQueue.length > 0) {
      const buffer = Buffer.concat(this.messageQueue);

      // Need at least 4 bytes for length prefix
      if (buffer.length < 4) {
        return;
      }

      const messageLength = buffer.readUInt32BE(0);

      // Check if we have the complete message
      if (buffer.length < 4 + messageLength) {
        return;
      }

      // Extract message
      const messageBytes = buffer.slice(4, 4 + messageLength);
      const remaining = buffer.slice(4 + messageLength);
      this.messageQueue = remaining.length > 0 ? [remaining] : [];

      try {
        const message: ProtocolMessage = JSON.parse(messageBytes.toString());
        this.handleMessage(message);
      } catch (error) {
        this.emit("error", new VsockError(`Failed to parse message: ${error}`));
      }
    }
  }

  /**
   * Handle parsed protocol message
   * @param message - Protocol message
   */
  private handleMessage(message: ProtocolMessage): void {
    // Handle responses to pending requests
    if ("request_id" in message && typeof message.request_id === "string") {
      const pending = this.pendingRequests.get(message.request_id);
      if (pending) {
        this.pendingRequests.delete(message.request_id);
        if (message.type === "error") {
          pending.reject(new Error(String(message.message || "Unknown error")));
        } else {
          pending.resolve(message);
        }
        return;
      }
    }

    this.emit("message", message);
  }

  /**
   * Send a message over VSOCK
   * @param message - Message to send
   */
  async send(message: ProtocolMessage): Promise<void> {
    if (!this.connected || !this.socket) {
      throw new VsockError("Not connected to VSOCK");
    }

    const messageBytes = Buffer.from(JSON.stringify(message));
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(messageBytes.length);

    const data = Buffer.concat([lengthPrefix, messageBytes]);

    return new Promise((resolve, reject) => {
      this.socket!.write(data, (error) => {
        if (error) {
          reject(new VsockError(`Send error: ${error.message}`, error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send request and wait for response
   * @param message - Request message
   * @param timeoutMs - Timeout in milliseconds
   * @returns Response message
   */
  async sendRequest(
    message: ProtocolMessage & { request_id: string },
    timeoutMs: number = 30000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.request_id);
        reject(new VsockError(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(message.request_id, {
        resolve: (value: unknown) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      // Send message
      this.send(message).catch((error) => {
        this.pendingRequests.delete(message.request_id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from VSOCK
   */
  disconnect(): void {
    this.connected = false;
    this.socket?.end();
    this.socket = undefined;
  }
}

// ============================================================================
// Binary Management
// ============================================================================

/**
 * Manage Firecracker binary downloads and verification
 */
class BinaryManager {
  private version: string;
  private installDir: string;

  constructor(version: string = DEFAULT_FIRECRACKER_VERSION, installDir: string) {
    this.version = version;
    this.installDir = installDir;
  }

  /**
   * Get path to firecracker binary
   */
  getBinaryPath(): string {
    return path.join(this.installDir, "firecracker");
  }

  /**
   * Get path to jailer binary
   */
  getJailerPath(): string {
    return path.join(this.installDir, "jailer");
  }

  /**
   * Check if firecracker binary exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.getBinaryPath(), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download and install firecracker binary
   * @param logger - Optional logger function
   */
  async download(
    logger?: (level: LogLevel, message: string) => void
  ): Promise<void> {
    const arch = isX86_64() ? "x86_64" : "aarch64";
    const binaryName = `firecracker-${this.version}-${arch}`;
    const url = `${FIRECRACKER_RELEASE_URL}/${this.version}/${binaryName}.tgz`;

    logger?.("info", `Downloading Firecracker ${this.version}...`);

    // Create install directory
    await fs.mkdir(this.installDir, { recursive: true });

    // Download using curl
    const tempDir = path.join(os.tmpdir(), `firecracker-download-${generateId()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const archivePath = path.join(tempDir, "firecracker.tgz");

    try {
      // Download archive
      await new Promise<void>((resolve, reject) => {
        const curl = spawn("curl", ["-L", "-o", archivePath, url]);

        curl.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new BinaryError(`Download failed with code ${code}`));
          }
        });

        curl.on("error", (error) => {
          reject(new BinaryError(`Download error: ${error.message}`, error));
        });
      });

      // Extract archive
      await new Promise<void>((resolve, reject) => {
        const tar = spawn("tar", ["-xzf", archivePath, "-C", tempDir]);

        tar.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new BinaryError(`Extraction failed with code ${code}`));
          }
        });

        tar.on("error", (error) => {
          reject(new BinaryError(`Extraction error: ${error.message}`, error));
        });
      });

      // Find and move binaries
      const extractedDir = path.join(tempDir, binaryName);
      const files = await fs.readdir(extractedDir);

      for (const file of files) {
        if (file === "firecracker" || file === "jailer") {
          const src = path.join(extractedDir, file);
          const dst = path.join(this.installDir, file);
          await fs.copyFile(src, dst);
          await fs.chmod(dst, 0o755);
        }
      }

      logger?.("info", `Firecracker ${this.version} installed successfully`);
    } finally {
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Verify binary checksum
   * @param expectedChecksum - Expected SHA256 checksum
   * @returns True if checksum matches
   */
  async verifyChecksum(expectedChecksum: string): Promise<boolean> {
    try {
      const data = await fs.readFile(this.getBinaryPath());
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      return hash.toLowerCase() === expectedChecksum.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get binary version
   * @returns Version string
   */
  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.getBinaryPath(), ["--version"]);
      let output = "";

      child.stdout?.on("data", (data) => {
        output += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          const match = output.match(/Firecracker v([\d.]+)/);
          resolve(match?.[1] || "unknown");
        } else {
          reject(new BinaryError(`Failed to get version, exit code ${code}`));
        }
      });

      child.on("error", (error) => {
        reject(new BinaryError(`Version check error: ${error.message}`, error));
      });
    });
  }
}

// ============================================================================
// Main Firecracker Driver
// ============================================================================

/**
 * Firecracker Driver for managing Linux microVMs
 *
 * This driver provides complete lifecycle management for Firecracker microVMs
 * including binary management, VM creation, startup/shutdown, and VSOCK
 * communication with the allternit-vm-executor guest agent.
 *
 * @example
 * ```typescript
 * const driver = new FirecrackerDriver({
 *   firecrackerBinary: "/usr/local/bin/firecracker",
 *   useJailer: true,
 * });
 *
 * const vm = await driver.createVM({
 *   id: "vm-001",
 *   name: "Test VM",
 *   kernelPath: "~/.allternit/images/vmlinux",
 *   rootfsPath: "~/.allternit/images/rootfs.ext4",
 *   cpuCount: 2,
 *   memorySize: 1024 * 1024 * 1024,
 * });
 *
 * await driver.startVM(vm);
 *
 * const result = await driver.executeCommand(vm, "ls", ["-la"]);
 * console.log(result.stdout);
 *
 * await driver.stopVM(vm);
 * await driver.destroyVM(vm);
 * ```
 */
export class FirecrackerDriver extends EventEmitter {
  private options: Required<FirecrackerDriverOptions>;
  private vms: Map<string, VMInstance> = new Map();
  private binaryManager: BinaryManager;
  private apiClient?: FirecrackerAPIClient;

  /**
   * Create a new Firecracker driver instance
   * @param options - Driver configuration options
   */
  constructor(options: FirecrackerDriverOptions = {}) {
    super();

    const homeDir = os.homedir();
    const defaultDataDir = path.join(homeDir, ".allternit", "firecracker");

    this.options = {
      firecrackerBinary: options.firecrackerBinary || "",
      jailerBinary: options.jailerBinary || "",
      dataDir: options.dataDir || defaultDataDir,
      firecrackerVersion: options.firecrackerVersion || DEFAULT_FIRECRACKER_VERSION,
      useJailer: options.useJailer ?? false,
      debug: options.debug ?? false,
      logger: options.logger || this.defaultLogger.bind(this),
    };

    this.binaryManager = new BinaryManager(
      this.options.firecrackerVersion,
      path.join(this.options.dataDir, "bin")
    );
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(level: LogLevel, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, meta?: unknown): void {
    this.options.logger(level, message, meta);
    this.emit("log", level, message, meta);
  }

  /**
   * Initialize the driver
   * Checks platform compatibility and downloads Firecracker if needed
   */
  async initialize(): Promise<void> {
    this.log("info", "Initializing Firecracker driver...");

    // Verify platform
    await verifyPlatform();
    this.log("debug", "Platform check passed");

    // Create data directory
    await fs.mkdir(this.options.dataDir, { recursive: true });

    // Ensure Firecracker binary is available
    if (!this.options.firecrackerBinary) {
      const binaryExists = await this.binaryManager.exists();
      if (!binaryExists) {
        this.log("info", "Firecracker binary not found, downloading...");
        await this.binaryManager.download((level, message) =>
          this.log(level, message)
        );
      }
      this.options.firecrackerBinary = this.binaryManager.getBinaryPath();
    }

    // Verify binary
    try {
      await fs.access(this.options.firecrackerBinary, fs.constants.X_OK);
      const version = await this.binaryManager.getVersion();
      this.log("info", `Firecracker version: ${version}`);
    } catch (error) {
      throw new BinaryError(
        `Firecracker binary not executable: ${this.options.firecrackerBinary}`,
        error instanceof Error ? error : undefined
      );
    }

    this.log("info", "Firecracker driver initialized");
  }

  /**
   * Create a new VM configuration
   * @param config - VM configuration
   * @returns VM instance handle
   */
  async createVM(config: FirecrackerConfig): Promise<VMInstance> {
    this.log("info", `Creating VM: ${config.id} (${config.name})`);

    // Validate configuration
    this.validateConfig(config);

    // Expand paths
    const kernelPath = expandPath(config.kernelPath);
    const rootfsPath = expandPath(config.rootfsPath);
    const initrdPath = config.initrdPath ? expandPath(config.initrdPath) : undefined;

    // Check kernel exists
    try {
      await fs.access(kernelPath);
    } catch {
      throw new VMOperationError(
        `Kernel not found: ${kernelPath}`,
        config.id
      );
    }

    // Check rootfs exists
    try {
      await fs.access(rootfsPath);
    } catch {
      throw new VMOperationError(
        `Rootfs not found: ${rootfsPath}`,
        config.id
      );
    }

    // Create VM directory
    const vmDir = path.join(this.options.dataDir, "vms", config.id);
    await fs.mkdir(vmDir, { recursive: true });

    // Setup socket paths
    const apiSocketPath = path.join(vmDir, "firecracker.sock");
    const vsockSocketPath =
      config.vsock?.udsPath || path.join(vmDir, "vsock.sock");

    // Create VM instance
    const vm: VMInstance = {
      config: {
        ...config,
        kernelPath,
        rootfsPath,
        initrdPath,
      },
      apiSocketPath,
      vsockSocketPath,
      state: "created",
      createdAt: new Date(),
      eventEmitter: new EventEmitter(),
    };

    // Store VM
    this.vms.set(config.id, vm);

    this.log("info", `VM ${config.id} created`);
    this.emit("vmCreated", vm);

    return vm;
  }

  /**
   * Validate VM configuration
   * @param config - Configuration to validate
   * @throws FirecrackerError if invalid
   */
  private validateConfig(config: FirecrackerConfig): void {
    if (!config.id || !/^[a-zA-Z0-9_-]+$/.test(config.id)) {
      throw new FirecrackerError(
        "Invalid VM ID: must be alphanumeric with hyphens/underscores",
        "VALIDATION_ERROR"
      );
    }

    if (!config.name) {
      throw new FirecrackerError("VM name is required", "VALIDATION_ERROR");
    }

    if (config.cpuCount < 1 || config.cpuCount > 32) {
      throw new ResourceLimitError(
        "Invalid CPU count",
        "cpu",
        config.cpuCount,
        32
      );
    }

    const minMemory = 128 * 1024 * 1024; // 128 MB
    const maxMemory = 128 * 1024 * 1024 * 1024; // 128 GB
    if (config.memorySize < minMemory || config.memorySize > maxMemory) {
      throw new ResourceLimitError(
        `Invalid memory size: ${formatBytes(config.memorySize)}`,
        "memory",
        config.memorySize,
        maxMemory
      );
    }
  }

  /**
   * Start a VM
   * @param vm - VM instance to start
   */
  async startVM(vm: VMInstance): Promise<void> {
    if (vm.state !== "created" && vm.state !== "stopped") {
      throw new VMOperationError(
        `Cannot start VM in state: ${vm.state}`,
        vm.config.id
      );
    }

    this.log("info", `Starting VM: ${vm.config.id}`);
    vm.state = "starting";
    this.emit("vmStarting", vm);

    try {
      // Clean up old socket if exists
      try {
        await fs.unlink(vm.apiSocketPath);
      } catch {
        // Ignore if doesn't exist
      }

      // Build Firecracker arguments
      const args: string[] = ["--api-sock", vm.apiSocketPath];

      if (this.options.debug) {
        args.push("--level", "Debug");
      }

      // Start Firecracker process
      const fcProcess = spawn(this.options.firecrackerBinary, args, {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      vm.process = fcProcess;
      vm.pid = fcProcess.pid;

      // Handle process events
      fcProcess.on("exit", (code) => {
        this.handleVMExit(vm, code);
      });

      fcProcess.on("error", (error) => {
        this.log("error", `VM process error: ${error.message}`, { vmId: vm.config.id });
        vm.eventEmitter.emit("error", error);
      });

      // Log stdout/stderr
      fcProcess.stdout?.on("data", (data) => {
        this.log("debug", `VM stdout: ${data.toString().trim()}`, {
          vmId: vm.config.id,
        });
        vm.eventEmitter.emit("stdout", data.toString());
      });

      fcProcess.stderr?.on("data", (data) => {
        this.log("debug", `VM stderr: ${data.toString().trim()}`, {
          vmId: vm.config.id,
        });
        vm.eventEmitter.emit("stderr", data.toString());
      });

      // Wait for API socket to be ready
      await this.waitForApiSocket(vm.apiSocketPath);

      // Create API client
      const api = new FirecrackerAPIClient(vm.apiSocketPath);

      // Configure VM
      await this.configureVM(vm, api);

      // Start the VM instance
      await api.sendAction({ action_type: "InstanceStart" });

      // Wait for VM to boot
      await this.waitForVMBoot(vm);

      // Setup VSOCK connection
      await this.setupVsock(vm);

      // Start health checks
      this.startHealthCheck(vm);

      vm.state = "running";
      vm.startedAt = new Date();
      this.emit("vmRunning", vm);

      this.log("info", `VM ${vm.config.id} is running`);
    } catch (error) {
      vm.state = "error";
      this.emit("vmError", vm, error);
      throw new VMOperationError(
        `Failed to start VM: ${error}`,
        vm.config.id,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Configure VM resources via API
   */
  private async configureVM(
    vm: VMInstance,
    api: FirecrackerAPIClient
  ): Promise<void> {
    this.log("debug", "Configuring VM resources...");

    // Configure machine
    await api.putMachineConfig({
      vcpu_count: vm.config.cpuCount,
      mem_size_mib: Math.floor(vm.config.memorySize / (1024 * 1024)),
      smt: vm.config.smt,
      cpu_template: vm.config.cpuTemplate,
      ht_enabled: vm.config.htEnabled,
      track_dirty_pages: vm.config.trackDirtyPages,
    });

    // Configure boot source
    const bootArgs =
      vm.config.bootArgs ||
      "console=ttyS0 reboot=k panic=1 pci=off nomodules";
    await api.putBootSource({
      kernel_image_path: vm.config.kernelPath,
      initrd_path: vm.config.initrdPath,
      boot_args: bootArgs,
    });

    // Configure root drive
    await api.putDrive({
      drive_id: "rootfs",
      path_on_host: vm.config.rootfsPath,
      is_root_device: true,
      is_read_only: false,
    });

    // Configure additional drives
    if (vm.config.drives) {
      for (const drive of vm.config.drives) {
        await api.putDrive({
          drive_id: drive.driveId,
          path_on_host: expandPath(drive.pathOnHost),
          is_root_device: drive.isRootDevice ?? false,
          is_read_only: drive.isReadOnly ?? false,
          partuuid: drive.partuuid,
        });
      }
    }

    // Configure network
    if (vm.config.network) {
      await api.putNetworkInterface({
        iface_id: vm.config.network.ifaceId || "eth0",
        host_dev_name: vm.config.network.tapDevice,
        guest_mac: vm.config.network.macAddress,
      });
    }

    // Configure VSOCK
    const guestCid = vm.config.vsock?.guestCid || DEFAULT_GUEST_CID;
    await api.putVsock({
      guest_cid: guestCid,
      uds_path: vm.vsockSocketPath,
    });

    this.log("debug", "VM configuration complete");
  }

  /**
   * Wait for API socket to be created
   */
  private async waitForApiSocket(socketPath: string): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await fs.access(socketPath);
        return;
      } catch {
        attempts++;
        await sleep(100);
      }
    }

    throw new FirecrackerError("API socket not created in time", "TIMEOUT");
  }

  /**
   * Wait for VM to complete boot
   */
  private async waitForVMBoot(vm: VMInstance): Promise<void> {
    this.log("debug", "Waiting for VM to boot...");
    await sleep(2000); // Basic boot time
  }

  /**
   * Setup VSOCK connection
   */
  private async setupVsock(vm: VMInstance): Promise<void> {
    this.log("debug", "Setting up VSOCK connection...");

    const vsockClient = new VsockClient(vm.vsockSocketPath);

    try {
      await vsockClient.connect();
      this.log("debug", "VSOCK connected");

      // Send heartbeat to verify executor is running
      const heartbeat = await this.sendHeartbeat(vsockClient);
      if (!heartbeat) {
        throw new VsockError("Guest agent not responding to heartbeat");
      }

      this.log("info", "Guest agent connected");
      vm.vsockConnection = vsockClient as unknown as net.Socket;
    } catch (error) {
      vsockClient.disconnect();
      throw error;
    }
  }

  /**
   * Send heartbeat to guest agent
   */
  private async sendHeartbeat(vsock: VsockClient): Promise<boolean> {
    try {
      const response = await vsock.sendRequest(
        {
          type: "heartbeat",
          request_id: generateId(),
        },
        5000
      );
      return (response as ProtocolMessage)?.type === "heartbeat_response";
    } catch {
      return false;
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(vm: VMInstance): void {
    vm.healthCheckInterval = setInterval(async () => {
      if (vm.state !== "running") {
        return;
      }

      try {
        // Check process is still running
        if (vm.pid) {
          try {
            process.kill(vm.pid, 0);
          } catch {
            this.log("error", "VM process not running", { vmId: vm.config.id });
            await this.handleVMExit(vm, -1);
            return;
          }
        }

        vm.eventEmitter.emit("healthCheck", { status: "healthy" });
      } catch (error) {
        this.log("error", `Health check error: ${error}`, {
          vmId: vm.config.id,
        });
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Handle VM process exit
   */
  private async handleVMExit(vm: VMInstance, code: number | null): Promise<void> {
    if (vm.state === "stopping") {
      vm.state = "stopped";
      this.emit("vmStopped", vm);
    } else if (vm.state === "running") {
      vm.state = "error";
      this.log("error", `VM exited unexpectedly with code ${code}`, {
        vmId: vm.config.id,
      });
      this.emit("vmCrashed", vm, code);
    }

    this.cleanupVM(vm);
  }

  /**
   * Cleanup VM resources
   */
  private cleanupVM(vm: VMInstance): void {
    if (vm.healthCheckInterval) {
      clearInterval(vm.healthCheckInterval);
      vm.healthCheckInterval = undefined;
    }

    // Note: vsockConnection cleanup if needed
  }

  /**
   * Stop a VM gracefully
   * @param vm - VM instance to stop
   */
  async stopVM(vm: VMInstance): Promise<void> {
    if (vm.state !== "running") {
      this.log("warn", `Cannot stop VM in state: ${vm.state}`);
      return;
    }

    this.log("info", `Stopping VM: ${vm.config.id}`);
    vm.state = "stopping";
    this.emit("vmStopping", vm);

    try {
      // Try graceful shutdown via API (SendCtrlAltDel)
      const api = new FirecrackerAPIClient(vm.apiSocketPath);
      await api.sendAction({ action_type: "SendCtrlAltDel" });

      // Wait for graceful shutdown
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Shutdown timeout"));
        }, VM_SHUTDOWN_TIMEOUT_MS);

        const checkState = setInterval(() => {
          if (vm.state === "stopped") {
            clearTimeout(timeout);
            clearInterval(checkState);
            resolve();
          }
        }, 500);

        // Also resolve if process exits
        vm.process?.on("exit", () => {
          clearTimeout(timeout);
          clearInterval(checkState);
          resolve();
        });
      });
    } catch (error) {
      this.log("warn", `Graceful shutdown failed: ${error}`, {
        vmId: vm.config.id,
      });
      // Force kill
      await this.destroyVM(vm);
    }
  }

  /**
   * Forcefully destroy a VM
   * @param vm - VM instance to destroy
   */
  async destroyVM(vm: VMInstance): Promise<void> {
    this.log("info", `Destroying VM: ${vm.config.id}`);

    vm.state = "stopping";
    this.cleanupVM(vm);

    if (vm.process) {
      vm.process.kill("SIGKILL");
      vm.process = undefined;
    }

    // Cleanup sockets
    try {
      await fs.unlink(vm.apiSocketPath);
    } catch {
      // Ignore
    }

    try {
      await fs.unlink(vm.vsockSocketPath);
    } catch {
      // Ignore
    }

    vm.state = "stopped";
    this.vms.delete(vm.config.id);
    this.emit("vmDestroyed", vm);

    this.log("info", `VM ${vm.config.id} destroyed`);
  }

  /**
   * Execute a command in the VM via guest agent
   * @param vm - VM instance
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Command result
   */
  async executeCommand(
    vm: VMInstance,
    command: string,
    args: string[] = [],
    options: {
      timeout?: number;
      workingDir?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<CommandResult> {
    if (vm.state !== "running") {
      throw new VMOperationError("VM is not running", vm.config.id);
    }

    const requestId = generateId();
    const timeout = options.timeout || 30000;

    this.log("debug", `Executing command: ${command} ${args.join(" ")}`, {
      vmId: vm.config.id,
      requestId,
    });

    // Create VSOCK client for this request
    const vsock = new VsockClient(vm.vsockSocketPath);

    try {
      await vsock.connect();

      const request: CommandRequest = {
        type: "command_request",
        request_id: requestId,
        command,
        args,
        working_dir: options.workingDir,
        env: options.env || {},
        timeout_ms: timeout,
      };

      const startTime = Date.now();
      const response = await vsock.sendRequest(request, timeout);
      const executionTime = Date.now() - startTime;

      const cmdResponse = response as CommandResponse;

      return {
        stdout: cmdResponse.stdout || "",
        stderr: cmdResponse.stderr || "",
        exitCode: cmdResponse.exit_code ?? -1,
        executionTimeMs: executionTime,
      };
    } finally {
      vsock.disconnect();
    }
  }

  /**
   * Get VM by ID
   * @param id - VM identifier
   * @returns VM instance or undefined
   */
  getVM(id: string): VMInstance | undefined {
    return this.vms.get(id);
  }

  /**
   * Get all managed VMs
   * @returns Array of VM instances
   */
  getAllVMs(): VMInstance[] {
    return Array.from(this.vms.values());
  }

  /**
   * Get running VMs
   * @returns Array of running VM instances
   */
  getRunningVMs(): VMInstance[] {
    return this.getAllVMs().filter((vm) => vm.state === "running");
  }

  /**
   * Check if VM exists
   * @param id - VM identifier
   * @returns True if exists
   */
  hasVM(id: string): boolean {
    return this.vms.has(id);
  }

  /**
   * Get VM metrics (placeholder for future implementation)
   * @param vm - VM instance
   * @returns VM metrics
   */
  async getMetrics(vm: VMInstance): Promise<VMMMetrics> {
    // This would integrate with Firecracker metrics API
    // For now, return placeholder data
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      memoryTotal: vm.config.memorySize,
      networkRx: 0,
      networkTx: 0,
      diskRead: 0,
      diskWrite: 0,
    };
  }

  /**
   * Dispose the driver and cleanup all resources
   */
  async dispose(): Promise<void> {
    this.log("info", "Disposing Firecracker driver...");

    // Stop all VMs
    const stopPromises = this.getAllVMs().map((vm) =>
      this.stopVM(vm).catch((error) => {
        this.log("error", `Error stopping VM ${vm.config.id}: ${error}`);
      })
    );

    await Promise.all(stopPromises);

    this.vms.clear();
    this.removeAllListeners();

    this.log("info", "Firecracker driver disposed");
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Check if the current platform supports Firecracker
 * @returns Platform compatibility info
 */
export async function checkFirecrackerSupport(): Promise<{
  supported: boolean;
  errors: string[];
}> {
  return checkPlatform();
}

/**
 * Download Firecracker binary to a specific directory
 * @param targetDir - Directory to install to
 * @param version - Version to download
 * @returns Path to installed binary
 */
export async function downloadFirecracker(
  targetDir: string,
  version: string = DEFAULT_FIRECRACKER_VERSION
): Promise<string> {
  const manager = new BinaryManager(version, targetDir);
  await manager.download();
  return manager.getBinaryPath();
}

// ============================================================================
// Module Exports
// ============================================================================

export default FirecrackerDriver;
