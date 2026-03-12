/**
 * Desktop VM Manager
 *
 * Electron main process VM manager that orchestrates VM lifecycle
 * for the desktop app. Integrates drivers, transport, protocol,
 * health monitoring, and CLI socket server.
 *
 * @module vm
 * @example
 * ```typescript
 * import {
 *   DesktopVMManager,
 *   registerVMIPCHandlers,
 *   VMLifecycle,
 *   HealthMonitor,
 *   SocketServer
 * } from './vm';
 *
 * // Create and initialize manager
 * const manager = new DesktopVMManager({
 *   dataDir: '~/.a2r/desktop',
 *   socketPath: '/var/run/a2r/desktop-vm.sock'
 * });
 *
 * await manager.initialize();
 * await manager.startVM();
 *
 * // Register IPC handlers for renderer
 * registerVMIPCHandlers(manager);
 *
 * // Execute commands
 * const result = await manager.execute('ls -la');
 * console.log(result.stdout);
 *
 * // Clean up
 * await manager.stopVM();
 * ```
 */

// ============================================================================
// Main Components
// ============================================================================

export {
  /** Main VM orchestrator class */
  DesktopVMManager,
  /** Factory function for creating manager */
  createDesktopVMManager,
  /** VM Manager errors */
  VMManagerError,
  VMNotRunningError,
  VMAlreadyRunningError,
  ImageNotFoundError,
} from "./manager.js";

export {
  /** VM lifecycle state machine */
  VMLifecycle,
  /** Factory function for creating lifecycle */
  createVMLifecycle,
  /** VM state type */
  VMState,
  /** State history entry */
  StateHistoryEntry,
  /** Transition result */
  TransitionResult,
  /** Lifecycle errors */
  VMLifecycleError,
  VMLifecycleTimeoutError,
} from "./lifecycle.js";

export {
  /** VM health monitor */
  HealthMonitor,
  /** Factory function for creating monitor */
  createHealthMonitor,
  /** Health monitor options */
  HealthMonitorOptions,
  /** Health status */
  HealthStatus,
  /** CPU usage info */
  CPUUsage,
  /** Memory usage info */
  MemoryUsage,
  /** Disk usage info */
  DiskUsage,
  /** Executor health info */
  ExecutorHealth,
} from "./health-monitor.js";

export {
  /** Unix socket server for CLI */
  SocketServer,
  /** Factory function for creating server */
  createSocketServer,
  /** Socket server options */
  SocketServerOptions,
  /** Socket connection info */
  SocketConnection,
  /** Socket server status */
  SocketServerStatus,
  /** Socket server errors */
  SocketServerError,
} from "./socket-server.js";

// ============================================================================
// IPC Handlers
// ============================================================================

export {
  /** Register all VM IPC handlers */
  registerVMIPCHandlers,
  /** Unregister VM IPC handlers */
  unregisterVMIPCHandlers,
} from "./ipc-handlers.js";

// ============================================================================
// Types
// ============================================================================

export type {
  /** VM driver type */
  VMDriverType,
  /** VM startup options */
  VMOptions,
  /** VM stop options */
  StopOptions,
  /** Command execution options */
  ExecuteOptions,
  /** Command execution result */
  ExecutionResult,
  /** VM status information */
  VMStatusInfo,
  /** Image download progress */
  DownloadProgress,
  /** Image information */
  ImageInfo,
  /** VM manager configuration */
  VMManagerConfig,
  /** Platform information */
  PlatformInfo,
  /** Recovery options */
  RecoveryOptions,
  /** VM backup info */
  VMBackup,
  /** VM log entry */
  VMLogEntry,
} from "./types.js";

// ============================================================================
// Re-exports from cowork
// ============================================================================

export type {
  /** VM configuration from driver */
  VMConfig,
  /** VM instance from driver */
  VMInstance,
} from "../../../../1-kernel/cowork/drivers/apple-vf.js";

// ============================================================================
// Version
// ============================================================================

/** Desktop VM Manager version */
export const VERSION = "1.0.0";

/** Desktop VM Manager name */
export const NAME = "a2r-desktop-vm-manager";
