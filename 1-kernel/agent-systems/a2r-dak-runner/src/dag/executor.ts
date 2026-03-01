/**
 * DAG Executor
 * 
 * Executes DAG nodes in topological order with gate evaluation.
 * Integrates with Ralph loop for bounded fix cycles.
 */

import { EventEmitter } from 'events';
import {
  DagDefinition,
  DagNode,
  NodeStatus,
  GateEvaluation,
  NodeExecutionResult,
  DagExecutionContext,
  OnFailAction,
} from './types';
import { DagParser } from './parser';
import { WIHParser } from '../wih/parser';
import { RalphLoop } from '../loop/ralph';
import { WorkerManager } from '../workers/manager';
import { ObservabilityLogger } from '../observability/events';
import { RailsAdapter } from '../adapters/rails_api';
import { LeaseManager } from '../lease/manager';

export interface DagExecutorConfig {
  dag: DagDefinition;
  runId: string;
  parser: DagParser;
  wihParser: WIHParser;
  ralphLoop: RalphLoop;
  workerManager: WorkerManager;
  observability: ObservabilityLogger;
  railsAdapter: RailsAdapter;
  leaseManager?: LeaseManager;
  maxParallelNodes?: number;
  autoManageLeases?: boolean;
}

export interface DagExecutionResult {
  success: boolean;
  dag_id: string;
  run_id: string;
  completed_nodes: string[];
  failed_nodes: string[];
  blocked_nodes: string[];
  node_results: Map<string, NodeExecutionResult>;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export class DagExecutor extends EventEmitter {
  private config: DagExecutorConfig;
  private context: DagExecutionContext;
  private nodeResults: Map<string, NodeExecutionResult> = new Map();
  private isRunning = false;

  constructor(config: DagExecutorConfig) {
    super();
    this.config = config;
    this.context = {
      dag_id: config.dag.dag_id,
      run_id: config.runId,
      started_at: new Date().toISOString(),
      completed_nodes: [],
      failed_nodes: [],
      blocked_nodes: [],
    };
  }

  /**
   * Execute the complete DAG
   */
  async execute(): Promise<DagExecutionResult> {
    if (this.isRunning) {
      throw new Error('DAG execution already in progress');
    }

    this.isRunning = true;
    this.emit('dag:started', { dag_id: this.context.dag_id, run_id: this.context.run_id });

    try {
      // Get topological order
      const sortedNodes = this.config.parser.topologicalSort(this.config.dag);
      
      // Execute nodes in order (respecting dependencies)
      for (const node of sortedNodes) {
        if (!this.isRunning) {
          throw new Error('DAG execution cancelled');
        }

        // Check if we should skip (already done or blocked)
        if (this.shouldSkipNode(node)) {
          continue;
        }

        // Wait for dependencies
        await this.waitForDependencies(node);

        // Execute node
        const result = await this.executeNode(node);
        this.nodeResults.set(node.id, result);

        // Update context
        if (result.status === 'done') {
          this.context.completed_nodes.push(node.id);
        } else if (result.status === 'failed') {
          this.context.failed_nodes.push(node.id);
        } else if (result.status === 'blocked') {
          this.context.blocked_nodes.push(node.id);
        }

        // Emit event
        this.emit('node:completed', { node_id: node.id, status: result.status });

        // Check if we should stop
        if (result.status === 'failed' && this.shouldFailFast()) {
          break;
        }
      }

      // Build final result
      const result = this.buildResult();
      this.emit('dag:completed', result);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const result = this.buildResult(errorMsg);
      this.emit('dag:failed', result);
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.isRunning = false;
    this.emit('dag:stopped', { dag_id: this.context.dag_id });
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: DagNode): Promise<NodeExecutionResult> {
    const started_at = new Date().toISOString();
    
    this.emit('node:started', { node_id: node.id });

    // Parse WIH
    let wih;
    try {
      wih = this.config.wihParser.parseFile(node.wih);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        node_id: node.id,
        status: 'failed',
        gates: [],
        iteration_count: 0,
        receipts: [],
        artifacts: [],
        error: `Failed to parse WIH: ${errorMsg}`,
        started_at,
        completed_at: new Date().toISOString(),
      };
    }

    // Acquire lease for this node
    try {
      await this.acquireNodeLease(node, wih);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        node_id: node.id,
        status: 'failed',
        gates: [],
        iteration_count: 0,
        receipts: [],
        artifacts: [],
        error: errorMsg,
        started_at,
        completed_at: new Date().toISOString(),
      };
    }

    // Evaluate gates
    const gates = await this.evaluateGates(node);
    const failedGates = gates.filter(g => g.status === 'fail');

    if (failedGates.length > 0) {
      return {
        node_id: node.id,
        status: 'blocked',
        gates,
        iteration_count: 0,
        receipts: [],
        artifacts: [],
        error: `Gates failed: ${failedGates.map(g => g.gate).join(', ')}`,
        started_at,
        completed_at: new Date().toISOString(),
      };
    }

    // Execute via Ralph loop
    const onFail: OnFailAction = node.loop?.on_fail || 'ralph';
    const maxIterations = node.loop?.max_iterations || 
                          this.config.dag.defaults.max_iterations || 
                          3;

    try {
      // Use Ralph loop for execution
      const ralphResult = await this.config.ralphLoop.executeNode({
        dagId: this.context.dag_id,
        nodeId: node.id,
        wihId: wih.work_item_id,
        runId: this.context.run_id,
        baseContextPack: null as any, // Would be built from WIH
        basePolicyBundle: null as any, // Would be built from WIH
        planFiles: {
          planPath: '',
          todoPath: '',
          progressPath: '',
          findingsPath: '',
        },
      });

      const status: NodeStatus = ralphResult.success ? 'done' : 
                                 ralphResult.finalStatus === 'BLOCKED' ? 'blocked' : 'failed';

      return {
        node_id: node.id,
        status,
        gates,
        iteration_count: ralphResult.iterations,
        receipts: [...ralphResult.builderReceipts, ralphResult.validatorReceipt].filter(Boolean) as string[],
        artifacts: [],
        error: ralphResult.escalationReason,
        started_at,
        completed_at: new Date().toISOString(),
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Release lease on error
      await this.releaseNodeLease(node);
      
      return {
        node_id: node.id,
        status: 'failed',
        gates,
        iteration_count: 0,
        receipts: [],
        artifacts: [],
        error: errorMsg,
        started_at,
        completed_at: new Date().toISOString(),
      };
    } finally {
      // Always release lease
      await this.releaseNodeLease(node);
    }
  }

  /**
   * Evaluate gates for a node
   */
  private async evaluateGates(node: DagNode): Promise<GateEvaluation[]> {
    const gates = node.gates || this.config.dag.defaults.gates || ['validator_pass'];
    const evaluations: GateEvaluation[] = [];

    for (const gate of gates) {
      // Check if we have evidence for this gate
      const result = await this.checkGateEvidence(node.id, gate);
      evaluations.push(result);
    }

    return evaluations;
  }

  /**
   * Check gate evidence (placeholder - would query Rails/receipts)
   */
  private async checkGateEvidence(nodeId: string, gate: string): Promise<GateEvaluation> {
    // In a real implementation, this would:
    // 1. Query Rails for validator receipts
    // 2. Check test results
    // 3. Verify policy compliance
    
    // For now, assume validator_pass is pending
    if (gate === 'validator_pass') {
      return {
        gate: gate as any,
        status: 'pending',
        reason: 'Waiting for validator execution',
      };
    }

    return {
      gate: gate as any,
      status: 'pass',
    };
  }

  /**
   * Check if node should be skipped
   */
  private shouldSkipNode(node: DagNode): boolean {
    // Skip if already done
    if (this.context.completed_nodes.includes(node.id)) {
      return true;
    }

    // Skip if failed
    if (this.context.failed_nodes.includes(node.id)) {
      return true;
    }

    // Skip if blocked
    if (this.context.blocked_nodes.includes(node.id)) {
      return true;
    }

    return false;
  }

  /**
   * Wait for all dependencies to complete
   */
  private async waitForDependencies(node: DagNode): Promise<void> {
    const deps = node.depends_on || [];
    
    // Check if any dependency failed
    for (const depId of deps) {
      if (this.context.failed_nodes.includes(depId)) {
        throw new Error(`Dependency ${depId} of node ${node.id} failed`);
      }
    }

    // Wait for all dependencies to complete (simple polling)
    const maxWait = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const allComplete = deps.every(depId => 
        this.context.completed_nodes.includes(depId)
      );

      if (allComplete) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for dependencies of node ${node.id}`);
  }

  /**
   * Check if we should fail fast on node failure
   */
  private shouldFailFast(): boolean {
    // For now, always fail fast
    // Could be configurable per DAG
    return true;
  }

  /**
   * Acquire lease for node execution
   */
  private async acquireNodeLease(node: DagNode, wih: { work_item_id: string }): Promise<void> {
    if (!this.config.leaseManager || !this.config.autoManageLeases) {
      return;
    }

    try {
      // Claim work via Rails adapter
      const claimResult = await this.config.railsAdapter.claimWork(
        this.context.dag_id,
        node.id,
        wih.work_item_id,
        `executor:${this.context.run_id}`,
        wih.scope?.allowed_paths || ['.'],
        900 // 15 minutes default
      );

      if (!claimResult.success || !claimResult.lease) {
        throw new Error(`Failed to acquire lease: ${claimResult.error}`);
      }

      // Register with lease manager for auto-renewal
      await this.config.leaseManager.acquireLease(claimResult.lease);

      this.emit('lease:acquired', { 
        node_id: node.id, 
        lease_id: claimResult.lease.leaseId 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Lease acquisition failed for node ${node.id}: ${errorMsg}`);
    }
  }

  /**
   * Release lease after node execution
   */
  private async releaseNodeLease(node: DagNode): Promise<void> {
    if (!this.config.leaseManager || !this.config.autoManageLeases) {
      return;
    }

    // Find lease for this node
    const leases = this.config.leaseManager.getAllLeases();
    const nodeLease = leases.find(l => l.nodeId === node.id);

    if (nodeLease) {
      await this.config.leaseManager.releaseLease(nodeLease.leaseId);
      this.emit('lease:released', { node_id: node.id, lease_id: nodeLease.leaseId });
    }
  }

  /**
   * Build final execution result
   */
  private buildResult(error?: string): DagExecutionResult {
    return {
      success: this.context.failed_nodes.length === 0 && 
               this.context.blocked_nodes.length === 0 &&
               !error,
      dag_id: this.context.dag_id,
      run_id: this.context.run_id,
      completed_nodes: this.context.completed_nodes,
      failed_nodes: this.context.failed_nodes,
      blocked_nodes: this.context.blocked_nodes,
      node_results: this.nodeResults,
      started_at: this.context.started_at,
      completed_at: new Date().toISOString(),
      error,
    };
  }

  /**
   * Get execution context
   */
  getContext(): DagExecutionContext {
    return { ...this.context };
  }

  /**
   * Get node result
   */
  getNodeResult(nodeId: string): NodeExecutionResult | undefined {
    return this.nodeResults.get(nodeId);
  }
}

// Factory function
export function createDagExecutor(config: DagExecutorConfig): DagExecutor {
  return new DagExecutor(config);
}
