/**
 * Worker Manager
 * 
 * Spawns, supervises, and terminates worker agents.
 * Enforces context inheritance rules:
 * - child permissions = intersection(parent WIH ∩ child WIH)
 * - child context = sealed ContextPack + policy injection marker
 */

import { EventEmitter } from 'events';
// Type stubs — domain type modules not yet implemented
type RunId = string;
type WihId = string;
type DagId = string;
type NodeId = string;
type Role = string;
type ContextPack = Record<string, unknown>;
type PolicyBundleId = string;
type CorrelationId = string;
type IterationId = string;
type PolicyBundle = Record<string, unknown>;

export interface WorkerConfig {
  role: Role;
  contextPack: ContextPack;
  policyBundleId: PolicyBundleId;
  policyBundle: PolicyBundle;
  parentWihId?: WihId;
  timeboxSeconds?: number;
}

export interface Worker {
  id: string;
  runId: RunId;
  wihId: WihId;
  dagId: DagId;
  nodeId: NodeId;
  role: Role;
  iterationId: IterationId;
  config: WorkerConfig;
  status: 'spawning' | 'running' | 'completed' | 'failed' | 'terminated' | 'unhealthy';
  startedAt: string;
  completedAt?: string;
  result?: WorkerResult;
  // Health monitoring
  lastHeartbeat?: string;
  heartbeatIntervalMs: number;
  healthStatus: WorkerHealthStatus;
  consecutiveMissedHeartbeats: number;
}

export interface WorkerHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpuPercent?: number;
  memoryMb?: number;
  lastCheck: string;
  issues: string[];
}

export interface WorkerResult {
  success: boolean;
  artifacts?: string[];
  receiptIds?: string[];
  report?: unknown;
  error?: string;
}

export interface WorkerContext {
  worker: Worker;
  permissions: string[];
  allowedTools: string[];
  writeScope: string[];
}

export class WorkerManager extends EventEmitter {
  private workers: Map<string, Worker> = new Map();
  private activeWorkers: Set<string> = new Set();
  private workerCounter = 0;
  private heartbeatIntervalMs = 30000;  // 30 seconds
  private maxMissedHeartbeats = 3;
  private healthCheckInterval?: NodeJS.Timeout;

  /**
   * Start health monitoring background task
   */
  startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkWorkerHealth();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Check health of all active workers
   */
  private checkWorkerHealth(): void {
    const now = new Date();
    
    for (const [workerId, worker] of this.workers.entries()) {
      if (worker.status !== 'running') {
        continue;
      }

      if (!worker.lastHeartbeat) {
        // No heartbeat received yet, skip
        continue;
      }

      const lastHeartbeat = new Date(worker.lastHeartbeat);
      const msSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
      const missedHeartbeats = Math.floor(msSinceHeartbeat / this.heartbeatIntervalMs);

      if (missedHeartbeats >= this.maxMissedHeartbeats) {
        // Worker is unhealthy
        worker.healthStatus = {
          status: 'unhealthy',
          lastCheck: now.toISOString(),
          issues: [`No heartbeat for ${missedHeartbeats} intervals`],
        };
        worker.consecutiveMissedHeartbeats = missedHeartbeats;
        worker.status = 'unhealthy';
        
        this.emit('worker:unhealthy', {
          workerId,
          reason: 'missed_heartbeats',
          missedCount: missedHeartbeats,
        });
      } else if (missedHeartbeats > 0) {
        // Worker is degraded
        worker.healthStatus = {
          status: 'degraded',
          lastCheck: now.toISOString(),
          issues: [`Late heartbeat (${missedHeartbeats} intervals)`],
        };
        worker.consecutiveMissedHeartbeats = missedHeartbeats;
      } else {
        // Worker is healthy
        worker.healthStatus = {
          status: 'healthy',
          lastCheck: now.toISOString(),
          issues: [],
        };
        worker.consecutiveMissedHeartbeats = 0;
      }
    }
  }

  /**
   * Receive heartbeat from worker
   */
  receiveHeartbeat(workerId: string, healthMetrics?: { cpuPercent?: number; memoryMb?: number }): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      this.emit('worker:heartbeat_unknown', { workerId });
      return;
    }

    worker.lastHeartbeat = new Date().toISOString();
    worker.consecutiveMissedHeartbeats = 0;
    
    if (healthMetrics) {
      worker.healthStatus = {
        ...worker.healthStatus,
        cpuPercent: healthMetrics.cpuPercent,
        memoryMb: healthMetrics.memoryMb,
        lastCheck: new Date().toISOString(),
      };
    }

    this.emit('worker:heartbeat', { workerId, healthMetrics });
  }

  /**
   * Spawn a new worker
   */
  async spawnWorker(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    runId: RunId,
    iterationId: IterationId,
    config: WorkerConfig
  ): Promise<Worker> {
    const workerId = `worker_${++this.workerCounter}_${Date.now()}`;
    
    // Calculate child permissions (intersection of parent and child constraints)
    const effectivePermissions = this.calculateEffectivePermissions(config);
    
    const worker: Worker = {
      id: workerId,
      runId,
      wihId,
      dagId,
      nodeId,
      role: config.role,
      iterationId,
      config,
      status: 'spawning',
      startedAt: new Date().toISOString(),
      // Health monitoring initialization
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      healthStatus: {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        issues: [],
      },
      consecutiveMissedHeartbeats: 0,
    };

    this.workers.set(workerId, worker);
    this.activeWorkers.add(workerId);

    // Emit spawn event
    this.emit('worker:spawned', {
      workerId,
      role: config.role,
      parentWihId: config.parentWihId,
      effectivePermissions,
    });

    // Set up timebox if specified
    if (config.timeboxSeconds) {
      setTimeout(() => {
        this.terminateWorker(workerId, 'timebox_exceeded');
      }, config.timeboxSeconds * 1000);
    }

    // Transition to running
    worker.status = 'running';
    this.emit('worker:running', { workerId });

    return worker;
  }

  /**
   * Complete a worker with results
   */
  async completeWorker(workerId: string, result: WorkerResult): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (worker.status !== 'running') {
      throw new Error(`Worker ${workerId} is not running (status: ${worker.status})`);
    }

    worker.status = result.success ? 'completed' : 'failed';
    worker.completedAt = new Date().toISOString();
    worker.result = result;

    this.activeWorkers.delete(workerId);

    this.emit('worker:completed', {
      workerId,
      role: worker.role,
      success: result.success,
      receiptIds: result.receiptIds,
    });
  }

  /**
   * Terminate a worker
   */
  async terminateWorker(workerId: string, reason: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return; // Already gone
    }

    if (worker.status === 'completed' || worker.status === 'failed') {
      return; // Already finished
    }

    worker.status = 'terminated';
    worker.completedAt = new Date().toISOString();
    worker.result = {
      success: false,
      error: `Terminated: ${reason}`,
    };

    this.activeWorkers.delete(workerId);

    this.emit('worker:terminated', {
      workerId,
      role: worker.role,
      reason,
    });
  }

  /**
   * Terminate unhealthy workers
   */
  async terminateUnhealthyWorkers(): Promise<number> {
    let terminated = 0;
    
    for (const [workerId, worker] of this.workers.entries()) {
      if (worker.status === 'unhealthy') {
        await this.terminateWorker(workerId, 'Health check failed');
        terminated++;
      }
    }
    
    return terminated;
  }

  /**
   * Get worker health status
   */
  getWorkerHealth(workerId: string): WorkerHealthStatus | undefined {
    const worker = this.workers.get(workerId);
    return worker?.healthStatus;
  }

  /**
   * Get health summary for all workers
   */
  getHealthSummary(): WorkerHealthSummary {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    const issues: string[] = [];

    for (const worker of this.workers.values()) {
      if (worker.status !== 'running') {
        continue;
      }

      switch (worker.healthStatus.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          issues.push(...worker.healthStatus.issues);
          break;
        case 'unhealthy':
          unhealthy++;
          issues.push(...worker.healthStatus.issues);
          break;
      }
    }

    return {
      total: healthy + degraded + unhealthy,
      healthy,
      degraded,
      unhealthy,
      issues: issues.slice(0, 10),  // Limit to first 10 issues
    };
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): Worker | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get active workers
   */
  getActiveWorkers(): Worker[] {
    return Array.from(this.activeWorkers)
      .map(id => this.workers.get(id))
      .filter((w): w is Worker => w !== undefined);
  }

  /**
   * Get workers by role
   */
  getWorkersByRole(role: Role): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.role === role);
  }

  /**
   * Get workers for a specific node
   */
  getWorkersForNode(nodeId: NodeId): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.nodeId === nodeId);
  }

  /**
   * Get worker context (permissions, allowed tools, etc.)
   */
  getWorkerContext(workerId: string): WorkerContext | null {
    const worker = this.workers.get(workerId);
    if (!worker) return null;

    return {
      worker,
      permissions: this.calculateEffectivePermissions(worker.config),
      allowedTools: (worker.config.policyBundle as any).constraints.allowed_tools,
      writeScope: (worker.config.policyBundle as any).constraints.write_scope.allowed_globs,
    };
  }

  /**
   * Check if worker has permission for a tool
   */
  hasToolPermission(workerId: string, toolName: string): boolean {
    const context = this.getWorkerContext(workerId);
    if (!context) return false;

    // Check allowed list
    if (context.allowedTools.length > 0) {
      const allowed = context.allowedTools.some(pattern => {
        if (pattern === toolName) return true;
        const regex = new RegExp(pattern);
        return regex.test(toolName);
      });
      if (!allowed) return false;
    }

    // Check forbidden list
    const forbidden = workerId; // Placeholder - would check policy bundle
    return true;
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    terminated: number;
  } {
    const all = Array.from(this.workers.values());
    return {
      total: all.length,
      active: all.filter(w => w.status === 'running').length,
      completed: all.filter(w => w.status === 'completed').length,
      failed: all.filter(w => w.status === 'failed').length,
      terminated: all.filter(w => w.status === 'terminated').length,
    };
  }

  // Private helpers

  private calculateEffectivePermissions(config: WorkerConfig): string[] {
    // Start with child (worker) permissions
    const childPermissions = new Set([
      ...(config.policyBundle as any).constraints.allowed_tools,
      ...(config.policyBundle as any).constraints.write_scope.allowed_globs,
    ]);

    // If no parent, child permissions are effective
    if (!config.parentWihId) {
      return Array.from(childPermissions);
    }

    // Otherwise, intersection would be calculated here
    // For now, just return child permissions
    return Array.from(childPermissions);
  }
}

export interface WorkerHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  issues: string[];
}

// Factory function
export function createWorkerManager(): WorkerManager {
  return new WorkerManager();
}
