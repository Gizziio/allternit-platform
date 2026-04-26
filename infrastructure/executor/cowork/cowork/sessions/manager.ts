/**
 * @fileoverview Session Manager
 *
 * Central manager for all VM sessions. Handles session lifecycle,
 * resource allocation, cleanup, and provides the main interface
 * for session operations.
 *
 * @module manager
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type {
  SessionOptions,
  ForkOptions,
  SessionInfo,
  SessionState,
  SessionManagerConfig,
  ResourceLimits,
  IsolationLevel,
  SessionEvent,
  SessionProtocolRequest,
  CreateSessionRequest,
  ForkSessionRequest,
  DestroySessionRequest,
  ListSessionsRequest,
  GetSessionRequest,
  ExecuteInSessionRequest,
  SessionResponse,
  ListSessionsResponse,
  ExecuteInSessionResponse,
  ExecutionResult,
} from "./types.js";
import type { VM } from "./types.js";
import { Session } from "./session.js";
import { ProcessIsolation, checkIsolationSupport } from "./isolation.js";
import { SessionFork, ForkError } from "./fork.js";

// ============================================================================
// Constants
// ============================================================================

/** Default maximum sessions */
const DEFAULT_MAX_SESSIONS = 100;

/** Default session timeout (30 minutes) */
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Default cleanup interval (1 minute) */
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000;

/** Default resource limits */
const DEFAULT_LIMITS: ResourceLimits = {
  cpu: { cores: 1, percent: 100 },
  memory: { limit: 512 * 1024 * 1024 }, // 512MB
  pids: 100,
};

/** Default isolation level */
const DEFAULT_ISOLATION: IsolationLevel = "standard";

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown for session manager operations
 */
export class SessionManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "SessionManagerError";
    Error.captureStackTrace?.(this, SessionManagerError);
  }
}

/**
 * Error thrown when session limit is exceeded
 */
export class SessionLimitError extends SessionManagerError {
  constructor(
    current: number,
    maximum: number
  ) {
    super(
      `Session limit exceeded: ${current}/${maximum}`,
      "SESSION_LIMIT_EXCEEDED"
    );
    this.name = "SessionLimitError";
    Object.setPrototypeOf(this, SessionLimitError.prototype);
  }
}

/**
 * Error thrown when a session is not found
 */
export class SessionNotFoundError extends SessionManagerError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, "SESSION_NOT_FOUND");
    this.name = "SessionNotFoundError";
    Object.setPrototypeOf(this, SessionNotFoundError.prototype);
  }
}

// ============================================================================
// Session Manager
// ============================================================================

/**
 * Manages multiple concurrent VM sessions
 *
 * The SessionManager is the primary interface for creating, managing,
 * and destroying sessions within a VM. It handles:
 *
 * - Session lifecycle management
 * - Resource allocation and limits
 * - Automatic cleanup of idle sessions
 * - Forking operations
 * - Protocol message handling
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private vm: VM;
  private isolationManager: ProcessIsolation;
  private forkManager: SessionFork;
  private config: Required<SessionManagerConfig>;
  private cleanupInterval?: NodeJS.Timeout;
  private initialized: boolean = false;
  private destroyed: boolean = false;

  /**
   * Create a new SessionManager
   *
   * @param vm - VM instance for command execution
   * @param config - Manager configuration
   *
   * @example
   * ```typescript
   * const manager = new SessionManager(vm, {
   *   maxSessions: 50,
   *   defaultLimits: {
   *     cpu: { cores: 2, percent: 100 },
   *     memory: { limit: 1024 * 1024 * 1024 },
   *   },
   * });
   * ```
   */
  constructor(vm: VM, config: SessionManagerConfig = {}) {
    super();

    this.vm = vm;
    this.config = {
      maxSessions: config.maxSessions ?? DEFAULT_MAX_SESSIONS,
      defaultLimits: config.defaultLimits ?? DEFAULT_LIMITS,
      defaultIsolation: config.defaultIsolation ?? DEFAULT_ISOLATION,
      sessionTimeoutMs: config.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
      cleanupIntervalMs: config.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS,
      enableSnapshots: config.enableSnapshots ?? false,
      snapshotDir: config.snapshotDir ?? "/tmp/allternit-sessions",
    };

    // Initialize isolation manager
    this.isolationManager = new ProcessIsolation();

    // Initialize fork manager (will be set after this is constructed)
    this.forkManager = new SessionFork(this as unknown as SessionManager, vm, this.isolationManager);
  }

  /**
   * Initialize the session manager
   *
   * Checks platform support, initializes the isolation manager,
   * and starts the cleanup interval.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.emit("initializing");

    try {
      // Check platform support
      const support = await checkIsolationSupport();
      if (!support.supported) {
        throw new SessionManagerError(
          `Process isolation not supported: ${support.errors.join(", ")}`,
          "PLATFORM_NOT_SUPPORTED"
        );
      }

      // Initialize isolation manager
      await this.isolationManager.initialize();

      // Re-initialize fork manager with correct reference
      this.forkManager = new SessionFork(this, this.vm, this.isolationManager);

      // Start cleanup interval
      this.startCleanupInterval();

      this.initialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Create a new session
   *
   * @param options - Session creation options
   * @returns Created session
   *
   * @example
   * ```typescript
   * const session = await manager.createSession({
   *   id: "my-session",
   *   cwd: "/workspace",
   *   env: { NODE_ENV: "development" },
   *   limits: {
   *     cpu: { cores: 2, percent: 100 },
   *     memory: { limit: 2 * 1024 * 1024 * 1024 },
   *   },
   * });
   * ```
   */
  async createSession(options: SessionOptions = {}): Promise<Session> {
    this.ensureInitialized();

    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      throw new SessionLimitError(this.sessions.size, this.config.maxSessions);
    }

    // Generate ID if not provided
    const sessionId = options.id || randomUUID();

    // Check for duplicate ID
    if (this.sessions.has(sessionId)) {
      throw new SessionManagerError(
        `Session ID already exists: ${sessionId}`,
        "SESSION_ALREADY_EXISTS"
      );
    }

    // Merge options with defaults
    const mergedOptions: SessionOptions = {
      ...options,
      id: sessionId,
      cwd: options.cwd || "/",
      isolation: options.isolation || this.config.defaultIsolation,
      limits: { ...this.config.defaultLimits, ...options.limits },
      env: { ...options.env },
    };

    try {
      // Create session
      const session = new Session(
        sessionId,
        this.vm,
        this.isolationManager,
        mergedOptions
      );

      // Initialize session
      await session.initialize();

      // Store session
      this.sessions.set(sessionId, session);

      // Setup session event forwarding
      this.setupSessionEvents(session);

      this.emit("sessionCreated", { sessionId, options: mergedOptions });

      return session;
    } catch (error) {
      this.emit("error", { message: "Failed to create session", sessionId, error });
      throw new SessionManagerError(
        `Failed to create session: ${error}`,
        "SESSION_CREATE_FAILED",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fork an existing session
   *
   * @param fromSessionId - ID of session to fork from
   * @param options - Fork options
   * @returns New forked session
   *
   * @example
   * ```typescript
   * const session2 = await manager.forkSession("session-1", {
   *   id: "session-2",
   *   copyFiles: true,
   * });
   * ```
   */
  async forkSession(
    fromSessionId: string,
    options: ForkOptions = {}
  ): Promise<Session> {
    this.ensureInitialized();

    const fromSession = this.sessions.get(fromSessionId);
    if (!fromSession) {
      throw new SessionNotFoundError(fromSessionId);
    }

    const forkedSession = await this.forkManager.fork(fromSession, options);

    // Store the forked session
    this.sessions.set(forkedSession.id, forkedSession);
    this.setupSessionEvents(forkedSession);

    this.emit("sessionForked", {
      fromSessionId,
      toSessionId: forkedSession.id,
    });

    return forkedSession;
  }

  /**
   * Destroy a session
   *
   * @param sessionId - ID of session to destroy
   * @param force - Force destruction even if processes are running
   *
   * @example
   * ```typescript
   * await manager.destroySession("session-1");
   * ```
   */
  async destroySession(sessionId: string, force: boolean = false): Promise<void> {
    this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    try {
      // Kill running processes if force
      if (force) {
        await session.killAll("SIGKILL");
      }

      // Destroy session
      await session.destroy();

      // Remove from manager
      this.sessions.delete(sessionId);
      this.forkManager.removeFDManager(sessionId);

      this.emit("sessionDestroyed", { sessionId });
    } catch (error) {
      this.emit("error", { message: "Failed to destroy session", sessionId, error });
      throw new SessionManagerError(
        `Failed to destroy session: ${error}`,
        "SESSION_DESTROY_FAILED",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - Session identifier
   * @returns Session or undefined if not found
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists
   *
   * @param sessionId - Session identifier
   * @returns True if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * List all sessions
   *
   * @returns Array of session info objects
   */
  async listSessions(): Promise<SessionInfo[]> {
    const infos: SessionInfo[] = [];

    for (const session of this.sessions.values()) {
      infos.push(session.getInfo());
    }

    return infos;
  }

  /**
   * List sessions matching filter criteria
   *
   * @param filter - Filter options
   * @returns Filtered session info array
   */
  async listSessionsFiltered(filter: {
    state?: SessionState;
    parentId?: string;
  }): Promise<SessionInfo[]> {
    const allSessions = await this.listSessions();

    return allSessions.filter((session) => {
      if (filter.state && session.state !== filter.state) {
        return false;
      }
      if (filter.parentId !== undefined && session.parentId !== filter.parentId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get all active sessions
   *
   * @returns Array of active session info
   */
  async getActiveSessions(): Promise<SessionInfo[]> {
    const allSessions = await this.listSessions();
    return allSessions.filter(
      (s) => s.state === "ready" || s.state === "running"
    );
  }

  /**
   * Get session count
   *
   * @returns Number of sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Execute a command in a session
   *
   * @param sessionId - Session ID
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Execution result
   */
  async executeInSession(
    sessionId: string,
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    return session.execute({
      command,
      args,
      options,
    });
  }

  /**
   * Get total resource usage across all sessions
   *
   * @returns Aggregated resource usage
   */
  async getTotalResourceUsage(): Promise<{
    sessionCount: number;
    processCount: number;
    totalMemoryBytes: number;
    totalCpuPercent: number;
  }> {
    let processCount = 0;
    let totalMemoryBytes = 0;
    let totalCpuPercent = 0;

    for (const session of this.sessions.values()) {
      try {
        const usage = await session.getResourceUsage();
        processCount += usage.processCount;
        totalMemoryBytes += usage.memoryBytes;
        totalCpuPercent += usage.cpuPercent;
      } catch {
        // Skip sessions that fail to report usage
      }
    }

    return {
      sessionCount: this.sessions.size,
      processCount,
      totalMemoryBytes,
      totalCpuPercent,
    };
  }

  /**
   * Destroy all sessions
   *
   * @param force - Force destroy even with running processes
   */
  async destroyAllSessions(force: boolean = false): Promise<void> {
    const destroyPromises: Promise<void>[] = [];

    for (const sessionId of this.sessions.keys()) {
      destroyPromises.push(
        this.destroySession(sessionId, force).catch(() => {
          // Ignore individual errors
        })
      );
    }

    await Promise.all(destroyPromises);
  }

  /**
   * Handle protocol request
   *
   * Processes session-related protocol messages
   *
   * @param request - Protocol request
   * @returns Protocol response
   */
  async handleProtocolRequest(
    request: SessionProtocolRequest
  ): Promise<SessionResponse | ListSessionsResponse | ExecuteInSessionResponse> {
    switch (request.type) {
      case "create_session":
        return this.handleCreateSession(request);

      case "fork_session":
        return this.handleForkSession(request);

      case "destroy_session":
        return this.handleDestroySession(request);

      case "list_sessions":
        return this.handleListSessions(request);

      case "get_session":
        return this.handleGetSession(request);

      case "execute_in_session":
        return this.handleExecuteInSession(request);

      default:
        return {
          id: (request as { id: string }).id,
          type: "session_response",
          success: false,
          error: `Unknown request type: ${(request as { type: string }).type}`,
        };
    }
  }

  /**
   * Dispose the session manager
   *
   * Stops all sessions and cleans up resources
   */
  async dispose(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.emit("disposing");

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Destroy all sessions
    await this.destroyAllSessions(true);

    // Dispose fork manager
    await this.forkManager.dispose();

    // Dispose isolation manager
    await this.isolationManager.dispose();

    this.destroyed = true;
    this.initialized = false;
    this.emit("disposed");
    this.removeAllListeners();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new SessionManagerError(
        "SessionManager not initialized",
        "NOT_INITIALIZED"
      );
    }
    if (this.destroyed) {
      throw new SessionManagerError(
        "SessionManager has been disposed",
        "DISPOSED"
      );
    }
  }

  /**
   * Setup event forwarding from session to manager
   */
  private setupSessionEvents(session: Session): void {
    session.on("stateChanged", (event) => {
      this.emit("sessionStateChanged", {
        sessionId: session.id,
        ...event,
      });
    });

    session.on("processStarted", (event) => {
      this.emit("sessionProcessStarted", {
        sessionId: session.id,
        ...event,
      });
    });

    session.on("processExited", (event) => {
      this.emit("sessionProcessExited", {
        sessionId: session.id,
        ...event,
      });
    });

    session.on("error", (event) => {
      this.emit("sessionError", {
        sessionId: session.id,
        ...event,
      });
    });

    session.on("destroyed", () => {
      // Remove from manager if not already removed
      if (this.sessions.has(session.id)) {
        this.sessions.delete(session.id);
        this.emit("sessionDestroyed", { sessionId: session.id });
      }
    });
  }

  /**
   * Start cleanup interval for idle sessions
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions().catch((error) => {
        this.emit("error", { message: "Cleanup failed", error });
      });
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Cleanup idle sessions that have exceeded timeout
   */
  private async cleanupIdleSessions(): Promise<void> {
    if (this.config.sessionTimeoutMs <= 0) {
      return; // No timeout configured
    }

    const now = Date.now();
    const timeout = this.config.sessionTimeoutMs;

    for (const [sessionId, session] of this.sessions) {
      const info = session.getInfo();
      const idleTime = now - info.lastActivityAt.getTime();

      if (idleTime > timeout) {
        this.emit("sessionIdleTimeout", { sessionId, idleTime });
        await this.destroySession(sessionId).catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  }

  /**
   * Handle create_session protocol request
   */
  private async handleCreateSession(
    request: CreateSessionRequest
  ): Promise<SessionResponse> {
    try {
      const session = await this.createSession(request.options);
      return {
        id: request.id,
        type: "session_response",
        success: true,
        session: session.getInfo(),
      };
    } catch (error) {
      return {
        id: request.id,
        type: "session_response",
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Handle fork_session protocol request
   */
  private async handleForkSession(
    request: ForkSessionRequest
  ): Promise<SessionResponse> {
    try {
      const session = await this.forkSession(
        request.fromSessionId,
        request.options
      );
      return {
        id: request.id,
        type: "session_response",
        success: true,
        session: session.getInfo(),
      };
    } catch (error) {
      return {
        id: request.id,
        type: "session_response",
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Handle destroy_session protocol request
   */
  private async handleDestroySession(
    request: DestroySessionRequest
  ): Promise<SessionResponse> {
    try {
      await this.destroySession(request.sessionId, request.force);
      return {
        id: request.id,
        type: "session_response",
        success: true,
      };
    } catch (error) {
      return {
        id: request.id,
        type: "session_response",
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Handle list_sessions protocol request
   */
  private async handleListSessions(
    request: ListSessionsRequest
  ): Promise<ListSessionsResponse> {
    const sessions = await this.listSessionsFiltered({
      state: request.filters?.state,
      parentId: request.filters?.parentId,
    });

    return {
      id: request.id,
      type: "list_sessions_response",
      sessions,
    };
  }

  /**
   * Handle get_session protocol request
   */
  private async handleGetSession(
    request: GetSessionRequest
  ): Promise<SessionResponse> {
    const session = this.sessions.get(request.sessionId);

    if (!session) {
      return {
        id: request.id,
        type: "session_response",
        success: false,
        error: `Session not found: ${request.sessionId}`,
      };
    }

    return {
      id: request.id,
      type: "session_response",
      success: true,
      session: session.getInfo(),
    };
  }

  /**
   * Handle execute_in_session protocol request
   */
  private async handleExecuteInSession(
    request: ExecuteInSessionRequest
  ): Promise<ExecuteInSessionResponse> {
    try {
      const result = await this.executeInSession(
        request.sessionId,
        request.command,
        request.args,
        {
          cwd: request.cwd,
          env: request.env,
          timeout: request.timeout,
        }
      );

      return {
        id: request.id,
        type: "execute_in_session_response",
        success: true,
        result,
      };
    } catch (error) {
      return {
        id: request.id,
        type: "execute_in_session_response",
        success: false,
        error: String(error),
      };
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a configured session manager
 *
 * @param vm - VM instance
 * @param config - Manager configuration
 * @returns Initialized session manager
 */
export async function createSessionManager(
  vm: VM,
  config: SessionManagerConfig = {}
): Promise<SessionManager> {
  const manager = new SessionManager(vm, config);
  await manager.initialize();
  return manager;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique session ID
 * @returns Unique session identifier
 */
export function generateSessionId(): string {
  return randomUUID();
}

/**
 * Validate session ID format
 * @param id - Session ID to validate
 * @returns True if valid
 */
export function isValidSessionId(id: string): boolean {
  // UUID format or alphanumeric with hyphens/underscores
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const simpleRegex = /^[a-zA-Z0-9_-]+$/;

  return uuidRegex.test(id) || simpleRegex.test(id);
}

/**
 * Format resource limits for display
 * @param limits - Resource limits
 * @returns Formatted string
 */
export function formatResourceLimits(limits: ResourceLimits): string {
  const parts: string[] = [];

  if (limits.cpu) {
    parts.push(`CPU: ${limits.cpu.cores} cores @ ${limits.cpu.percent}%`);
  }

  if (limits.memory) {
    const mb = Math.floor(limits.memory.limit / (1024 * 1024));
    parts.push(`Memory: ${mb}MB`);
  }

  if (limits.pids) {
    parts.push(`PIDs: ${limits.pids}`);
  }

  if (limits.io) {
    parts.push(`IO: ${limits.io.readMbps}/${limits.io.writeMbps} MB/s`);
  }

  return parts.join(", ") || "unlimited";
}
