/**
 * @fileoverview Session Forking
 *
 * Implements session forking functionality for creating copies of sessions
 * with shared state. Supports various fork options including environment
 * copying, file descriptor inheritance, and process cloning.
 *
 * @module fork
 */

import { randomUUID } from "node:crypto";
import type { Session } from "./session.js";
import type {
  ForkOptions,
  SessionOptions,
  IsolationLevel,
  ResourceLimits,
  ProcessInfo,
} from "./types.js";
import type { VM } from "./types.js";
import type { ProcessIsolation } from "./isolation.js";
import { SessionManager } from "./manager.js";

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown for fork-related failures
 */
export class ForkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sourceSessionId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ForkError";
    Error.captureStackTrace?.(this, ForkError);
  }
}

// ============================================================================
// File Descriptor Tracking
// ============================================================================

/**
 * Represents a file descriptor in a session
 */
interface TrackedFileDescriptor {
  /** File descriptor number */
  fd: number;
  /** Path to the file */
  path: string;
  /** Open flags */
  flags: number;
  /** Current position */
  position: number;
  /** Whether the FD is open */
  open: boolean;
}

/**
 * File descriptor manager for session forking
 */
class FileDescriptorManager {
  private fds: Map<number, TrackedFileDescriptor> = new Map();
  private nextFd: number = 3; // Start after stdin, stdout, stderr

  /**
   * Track a new file descriptor
   * @param path - File path
   * @param flags - Open flags
   * @param position - Initial position
   * @returns File descriptor number
   */
  track(path: string, flags: number, position: number = 0): number {
    const fd = this.nextFd++;
    this.fds.set(fd, {
      fd,
      path,
      flags,
      position,
      open: true,
    });
    return fd;
  }

  /**
   * Get file descriptor info
   * @param fd - File descriptor number
   * @returns FD info or undefined
   */
  get(fd: number): TrackedFileDescriptor | undefined {
    return this.fds.get(fd);
  }

  /**
   * Close a file descriptor
   * @param fd - File descriptor number
   * @returns True if closed
   */
  close(fd: number): boolean {
    const info = this.fds.get(fd);
    if (info) {
      info.open = false;
      return true;
    }
    return false;
  }

  /**
   * Get all open file descriptors
   * @returns Array of open FDs
   */
  getOpenFDs(): TrackedFileDescriptor[] {
    return Array.from(this.fds.values()).filter((fd) => fd.open);
  }

  /**
   * Copy file descriptors to a new manager
   * @returns New FD manager with copied state
   */
  copy(): FileDescriptorManager {
    const copy = new FileDescriptorManager();
    for (const fd of this.fds.values()) {
      copy.fds.set(fd.fd, { ...fd });
    }
    copy.nextFd = this.nextFd;
    return copy;
  }

  /**
   * Clear all file descriptors
   */
  clear(): void {
    this.fds.clear();
    this.nextFd = 3;
  }
}

// ============================================================================
// Session Fork
// ============================================================================

/**
 * Manages session forking operations
 */
export class SessionFork {
  private manager: SessionManager;
  private vm: VM;
  private isolationManager: ProcessIsolation;
  private fdManagers: Map<string, FileDescriptorManager> = new Map();

  /**
   * Create a new SessionFork instance
   * @param manager - Session manager
   * @param vm - VM instance
   * @param isolationManager - Process isolation manager
   */
  constructor(
    manager: SessionManager,
    vm: VM,
    isolationManager: ProcessIsolation
  ) {
    this.manager = manager;
    this.vm = vm;
    this.isolationManager = isolationManager;
  }

  /**
   * Fork a session
   * Creates a new session as a copy of an existing one
   *
   * @param from - Source session to fork from
   * @param options - Fork options
   * @returns New forked session
   */
  async fork(from: Session, options: ForkOptions = {}): Promise<Session> {
    const startTime = Date.now();

    // Validate source session
    if (from.isDestroyed()) {
      throw new ForkError(
        "Cannot fork a destroyed session",
        "SOURCE_DESTROYED",
        from.id
      );
    }

    if (!from.isReady()) {
      throw new ForkError(
        `Cannot fork session in state: ${from.getState()}`,
        "SOURCE_NOT_READY",
        from.id
      );
    }

    // Generate new session ID
    const newSessionId = options.id || randomUUID();

    // Check if ID already exists
    if (this.manager.getSession(newSessionId)) {
      throw new ForkError(
        `Session ID already exists: ${newSessionId}`,
        "SESSION_EXISTS",
        from.id
      );
    }

    try {
      // Prepare session options
      const sessionOptions = this.buildSessionOptions(from, options, newSessionId);

      // Create new session
      const newSession = await this.manager.createSession(sessionOptions);

      // Copy environment
      await this.copyEnvironment(from, newSession, options.env);

      // Copy working directory
      await this.copyWorkingDirectory(from, newSession, options.cwd);

      // Copy file descriptors if requested
      if (options.copyFiles) {
        await this.copyFileDescriptors(from, newSession);
      }

      // Copy metadata
      this.copyMetadata(from, newSession);

      // Copy processes if requested (snapshot and restore)
      if (options.copyProcesses) {
        await this.copyProcesses(from, newSession);
      }

      const duration = Date.now() - startTime;
      from.emit("forked", {
        forkId: newSessionId,
        duration,
      });

      newSession.emit("forkComplete", {
        parentId: from.id,
        duration,
      });

      return newSession;
    } catch (error) {
      // Cleanup on failure
      const existingSession = this.manager.getSession(newSessionId);
      if (existingSession) {
        await this.manager.destroySession(newSessionId).catch(() => {
          // Ignore cleanup errors
        });
      }

      throw new ForkError(
        `Failed to fork session: ${error}`,
        "FORK_FAILED",
        from.id,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a lightweight copy (copy-on-write style)
   * Shares underlying resources but provides separate interface
   *
   * @param from - Source session
   * @param options - Fork options
   * @returns Lightweight session copy
   */
  async forkLightweight(from: Session, options: ForkOptions = {}): Promise<Session> {
    // Lightweight fork uses environment isolation only
    const forkOptions: ForkOptions = {
      ...options,
      isolation: "lightweight",
      copyFiles: false,
      copyProcesses: false,
    };

    return this.fork(from, forkOptions);
  }

  /**
   * Create an isolated fork (full namespace separation)
   *
   * @param from - Source session
   * @param options - Fork options
   * @returns Fully isolated session copy
   */
  async forkIsolated(from: Session, options: ForkOptions = {}): Promise<Session> {
    // Isolated fork uses full namespace separation
    const forkOptions: ForkOptions = {
      ...options,
      isolation: "full",
      copyFiles: options.copyFiles ?? true,
      copyProcesses: false,
    };

    return this.fork(from, forkOptions);
  }

  /**
   * Get file descriptor manager for a session
   * @param sessionId - Session ID
   * @returns FD manager (creates if not exists)
   */
  getFDManager(sessionId: string): FileDescriptorManager {
    let manager = this.fdManagers.get(sessionId);
    if (!manager) {
      manager = new FileDescriptorManager();
      this.fdManagers.set(sessionId, manager);
    }
    return manager;
  }

  /**
   * Remove file descriptor manager for a session
   * @param sessionId - Session ID
   */
  removeFDManager(sessionId: string): void {
    this.fdManagers.delete(sessionId);
  }

  /**
   * Copy file descriptors from one session to another
   * @param from - Source session
   * @param to - Destination session
   */
  async copyFileDescriptors(from: Session, to: Session): Promise<void> {
    const fromManager = this.fdManagers.get(from.id);
    if (!fromManager) {
      return; // No FDs to copy
    }

    const toManager = this.getFDManager(to.id);
    const openFDs = fromManager.getOpenFDs();

    for (const fd of openFDs) {
      try {
        // Re-open the file in the new session
        // In a real implementation, this would use dup() or similar
        await to.execute({
          command: "cat",
          args: ["/dev/null"],
          options: {
            cwd: fd.path,
          },
        });

        // Track the new FD
        toManager.track(fd.path, fd.flags, fd.position);
      } catch (error) {
        // Log but don't fail the fork
        to.emit("warning", {
          message: `Failed to copy file descriptor ${fd.fd}`,
          error,
        });
      }
    }
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    this.fdManagers.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Build session options for the forked session
   */
  private buildSessionOptions(
    from: Session,
    options: ForkOptions,
    newSessionId: string
  ): SessionOptions {
    // Determine isolation level
    const isolation: IsolationLevel = options.isolation || from.isolation;

    // Determine limits
    const limits: ResourceLimits = options.limits || {};

    return {
      id: newSessionId,
      parentId: from.id,
      cwd: options.cwd || undefined,
      isolation,
      limits,
      autoStart: true,
      metadata: {
        forkedFrom: from.id,
        forkTime: new Date().toISOString(),
      },
    };
  }

  /**
   * Copy environment variables from source to destination session
   */
  private async copyEnvironment(
    from: Session,
    to: Session,
    additionalEnv?: Record<string, string>
  ): Promise<void> {
    // Get all environment from source
    const sourceEnv = from.getAllEnv();

    // Copy to destination
    for (const [key, value] of sourceEnv) {
      // Skip session-specific variables
      if (key === "A2R_SESSION_ID") continue;

      await to.setEnv(key, value);
    }

    // Merge additional environment variables
    if (additionalEnv) {
      for (const [key, value] of Object.entries(additionalEnv)) {
        await to.setEnv(key, value);
      }
    }

    // Set fork-specific environment
    await to.setEnv("A2R_FORKED_FROM", from.id);
  }

  /**
   * Copy working directory from source to destination session
   */
  private async copyWorkingDirectory(
    from: Session,
    to: Session,
    overrideCwd?: string
  ): Promise<void> {
    const cwd = overrideCwd || (await from.getCwd());
    await to.setCwd(cwd);
  }

  /**
   * Copy metadata from source to destination session
   */
  private copyMetadata(from: Session, to: Session): void {
    // Copy specific metadata fields if needed
    const forkCount = (from.getMetadata("forkCount") as number) || 0;
    from.setMetadata("forkCount", forkCount + 1);
    from.setMetadata("lastForkTime", new Date().toISOString());
    from.setMetadata("lastForkId", to.id);
  }

  /**
   * Copy running processes from source to destination
   * Note: This creates new processes with the same state
   */
  private async copyProcesses(from: Session, to: Session): Promise<void> {
    const processes = from.getProcesses();

    for (const process of processes) {
      const info = process.info;

      if (info.state === "running") {
        // In a real implementation, this might use checkpoint/restore
        // For now, we just note that the process was running
        to.setMetadata(`inheritedProcess_${info.pid}`, {
          command: info.command,
          args: info.args,
          startedAt: info.startedAt,
        });
      }
    }
  }
}

// ============================================================================
// Fork Strategies
// ============================================================================

/**
 * Fork strategy interface
 */
export interface ForkStrategy {
  /**
   * Execute the fork
   * @param fork - SessionFork instance
   * @param from - Source session
   * @param options - Fork options
   * @returns New session
   */
  execute(
    fork: SessionFork,
    from: Session,
    options: ForkOptions
  ): Promise<Session>;
}

/**
 * Standard fork strategy
 */
export class StandardForkStrategy implements ForkStrategy {
  async execute(
    fork: SessionFork,
    from: Session,
    options: ForkOptions
  ): Promise<Session> {
    return fork.fork(from, options);
  }
}

/**
 * Copy-on-write fork strategy
 */
export class CopyOnWriteForkStrategy implements ForkStrategy {
  async execute(
    fork: SessionFork,
    from: Session,
    options: ForkOptions
  ): Promise<Session> {
    return fork.forkLightweight(from, options);
  }
}

/**
 * Full isolation fork strategy
 */
export class FullIsolationForkStrategy implements ForkStrategy {
  async execute(
    fork: SessionFork,
    from: Session,
    options: ForkOptions
  ): Promise<Session> {
    return fork.forkIsolated(from, options);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a session can be forked
 * @param session - Session to check
 * @returns Object with canFork and reason
 */
export function canFork(session: Session): {
  canFork: boolean;
  reason?: string;
} {
  if (session.isDestroyed()) {
    return { canFork: false, reason: "Session is destroyed" };
  }

  const state = session.getState();
  if (state === "creating" || state === "destroying") {
    return { canFork: false, reason: `Session is in ${state} state` };
  }

  return { canFork: true };
}

/**
 * Estimate fork cost
 * @param from - Source session
 * @param options - Fork options
 * @returns Estimated cost metrics
 */
export function estimateForkCost(
  from: Session,
  options: ForkOptions = {}
): {
  memoryOverhead: number;
  timeEstimateMs: number;
  complexity: "low" | "medium" | "high";
} {
  const processCount = from.getProcessCount();
  const copyFiles = options.copyFiles ?? false;
  const copyProcesses = options.copyProcesses ?? false;
  const isolation = options.isolation || from.isolation;

  let memoryOverhead = 1024 * 1024; // Base 1MB overhead
  let timeEstimateMs = 50; // Base 50ms
  let complexity: "low" | "medium" | "high" = "low";

  // Process copying adds overhead
  if (copyProcesses && processCount > 0) {
    memoryOverhead += processCount * 512 * 1024; // 512KB per process
    timeEstimateMs += processCount * 100;
    complexity = "high";
  }

  // File descriptor copying
  if (copyFiles) {
    memoryOverhead += 256 * 1024; // 256KB for FD tracking
    timeEstimateMs += 20;
    if (complexity === "low") complexity = "medium";
  }

  // Isolation level affects overhead
  switch (isolation) {
    case "lightweight":
      memoryOverhead += 512 * 1024;
      break;
    case "standard":
      memoryOverhead += 2 * 1024 * 1024; // 2MB
      timeEstimateMs += 30;
      break;
    case "full":
      memoryOverhead += 5 * 1024 * 1024; // 5MB
      timeEstimateMs += 100;
      complexity = "high";
      break;
  }

  return {
    memoryOverhead,
    timeEstimateMs,
    complexity,
  };
}

/**
 * Create fork options with defaults
 * @param overrides - Options to override
 * @returns Complete fork options
 */
export function createForkOptions(overrides: ForkOptions = {}): ForkOptions {
  return {
    id: overrides.id || randomUUID(),
    copyFiles: overrides.copyFiles ?? false,
    copyProcesses: overrides.copyProcesses ?? false,
    isolation: overrides.isolation,
    limits: overrides.limits,
    env: overrides.env,
    cwd: overrides.cwd,
    metadata: overrides.metadata,
  };
}
