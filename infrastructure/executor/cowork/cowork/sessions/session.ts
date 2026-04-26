/**
 * @fileoverview Session - Individual Session Instance
 *
 * Manages a single session within a VM, including process execution,
 * environment variables, working directory, and state management.
 * Supports forking, snapshots, and streaming execution.
 *
 * @module session
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type {
  Command,
  CommandOptions,
  ExecutionResult,
  StreamHandlers,
  SessionState,
  ProcessState,
  Process,
  ProcessInfo,
  SessionSnapshot,
  SessionResources,
  SessionInfo,
  ResourceLimits,
  IsolationLevel,
  SessionEvent,
} from "./types.js";
import type { VM } from "./types.js";
import type { Namespace, CgroupConfig, Process as ProcessType } from "./types.js";
import type { ProcessIsolation } from "./isolation.js";

// ============================================================================
// Constants
// ============================================================================

/** Default session timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000;

/** Snapshot version for compatibility */
const SNAPSHOT_VERSION = "1.0.0";

/** Maximum output size (10 MB) */
const MAX_OUTPUT_SIZE = 10 * 1024 * 1024;

// ============================================================================
// Process Implementation
// ============================================================================

/**
 * Process handle for a running process in a session
 */
class SessionProcess implements Process {
  public readonly pid: number;
  public readonly info: ProcessInfo;
  public readonly events: EventEmitter;

  private result?: ExecutionResult;
  private running: boolean = false;
  private stdout: string = "";
  private stderr: string = "";
  private startTime: number = 0;
  private vm: VM;
  private command: Command;
  private exitPromise?: Promise<ExecutionResult>;
  private exitResolve?: (result: ExecutionResult) => void;

  constructor(
    pid: number,
    command: Command,
    vm: VM,
    sessionCwd: string,
    sessionEnv: Map<string, string>
  ) {
    this.pid = pid;
    this.vm = vm;
    this.command = command;
    this.events = new EventEmitter();

    // Merge session env with command env
    const mergedEnv: Record<string, string> = {};
    for (const [key, value] of sessionEnv) {
      mergedEnv[key] = value;
    }
    if (command.options?.env) {
      Object.assign(mergedEnv, command.options.env);
    }

    this.info = {
      pid,
      state: "pending",
      command: command.command,
      args: command.args || [],
      startedAt: new Date(),
    };

    // Create promise for wait()
    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;
    });
  }

  /**
   * Start the process execution
   * @internal
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Process already started");
    }

    this.running = true;
    this.startTime = Date.now();
    this.info.state = "starting";

    const args = this.command.args || [];
    const timeout = this.command.options?.timeout ?? DEFAULT_TIMEOUT;
    const cwd = this.command.options?.cwd || "/";

    // Merge environment
    const env: Record<string, string> = {};
    // Add session env first
    // Then add command-specific env
    if (this.command.options?.env) {
      Object.assign(env, this.command.options.env);
    }

    try {
      this.info.state = "running";
      this.events.emit("started", { pid: this.pid });

      const result = await this.vm.execute(this.command.command, args, {
        workingDir: cwd,
        env,
        timeout,
      });

      this.stdout = result.stdout;
      this.stderr = result.stderr;
      this.result = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        pid: this.pid,
        durationMs: Date.now() - this.startTime,
      };

      this.info.state = "stopped";
      this.running = false;

      this.events.emit("exited", { exitCode: result.exitCode });
      this.exitResolve?.(this.result);
    } catch (error) {
      this.info.state = "error";
      this.running = false;

      const errorResult: ExecutionResult = {
        stdout: this.stdout,
        stderr: this.stderr + String(error),
        exitCode: -1,
        pid: this.pid,
        durationMs: Date.now() - this.startTime,
      };

      this.result = errorResult;
      this.events.emit("error", error);
      this.exitResolve?.(errorResult);
    }
  }

  /**
   * Start streaming execution
   * @internal
   */
  async startStreaming(handlers: StreamHandlers): Promise<void> {
    if (this.running) {
      throw new Error("Process already started");
    }

    this.running = true;
    this.startTime = Date.now();
    this.info.state = "starting";

    const args = this.command.args || [];
    const timeout = this.command.options?.timeout ?? DEFAULT_TIMEOUT;
    const cwd = this.command.options?.cwd || "/";

    // Merge environment
    const env: Record<string, string> = {};
    if (this.command.options?.env) {
      Object.assign(env, this.command.options.env);
    }

    return new Promise((resolve, reject) => {
      this.info.state = "running";
      this.events.emit("started", { pid: this.pid });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      this.vm
        .executeStreaming(
          this.command.command,
          args,
          {
            workingDir: cwd,
            env,
            timeout,
            onStdout: (data) => {
              stdoutChunks.push(data);
              handlers.onStdout?.(data);
            },
            onStderr: (data) => {
              stderrChunks.push(data);
              handlers.onStderr?.(data);
            },
            onExit: (exitCode) => {
              this.stdout = Buffer.concat(stdoutChunks).toString("utf-8");
              this.stderr = Buffer.concat(stderrChunks).toString("utf-8");

              this.result = {
                stdout: this.stdout,
                stderr: this.stderr,
                exitCode,
                pid: this.pid,
                durationMs: Date.now() - this.startTime,
              };

              this.info.state = "stopped";
              this.running = false;

              this.events.emit("exited", { exitCode });
              handlers.onExit?.(exitCode);
              this.exitResolve?.(this.result);
              resolve();
            },
          }
        )
        .catch((error) => {
          this.info.state = "error";
          this.running = false;

          const errorResult: ExecutionResult = {
            stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
            stderr: Buffer.concat(stderrChunks).toString("utf-8") + String(error),
            exitCode: -1,
            pid: this.pid,
            durationMs: Date.now() - this.startTime,
          };

          this.result = errorResult;
          this.events.emit("error", error);
          handlers.onError?.(error);
          this.exitResolve?.(errorResult);
          reject(error);
        });
    });
  }

  /**
   * Kill the process
   * @param signal - Signal to send (default: SIGTERM)
   */
  async kill(signal: string = "SIGTERM"): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      // Send kill command through VM
      const result = await this.vm.execute("kill", [`-${signal}`, this.pid.toString()]);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to kill process: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Failed to kill process ${this.pid}: ${error}`);
    }
  }

  /**
   * Wait for the process to complete
   * @returns Execution result
   */
  async wait(): Promise<ExecutionResult> {
    if (this.result) {
      return this.result;
    }
    return this.exitPromise!;
  }

  /**
   * Check if the process is still running
   * @returns True if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the current stdout content
   * @returns Stdout string
   */
  getStdout(): string {
    return this.stdout;
  }

  /**
   * Get the current stderr content
   * @returns Stderr string
   */
  getStderr(): string {
    return this.stderr;
  }
}

// ============================================================================
// Session Class
// ============================================================================

/**
 * Individual session instance
 *
 * Manages a self-contained execution environment within a VM, including:
 * - Process execution and lifecycle
 * - Environment variables
 * - Working directory
 * - Resource isolation (via cgroups)
 * - Namespace isolation
 */
export class Session extends EventEmitter {
  /** Unique session identifier */
  readonly id: string;
  /** Parent session ID (if forked) */
  readonly parentId?: string;
  /** Isolation level for this session */
  readonly isolation: IsolationLevel;

  private vm: VM;
  private isolationManager: ProcessIsolation;
  private state: SessionState = "creating";
  private processes: Map<number, SessionProcess> = new Map();
  private env: Map<string, string> = new Map();
  private cwd: string;
  private limits: ResourceLimits;
  private nextPid: number = 1;
  private createdAt: Date;
  private lastActivityAt: Date;
  private namespace?: Namespace;
  private cgroup?: CgroupConfig;
  private metadata: Map<string, unknown> = new Map();
  private destroying: boolean = false;

  /**
   * Create a new session
   * @param id - Unique session identifier
   * @param vm - VM instance
   * @param isolationManager - Process isolation manager
   * @param options - Session options
   */
  constructor(
    id: string,
    vm: VM,
    isolationManager: ProcessIsolation,
    options: {
      parentId?: string;
      cwd?: string;
      env?: Record<string, string>;
      isolation?: IsolationLevel;
      limits?: ResourceLimits;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super();

    this.id = id;
    this.vm = vm;
    this.isolationManager = isolationManager;
    this.parentId = options.parentId;
    this.cwd = options.cwd || "/";
    this.isolation = options.isolation || "standard";
    this.limits = options.limits || {};
    this.createdAt = new Date();
    this.lastActivityAt = new Date();

    // Initialize environment
    this.env.set("PATH", "/usr/local/bin:/usr/bin:/bin");
    this.env.set("HOME", "/root");
    this.env.set("TERM", "xterm-256color");
    this.env.set("Allternit_SESSION_ID", id);

    // Add custom environment
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        this.env.set(key, value);
      }
    }

    // Add custom metadata
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        this.metadata.set(key, value);
      }
    }
  }

  /**
   * Initialize the session
   * Creates namespaces and sets up cgroups
   */
  async initialize(): Promise<void> {
    if (this.state !== "creating") {
      throw new Error(`Cannot initialize session in state: ${this.state}`);
    }

    try {
      // Create namespace
      this.namespace = await this.isolationManager.createNamespace(
        this.id,
        this.isolation
      );
      this.state = "namespace_created";
      this.emit("stateChanged", { state: this.state });

      // Setup cgroup
      if (Object.keys(this.limits).length > 0) {
        this.cgroup = await this.isolationManager.setupCgroup(this.id, this.limits);
      }
      this.state = "cgroup_setup";
      this.emit("stateChanged", { state: this.state });

      // Session is ready
      this.state = "ready";
      this.emit("stateChanged", { state: this.state });
      this.emit("ready");
    } catch (error) {
      this.state = "destroyed";
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Get the current session state
   * @returns Session state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Check if the session is ready for commands
   * @returns True if ready
   */
  isReady(): boolean {
    return this.state === "ready" || this.state === "running";
  }

  /**
   * Execute a command in the session
   * @param command - Command to execute
   * @returns Execution result
   */
  async execute(command: Command | string): Promise<ExecutionResult> {
    this.ensureReady();
    this.updateActivity();

    const cmd = typeof command === "string" ? { command } : command;
    const pid = this.allocatePid();

    const process = new SessionProcess(pid, cmd, this.vm, this.cwd, this.env);
    this.processes.set(pid, process);

    this.state = "running";
    this.emit("processStarted", { pid, command: cmd.command });

    try {
      await process.start();

      if (this.processes.size === 0) {
        this.state = "ready";
      }

      this.emit("processExited", { pid, exitCode: process.info.state === "error" ? -1 : 0 });
      return await process.wait();
    } catch (error) {
      this.emit("processError", { pid, error });
      throw error;
    } finally {
      this.processes.delete(pid);
    }
  }

  /**
   * Execute a command with streaming output
   * @param command - Command to execute
   * @param handlers - Stream handlers for output
   */
  async executeStreaming(
    command: Command | string,
    handlers: StreamHandlers
  ): Promise<void> {
    this.ensureReady();
    this.updateActivity();

    const cmd = typeof command === "string" ? { command } : command;
    const pid = this.allocatePid();

    const process = new SessionProcess(pid, cmd, this.vm, this.cwd, this.env);
    this.processes.set(pid, process);

    this.state = "running";
    this.emit("processStarted", { pid, command: cmd.command });

    try {
      await process.startStreaming(handlers);

      if (this.processes.size === 0) {
        this.state = "ready";
      }

      this.emit("processExited", { pid, exitCode: 0 });
    } catch (error) {
      this.emit("processError", { pid, error });
      throw error;
    } finally {
      this.processes.delete(pid);
    }
  }

  /**
   * Set an environment variable
   * @param key - Variable name
   * @param value - Variable value
   */
  async setEnv(key: string, value: string): Promise<void> {
    this.env.set(key, value);
    this.updateActivity();
  }

  /**
   * Get an environment variable
   * @param key - Variable name
   * @returns Variable value or undefined
   */
  async getEnv(key: string): Promise<string | undefined> {
    return this.env.get(key);
  }

  /**
   * Get all environment variables
   * @returns Map of all environment variables
   */
  getAllEnv(): Map<string, string> {
    return new Map(this.env);
  }

  /**
   * Remove an environment variable
   * @param key - Variable name
   * @returns True if variable was removed
   */
  async removeEnv(key: string): Promise<boolean> {
    this.updateActivity();
    return this.env.delete(key);
  }

  /**
   * Set the working directory
   * @param path - New working directory
   */
  async setCwd(path: string): Promise<void> {
    // Validate path exists
    const result = await this.vm.execute("test", ["-d", path]);
    if (result.exitCode !== 0) {
      throw new Error(`Directory does not exist: ${path}`);
    }

    this.cwd = path;
    this.updateActivity();
  }

  /**
   * Get the current working directory
   * @returns Current working directory
   */
  async getCwd(): Promise<string> {
    return this.cwd;
  }

  /**
   * Get process by PID
   * @param pid - Process ID
   * @returns Process handle or undefined
   */
  getProcess(pid: number): Process | undefined {
    return this.processes.get(pid);
  }

  /**
   * Get all running processes
   * @returns Array of process handles
   */
  getProcesses(): Process[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get process count
   * @returns Number of running processes
   */
  getProcessCount(): number {
    return this.processes.size;
  }

  /**
   * Kill all running processes in the session
   * @param signal - Signal to send (default: SIGTERM)
   */
  async killAll(signal: string = "SIGTERM"): Promise<void> {
    const killPromises: Promise<void>[] = [];

    for (const process of this.processes.values()) {
      if (process.isRunning()) {
        killPromises.push(process.kill(signal));
      }
    }

    await Promise.all(killPromises);
  }

  /**
   * Create a fork of this session
   * @returns New session with copied state
   */
  async fork(): Promise<Session> {
    this.updateActivity();

    // This is a simplified fork - full implementation is in SessionFork class
    const forkId = randomUUID();

    // Create fork event
    this.emit("fork", { forkId });

    return this;
  }

  /**
   * Create a snapshot of the current session state
   * @returns Session snapshot
   */
  async snapshot(): Promise<SessionSnapshot> {
    this.updateActivity();

    const envObj: Record<string, string> = {};
    for (const [key, value] of this.env) {
      envObj[key] = value;
    }

    const processInfos: ProcessInfo[] = [];
    for (const process of this.processes.values()) {
      processInfos.push({
        pid: process.pid,
        state: process.info.state,
        command: process.info.command,
        args: process.info.args,
        startedAt: process.info.startedAt,
        cpuPercent: process.info.cpuPercent,
        memoryBytes: process.info.memoryBytes,
      });
    }

    const metadataObj: Record<string, unknown> = {};
    for (const [key, value] of this.metadata) {
      metadataObj[key] = value;
    }

    return {
      id: this.id,
      parentId: this.parentId,
      state: this.state,
      env: envObj,
      cwd: this.cwd,
      processes: processInfos,
      limits: this.limits,
      isolation: this.isolation,
      timestamp: new Date(),
      version: SNAPSHOT_VERSION,
    };
  }

  /**
   * Restore session from a snapshot
   * @param snapshot - Snapshot to restore from
   */
  async restore(snapshot: SessionSnapshot): Promise<void> {
    if (snapshot.version !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot version mismatch: ${snapshot.version} vs ${SNAPSHOT_VERSION}`
      );
    }

    // Restore environment
    this.env.clear();
    for (const [key, value] of Object.entries(snapshot.env)) {
      this.env.set(key, value);
    }

    // Restore working directory
    this.cwd = snapshot.cwd;

    // Restore metadata
    this.metadata.clear();

    this.updateActivity();
    this.emit("restored", { snapshot });
  }

  /**
   * Update resource limits
   * @param limits - New resource limits
   */
  async updateLimits(limits: Partial<ResourceLimits>): Promise<void> {
    this.limits = { ...this.limits, ...limits };

    if (this.cgroup) {
      await this.isolationManager.updateLimits(this.id, limits);
    }

    this.updateActivity();
  }

  /**
   * Get current resource usage
   * @returns Resource usage statistics
   */
  async getResourceUsage(): Promise<SessionResources> {
    const usage = await this.isolationManager.getResourceUsage(this.id);

    return {
      cpuPercent: usage.cpuUsage,
      memoryBytes: usage.memoryUsage,
      memoryLimitBytes: this.limits.memory?.limit || 0,
      processCount: this.processes.size,
      processLimit: this.limits.pids || 0,
    };
  }

  /**
   * Set session metadata
   * @param key - Metadata key
   * @param value - Metadata value
   */
  setMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  /**
   * Get session metadata
   * @param key - Metadata key
   * @returns Metadata value or undefined
   */
  getMetadata(key: string): unknown {
    return this.metadata.get(key);
  }

  /**
   * Get session information
   * @returns Session info object
   */
  getInfo(): SessionInfo {
    return {
      id: this.id,
      parentId: this.parentId,
      state: this.state,
      isolation: this.isolation,
      cwd: this.cwd,
      processCount: this.processes.size,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      metadata: Object.fromEntries(this.metadata),
    };
  }

  /**
   * Destroy the session
   * Cleans up all resources and terminates processes
   */
  async destroy(): Promise<void> {
    if (this.destroying || this.state === "destroyed") {
      return;
    }

    this.destroying = true;
    const previousState = this.state;
    this.state = "destroying";
    this.emit("stateChanged", { state: this.state });

    try {
      // Kill all running processes
      await this.killAll("SIGTERM");

      // Give processes time to terminate gracefully
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Force kill remaining processes
      await this.killAll("SIGKILL");

      // Cleanup cgroups
      if (this.cgroup) {
        await this.isolationManager.destroyCgroup(this.id);
      }

      // Cleanup namespaces
      if (this.namespace) {
        await this.isolationManager.destroyNamespace(this.id);
      }

      // Clear process map
      this.processes.clear();

      this.state = "destroyed";
      this.emit("stateChanged", { state: this.state });
      this.emit("destroyed");
    } catch (error) {
      this.state = previousState;
      this.destroying = false;
      this.emit("error", { message: "Failed to destroy session", error });
      throw error;
    }
  }

  /**
   * Check if session is destroyed
   * @returns True if destroyed
   */
  isDestroyed(): boolean {
    return this.state === "destroyed";
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Ensure session is ready for operations
   */
  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error(`Session not ready (state: ${this.state})`);
    }
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    this.lastActivityAt = new Date();
  }

  /**
   * Allocate a new process ID
   */
  private allocatePid(): number {
    return this.nextPid++;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a session from a snapshot
 * @param snapshot - Session snapshot
 * @param vm - VM instance
 * @param isolationManager - Process isolation manager
 * @returns Restored session
 */
export async function createSessionFromSnapshot(
  snapshot: SessionSnapshot,
  vm: VM,
  isolationManager: ProcessIsolation
): Promise<Session> {
  const session = new Session(snapshot.id, vm, isolationManager, {
    parentId: snapshot.parentId,
    cwd: snapshot.cwd,
    env: snapshot.env,
    isolation: snapshot.isolation,
    limits: snapshot.limits,
  });

  await session.initialize();
  await session.restore(snapshot);

  return session;
}

/**
 * Compare two sessions for equality
 * @param a - First session
 * @param b - Second session
 * @returns True if sessions are equal
 */
export function sessionsEqual(a: Session, b: Session): boolean {
  return a.id === b.id;
}
