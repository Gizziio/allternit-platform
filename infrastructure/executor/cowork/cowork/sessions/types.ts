/**
 * @fileoverview Session Multiplexing - Type Definitions
 *
 * Core type definitions for the session multiplexing system.
 * Provides interfaces for sessions, processes, resource limits,
 * and protocol messages specific to session management.
 *
 * @module types
 */

import type { EventEmitter } from "node:events";

// ============================================================================
// Session Lifecycle States
// ============================================================================

/**
 * Session lifecycle states
 *
 * State machine:
 * ```
 * creating
 *    ↓
 * namespace_created
 *    ↓
 * cgroup_setup
 *    ↓
 * ready ←─────────────────────┐
 *    ↓                        │
 * running (executing)        │ fork()
 *    ↓                        │
 * stopped ───────────────────┘
 *    ↓
 * destroying
 *    ↓
 * destroyed
 * ```
 */
export type SessionState =
  | "creating"
  | "namespace_created"
  | "cgroup_setup"
  | "ready"
  | "running"
  | "stopped"
  | "destroying"
  | "destroyed";

/**
 * Process lifecycle states within a session
 */
export type ProcessState =
  | "pending"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

// ============================================================================
// Isolation Levels
// ============================================================================

/**
 * Isolation level for session processes
 *
 * - **lightweight**: Environment isolation only, shared namespaces
 * - **standard**: Private PID namespace, cgroup limits
 * - **full**: Complete namespace isolation including network and mounts
 */
export type IsolationLevel = "lightweight" | "standard" | "full";

// ============================================================================
// Resource Limits
// ============================================================================

/**
 * CPU resource limits
 */
export interface CPULimits {
  /** Number of CPU cores */
  cores: number;
  /** CPU usage percentage (0-100) */
  percent: number;
  /** CPU time quota in microseconds (optional) */
  quotaUs?: number;
  /** CPU period in microseconds (optional) */
  periodUs?: number;
}

/**
 * Memory resource limits
 */
export interface MemoryLimits {
  /** Memory limit in bytes */
  limit: number;
  /** Swap limit in bytes (optional) */
  swap?: number;
  /** Kernel memory limit in bytes (optional) */
  kernel?: number;
  /** OOM killer behavior: "kill" | "panic" | "disabled" */
  oomBehavior?: "kill" | "panic" | "disabled";
}

/**
 * I/O resource limits
 */
export interface IOLimits {
  /** Read bandwidth limit in MB/s */
  readMbps: number;
  /** Write bandwidth limit in MB/s */
  writeMbps: number;
  /** IOPS read limit */
  readIOPS?: number;
  /** IOPS write limit */
  writeIOPS?: number;
}

/**
 * Network resource limits
 */
export interface NetworkLimits {
  /** Incoming bandwidth limit in Mbps */
  ingressMbps?: number;
  /** Outgoing bandwidth limit in Mbps */
  egressMbps?: number;
  /** Maximum connections */
  maxConnections?: number;
}

/**
 * Complete resource limits for a session
 */
export interface ResourceLimits {
  /** CPU limits */
  cpu?: CPULimits;
  /** Memory limits */
  memory?: MemoryLimits;
  /** I/O limits */
  io?: IOLimits;
  /** Maximum number of PIDs */
  pids?: number;
  /** Network limits */
  network?: NetworkLimits;
}

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Options for creating a new session
 */
export interface SessionOptions {
  /** Unique session identifier (auto-generated if not provided) */
  id?: string;
  /** Parent session ID (for forked sessions) */
  parentId?: string;
  /** Initial working directory */
  cwd?: string;
  /** Initial environment variables */
  env?: Record<string, string>;
  /** Isolation level */
  isolation?: IsolationLevel;
  /** Resource limits */
  limits?: ResourceLimits;
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Auto-start session after creation */
  autoStart?: boolean;
}

/**
 * Options for forking a session
 */
export interface ForkOptions {
  /** New session ID (auto-generated if not provided) */
  id?: string;
  /** Copy file descriptors from parent */
  copyFiles?: boolean;
  /** Copy running processes from parent */
  copyProcesses?: boolean;
  /** Override isolation level */
  isolation?: IsolationLevel;
  /** Override resource limits */
  limits?: ResourceLimits;
  /** Additional environment variables to merge */
  env?: Record<string, string>;
  /** Override working directory */
  cwd?: string;
  /** Session metadata */
  metadata?: Record<string, string>;
}

/**
 * Command execution options
 */
export interface CommandOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Environment variables (merged with session env) */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Run in background (don't wait for completion) */
  background?: boolean;
  /** Standard input data */
  stdin?: string | Buffer;
  /** Maximum output size in bytes */
  maxOutputSize?: number;
}

/**
 * Command definition for execution
 */
export interface Command {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Execution options */
  options?: CommandOptions;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Process ID */
  pid: number;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Stream handlers for real-time output
 */
export interface StreamHandlers {
  /** Called for each stdout chunk */
  onStdout?: (data: Buffer) => void;
  /** Called for each stderr chunk */
  onStderr?: (data: Buffer) => void;
  /** Called when process exits */
  onExit?: (exitCode: number) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

// ============================================================================
// Process Information
// ============================================================================

/**
 * Process information within a session
 */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Process state */
  state: ProcessState;
  /** Command being executed */
  command: string;
  /** Arguments */
  args: string[];
  /** Start time */
  startedAt: Date;
  /** CPU usage percentage */
  cpuPercent?: number;
  /** Memory usage in bytes */
  memoryBytes?: number;
}

/**
 * Process handle for managing a running process
 */
export interface Process {
  /** Process ID */
  readonly pid: number;
  /** Process information */
  readonly info: ProcessInfo;
  /** Event emitter for process events */
  readonly events: EventEmitter;
  /** Kill the process */
  kill(signal?: string): Promise<void>;
  /** Wait for process to complete */
  wait(): Promise<ExecutionResult>;
  /** Check if process is running */
  isRunning(): boolean;
}

// ============================================================================
// Session Information
// ============================================================================

/**
 * Session information for listing
 */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** Parent session ID (if forked) */
  parentId?: string;
  /** Session state */
  state: SessionState;
  /** Isolation level */
  isolation: IsolationLevel;
  /** Current working directory */
  cwd: string;
  /** Number of running processes */
  processCount: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Resource usage */
  resources?: SessionResources;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session resource usage
 */
export interface SessionResources {
  /** CPU usage percentage */
  cpuPercent: number;
  /** Memory usage in bytes */
  memoryBytes: number;
  /** Memory limit in bytes */
  memoryLimitBytes: number;
  /** Number of processes */
  processCount: number;
  /** Process limit */
  processLimit: number;
}

/**
 * Session snapshot for persistence
 */
export interface SessionSnapshot {
  /** Session ID */
  id: string;
  /** Parent session ID (if forked) */
  parentId?: string;
  /** Session state at snapshot time */
  state: SessionState;
  /** Environment variables */
  env: Record<string, string>;
  /** Working directory */
  cwd: string;
  /** Running processes at snapshot time */
  processes: ProcessInfo[];
  /** Resource limits */
  limits: ResourceLimits;
  /** Isolation level */
  isolation: IsolationLevel;
  /** Snapshot timestamp */
  timestamp: Date;
  /** Snapshot version */
  version: string;
}

// ============================================================================
// Namespace Types
// ============================================================================

/**
 * Linux namespace types
 */
export type NamespaceType = "pid" | "net" | "ipc" | "uts" | "mnt" | "cgroup" | "user" | "time";

/**
 * Namespace handle
 */
export interface Namespace {
  /** Session ID */
  sessionId: string;
  /** Namespace types that are isolated */
  types: NamespaceType[];
  /** Namespace file descriptors (for setns) */
  fds: Map<NamespaceType, number>;
  /** Path to namespace in /proc */
  procPaths: Map<NamespaceType, string>;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Cgroup configuration
 */
export interface CgroupConfig {
  /** Cgroup version (1 or 2) */
  version: 1 | 2;
  /** Cgroup controller path */
  path: string;
  /** Resource limits applied */
  limits: ResourceLimits;
  /** Whether cgroup is active */
  active: boolean;
}

// ============================================================================
// Protocol Messages
// ============================================================================

/**
 * Create session request
 */
export interface CreateSessionRequest {
  id: string;
  type: "create_session";
  options: SessionOptions;
}

/**
 * Execute in session request
 */
export interface ExecuteInSessionRequest {
  id: string;
  type: "execute_in_session";
  sessionId: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Fork session request
 */
export interface ForkSessionRequest {
  id: string;
  type: "fork_session";
  fromSessionId: string;
  options?: ForkOptions;
}

/**
 * Destroy session request
 */
export interface DestroySessionRequest {
  id: string;
  type: "destroy_session";
  sessionId: string;
  force?: boolean;
}

/**
 * List sessions request
 */
export interface ListSessionsRequest {
  id: string;
  type: "list_sessions";
  filters?: {
    state?: SessionState;
    parentId?: string;
  };
}

/**
 * Get session request
 */
export interface GetSessionRequest {
  id: string;
  type: "get_session";
  sessionId: string;
}

/**
 * Session response
 */
export interface SessionResponse {
  id: string;
  type: "session_response";
  success: boolean;
  session?: SessionInfo;
  error?: string;
}

/**
 * List sessions response
 */
export interface ListSessionsResponse {
  id: string;
  type: "list_sessions_response";
  sessions: SessionInfo[];
}

/**
 * Execute in session response
 */
export interface ExecuteInSessionResponse {
  id: string;
  type: "execute_in_session_response";
  success: boolean;
  result?: ExecutionResult;
  error?: string;
}

/**
 * Session event types
 */
export type SessionEventType =
  | "session_created"
  | "session_forked"
  | "session_destroyed"
  | "process_started"
  | "process_exited"
  | "process_error"
  | "resource_limit_hit"
  | "session_error";

/**
 * Session event
 */
export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: Date;
  data?: unknown;
}

/**
 * Union type for all session protocol requests
 */
export type SessionProtocolRequest =
  | CreateSessionRequest
  | ExecuteInSessionRequest
  | ForkSessionRequest
  | DestroySessionRequest
  | ListSessionsRequest
  | GetSessionRequest;

/**
 * Union type for all session protocol responses
 */
export type SessionProtocolResponse =
  | SessionResponse
  | ListSessionsResponse
  | ExecuteInSessionResponse;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for session operations
 */
export type SessionErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_ALREADY_EXISTS"
  | "SESSION_NOT_READY"
  | "INVALID_STATE"
  | "RESOURCE_LIMIT_EXCEEDED"
  | "ISOLATION_FAILED"
  | "FORK_FAILED"
  | "EXECUTION_FAILED"
  | "SNAPSHOT_FAILED"
  | "RESTORE_FAILED"
  | "CGROUP_ERROR"
  | "NAMESPACE_ERROR"
  | "PROCESS_NOT_FOUND"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

/**
 * Session error details
 */
export interface SessionError {
  code: SessionErrorCode;
  message: string;
  sessionId?: string;
  cause?: Error;
}

// ============================================================================
// VM Interface
// ============================================================================

/**
 * VM interface for session manager
 * This abstracts the underlying VM implementation
 */
export interface VM {
  /** VM identifier */
  readonly id: string;
  /** VM state */
  readonly state: string;
  /** Execute a command in the VM */
  execute(command: string, args?: string[], options?: {
    workingDir?: string;
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
  }>;
  /** Execute with streaming output */
  executeStreaming(
    command: string,
    args: string[],
    options: {
      workingDir?: string;
      env?: Record<string, string>;
      timeout?: number;
      onStdout?: (data: Buffer) => void;
      onStderr?: (data: Buffer) => void;
      onExit?: (exitCode: number) => void;
    }
  ): Promise<void>;
  /** Check if VM is running */
  isRunning(): boolean;
}

// ============================================================================
// Manager Configuration
// ============================================================================

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  /** Maximum number of concurrent sessions */
  maxSessions?: number;
  /** Default resource limits for new sessions */
  defaultLimits?: ResourceLimits;
  /** Default isolation level */
  defaultIsolation?: IsolationLevel;
  /** Session timeout in milliseconds (0 = no timeout) */
  sessionTimeoutMs?: number;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs?: number;
  /** Enable session snapshots */
  enableSnapshots?: boolean;
  /** Snapshot directory */
  snapshotDir?: string;
}
