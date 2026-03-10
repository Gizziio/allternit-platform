/**
 * Rails API Adapter
 * 
 * Bridges the Agent Runner to the Rails control plane.
 * Handles: leases, gate checks, receipts, WIH operations via CLI or HTTP.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  WorkRequest,
  Lease,
  LeaseId,
  WihId,
  DagId,
  NodeId,
  RunId,
  Receipt,
  ReceiptId,
  ToolCall,
  ToolResult,
  CorrelationId,
} from '../types';

const execAsync = promisify(exec);

export interface RailsConfig {
  cliPath: string;
  projectPath: string;
  useHttp?: boolean;
  httpEndpoint?: string;
}

export interface GateCheckRequest {
  wihId: WihId;
  dagId: DagId;
  nodeId: NodeId;
  runId: RunId;
  tool: ToolCall;
  contextPackId: string;
  policyBundleId: string;
  leaseId?: LeaseId;
}

export interface GateCheckResponse {
  allowed: boolean;
  decision: 'ALLOW' | 'BLOCK' | 'TRANSFORM' | 'REQUIRE_APPROVAL';
  transformedArgs?: Record<string, unknown>;
  reason?: string;
  checkId: string;
}

export interface WorkClaimResult {
  success: boolean;
  lease?: Lease;
  error?: string;
}

export class RailsAdapter {
  private config: RailsConfig;

  constructor(config: RailsConfig) {
    this.config = config;
  }

  /**
   * Discover work items from Rails
   */
  async discoverWork(): Promise<WorkRequest[]> {
    try {
      const { stdout } = await this.execRails('wih list --ready --json');
      const workItems = JSON.parse(stdout);
      return workItems.map((item: unknown) => this.parseWorkRequest(item));
    } catch (error) {
      console.error('Failed to discover work:', error);
      return [];
    }
  }

  /**
   * Claim work by requesting a lease
   */
  async claimWork(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    agentId: string,
    paths: string[],
    ttlSeconds: number = 900
  ): Promise<WorkClaimResult> {
    try {
      // Request lease
      const pathsArg = paths.map(p => `"${p}"`).join(' ');
      const { stdout } = await this.execRails(
        `lease request ${wihId} --paths "${pathsArg}" --ttl ${ttlSeconds} --json`
      );
      
      const leaseData = JSON.parse(stdout);
      
      if (leaseData.status === 'denied') {
        return {
          success: false,
          error: leaseData.reason || 'Lease denied',
        };
      }

      // Pickup WIH
      await this.execRails(
        `wih pickup ${nodeId} --dag ${dagId} --agent ${agentId} --json`
      );

      const lease: Lease = {
        leaseId: leaseData.lease_id,
        wihId,
        dagId,
        nodeId,
        holder: agentId,
        grantedAt: leaseData.granted_at,
        expiresAt: leaseData.expires_at,
        scope: {
          paths: leaseData.paths || paths,
          tools: leaseData.tools || [],
        },
      };

      return { success: true, lease };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Renew an existing lease
   */
  async renewLease(leaseId: LeaseId, additionalSeconds: number): Promise<boolean> {
    try {
      await this.execRails(`lease renew ${leaseId} --extend ${additionalSeconds}`);
      return true;
    } catch (error) {
      console.error('Failed to renew lease:', error);
      return false;
    }
  }

  /**
   * Release a lease
   */
  async releaseLease(leaseId: LeaseId): Promise<boolean> {
    try {
      await this.execRails(`lease release ${leaseId}`);
      return true;
    } catch (error) {
      console.error('Failed to release lease:', error);
      return false;
    }
  }

  /**
   * PreToolUse gate check
   */
  async gateCheck(request: GateCheckRequest): Promise<GateCheckResponse> {
    try {
      // Build gate check command
      const contextJson = JSON.stringify({
        context_pack_id: request.contextPackId,
        policy_bundle_id: request.policyBundleId,
        lease_id: request.leaseId,
      });

      const toolJson = JSON.stringify({
        name: request.tool.tool,
        args: request.tool.args,
      });

      const { stdout } = await this.execRails(
        `gate check ${request.wihId} --context '${contextJson}' --tool '${toolJson}' --json`
      );

      const result = JSON.parse(stdout);
      
      return {
        allowed: result.allowed,
        decision: result.decision,
        transformedArgs: result.transformed_args,
        reason: result.reason,
        checkId: result.check_id,
      };
    } catch (error) {
      // On failure, default to block
      return {
        allowed: false,
        decision: 'BLOCK',
        reason: `Gate check failed: ${error instanceof Error ? error.message : String(error)}`,
        checkId: `check_${Date.now()}`,
      };
    }
  }

  /**
   * PostToolUse gate commit
   */
  async gateCommit(
    checkId: string,
    toolCall: ToolCall,
    result: ToolResult,
    receiptId: ReceiptId
  ): Promise<boolean> {
    try {
      const resultJson = JSON.stringify({
        success: result.success,
        affected_paths: result.affectedPaths,
        receipt_id: receiptId,
      });

      await this.execRails(
        `gate commit ${checkId} --result '${resultJson}'`
      );
      return true;
    } catch (error) {
      console.error('Failed to commit gate:', error);
      return false;
    }
  }

  /**
   * PostToolUse gate failure
   */
  async gateFail(
    checkId: string,
    toolCall: ToolCall,
    error: ToolResult['error'],
    receiptId: ReceiptId
  ): Promise<boolean> {
    try {
      const errorJson = JSON.stringify({
        message: error?.message,
        code: error?.code,
        receipt_id: receiptId,
      });

      await this.execRails(
        `gate fail ${checkId} --error '${errorJson}'`
      );
      return true;
    } catch (err) {
      console.error('Failed to fail gate:', err);
      return false;
    }
  }

  /**
   * Write a receipt to Rails
   */
  async writeReceipt(receipt: Omit<Receipt, 'receiptId'>): Promise<ReceiptId | null> {
    try {
      const receiptJson = JSON.stringify(receipt);
      const { stdout } = await this.execRails(
        `receipt write --data '${receiptJson}' --json`
      );
      
      const result = JSON.parse(stdout);
      return result.receipt_id;
    } catch (error) {
      console.error('Failed to write receipt:', error);
      return null;
    }
  }

  /**
   * Request WIH close (after validator PASS)
   */
  async requestWihClose(
    wihId: WihId,
    status: 'DONE' | 'FAILED',
    evidenceRefs: ReceiptId[]
  ): Promise<boolean> {
    try {
      const evidenceArg = evidenceRefs.join(',');
      await this.execRails(
        `wih close ${wihId} --status ${status} --evidence ${evidenceArg}`
      );
      return true;
    } catch (error) {
      console.error('Failed to close WIH:', error);
      return false;
    }
  }

  /**
   * Emit iteration started event
   */
  async emitIterationStarted(
    runId: RunId,
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    contextPackId: string
  ): Promise<boolean> {
    try {
      const eventData = JSON.stringify({
        type: 'WorkIterationStarted',
        run_id: runId,
        dag_id: dagId,
        node_id: nodeId,
        wih_id: wihId,
        context_pack_id: contextPackId,
        timestamp: new Date().toISOString(),
      });

      await this.execRails(`ledger emit '${eventData}'`);
      return true;
    } catch (error) {
      console.error('Failed to emit iteration started:', error);
      return false;
    }
  }

  /**
   * Emit iteration completed event
   */
  async emitIterationCompleted(
    runId: RunId,
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    outcome: 'PASS' | 'FAIL' | 'BLOCKED',
    evidenceRefs: ReceiptId[]
  ): Promise<boolean> {
    try {
      const eventData = JSON.stringify({
        type: 'WorkIterationCompleted',
        run_id: runId,
        dag_id: dagId,
        node_id: nodeId,
        wih_id: wihId,
        outcome,
        evidence_refs: evidenceRefs,
        timestamp: new Date().toISOString(),
      });

      await this.execRails(`ledger emit '${eventData}'`);
      return true;
    } catch (error) {
      console.error('Failed to emit iteration completed:', error);
      return false;
    }
  }

  // Private helpers

  private async execRails(command: string): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `${this.config.cliPath} ${command}`;
    
    if (this.config.useHttp && this.config.httpEndpoint) {
      // HTTP implementation would go here
      throw new Error('HTTP mode not yet implemented');
    }

    return execAsync(fullCommand, { cwd: this.config.projectPath });
  }

  private parseWorkRequest(data: unknown): WorkRequest {
    const item = data as Record<string, unknown>;
    
    return {
      requestId: String(item.request_id || ''),
      dagId: String(item.dag_id || '') as DagId,
      nodeId: String(item.node_id || '') as NodeId,
      wihId: String(item.wih_id || '') as WihId,
      role: String(item.role || 'builder') as WorkRequest['role'],
      executionMode: String(item.execution_mode || 'ACCEPT_EDITS') as WorkRequest['executionMode'],
      priority: Number(item.priority || 0),
      depsSatisfied: Boolean(item.deps_satisfied),
      requiredGates: Array.isArray(item.required_gates) ? item.required_gates : [],
      requiredEvidence: Array.isArray(item.required_evidence) ? item.required_evidence : [],
      leaseRequired: Boolean(item.lease_required),
      leaseScope: {
        allowedPaths: Array.isArray((item.lease_scope as Record<string, unknown>)?.allowed_paths)
          ? (item.lease_scope as Record<string, unknown>).allowed_paths as string[]
          : [],
        allowedTools: Array.isArray((item.lease_scope as Record<string, unknown>)?.allowed_tools)
          ? (item.lease_scope as Record<string, unknown>).allowed_tools as string[]
          : [],
      },
      createdAt: String(item.created_at || new Date().toISOString()),
      correlationId: String(item.correlation_id || `corr_${Date.now()}`) as CorrelationId,
    };
  }
}

// Factory function
export function createRailsAdapter(config: RailsConfig): RailsAdapter {
  return new RailsAdapter(config);
}
