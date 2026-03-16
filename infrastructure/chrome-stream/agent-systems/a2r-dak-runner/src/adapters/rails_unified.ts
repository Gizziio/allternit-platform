/**
 * Unified Rails Adapter
 * 
 * Combines CLI and HTTP modes with automatic fallback.
 * Uses HTTP by default, falls back to CLI if HTTP fails.
 */

import { RailsAdapter, RailsConfig } from './rails_api';
import { RailsHttpAdapter, RailsHttpConfig } from './rails_http';
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
} from '../types';
import type { GateCheckRequest, GateCheckResponse, WorkClaimResult } from './rails_api';

export interface UnifiedRailsConfig extends RailsConfig {
  http?: RailsHttpConfig;
  preferHttp?: boolean;
  fallbackToCli?: boolean;
}

export class RailsUnifiedAdapter {
  private cliAdapter: RailsAdapter;
  private httpAdapter?: RailsHttpAdapter;
  private config: UnifiedRailsConfig;
  private useHttp: boolean;

  constructor(config: UnifiedRailsConfig) {
    this.config = {
      preferHttp: true,
      fallbackToCli: true,
      ...config,
    };

    this.cliAdapter = new RailsAdapter({
      cliPath: config.cliPath,
      projectPath: config.projectPath,
    });

    if (config.http) {
      this.httpAdapter = new RailsHttpAdapter(config.http);
    }

    this.useHttp = !!(this.config.preferHttp && this.httpAdapter);
  }

  // ============================================================================
  // Mode Management
  // ============================================================================

  /**
   * Check if HTTP mode is available
   */
  isHttpAvailable(): boolean {
    return !!this.httpAdapter;
  }

  /**
   * Switch to CLI mode
   */
  useCliMode(): void {
    this.useHttp = false;
  }

  /**
   * Switch to HTTP mode
   */
  useHttpMode(): void {
    if (!this.httpAdapter) {
      throw new Error('HTTP adapter not configured');
    }
    this.useHttp = true;
  }

  /**
   * Get current mode
   */
  getMode(): 'http' | 'cli' {
    return this.useHttp ? 'http' : 'cli';
  }

  // ============================================================================
  // Work Discovery
  // ============================================================================

  async discoverWork(): Promise<WorkRequest[]> {
    return this.executeWithFallback(
      () => this.httpAdapter?.discoverWork(),
      () => this.cliAdapter.discoverWork()
    );
  }

  // ============================================================================
  // Lease Management
  // ============================================================================

  async claimWork(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    agentId: string,
    paths: string[],
    ttlSeconds: number = 900
  ): Promise<WorkClaimResult> {
    return this.executeWithFallback(
      async () => {
        const lease = await this.httpAdapter!.requestLease({
          wihId,
          dagId,
          nodeId,
          agentId,
          paths,
          tools: [],
          ttlSeconds,
        });
        return { success: true, lease } as WorkClaimResult;
      },
      () => this.cliAdapter.claimWork(dagId, nodeId, wihId, agentId, paths, ttlSeconds)
    );
  }

  async renewLease(leaseId: LeaseId, additionalSeconds: number): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.renewLease(leaseId, additionalSeconds);
        return true;
      },
      () => this.cliAdapter.renewLease(leaseId, additionalSeconds)
    );
  }

  async releaseLease(leaseId: LeaseId): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.releaseLease(leaseId);
        return true;
      },
      () => this.cliAdapter.releaseLease(leaseId)
    );
  }

  // ============================================================================
  // Gate Checking
  // ============================================================================

  async gateCheck(request: GateCheckRequest): Promise<GateCheckResponse> {
    return this.executeWithFallback(
      () => this.httpAdapter?.gateCheck(request),
      () => this.cliAdapter.gateCheck(request)
    );
  }

  async gateCommit(
    checkId: string,
    toolCall: ToolCall,
    result: ToolResult,
    receiptId: ReceiptId
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.gateCommit(checkId, toolCall, result, receiptId);
        return true;
      },
      () => this.cliAdapter.gateCommit(checkId, toolCall, result, receiptId)
    );
  }

  async gateFail(
    checkId: string,
    toolCall: ToolCall,
    error: ToolResult['error'],
    receiptId: ReceiptId
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.gateFail(checkId, toolCall, error, receiptId);
        return true;
      },
      () => this.cliAdapter.gateFail(checkId, toolCall, error, receiptId)
    );
  }

  // ============================================================================
  // Receipt Management
  // ============================================================================

  async writeReceipt(receipt: Omit<Receipt, 'receiptId'>): Promise<ReceiptId | null> {
    return this.executeWithFallback(
      () => this.httpAdapter?.writeReceipt(receipt),
      () => this.cliAdapter.writeReceipt(receipt)
    );
  }

  /**
   * Query receipts - HTTP only (CLI doesn't support this)
   */
  async queryReceipts(query: {
    wihId?: WihId;
    dagId?: DagId;
    nodeId?: NodeId;
    kinds?: string[];
    runId?: RunId;
    limit?: number;
  }): Promise<Receipt[]> {
    if (!this.httpAdapter) {
      throw new Error('Receipt query requires HTTP adapter');
    }
    return this.httpAdapter.queryReceipts(query);
  }

  // ============================================================================
  // Context Pack
  // ============================================================================

  /**
   * Seal context pack - HTTP only
   */
  async sealContextPack(pack: {
    contextPackId: string;
    version: string;
    createdAt: string;
    inputs: {
      wihId: string;
      dagId: string;
      nodeId: string;
      receiptRefs: string[];
      policyBundleId: string;
      planHashes: Record<string, string>;
    };
    correlationId: string;
  }): Promise<void> {
    if (!this.httpAdapter) {
      throw new Error('Context pack sealing requires HTTP adapter');
    }
    return this.httpAdapter.sealContextPack(pack);
  }

  // ============================================================================
  // WIH Management
  // ============================================================================

  async requestWihClose(
    wihId: WihId,
    status: 'DONE' | 'FAILED',
    evidenceRefs: ReceiptId[]
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.requestWihClose(wihId, status, evidenceRefs);
        return true;
      },
      () => this.cliAdapter.requestWihClose(wihId, status, evidenceRefs)
    );
  }

  // ============================================================================
  // Ledger Events
  // ============================================================================

  async emitIterationStarted(
    runId: RunId,
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    contextPackId: string
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.emitLedgerEvent({
          type: 'WorkIterationStarted',
          runId,
          dagId,
          nodeId,
          wihId,
          payload: { context_pack_id: contextPackId },
        });
        return true;
      },
      () => this.cliAdapter.emitIterationStarted(runId, dagId, nodeId, wihId, contextPackId)
    );
  }

  async emitIterationCompleted(
    runId: RunId,
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    outcome: 'PASS' | 'FAIL' | 'BLOCKED',
    evidenceRefs: ReceiptId[]
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        await this.httpAdapter!.emitLedgerEvent({
          type: 'WorkIterationCompleted',
          runId,
          dagId,
          nodeId,
          wihId,
          payload: { outcome, evidence_refs: evidenceRefs },
        });
        return true;
      },
      () => this.cliAdapter.emitIterationCompleted(runId, dagId, nodeId, wihId, outcome, evidenceRefs)
    );
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    timestamp: string;
  }> {
    if (this.httpAdapter) {
      try {
        return await this.httpAdapter.healthCheck();
      } catch {
        // Fall through to CLI check
      }
    }
    // CLI doesn't have health check, return assumed healthy
    return {
      status: 'healthy',
      version: 'unknown',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async executeWithFallback<T>(
    httpFn: () => Promise<T> | undefined,
    cliFn: () => Promise<T>
  ): Promise<T> {
    if (this.useHttp && this.httpAdapter) {
      try {
        const result = await httpFn();
        if (result !== undefined) {
          return result;
        }
      } catch (error) {
        if (!this.config.fallbackToCli) {
          throw error;
        }
        console.warn('HTTP call failed, falling back to CLI:', error);
        this.useHttp = false;
      }
    }
    return cliFn();
  }
}

// Factory function
export function createRailsUnifiedAdapter(config: UnifiedRailsConfig): RailsUnifiedAdapter {
  return new RailsUnifiedAdapter(config);
}
