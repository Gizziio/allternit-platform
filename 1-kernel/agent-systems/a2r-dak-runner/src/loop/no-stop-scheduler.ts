/**
 * Ralph Loop No-Stop Scheduling
 *
 * Implements SYSTEM_LAW.md LAW-AUT-001 (No-Stop Execution Rule)
 * 
 * Requirements:
 * - If DAG has READY work and budget/policy allows, MUST pickup and execute next WIH
 * - Deterministic READY ordering (priority, then nodeId lexical)
 * - Continuous execution while budget allows
 * - Never idle while READY nodes exist (unless blocked by explicit gate)
 */

import { EventEmitter } from 'events';
import { RailsHttpAdapter } from '../adapters/rails_http';
import { RalphLoop, NodeExecutionRequest, RalphLoopResult } from './ralph';
import { ContextPackBuilder } from '../context/builder';
import {
  DagId,
  NodeId,
  WihId,
  RunId,
  ExecutionMode,
  WorkRequest,
} from '../types';

export interface SchedulerConfig {
  maxConcurrentNodes: number;
  budgetCheckIntervalMs: number;
  maxBudgetPercentage: number;
}

export interface ReadyNode {
  dagId: DagId;
  nodeId: NodeId;
  wihId: WihId;
  priority: number;
  executionMode: ExecutionMode;
  readyAt: string;
}

export interface SchedulerStats {
  nodesExecuted: number;
  nodesPending: number;
  nodesBlocked: number;
  budgetUsedPercentage: number;
  avgExecutionTimeMs: number;
}

export class RalphNoStopScheduler extends EventEmitter {
  private rails: RailsHttpAdapter;
  private ralphLoop: RalphLoop;
  private contextPackBuilder: ContextPackBuilder;
  private config: SchedulerConfig;
  private readyQueue: ReadyNode[];
  private executingNodes: Set<string>;
  private blockedNodes: Map<string, string>;
  private stats: SchedulerStats;
  private running: boolean;
  private budgetCheckTimer?: NodeJS.Timeout;

  constructor(
    rails: RailsHttpAdapter,
    ralphLoop: RalphLoop,
    contextPackBuilder: ContextPackBuilder,
    config: SchedulerConfig = {
      maxConcurrentNodes: 3,
      budgetCheckIntervalMs: 5000,
      maxBudgetPercentage: 90,
    }
  ) {
    super();
    this.rails = rails;
    this.ralphLoop = ralphLoop;
    this.contextPackBuilder = contextPackBuilder;
    this.config = config;
    this.readyQueue = [];
    this.executingNodes = new Set();
    this.blockedNodes = new Map();
    this.running = false;
    this.stats = {
      nodesExecuted: 0,
      nodesPending: 0,
      nodesBlocked: 0,
      budgetUsedPercentage: 0,
      avgExecutionTimeMs: 0,
    };
  }

  /**
   * Start the no-stop scheduler
   * 
   * LAW-AUT-001: If DAG has READY work and budget/policy allows,
   * the runner must pickup and execute the next WIH.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.emit('scheduler:started');

    // Start budget monitoring
    this.startBudgetMonitoring();

    // Initial work discovery
    await this.discoverWork();

    // Start execution loop
    this.executionLoop();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;

    if (this.budgetCheckTimer) {
      clearInterval(this.budgetCheckTimer);
    }

    this.emit('scheduler:stopped');
  }

  /**
   * Discover available work from Rails
   */
  async discoverWork(): Promise<void> {
    try {
      const workRequests = await this.rails.discoverWork({
        ready: true,
      });

      // Convert to ready nodes
      for (const work of workRequests) {
        const readyNode: ReadyNode = {
          dagId: work.dagId,
          nodeId: work.nodeId,
          wihId: work.wihId,
          priority: work.priority || 0,
          executionMode: work.executionMode,
          readyAt: new Date().toISOString(),
        };

        // Add to queue if not already executing or blocked
        const nodeKey = `${work.dagId}:${work.nodeId}`;
        if (!this.executingNodes.has(nodeKey) && !this.blockedNodes.has(nodeKey)) {
          this.readyQueue.push(readyNode);
        }
      }

      // Sort queue deterministically (priority desc, then nodeId lexical)
      this.sortReadyQueue();

      this.stats.nodesPending = this.readyQueue.length;
      this.emit('work:discovered', { count: workRequests.length });
    } catch (error) {
      this.emit('work:discovery_error', { error });
    }
  }

  /**
   * Sort ready queue deterministically
   * 
   * LAW-AUT-001: Deterministic READY ordering (priority, then nodeId lexical)
   */
  private sortReadyQueue(): void {
    this.readyQueue.sort((a, b) => {
      // First by priority (descending)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by nodeId (lexical ascending)
      return a.nodeId.localeCompare(b.nodeId);
    });
  }

  /**
   * Main execution loop - NEVER stops while READY nodes exist
   */
  private async executionLoop(): Promise<void> {
    while (this.running) {
      // Check if we have capacity
      if (this.executingNodes.size >= this.config.maxConcurrentNodes) {
        await this.sleep(100);
        continue;
      }

      // Check budget
      if (!this.budgetAllows()) {
        this.emit('scheduler:paused', { reason: 'Budget exceeded' });
        await this.sleep(1000);
        continue;
      }

      // Get next ready node
      const nextNode = this.readyQueue.shift();
      if (!nextNode) {
        // No ready nodes - discover more work
        await this.discoverWork();
        
        // If still no work, wait a bit
        if (this.readyQueue.length === 0) {
          await this.sleep(500);
          continue;
        }
        
        continue;
      }

      // Execute the node
      this.executeNode(nextNode);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: ReadyNode): Promise<void> {
    const nodeKey = `${node.dagId}:${node.nodeId}`;
    this.executingNodes.add(nodeKey);

    this.emit('node:started', node);

    const startTime = Date.now();

    try {
      // Build ContextPack (LAW-AUT-002: Deterministic Rehydration)
      const contextPack = await this.contextPackBuilder.buildAndSeal({
        dagId: node.dagId,
        nodeId: node.nodeId,
        wihId: node.wihId,
      });

      // Create execution request
      const request: NodeExecutionRequest = {
        dagId: node.dagId,
        nodeId: node.nodeId,
        wihId: node.wihId,
        runId: `run_${Date.now()}`,
        baseContextPack: contextPack,
        basePolicyBundle: {
          role: 'builder',
          executionMode: node.executionMode,
        },
        planFiles: {
          planPath: `.a2r/work/dags/${node.dagId}/plan.md`,
          todoPath: `.a2r/work/dags/${node.dagId}/todo.md`,
          progressPath: `.a2r/work/dags/${node.dagId}/progress.md`,
          findingsPath: `.a2r/work/dags/${node.dagId}/findings.md`,
        },
      };

      // Execute through Ralph Loop
      const result = await this.ralphLoop.executeNode(request);

      // Update stats
      const executionTime = Date.now() - startTime;
      this.updateStats(result, executionTime);

      // Handle result
      if (result.success) {
        this.emit('node:completed', { ...node, result });
      } else {
        if (result.finalStatus === 'BLOCKED') {
          // Node is blocked - don't requeue
          this.blockedNodes.set(nodeKey, result.escalationReason || 'Unknown');
          this.stats.nodesBlocked++;
          this.emit('node:blocked', { ...node, result });
        } else {
          // Failed but not blocked - may retry later
          this.emit('node:failed', { ...node, result });
        }
      }
    } catch (error) {
      this.emit('node:error', { ...node, error });
    } finally {
      this.executingNodes.delete(nodeKey);
      this.stats.nodesPending = this.readyQueue.length;
    }
  }

  /**
   * Check if budget allows execution
   */
  private budgetAllows(): boolean {
    // In real implementation, this would check actual budget
    // For now, just check if we're under the configured max
    return this.stats.budgetUsedPercentage < this.config.maxBudgetPercentage;
  }

  /**
   * Start budget monitoring
   */
  private startBudgetMonitoring(): void {
    this.budgetCheckTimer = setInterval(() => {
      // In real implementation, this would query actual budget usage
      // For now, simulate gradual budget consumption
      this.stats.budgetUsedPercentage = Math.min(
        this.stats.budgetUsedPercentage + 1,
        100
      );

      this.emit('budget:updated', {
        usedPercentage: this.stats.budgetUsedPercentage,
        maxPercentage: this.config.maxBudgetPercentage,
      });
    }, this.config.budgetCheckIntervalMs);
  }

  /**
   * Update execution stats
   */
  private updateStats(result: RalphLoopResult, executionTimeMs: number): void {
    this.stats.nodesExecuted++;
    
    // Update average execution time
    const totalNodes = this.stats.nodesExecuted;
    const oldAvg = this.stats.avgExecutionTimeMs;
    this.stats.avgExecutionTimeMs = ((oldAvg * (totalNodes - 1)) + executionTimeMs) / totalNodes;
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Get ready queue length
   */
  getReadyQueueLength(): number {
    return this.readyQueue.length;
  }

  /**
   * Get executing nodes count
   */
  getExecutingCount(): number {
    return this.executingNodes.size;
  }

  /**
   * Get blocked nodes count
   */
  getBlockedCount(): number {
    return this.blockedNodes.size;
  }

  /**
   * Check if scheduler has work to do
   * 
   * LAW-AUT-001: No idling while READY nodes exist
   */
  hasWork(): boolean {
    return this.readyQueue.length > 0 || this.executingNodes.size > 0;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export function createRalphNoStopScheduler(
  rails: RailsHttpAdapter,
  ralphLoop: RalphLoop,
  contextPackBuilder: ContextPackBuilder,
  config?: SchedulerConfig
): RalphNoStopScheduler {
  return new RalphNoStopScheduler(rails, ralphLoop, contextPackBuilder, config);
}
