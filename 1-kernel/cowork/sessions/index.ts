/**
 * @fileoverview Session Multiplexing System
 *
 * A comprehensive session management system for multiple concurrent VM sessions.
 * Provides process isolation through namespaces and cgroups, session forking,
 * resource limits, and streaming execution capabilities.
 *
 * @module sessions
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import { SessionManager, createSessionManager } from "./index.js";
 *
 * // Create and initialize session manager
 * const manager = await createSessionManager(vm, {
 *   maxSessions: 50,
 *   defaultLimits: {
 *     cpu: { cores: 2, percent: 100 },
 *     memory: { limit: 1024 * 1024 * 1024 }, // 1GB
 *   },
 * });
 *
 * // Create a new session
 * const session1 = await manager.createSession({
 *   id: "session-1",
 *   cwd: "/workspace/project1",
 *   env: { NODE_ENV: "development" },
 *   isolation: "standard",
 * });
 *
 * // Execute commands in session
 * await session1.execute("npm install");
 * await session1.execute("npm run build");
 *
 * // Fork the session (faster than creating new)
 * const session2 = await session1.fork();
 *
 * // Run commands in parallel
 * await Promise.all([
 *   session1.execute("npm run test:unit"),
 *   session2.execute("npm run test:e2e"),
 * ]);
 *
 * // Cleanup
 * await manager.destroySession(session1.id);
 * await manager.destroySession(session2.id);
 * ```
 */

// ============================================================================
// Core Classes
// ============================================================================

export { SessionManager, SessionManagerError, SessionLimitError, SessionNotFoundError } from "./manager.js";
export { Session, createSessionFromSnapshot } from "./session.js";
export { ProcessIsolation, IsolationError, NamespaceError, CgroupError } from "./isolation.js";
export { SessionFork, ForkError } from "./fork.js";

// ============================================================================
// Type Definitions
// ============================================================================

export type {
  // Session lifecycle
  SessionState,
  ProcessState,
  
  // Isolation
  IsolationLevel,
  Namespace,
  NamespaceType,
  CgroupConfig,
  
  // Resources
  ResourceLimits,
  CPULimits,
  MemoryLimits,
  IOLimits,
  NetworkLimits,
  SessionResources,
  
  // Configuration
  SessionOptions,
  ForkOptions,
  SessionManagerConfig,
  Command,
  CommandOptions,
  
  // Execution
  ExecutionResult,
  StreamHandlers,
  Process,
  ProcessInfo,
  
  // Session info
  SessionInfo,
  SessionSnapshot,
  
  // Protocol
  CreateSessionRequest,
  ExecuteInSessionRequest,
  ForkSessionRequest,
  DestroySessionRequest,
  ListSessionsRequest,
  GetSessionRequest,
  SessionResponse,
  ListSessionsResponse,
  ExecuteInSessionResponse,
  SessionProtocolRequest,
  SessionProtocolResponse,
  SessionEvent,
  SessionEventType,
  
  // Errors
  SessionError,
  SessionErrorCode,
  
  // VM Interface
  VM,
} from "./types.js";

// ============================================================================
// Utility Functions
// ============================================================================

export {
  // Manager utilities
  createSessionManager,
  generateSessionId,
  isValidSessionId,
  formatResourceLimits,
} from "./manager.js";

export {
  // Isolation utilities
  detectCgroupVersion,
  isCgroupV2Available,
  getAvailableControllers,
  checkIsolationSupport,
  getNamespaceFlags,
  parseResourceLimits,
} from "./isolation.js";

export {
  // Fork utilities
  canFork,
  estimateForkCost,
  createForkOptions,
} from "./fork.js";

export { sessionsEqual } from "./session.js";

// ============================================================================
// Fork Strategies
// ============================================================================

export {
  type ForkStrategy,
  StandardForkStrategy,
  CopyOnWriteForkStrategy,
  FullIsolationForkStrategy,
} from "./fork.js";

// ============================================================================
// Constants
// ============================================================================

/** Module version */
export const VERSION = "1.0.0";

/** Default session limits */
export const DEFAULT_LIMITS = {
  maxSessions: 100,
  maxProcessesPerSession: 100,
  defaultMemoryLimit: 512 * 1024 * 1024, // 512MB
  defaultCPUPercent: 100,
};

/** Isolation level descriptions */
export const ISOLATION_LEVELS = {
  lightweight: {
    description: "Environment isolation only, shared namespaces",
    namespaces: ["uts"],
    useCase: "Quick ephemeral commands",
  },
  standard: {
    description: "Private PID namespace, cgroup limits",
    namespaces: ["pid", "uts", "ipc"],
    useCase: "General purpose sessions",
  },
  full: {
    description: "Complete namespace isolation",
    namespaces: ["pid", "net", "ipc", "uts", "mnt", "cgroup"],
    useCase: "Untrusted or sensitive workloads",
  },
} as const;

// ============================================================================
// Re-export for convenience
// ============================================================================

export { EventEmitter } from "node:events";
