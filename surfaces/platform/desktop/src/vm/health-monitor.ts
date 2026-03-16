/**
 * VM Health Monitor
 *
 * Monitors VM health through periodic checks and automatic recovery.
 * Tracks CPU, memory, disk usage, and executor responsiveness.
 *
 * @module health-monitor
 * @example
 * ```typescript
 * const monitor = new HealthMonitor({
 *   checkInterval: 5000,
 *   cpuThreshold: 80,
 *   memoryThreshold: 90
 * });
 *
 * monitor.onUnhealthy(() => {
 *   console.log('VM is unhealthy, initiating recovery...');
 * });
 *
 * monitor.start();
 * ```
 */

import { EventEmitter } from "events";
import { VMConnection, VMTransportError } from "../../../../1-kernel/cowork/transport/transport.js";
import { ProtocolClient } from "../../../../1-kernel/cowork/protocol/client.js";

/**
 * Health check configuration options
 */
export interface HealthMonitorOptions {
  /** Check interval in milliseconds (default: 5000) */
  checkInterval?: number;
  /** CPU usage threshold percentage (default: 80) */
  cpuThreshold?: number;
  /** Memory usage threshold percentage (default: 90) */
  memoryThreshold?: number;
  /** Disk usage threshold percentage (default: 85) */
  diskThreshold?: number;
  /** Maximum consecutive failures before unhealthy (default: 3) */
  maxConsecutiveFailures?: number;
  /** Health check timeout in milliseconds (default: 5000) */
  checkTimeout?: number;
  /** Enable automatic restart on unhealthy (default: false) */
  autoRestart?: boolean;
  /** Number of checks to keep in history (default: 100) */
  historySize?: number;
}

/**
 * CPU usage information
 */
export interface CPUUsage {
  /** CPU usage percentage (0-100) */
  percentage: number;
  /** Number of CPU cores */
  cores: number;
  /** Load average [1min, 5min, 15min] */
  loadAverage?: number[];
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  /** Total memory in bytes */
  total: number;
  /** Used memory in bytes */
  used: number;
  /** Free memory in bytes */
  free: number;
  /** Usage percentage (0-100) */
  percentage: number;
}

/**
 * Disk usage information
 */
export interface DiskUsage {
  /** Total disk space in bytes */
  total: number;
  /** Used disk space in bytes */
  used: number;
  /** Free disk space in bytes */
  free: number;
  /** Usage percentage (0-100) */
  percentage: number;
  /** Mount point */
  mountPoint: string;
}

/**
 * Executor health status
 */
export interface ExecutorHealth {
  /** Whether executor is responding */
  responsive: boolean;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Last successful ping timestamp */
  lastPing?: Date;
  /** Protocol version */
  protocolVersion?: string;
  /** Active request count */
  activeRequests?: number;
}

/**
 * Complete health status
 */
export interface HealthStatus {
  /** Overall health status */
  healthy: boolean;
  /** Timestamp of check */
  timestamp: Date;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** CPU usage information */
  cpu?: CPUUsage;
  /** Memory usage information */
  memory?: MemoryUsage;
  /** Disk usage information */
  disk?: DiskUsage;
  /** Executor health status */
  executor?: ExecutorHealth;
  /** Individual check results */
  checks: {
    cpu: boolean;
    memory: boolean;
    disk: boolean;
    executor: boolean;
  };
  /** Error messages for failed checks */
  errors: string[];
}

/**
 * Health check result
 */
interface HealthCheckResult {
  passed: boolean;
  status: Partial<HealthStatus>;
  errors: string[];
}

/**
 * Health monitor events
 */
export interface HealthMonitorEvents {
  "health:check": (status: HealthStatus) => void;
  "health:healthy": (status: HealthStatus) => void;
  "health:unhealthy": (status: HealthStatus) => void;
  "health:degraded": (status: HealthStatus) => void;
  "health:recovered": (status: HealthStatus) => void;
  "health:check:failed": (error: Error) => void;
  "health:threshold:cpu": (usage: number, threshold: number) => void;
  "health:threshold:memory": (usage: number, threshold: number) => void;
  "health:threshold:disk": (usage: number, threshold: number) => void;
  "health:executor:unresponsive": () => void;
}

/**
 * VM Health Monitor
 *
 * Monitors VM health through periodic checks of:
 * - CPU usage
 * - Memory usage
 * - Disk space
 * - Executor responsiveness
 *
 * Emits events when health status changes for UI updates.
 */
export class HealthMonitor extends EventEmitter {
  private options: Required<HealthMonitorOptions>;
  private checkIntervalId?: NodeJS.Timeout;
  private isRunning = false;
  private consecutiveFailures = 0;
  private lastStatus: HealthStatus | null = null;
  private healthHistory: HealthStatus[] = [];
  private protocolClient: ProtocolClient | null = null;
  private unhealthyCallbacks: Array<() => void> = [];
  private wasHealthy = true;

  constructor(options: HealthMonitorOptions = {}) {
    super();

    this.options = {
      checkInterval: options.checkInterval ?? 5000,
      cpuThreshold: options.cpuThreshold ?? 80,
      memoryThreshold: options.memoryThreshold ?? 90,
      diskThreshold: options.diskThreshold ?? 85,
      maxConsecutiveFailures: options.maxConsecutiveFailures ?? 3,
      checkTimeout: options.checkTimeout ?? 5000,
      autoRestart: options.autoRestart ?? false,
      historySize: options.historySize ?? 100,
    };
  }

  /**
   * Set the protocol client for executor health checks
   * @param client - Protocol client instance
   */
  setProtocolClient(client: ProtocolClient): void {
    this.protocolClient = client;
  }

  /**
   * Clear the protocol client
   */
  clearProtocolClient(): void {
    this.protocolClient = null;
  }

  /**
   * Start health monitoring
   * Begins periodic health checks
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.wasHealthy = true;

    // Run initial check
    this.runHealthCheck();

    // Schedule periodic checks
    this.checkIntervalId = setInterval(() => {
      this.runHealthCheck();
    }, this.options.checkInterval);

    this.emit("started");
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = undefined;
    }

    this.emit("stopped");
  }

  /**
   * Check if monitor is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the most recent health status
   */
  get currentStatus(): HealthStatus | null {
    return this.lastStatus;
  }

  /**
   * Get health check history
   */
  get history(): ReadonlyArray<HealthStatus> {
    return Object.freeze([...this.healthHistory]);
  }

  /**
   * Get average health over time period
   * @param durationMs - Time period in milliseconds
   */
  getAverageHealth(durationMs: number): {
    healthyPercentage: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
    checkCount: number;
  } {
    const cutoff = Date.now() - durationMs;
    const relevantChecks = this.healthHistory.filter(
      (h) => h.timestamp.getTime() >= cutoff
    );

    if (relevantChecks.length === 0) {
      return {
        healthyPercentage: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        checkCount: 0,
      };
    }

    const healthyCount = relevantChecks.filter((h) => h.healthy).length;
    const avgCpu =
      relevantChecks
        .filter((h) => h.cpu)
        .reduce((sum, h) => sum + (h.cpu?.percentage || 0), 0) /
      relevantChecks.filter((h) => h.cpu).length || 0;
    const avgMemory =
      relevantChecks
        .filter((h) => h.memory)
        .reduce((sum, h) => sum + (h.memory?.percentage || 0), 0) /
      relevantChecks.filter((h) => h.memory).length || 0;

    return {
      healthyPercentage: (healthyCount / relevantChecks.length) * 100,
      avgCpuUsage: avgCpu,
      avgMemoryUsage: avgMemory,
      checkCount: relevantChecks.length,
    };
  }

  /**
   * Register callback for unhealthy state
   * @param callback - Function to call when VM becomes unhealthy
   */
  onUnhealthy(callback: () => void): void {
    this.unhealthyCallbacks.push(callback);
  }

  /**
   * Remove unhealthy callback
   * @param callback - Callback to remove
   */
  offUnhealthy(callback: () => void): void {
    this.unhealthyCallbacks = this.unhealthyCallbacks.filter(
      (cb) => cb !== callback
    );
  }

  /**
   * Run a single health check
   */
  async runHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date();
    const errors: string[] = [];

    try {
      // Run all health checks in parallel
      const [cpuResult, memoryResult, diskResult, executorResult] =
        await Promise.all([
          this.checkCPU(),
          this.checkMemory(),
          this.checkDisk(),
          this.checkExecutor(),
        ]);

      // Collect errors
      if (!cpuResult.passed) errors.push(...cpuResult.errors);
      if (!memoryResult.passed) errors.push(...memoryResult.errors);
      if (!diskResult.passed) errors.push(...diskResult.errors);
      if (!executorResult.passed) errors.push(...executorResult.errors);

      // Determine overall health
      const checks = {
        cpu: cpuResult.passed,
        memory: memoryResult.passed,
        disk: diskResult.passed,
        executor: executorResult.passed,
      };

      const allPassed =
        checks.cpu && checks.memory && checks.disk && checks.executor;

      // Update consecutive failures
      if (allPassed) {
        if (this.consecutiveFailures > 0) {
          this.consecutiveFailures = 0;
        }
      } else {
        this.consecutiveFailures++;
      }

      // Determine if healthy based on consecutive failures
      const isHealthy =
        allPassed || this.consecutiveFailures < this.options.maxConsecutiveFailures;

      const status: HealthStatus = {
        healthy: isHealthy,
        timestamp,
        consecutiveFailures: this.consecutiveFailures,
        cpu: cpuResult.status.cpu,
        memory: memoryResult.status.memory,
        disk: diskResult.status.disk,
        executor: executorResult.status.executor,
        checks,
        errors,
      };

      // Update history
      this.updateHistory(status);
      this.lastStatus = status;

      // Emit events
      this.emit("health:check", status);

      if (isHealthy && !this.wasHealthy) {
        this.emit("health:recovered", status);
      } else if (!isHealthy && this.wasHealthy) {
        this.emit("health:unhealthy", status);
        this.unhealthyCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            // Ignore callback errors
          }
        });
      } else if (!allPassed && isHealthy) {
        this.emit("health:degraded", status);
      }

      if (isHealthy) {
        this.emit("health:healthy", status);
      }

      this.wasHealthy = isHealthy;

      return status;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.emit("health:check:failed", error);

      const status: HealthStatus = {
        healthy: false,
        timestamp,
        consecutiveFailures: ++this.consecutiveFailures,
        checks: {
          cpu: false,
          memory: false,
          disk: false,
          executor: false,
        },
        errors: [errorMessage],
      };

      this.updateHistory(status);
      this.lastStatus = status;

      return status;
    }
  }

  /**
   * Check CPU usage
   */
  private async checkCPU(): Promise<HealthCheckResult> {
    try {
      // Query CPU stats via protocol if available
      let percentage = 0;
      let cores = 1;
      let loadAverage: number[] | undefined;

      if (this.protocolClient) {
        try {
          const result = await this.protocolClient.execute({
            command: "cat /proc/stat && cat /proc/loadavg",
            timeout: this.options.checkTimeout,
          });

          if (result.exitCode === 0) {
            const lines = result.stdout.split("\n");
            const cpuLine = lines.find((l) => l.startsWith("cpu "));
            if (cpuLine) {
              const values = cpuLine
                .split(/\s+/)
                .slice(1)
                .map((v) => parseInt(v, 10));
              const idle = values[3] || 0;
              const total = values.reduce((a, b) => a + b, 0);
              percentage = total > 0 ? ((total - idle) / total) * 100 : 0;
            }

            const loadLine = lines.find((l) => l.includes("load average"));
            if (loadLine) {
              const match = loadLine.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
              if (match) {
                loadAverage = [
                  parseFloat(match[1]),
                  parseFloat(match[2]),
                  parseFloat(match[3]),
                ];
              }
            }
          }
        } catch {
          // Fall back to estimation
          percentage = 50; // Unknown, assume moderate
        }
      }

      const cpuUsage: CPUUsage = {
        percentage,
        cores,
        loadAverage,
      };

      const passed = percentage < this.options.cpuThreshold;

      if (!passed) {
        this.emit("health:threshold:cpu", percentage, this.options.cpuThreshold);
      }

      return {
        passed,
        status: { cpu: cpuUsage },
        errors: passed
          ? []
          : [`CPU usage ${percentage.toFixed(1)}% exceeds threshold ${this.options.cpuThreshold}%`],
      };
    } catch (error) {
      return {
        passed: false,
        status: {},
        errors: [
          `CPU check failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheckResult> {
    try {
      let total = 0;
      let used = 0;
      let percentage = 0;

      if (this.protocolClient) {
        try {
          const result = await this.protocolClient.execute({
            command: "free -b | grep Mem",
            timeout: this.options.checkTimeout,
          });

          if (result.exitCode === 0) {
            const parts = result.stdout.trim().split(/\s+/);
            total = parseInt(parts[1], 10) || 0;
            used = parseInt(parts[2], 10) || 0;
            percentage = total > 0 ? (used / total) * 100 : 0;
          }
        } catch {
          // Fallback
          percentage = 50;
        }
      }

      const memoryUsage: MemoryUsage = {
        total,
        used,
        free: total - used,
        percentage,
      };

      const passed = percentage < this.options.memoryThreshold;

      if (!passed) {
        this.emit("health:threshold:memory", percentage, this.options.memoryThreshold);
      }

      return {
        passed,
        status: { memory: memoryUsage },
        errors: passed
          ? []
          : [`Memory usage ${percentage.toFixed(1)}% exceeds threshold ${this.options.memoryThreshold}%`],
      };
    } catch (error) {
      return {
        passed: false,
        status: {},
        errors: [
          `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Check disk usage
   */
  private async checkDisk(): Promise<HealthCheckResult> {
    try {
      let total = 0;
      let used = 0;
      let percentage = 0;
      let mountPoint = "/";

      if (this.protocolClient) {
        try {
          const result = await this.protocolClient.execute({
            command: "df -B1 / | tail -1",
            timeout: this.options.checkTimeout,
          });

          if (result.exitCode === 0) {
            const parts = result.stdout.trim().split(/\s+/);
            total = parseInt(parts[1], 10) || 0;
            used = parseInt(parts[2], 10) || 0;
            percentage = total > 0 ? (used / total) * 100 : 0;
            mountPoint = parts[5] || "/";
          }
        } catch {
          percentage = 50;
        }
      }

      const diskUsage: DiskUsage = {
        total,
        used,
        free: total - used,
        percentage,
        mountPoint,
      };

      const passed = percentage < this.options.diskThreshold;

      if (!passed) {
        this.emit("health:threshold:disk", percentage, this.options.diskThreshold);
      }

      return {
        passed,
        status: { disk: diskUsage },
        errors: passed
          ? []
          : [`Disk usage ${percentage.toFixed(1)}% exceeds threshold ${this.options.diskThreshold}%`],
      };
    } catch (error) {
      return {
        passed: false,
        status: {},
        errors: [
          `Disk check failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Check executor responsiveness
   */
  private async checkExecutor(): Promise<HealthCheckResult> {
    if (!this.protocolClient) {
      return {
        passed: true,
        status: {
          executor: {
            responsive: true,
            responseTimeMs: 0,
          },
        },
        errors: [],
      };
    }

    const startTime = Date.now();

    try {
      // Send a simple ping command
      const result = await this.protocolClient.execute({
        command: "echo 'ping'",
        timeout: this.options.checkTimeout,
      });

      const responseTimeMs = Date.now() - startTime;
      const responsive = result.exitCode === 0;

      const executorHealth: ExecutorHealth = {
        responsive,
        responseTimeMs,
        lastPing: new Date(),
      };

      if (!responsive) {
        this.emit("health:executor:unresponsive");
      }

      return {
        passed: responsive,
        status: { executor: executorHealth },
        errors: responsive ? [] : ["Executor unresponsive"],
      };
    } catch (error) {
      this.emit("health:executor:unresponsive");

      return {
        passed: false,
        status: {
          executor: {
            responsive: false,
            responseTimeMs: Date.now() - startTime,
          },
        },
        errors: [
          `Executor check failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Update health history
   * @param status - New health status
   */
  private updateHistory(status: HealthStatus): void {
    this.healthHistory.push(status);

    // Limit history size
    while (this.healthHistory.length > this.options.historySize) {
      this.healthHistory.shift();
    }
  }

  /**
   * Force an immediate health check
   * @returns Current health status
   */
  async checkHealth(): Promise<HealthStatus> {
    return this.runHealthCheck();
  }

  /**
   * Get health statistics
   */
  getStats(): {
    totalChecks: number;
    healthyChecks: number;
    unhealthyChecks: number;
    uptime: number;
    averageResponseTime: number;
  } {
    const totalChecks = this.healthHistory.length;
    const healthyChecks = this.healthHistory.filter((h) => h.healthy).length;
    const unhealthyChecks = totalChecks - healthyChecks;

    const now = Date.now();
    const firstCheck = this.healthHistory[0]?.timestamp.getTime() || now;
    const uptime = now - firstCheck;

    const avgResponseTime =
      this.healthHistory
        .filter((h) => h.executor)
        .reduce((sum, h) => sum + (h.executor?.responseTimeMs || 0), 0) /
        this.healthHistory.filter((h) => h.executor).length || 0;

    return {
      totalChecks,
      healthyChecks,
      unhealthyChecks,
      uptime,
      averageResponseTime: avgResponseTime,
    };
  }

  /**
   * Dispose of the monitor
   * Stops monitoring and clears resources
   */
  dispose(): void {
    this.stop();
    this.unhealthyCallbacks = [];
    this.healthHistory = [];
    this.lastStatus = null;
    this.protocolClient = null;
    this.removeAllListeners();
  }
}

/**
 * Create a new health monitor
 * @param options - Health monitor options
 * @returns New HealthMonitor instance
 */
export function createHealthMonitor(
  options?: HealthMonitorOptions
): HealthMonitor {
  return new HealthMonitor(options);
}

export default HealthMonitor;
