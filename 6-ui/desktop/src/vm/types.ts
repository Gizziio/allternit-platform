/**
 * VM Manager Types
 *
 * Type definitions for the Desktop VM Manager.
 *
 * @module types
 */

import { VMConfig, VMInstance, VMStatus as DriverVMStatus } from "../../../../1-kernel/cowork/drivers/apple-vf.js";
import { VMState } from "./lifecycle.js";
import { HealthStatus } from "./health-monitor.js";
import { SocketServerStatus } from "./socket-server.js";

// Re-export driver types
export type { VMConfig, VMInstance };

/**
 * VM driver type
 */
export type VMDriverType = "apple-vf" | "firecracker" | "mock";

/**
 * VM Options for starting a VM
 */
export interface VMOptions {
  /** VM ID (auto-generated if not provided) */
  id?: string;
  /** VM name */
  name?: string;
  /** Number of CPU cores */
  cpuCount?: number;
  /** Memory size in bytes */
  memorySize?: number;
  /** Disk size in bytes */
  diskSize?: number;
  /** Force re-download of images */
  forceDownload?: boolean;
  /** Auto-start VM after creation */
  autoStart?: boolean;
  /** Shared directories */
  sharedDirectories?: Array<{
    hostPath: string;
    vmPath: string;
    readOnly?: boolean;
  }>;
  /** Boot arguments */
  bootArgs?: string;
  /** Enable Rosetta 2 (Apple Silicon only) */
  enableRosetta?: boolean;
}

/**
 * Options for stopping a VM
 */
export interface StopOptions {
  /** Timeout for graceful shutdown in milliseconds */
  timeoutMs?: number;
  /** Force stop if graceful shutdown fails */
  force?: boolean;
}

/**
 * Command execution options
 */
export interface ExecuteOptions {
  /** Working directory in VM */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Run as specific user */
  user?: string;
  /** Stream output instead of buffering */
  stream?: boolean;
}

/**
 * Command execution result
 */
export interface ExecutionResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * VM Status information
 */
export interface VMStatusInfo {
  /** Current lifecycle state */
  state: VMState;
  /** Driver-level status */
  driverStatus: DriverVMStatus;
  /** VM ID */
  vmId?: string;
  /** VM name */
  vmName?: string;
  /** Whether VM is running */
  isRunning: boolean;
  /** Health status */
  health?: HealthStatus;
  /** Creation timestamp */
  createdAt?: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Uptime in milliseconds */
  uptime?: number;
  /** Configuration */
  config?: Partial<VMConfig>;
  /** Socket server status */
  socketServer?: SocketServerStatus;
  /** Error information */
  error?: string;
}

/**
 * Image download progress
 */
export interface DownloadProgress {
  /** Image name */
  imageName: string;
  /** Bytes downloaded */
  downloaded: number;
  /** Total bytes */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Download speed in bytes/second */
  speed?: number;
  /** Estimated time remaining in seconds */
  eta?: number;
}

/**
 * Image information
 */
export interface ImageInfo {
  /** Image name */
  name: string;
  /** Image version */
  version: string;
  /** Local path */
  path: string;
  /** Whether image exists locally */
  exists: boolean;
  /** Image size in bytes */
  size?: number;
  /** Last modified timestamp */
  modifiedAt?: Date;
  /** Checksum */
  checksum?: string;
}

/**
 * VM Manager events
 */
export interface VMManagerEvents {
  // Lifecycle events
  "vm:initialized": void;
  "vm:starting": void;
  "vm:started": void;
  "vm:stopping": void;
  "vm:stopped": void;
  "vm:restarting": void;
  "vm:restart:complete": void;
  "vm:error": { error: Error; recoverable: boolean };
  "vm:destroyed": void;

  // State events
  "state:changed": { from: VMState; to: VMState; duration?: number };

  // Download events
  "download:start": { imageName: string };
  "download:progress": DownloadProgress;
  "download:complete": { imageName: string };
  "download:error": { imageName: string; error: Error };

  // Health events
  "health:check": HealthStatus;
  "health:healthy": HealthStatus;
  "health:unhealthy": HealthStatus;

  // Execution events
  "execution:start": { command: string };
  "execution:complete": ExecutionResult;
  "execution:error": { command: string; error: Error };

  // Socket server events
  "socket:started": { path: string };
  "socket:stopped": void;
  "socket:connection": { clientId: string };
}

/**
 * VM Manager configuration
 */
export interface VMManagerConfig {
  /** Base directory for VM data */
  dataDir: string;
  /** Directory for VM images */
  imagesDir: string;
  /** Socket path for CLI */
  socketPath: string;
  /** Driver type */
  driverType: VMDriverType;
  /** Health check options */
  healthCheck?: {
    enabled: boolean;
    interval: number;
    cpuThreshold: number;
    memoryThreshold: number;
    diskThreshold: number;
  };
  /** Default VM options */
  defaultVMOptions?: Partial<VMOptions>;
  /** Image download URLs */
  imageUrls?: {
    kernel: string;
    initrd: string;
    rootfs: string;
  };
}

/**
 * Platform information
 */
export interface PlatformInfo {
  /** Operating system */
  platform: string;
  /** Architecture */
  arch: string;
  /** macOS version (if applicable) */
  macosVersion?: string;
  /** Whether Virtualization.framework is available */
  virtualizationAvailable: boolean;
  /** Whether running on Apple Silicon */
  isAppleSilicon: boolean;
  /** Whether Rosetta 2 is available */
  rosettaAvailable: boolean;
  /** Maximum recommended CPUs */
  maxCPUs: number;
  /** Maximum recommended memory in bytes */
  maxMemory: number;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  /** Maximum recovery attempts */
  maxAttempts?: number;
  /** Delay between attempts in milliseconds */
  retryDelay?: number;
  /** Whether to reset VM state on recovery failure */
  resetOnFailure?: boolean;
}

/**
 * Backup information
 */
export interface VMBackup {
  /** Backup ID */
  id: string;
  /** Backup name */
  name: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Size in bytes */
  size: number;
  /** VM state at backup */
  state: VMState;
  /** Path to backup files */
  path: string;
}

/**
 * Log entry
 */
export interface VMLogEntry {
  /** Log level */
  level: "debug" | "info" | "warn" | "error";
  /** Message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}
