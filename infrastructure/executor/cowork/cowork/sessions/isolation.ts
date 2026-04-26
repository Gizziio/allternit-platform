/**
 * @fileoverview Session Isolation - Namespaces and Cgroups
 *
 * Manages process isolation for sessions using Linux namespaces and cgroups.
 * Supports cgroup v1 and v2 with automatic detection.
 *
 * @module isolation
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import type {
  Namespace,
  NamespaceType,
  CgroupConfig,
  ResourceLimits,
  CPULimits,
  MemoryLimits,
  IOLimits,
  IsolationLevel,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Cgroup v2 mount point */
const CGROUP2_MOUNT = "/sys/fs/cgroup";

/** Cgroup v1 mount points */
const CGROUP1_MOUNTS: Record<string, string> = {
  cpu: "/sys/fs/cgroup/cpu",
  memory: "/sys/fs/cgroup/memory",
  blkio: "/sys/fs/cgroup/blkio",
  pids: "/sys/fs/cgroup/pids",
  devices: "/sys/fs/cgroup/devices",
};

/** Default cgroup slice */
const DEFAULT_CGROUP_SLICE = "allternit-sessions";

/** Namespace type to clone flag mapping */
const NAMESPACE_FLAGS: Record<NamespaceType, number> = {
  pid: 0x20000000,   // CLONE_NEWPID
  net: 0x40000000,   // CLONE_NEWNET
  ipc: 0x08000000,   // CLONE_NEWIPC
  uts: 0x04000000,   // CLONE_NEWUTS
  mnt: 0x00020000,   // CLONE_NEWNS
  cgroup: 0x02000000, // CLONE_NEWCGROUP
  user: 0x10000000,  // CLONE_NEWUSER
  time: 0x00000080,  // CLONE_NEWTIME
};

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown for isolation-related failures
 */
export class IsolationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "IsolationError";
    Error.captureStackTrace?.(this, IsolationError);
  }
}

/**
 * Error thrown for namespace operations
 */
export class NamespaceError extends IsolationError {
  constructor(message: string, cause?: Error) {
    super(message, "NAMESPACE_ERROR", cause);
    this.name = "NamespaceError";
    Object.setPrototypeOf(this, NamespaceError.prototype);
  }
}

/**
 * Error thrown for cgroup operations
 */
export class CgroupError extends IsolationError {
  constructor(message: string, cause?: Error) {
    super(message, "CGROUP_ERROR", cause);
    this.name = "CgroupError";
    Object.setPrototypeOf(this, CgroupError.prototype);
  }
}

// ============================================================================
// Cgroup Detection
// ============================================================================

/**
 * Detect available cgroup version
 * @returns Cgroup version (1 or 2)
 */
export async function detectCgroupVersion(): Promise<1 | 2> {
  try {
    // Check if cgroup v2 is mounted
    const cgroupRoot = await fs.stat(CGROUP2_MOUNT);
    if (!cgroupRoot.isDirectory()) {
      return 1;
    }

    // Check for cgroup.controllers file (v2 only)
    try {
      await fs.access(
        path.join(CGROUP2_MOUNT, "cgroup.controllers"),
        fs.constants.F_OK
      );
      return 2;
    } catch {
      // Check if it's a hybrid setup
      try {
        await fs.access(
          path.join(CGROUP2_MOUNT, "cpu.stat"),
          fs.constants.F_OK
        );
        return 2;
      } catch {
        return 1;
      }
    }
  } catch {
    return 1;
  }
}

/**
 * Check if cgroup v2 is available
 * @returns True if cgroup v2 is available
 */
export async function isCgroupV2Available(): Promise<boolean> {
  return (await detectCgroupVersion()) === 2;
}

/**
 * Get available cgroup controllers
 * @returns Array of available controller names
 */
export async function getAvailableControllers(): Promise<string[]> {
  const version = await detectCgroupVersion();
  const controllers: string[] = [];

  if (version === 2) {
    try {
      const controllersFile = await fs.readFile(
        path.join(CGROUP2_MOUNT, "cgroup.controllers"),
        "utf-8"
      );
      controllers.push(...controllersFile.trim().split(/\s+/));
    } catch {
      // Fall back to checking available subsystems
      try {
        const subtreeControl = await fs.readFile(
          path.join(CGROUP2_MOUNT, "cgroup.subtree_control"),
          "utf-8"
        );
        controllers.push(...subtreeControl.trim().split(/\s+/));
      } catch {
        // No controllers available
      }
    }
  } else {
    // Check v1 mounts
    for (const [controller, mountPath] of Object.entries(CGROUP1_MOUNTS)) {
      try {
        await fs.access(mountPath, fs.constants.F_OK);
        controllers.push(controller);
      } catch {
        // Controller not available
      }
    }
  }

  return controllers;
}

// ============================================================================
// Process Isolation
// ============================================================================

/**
 * Manages process isolation using namespaces and cgroups
 */
export class ProcessIsolation extends EventEmitter {
  private cgVersion: 1 | 2 | null = null;
  private cgroupSlice: string;
  private sessionCgroups: Map<string, CgroupConfig> = new Map();
  private sessionNamespaces: Map<string, Namespace> = new Map();

  /**
   * Create a new ProcessIsolation instance
   * @param options - Configuration options
   */
  constructor(options: { cgroupSlice?: string } = {}) {
    super();
    this.cgroupSlice = options.cgroupSlice || DEFAULT_CGROUP_SLICE;
  }

  /**
   * Initialize the isolation manager
   * Detects cgroup version and ensures slice exists
   */
  async initialize(): Promise<void> {
    this.cgVersion = await detectCgroupVersion();
    this.emit("initialized", { cgroupVersion: this.cgVersion });

    // Ensure cgroup slice exists
    await this.ensureCgroupSlice();
  }

  /**
   * Get the detected cgroup version
   * @returns Cgroup version (1 or 2)
   */
  getCgroupVersion(): 1 | 2 {
    if (!this.cgVersion) {
      throw new CgroupError("ProcessIsolation not initialized");
    }
    return this.cgVersion;
  }

  /**
   * Create namespaces for a session
   * @param sessionId - Session identifier
   * @param isolation - Isolation level
   * @returns Created namespace
   */
  async createNamespace(
    sessionId: string,
    isolation: IsolationLevel
  ): Promise<Namespace> {
    const types = this.getNamespacesForIsolation(isolation);
    const namespace: Namespace = {
      sessionId,
      types,
      fds: new Map(),
      procPaths: new Map(),
      createdAt: new Date(),
    };

    try {
      // For each namespace type, create the namespace
      // Note: In a real implementation, this would use unshare() or clone()
      // with the appropriate flags to create new namespaces
      for (const nsType of types) {
        const procPath = `/proc/self/ns/${nsType}`;
        try {
          await fs.access(procPath, fs.constants.R_OK);
          namespace.procPaths.set(nsType, procPath);

          // Open file descriptor for later setns
          // In real implementation, would get FD after unshare
          namespace.fds.set(nsType, -1);
        } catch (error) {
          throw new NamespaceError(
            `Failed to access ${nsType} namespace: ${error}`,
            error instanceof Error ? error : undefined
          );
        }
      }

      this.sessionNamespaces.set(sessionId, namespace);
      this.emit("namespaceCreated", { sessionId, namespace });

      return namespace;
    } catch (error) {
      throw new NamespaceError(
        `Failed to create namespace for session ${sessionId}: ${error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Destroy a session namespace
   * @param sessionId - Session identifier
   */
  async destroyNamespace(sessionId: string): Promise<void> {
    const namespace = this.sessionNamespaces.get(sessionId);
    if (!namespace) {
      return;
    }

    // Close namespace file descriptors
    for (const [type, fd] of namespace.fds) {
      if (fd >= 0) {
        try {
          // In real implementation, would close(fd)
          this.emit("debug", { message: `Closing ${type} namespace FD` });
        } catch (error) {
          this.emit("warning", {
            message: `Failed to close ${type} namespace FD`,
            error,
          });
        }
      }
    }

    this.sessionNamespaces.delete(sessionId);
    this.emit("namespaceDestroyed", { sessionId });
  }

  /**
   * Get namespace for a session
   * @param sessionId - Session identifier
   * @returns Namespace or undefined
   */
  getNamespace(sessionId: string): Namespace | undefined {
    return this.sessionNamespaces.get(sessionId);
  }

  /**
   * Set up cgroups for a session
   * @param sessionId - Session identifier
   * @param limits - Resource limits
   */
  async setupCgroup(
    sessionId: string,
    limits: ResourceLimits
  ): Promise<CgroupConfig> {
    const version = this.getCgroupVersion();
    const cgroupPath = this.getCgroupPath(sessionId);

    const config: CgroupConfig = {
      version,
      path: cgroupPath,
      limits,
      active: false,
    };

    try {
      // Create cgroup directory
      await fs.mkdir(cgroupPath, { recursive: true });

      if (version === 2) {
        await this.setupCgroupV2(cgroupPath, limits);
      } else {
        await this.setupCgroupV1(sessionId, limits);
      }

      config.active = true;
      this.sessionCgroups.set(sessionId, config);

      this.emit("cgroupCreated", { sessionId, config });
      return config;
    } catch (error) {
      // Attempt cleanup
      await this.cleanupCgroup(sessionId).catch(() => {
        // Ignore cleanup errors
      });

      throw new CgroupError(
        `Failed to setup cgroup for session ${sessionId}: ${error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Destroy cgroup for a session
   * @param sessionId - Session identifier
   */
  async destroyCgroup(sessionId: string): Promise<void> {
    const config = this.sessionCgroups.get(sessionId);
    if (!config) {
      return;
    }

    await this.cleanupCgroup(sessionId);
    this.sessionCgroups.delete(sessionId);
    this.emit("cgroupDestroyed", { sessionId });
  }

  /**
   * Get cgroup configuration for a session
   * @param sessionId - Session identifier
   * @returns Cgroup config or undefined
   */
  getCgroup(sessionId: string): CgroupConfig | undefined {
    return this.sessionCgroups.get(sessionId);
  }

  /**
   * Update resource limits for an existing cgroup
   * @param sessionId - Session identifier
   * @param limits - New resource limits
   */
  async updateLimits(
    sessionId: string,
    limits: Partial<ResourceLimits>
  ): Promise<void> {
    const config = this.sessionCgroups.get(sessionId);
    if (!config) {
      throw new CgroupError(`No cgroup found for session ${sessionId}`);
    }

    // Merge new limits with existing
    const newLimits: ResourceLimits = {
      ...config.limits,
      ...limits,
      cpu: { ...config.limits.cpu, ...limits.cpu },
      memory: { ...config.limits.memory, ...limits.memory },
      io: { ...config.limits.io, ...limits.io },
    };

    if (config.version === 2) {
      await this.setupCgroupV2(config.path, newLimits);
    } else {
      await this.setupCgroupV1(sessionId, newLimits);
    }

    config.limits = newLimits;
  }

  /**
   * Get resource usage for a session
   * @param sessionId - Session identifier
   * @returns Resource usage statistics
   */
  async getResourceUsage(sessionId: string): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    pids: number;
  }> {
    const config = this.sessionCgroups.get(sessionId);
    if (!config) {
      throw new CgroupError(`No cgroup found for session ${sessionId}`);
    }

    const usage: { cpuUsage: number; memoryUsage: number; pids: number } = {
      cpuUsage: 0,
      memoryUsage: 0,
      pids: 0,
    };

    try {
      if (config.version === 2) {
        // Read memory usage
        try {
          const memCurrent = await fs.readFile(
            path.join(config.path, "memory.current"),
            "utf-8"
          );
          usage.memoryUsage = parseInt(memCurrent.trim(), 10);
        } catch {
          // Ignore if not available
        }

        // Read CPU usage (in microseconds)
        try {
          const cpuStat = await fs.readFile(
            path.join(config.path, "cpu.stat"),
            "utf-8"
          );
          const match = cpuStat.match(/usage_usec\s+(\d+)/);
          if (match) {
            usage.cpuUsage = parseInt(match[1], 10);
          }
        } catch {
          // Ignore if not available
        }

        // Read PID count
        try {
          const pidsCurrent = await fs.readFile(
            path.join(config.path, "pids.current"),
            "utf-8"
          );
          usage.pids = parseInt(pidsCurrent.trim(), 10);
        } catch {
          // Ignore if not available
        }
      } else {
        // Cgroup v1 - read from appropriate controllers
        // Memory
        try {
          const memUsage = await fs.readFile(
            path.join(CGROUP1_MOUNTS.memory, this.cgroupSlice, sessionId, "memory.usage_in_bytes"),
            "utf-8"
          );
          usage.memoryUsage = parseInt(memUsage.trim(), 10);
        } catch {
          // Ignore
        }

        // PIDs
        try {
          const pids = await fs.readFile(
            path.join(CGROUP1_MOUNTS.pids, this.cgroupSlice, sessionId, "pids.current"),
            "utf-8"
          );
          usage.pids = parseInt(pids.trim(), 10);
        } catch {
          // Ignore
        }
      }
    } catch (error) {
      this.emit("warning", { message: "Failed to read resource usage", error });
    }

    return usage;
  }

  /**
   * Move a process into a session cgroup
   * @param sessionId - Session identifier
   * @param pid - Process ID to move
   */
  async addProcessToCgroup(sessionId: string, pid: number): Promise<void> {
    const config = this.sessionCgroups.get(sessionId);
    if (!config) {
      throw new CgroupError(`No cgroup found for session ${sessionId}`);
    }

    try {
      if (config.version === 2) {
        await fs.writeFile(
          path.join(config.path, "cgroup.procs"),
          pid.toString()
        );
      } else {
        // Write to all v1 controllers
        const controllers = ["cpu", "memory", "pids", "blkio"] as const;
        for (const controller of controllers) {
          const mountPath = CGROUP1_MOUNTS[controller];
          if (mountPath) {
            try {
              await fs.writeFile(
                path.join(mountPath, this.cgroupSlice, sessionId, "cgroup.procs"),
                pid.toString()
              );
            } catch {
              // Controller might not be available
            }
          }
        }
      }
    } catch (error) {
      throw new CgroupError(
        `Failed to add process ${pid} to cgroup: ${error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all processes in a session cgroup
   * @param sessionId - Session identifier
   * @returns Array of process IDs
   */
  async getCgroupProcesses(sessionId: string): Promise<number[]> {
    const config = this.sessionCgroups.get(sessionId);
    if (!config) {
      return [];
    }

    try {
      let procsFile: string;
      if (config.version === 2) {
        procsFile = path.join(config.path, "cgroup.procs");
      } else {
        procsFile = path.join(
          CGROUP1_MOUNTS.pids,
          this.cgroupSlice,
          sessionId,
          "cgroup.procs"
        );
      }

      const content = await fs.readFile(procsFile, "utf-8");
      return content
        .trim()
        .split("\n")
        .map((line) => parseInt(line.trim(), 10))
        .filter((pid) => !isNaN(pid));
    } catch {
      return [];
    }
  }

  /**
   * Kill all processes in a session cgroup
   * @param sessionId - Session identifier
   * @param signal - Signal to send (default: SIGTERM)
   */
  async killAllProcesses(
    sessionId: string,
    signal: string = "SIGTERM"
  ): Promise<void> {
    const pids = await this.getCgroupProcesses(sessionId);
    const signum = this.signalToNumber(signal);

    for (const pid of pids) {
      try {
        process.kill(pid, signum);
      } catch {
        // Process might already be dead
      }
    }

    // Wait for processes to exit
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    while (attempts < maxAttempts) {
      const remaining = await this.getCgroupProcesses(sessionId);
      if (remaining.length === 0) {
        break;
      }

      // If SIGTERM didn't work, escalate to SIGKILL
      if (attempts === 30 && signal !== "SIGKILL") {
        for (const pid of remaining) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // Ignore
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
  }

  /**
   * Dispose and cleanup all resources
   */
  async dispose(): Promise<void> {
    // Destroy all session cgroups
    const cleanupPromises: Promise<void>[] = [];
    for (const sessionId of this.sessionCgroups.keys()) {
      cleanupPromises.push(
        this.cleanupCgroup(sessionId).catch(() => {
          // Ignore cleanup errors during dispose
        })
      );
    }

    await Promise.all(cleanupPromises);
    this.sessionCgroups.clear();
    this.sessionNamespaces.clear();
    this.removeAllListeners();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Ensure the cgroup slice exists
   */
  private async ensureCgroupSlice(): Promise<void> {
    const version = this.getCgroupVersion();

    if (version === 2) {
      const slicePath = path.join(CGROUP2_MOUNT, this.cgroupSlice);
      await fs.mkdir(slicePath, { recursive: true });

      // Enable controllers in slice
      try {
        const subtreeControl = path.join(CGROUP2_MOUNT, "cgroup.subtree_control");
        const controllers = ["cpu", "memory", "pids", "io"];
        for (const controller of controllers) {
          try {
            await fs.writeFile(subtreeControl, `+${controller}`, { flag: "a" });
          } catch {
            // Controller might not be available
          }
        }
      } catch {
        // Ignore subtree control errors
      }
    } else {
      // Create v1 hierarchy in each controller
      for (const mountPath of Object.values(CGROUP1_MOUNTS)) {
        const slicePath = path.join(mountPath, this.cgroupSlice);
        await fs.mkdir(slicePath, { recursive: true });
      }
    }
  }

  /**
   * Get cgroup path for a session
   */
  private getCgroupPath(sessionId: string): string {
    return path.join(CGROUP2_MOUNT, this.cgroupSlice, sessionId);
  }

  /**
   * Set up cgroup v2 limits
   */
  private async setupCgroupV2(
    cgroupPath: string,
    limits: ResourceLimits
  ): Promise<void> {
    // Enable controllers for child cgroups
    const subtreeControl = path.join(cgroupPath, "cgroup.subtree_control");
    const controllers = [];
    if (limits.cpu) controllers.push("cpu");
    if (limits.memory) controllers.push("memory");
    if (limits.pids) controllers.push("pids");
    if (limits.io) controllers.push("io");

    for (const controller of controllers) {
      try {
        await fs.writeFile(subtreeControl, `+${controller}`, { flag: "a" });
      } catch {
        // Controller might not be available
      }
    }

    // CPU limits
    if (limits.cpu) {
      await this.writeCpuLimitV2(cgroupPath, limits.cpu);
    }

    // Memory limits
    if (limits.memory) {
      await this.writeMemoryLimitV2(cgroupPath, limits.memory);
    }

    // PID limits
    if (limits.pids) {
      await fs.writeFile(
        path.join(cgroupPath, "pids.max"),
        limits.pids.toString()
      );
    }

    // IO limits
    if (limits.io) {
      await this.writeIOLimitV2(cgroupPath, limits.io);
    }
  }

  /**
   * Set up cgroup v1 limits
   */
  private async setupCgroupV1(
    sessionId: string,
    limits: ResourceLimits
  ): Promise<void> {
    // CPU limits
    if (limits.cpu) {
      const cpuPath = path.join(
        CGROUP1_MOUNTS.cpu,
        this.cgroupSlice,
        sessionId
      );
      await fs.mkdir(cpuPath, { recursive: true });

      // CPU quota and period
      if (limits.cpu.quotaUs && limits.cpu.periodUs) {
        await fs.writeFile(
          path.join(cpuPath, "cpu.cfs_quota_us"),
          limits.cpu.quotaUs.toString()
        );
        await fs.writeFile(
          path.join(cpuPath, "cpu.cfs_period_us"),
          limits.cpu.periodUs.toString()
        );
      }

      // CPU shares (relative weight)
      const shares = Math.max(2, Math.floor(limits.cpu.percent * 1024 / 100));
      await fs.writeFile(path.join(cpuPath, "cpu.shares"), shares.toString());
    }

    // Memory limits
    if (limits.memory) {
      const memPath = path.join(
        CGROUP1_MOUNTS.memory,
        this.cgroupSlice,
        sessionId
      );
      await fs.mkdir(memPath, { recursive: true });

      await fs.writeFile(
        path.join(memPath, "memory.limit_in_bytes"),
        limits.memory.limit.toString()
      );

      if (limits.memory.swap) {
        await fs.writeFile(
          path.join(memPath, "memory.memsw.limit_in_bytes"),
          limits.memory.swap.toString()
        );
      }
    }

    // PID limits
    if (limits.pids) {
      const pidsPath = path.join(
        CGROUP1_MOUNTS.pids,
        this.cgroupSlice,
        sessionId
      );
      await fs.mkdir(pidsPath, { recursive: true });
      await fs.writeFile(
        path.join(pidsPath, "pids.max"),
        limits.pids.toString()
      );
    }

    // IO limits (blkio)
    if (limits.io) {
      const blkioPath = path.join(
        CGROUP1_MOUNTS.blkio,
        this.cgroupSlice,
        sessionId
      );
      await fs.mkdir(blkioPath, { recursive: true });

      // Convert MB/s to bytes/s
      const readBps = Math.floor(limits.io.readMbps * 1024 * 1024);
      const writeBps = Math.floor(limits.io.writeMbps * 1024 * 1024);

      await fs.writeFile(
        path.join(blkioPath, "blkio.throttle.read_bps_device"),
        `8:0 ${readBps}`
      );
      await fs.writeFile(
        path.join(blkioPath, "blkio.throttle.write_bps_device"),
        `8:0 ${writeBps}`
      );
    }
  }

  /**
   * Write CPU limit for cgroup v2
   */
  private async writeCpuLimitV2(
    cgroupPath: string,
    cpu: CPULimits
  ): Promise<void> {
    // cpu.max: "quota period"
    // quota can be "max" for unlimited
    if (cpu.quotaUs && cpu.periodUs) {
      const quota = cpu.quotaUs > 0 ? cpu.quotaUs.toString() : "max";
      await fs.writeFile(
        path.join(cgroupPath, "cpu.max"),
        `${quota} ${cpu.periodUs}`
      );
    }

    // CPU weight (relative, range 1-10000, default 100)
    // Convert percent (0-100) to weight
    const weight = Math.max(1, Math.floor(cpu.percent * 100));
    await fs.writeFile(
      path.join(cgroupPath, "cpu.weight"),
      Math.min(10000, weight).toString()
    );

    // CPU reservation (optional)
    if (cpu.cores) {
      await fs.writeFile(
        path.join(cgroupPath, "cpu.uclamp.min"),
        "0"
      );
    }
  }

  /**
   * Write memory limit for cgroup v2
   */
  private async writeMemoryLimitV2(
    cgroupPath: string,
    memory: MemoryLimits
  ): Promise<void> {
    // memory.max: hard limit
    await fs.writeFile(
      path.join(cgroupPath, "memory.max"),
      memory.limit.toString()
    );

    // memory.swap.max: swap limit
    if (memory.swap !== undefined) {
      await fs.writeFile(
        path.join(cgroupPath, "memory.swap.max"),
        memory.swap.toString()
      );
    }

    // memory.high: throttle threshold (80% of max)
    const high = Math.floor(memory.limit * 0.8);
    await fs.writeFile(
      path.join(cgroupPath, "memory.high"),
      high.toString()
    );
  }

  /**
   * Write IO limit for cgroup v2
   */
  private async writeIOLimitV2(
    cgroupPath: string,
    io: IOLimits
  ): Promise<void> {
    // Format: "device rbps=0 wbps=0 riops=0 wiops=0"
    // Use 8:0 for typical block device (major:minor)
    const readBps = Math.floor(io.readMbps * 1024 * 1024);
    const writeBps = Math.floor(io.writeMbps * 1024 * 1024);
    const readIops = io.readIOPS || 0;
    const writeIops = io.writeIOPS || 0;

    const ioMax = `8:0 rbps=${readBps} wbps=${writeBps} riops=${readIops} wiops=${writeIops}`;
    await fs.writeFile(path.join(cgroupPath, "io.max"), ioMax);
  }

  /**
   * Cleanup cgroup for a session
   */
  private async cleanupCgroup(sessionId: string): Promise<void> {
    const version = this.getCgroupVersion();

    // Kill all processes first
    await this.killAllProcesses(sessionId, "SIGKILL").catch(() => {
      // Ignore errors
    });

    if (version === 2) {
      const cgroupPath = this.getCgroupPath(sessionId);
      try {
        await fs.rmdir(cgroupPath);
      } catch {
        // Directory might not be empty or might not exist
        try {
          // Try to remove recursively
          const entries = await fs.readdir(cgroupPath);
          for (const entry of entries) {
            const entryPath = path.join(cgroupPath, entry);
            try {
              const stat = await fs.stat(entryPath);
              if (stat.isDirectory()) {
                await fs.rmdir(entryPath);
              }
            } catch {
              // Ignore
            }
          }
          await fs.rmdir(cgroupPath);
        } catch {
          // Best effort cleanup
        }
      }
    } else {
      // Cleanup v1 controllers
      for (const mountPath of Object.values(CGROUP1_MOUNTS)) {
        const cgroupPath = path.join(mountPath, this.cgroupSlice, sessionId);
        try {
          await fs.rmdir(cgroupPath);
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Get namespace types for isolation level
   */
  private getNamespacesForIsolation(isolation: IsolationLevel): NamespaceType[] {
    switch (isolation) {
      case "lightweight":
        // Minimal isolation - just UTS for hostname
        return ["uts"];

      case "standard":
        // Standard isolation - PID and UTS
        return ["pid", "uts", "ipc"];

      case "full":
        // Full isolation - all namespaces
        return ["pid", "net", "ipc", "uts", "mnt", "cgroup"];

      default:
        return ["uts"];
    }
  }

  /**
   * Convert signal name to number
   */
  private signalToNumber(signal: string): number {
    const signals: Record<string, number> = {
      SIGHUP: 1,
      SIGINT: 2,
      SIGQUIT: 3,
      SIGILL: 4,
      SIGTRAP: 5,
      SIGABRT: 6,
      SIGBUS: 7,
      SIGFPE: 8,
      SIGKILL: 9,
      SIGUSR1: 10,
      SIGSEGV: 11,
      SIGUSR2: 12,
      SIGPIPE: 13,
      SIGALRM: 14,
      SIGTERM: 15,
      SIGCHLD: 17,
      SIGCONT: 18,
      SIGSTOP: 19,
      SIGTSTP: 20,
      SIGTTIN: 21,
      SIGTTOU: 22,
    };

    return signals[signal] || 15; // Default to SIGTERM
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Check if the current platform supports process isolation
 * @returns Platform compatibility info
 */
export async function checkIsolationSupport(): Promise<{
  supported: boolean;
  namespace: boolean;
  cgroup: boolean;
  cgroupVersion: 1 | 2;
  errors: string[];
}> {
  const errors: string[] = [];
  const checks = {
    supported: false,
    namespace: false,
    cgroup: false,
    cgroupVersion: 1 as 1 | 2,
    errors,
  };

  // Check for Linux
  if (process.platform !== "linux") {
    errors.push("Process isolation requires Linux platform");
    return checks;
  }

  // Check for namespace support
  try {
    await fs.access("/proc/self/ns/pid", fs.constants.R_OK);
    checks.namespace = true;
  } catch {
    errors.push("Namespace support not available");
  }

  // Check for cgroup support
  const cgroupVersion = await detectCgroupVersion();
  checks.cgroupVersion = cgroupVersion;

  if (cgroupVersion === 2) {
    try {
      await fs.access(CGROUP2_MOUNT, fs.constants.R_OK | fs.constants.W_OK);
      checks.cgroup = true;
    } catch {
      errors.push("Cgroup v2 not accessible");
    }
  } else {
    // Check v1 controllers
    let hasV1 = false;
    for (const mountPath of Object.values(CGROUP1_MOUNTS)) {
      try {
        await fs.access(mountPath, fs.constants.R_OK | fs.constants.W_OK);
        hasV1 = true;
        break;
      } catch {
        // Continue checking
      }
    }
    checks.cgroup = hasV1;
    if (!hasV1) {
      errors.push("No cgroup controllers available");
    }
  }

  checks.supported = checks.namespace && checks.cgroup;
  return checks;
}

/**
 * Get namespace clone flags for isolation level
 * @param isolation - Isolation level
 * @returns Combined clone flags
 */
export function getNamespaceFlags(isolation: IsolationLevel): number {
  let flags = 0;

  switch (isolation) {
    case "lightweight":
      flags = NAMESPACE_FLAGS.uts;
      break;
    case "standard":
      flags = NAMESPACE_FLAGS.pid | NAMESPACE_FLAGS.uts | NAMESPACE_FLAGS.ipc;
      break;
    case "full":
      flags =
        NAMESPACE_FLAGS.pid |
        NAMESPACE_FLAGS.net |
        NAMESPACE_FLAGS.ipc |
        NAMESPACE_FLAGS.uts |
        NAMESPACE_FLAGS.mnt |
        NAMESPACE_FLAGS.cgroup;
      break;
  }

  return flags;
}

/**
 * Parse resource limits from string values
 * @param limits - String-based limit definitions
 * @returns Parsed ResourceLimits
 */
export function parseResourceLimits(limits: {
  cpuCores?: number;
  cpuPercent?: number;
  memoryMB?: number;
  memoryGB?: number;
  pids?: number;
  ioReadMBps?: number;
  ioWriteMBps?: number;
}): ResourceLimits {
  const result: ResourceLimits = {};

  if (limits.cpuCores !== undefined || limits.cpuPercent !== undefined) {
    result.cpu = {
      cores: limits.cpuCores || 1,
      percent: limits.cpuPercent || 100,
      periodUs: 100000, // 100ms default
      quotaUs: limits.cpuPercent
        ? Math.floor((limits.cpuPercent / 100) * 100000)
        : 100000,
    };
  }

  if (limits.memoryMB !== undefined) {
    result.memory = {
      limit: limits.memoryMB * 1024 * 1024,
    };
  } else if (limits.memoryGB !== undefined) {
    result.memory = {
      limit: limits.memoryGB * 1024 * 1024 * 1024,
    };
  }

  if (limits.pids !== undefined) {
    result.pids = limits.pids;
  }

  if (limits.ioReadMBps !== undefined || limits.ioWriteMBps !== undefined) {
    result.io = {
      readMbps: limits.ioReadMBps || 100,
      writeMbps: limits.ioWriteMBps || 100,
    };
  }

  return result;
}
