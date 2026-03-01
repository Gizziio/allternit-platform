/**
 * Rails HTTP API Adapter
 * 
 * HTTP client for Rails control plane API.
 * Provides RESTful interface to Rails ledger, gates, leases, and receipts.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
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
  GateCheckRequest,
  GateCheckResponse,
  WorkClaimResult,
} from '../types';

export interface RailsHttpConfig {
  baseURL: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface RailsError {
  code: string;
  message: string;
  details?: unknown;
}

export class RailsHttpAdapter {
  private client: AxiosInstance;
  private config: RailsHttpConfig;

  constructor(config: RailsHttpConfig) {
    this.config = {
      timeoutMs: 30000,
      retries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleError(error)
    );
  }

  // ============================================================================
  // Work Discovery
  // ============================================================================

  /**
   * Discover available work items from Rails
   */
  async discoverWork(filters?: {
    role?: string;
    priority?: number;
    ready?: boolean;
  }): Promise<WorkRequest[]> {
    const response = await this.client.get('/v1/work/discover', {
      params: filters,
    });
    return response.data.work_requests.map(this.parseWorkRequest);
  }

  // ============================================================================
  // Lease Management
  // ============================================================================

  /**
   * Request a lease for work execution
   */
  async requestLease(params: {
    wihId: WihId;
    dagId: DagId;
    nodeId: NodeId;
    agentId: string;
    paths: string[];
    tools: string[];
    ttlSeconds: number;
  }): Promise<Lease> {
    const response = await this.client.post('/v1/leases', {
      wih_id: params.wihId,
      dag_id: params.dagId,
      node_id: params.nodeId,
      holder: params.agentId,
      scope: {
        paths: params.paths,
        tools: params.tools,
      },
      ttl_seconds: params.ttlSeconds,
    });

    return this.parseLease(response.data.lease);
  }

  /**
   * Get lease details
   */
  async getLease(leaseId: LeaseId): Promise<Lease | null> {
    try {
      const response = await this.client.get(`/v1/leases/${leaseId}`);
      return this.parseLease(response.data.lease);
    } catch (error) {
      if ((error as RailsError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Renew an existing lease
   */
  async renewLease(leaseId: LeaseId, additionalSeconds: number): Promise<Lease> {
    const response = await this.client.post(`/v1/leases/${leaseId}/renew`, {
      extend_seconds: additionalSeconds,
    });
    return this.parseLease(response.data.lease);
  }

  /**
   * Release a lease
   */
  async releaseLease(leaseId: LeaseId): Promise<void> {
    await this.client.delete(`/v1/leases/${leaseId}`);
  }

  /**
   * List active leases for an agent
   */
  async listLeases(agentId: string): Promise<Lease[]> {
    const response = await this.client.get('/v1/leases', {
      params: { holder: agentId },
    });
    return response.data.leases.map(this.parseLease);
  }

  // ============================================================================
  // Gate Checking
  // ============================================================================

  /**
   * PreToolUse gate check
   */
  async gateCheck(request: GateCheckRequest): Promise<GateCheckResponse> {
    const response = await this.client.post('/v1/gate/check', {
      wih_id: request.wihId,
      dag_id: request.dagId,
      node_id: request.nodeId,
      run_id: request.runId,
      tool: {
        name: request.tool.tool,
        args: request.tool.args,
        intended_paths: request.tool.intendedPaths,
      },
      context: {
        context_pack_id: request.contextPackId,
        policy_bundle_id: request.policyBundleId,
        lease_id: request.leaseId,
      },
    });

    return {
      allowed: response.data.decision === 'ALLOW' || response.data.decision === 'TRANSFORM',
      decision: response.data.decision,
      transformedArgs: response.data.transformed_args,
      reason: response.data.reason,
      checkId: response.data.check_id,
    };
  }

  /**
   * PostToolUse gate commit
   */
  async gateCommit(
    checkId: string,
    toolCall: ToolCall,
    result: ToolResult,
    receiptId: ReceiptId
  ): Promise<void> {
    await this.client.post(`/v1/gates/commit/${checkId}`, {
      tool: {
        name: toolCall.tool,
        args: toolCall.args,
      },
      result: {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        affected_paths: result.affectedPaths,
        produced_hashes: result.producedHashes,
      },
      receipt_id: receiptId,
    });
  }

  /**
   * PostToolUse gate failure
   */
  async gateFail(
    checkId: string,
    toolCall: ToolCall,
    error: ToolResult['error'],
    receiptId: ReceiptId
  ): Promise<void> {
    await this.client.post(`/v1/gates/fail/${checkId}`, {
      tool: {
        name: toolCall.tool,
        args: toolCall.args,
      },
      error: {
        message: error?.message,
        code: error?.code,
        stderr: error?.stderr,
      },
      receipt_id: receiptId,
    });
  }

  // ============================================================================
  // Receipt Management
  // ============================================================================

  /**
   * Write a receipt to Rails
   */
  async writeReceipt(receipt: Omit<Receipt, 'receiptId'>): Promise<ReceiptId> {
    const response = await this.client.post('/v1/receipts', receipt);
    return response.data.receipt_id;
  }

  /**
   * Query receipts
   */
  async queryReceipts(query: {
    wihId?: WihId;
    dagId?: DagId;
    nodeId?: NodeId;
    kinds?: string[];
    runId?: RunId;
    limit?: number;
  }): Promise<Receipt[]> {
    const response = await this.client.get('/v1/receipts', {
      params: {
        wih_id: query.wihId,
        dag_id: query.dagId,
        node_id: query.nodeId,
        kinds: query.kinds?.join(','),
        run_id: query.runId,
        limit: query.limit,
      },
    });
    return response.data.receipts.map(this.parseReceipt);
  }

  /**
   * Get a specific receipt
   */
  async getReceipt(receiptId: ReceiptId): Promise<Receipt | null> {
    try {
      const response = await this.client.get(`/v1/receipts/${receiptId}`);
      return this.parseReceipt(response.data.receipt);
    } catch (error) {
      if ((error as RailsError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // Context Pack
  // ============================================================================

  /**
   * Seal a context pack to Rails
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
    await this.client.post('/v1/context-packs', {
      context_pack_id: pack.contextPackId,
      version: pack.version,
      created_at: pack.createdAt,
      inputs: {
        wih_id: pack.inputs.wihId,
        dag_id: pack.inputs.dagId,
        node_id: pack.inputs.nodeId,
        receipt_refs: pack.inputs.receiptRefs,
        policy_bundle_id: pack.inputs.policyBundleId,
        plan_hashes: pack.inputs.planHashes,
      },
      correlation_id: pack.correlationId,
    });
  }

  /**
   * Get a context pack by ID
   */
  async getContextPack(contextPackId: string): Promise<unknown | null> {
    try {
      const response = await this.client.get(`/v1/context-packs/${contextPackId}`);
      return response.data.context_pack;
    } catch (error) {
      if ((error as RailsError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // WIH Management
  // ============================================================================

  /**
   * Request WIH close (after validator PASS)
   */
  async requestWihClose(
    wihId: WihId,
    status: 'DONE' | 'FAILED',
    evidenceRefs: ReceiptId[]
  ): Promise<void> {
    await this.client.post(`/v1/wih/${wihId}/close`, {
      status,
      evidence_refs: evidenceRefs,
    });
  }

  /**
   * Get WIH content
   */
  async getWihContent(wihId: WihId): Promise<string | null> {
    try {
      const response = await this.client.get(`/v1/wih/${wihId}/content`);
      return response.data.content;
    } catch (error) {
      if ((error as RailsError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // Ledger Events
  // ============================================================================

  /**
   * Emit a ledger event
   */
  async emitLedgerEvent(event: {
    type: string;
    runId?: RunId;
    dagId?: DagId;
    nodeId?: NodeId;
    wihId?: WihId;
    payload: unknown;
  }): Promise<void> {
    await this.client.post('/v1/ledger/events', {
      type: event.type,
      run_id: event.runId,
      dag_id: event.dagId,
      node_id: event.nodeId,
      wih_id: event.wihId,
      payload: event.payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Query ledger events
   */
  async queryLedger(query: {
    wihId?: WihId;
    dagId?: DagId;
    types?: string[];
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const response = await this.client.get('/v1/ledger/events', {
      params: {
        wih_id: query.wihId,
        dag_id: query.dagId,
        types: query.types?.join(','),
        from: query.from,
        to: query.to,
        limit: query.limit,
      },
    });
    return response.data.events;
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check Rails health
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    timestamp: string;
  }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private handleError(error: AxiosError): never {
    if (error.response) {
      const railsError: RailsError = {
        code: error.response.data?.code || 'UNKNOWN_ERROR',
        message: error.response.data?.message || error.message,
        details: error.response.data?.details,
      };
      throw railsError;
    } else if (error.request) {
      throw {
        code: 'NETWORK_ERROR',
        message: 'No response from Rails server',
        details: error.message,
      } as RailsError;
    } else {
      throw {
        code: 'REQUEST_ERROR',
        message: error.message,
      } as RailsError;
    }
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
        allowedPaths: Array.isArray(item.lease_scope?.allowed_paths)
          ? item.lease_scope.allowed_paths
          : [],
        allowedTools: Array.isArray(item.lease_scope?.allowed_tools)
          ? item.lease_scope.allowed_tools
          : [],
      },
      createdAt: String(item.created_at || new Date().toISOString()),
      correlationId: String(item.correlation_id || `corr_${Date.now()}`) as CorrelationId,
    };
  }

  private parseLease(data: unknown): Lease {
    const item = data as Record<string, unknown>;
    return {
      leaseId: String(item.lease_id || item.id) as LeaseId,
      wihId: String(item.wih_id) as WihId,
      dagId: String(item.dag_id) as DagId,
      nodeId: String(item.node_id) as NodeId,
      holder: String(item.holder || item.holder_id),
      grantedAt: String(item.granted_at || item.created_at),
      expiresAt: String(item.expires_at),
      scope: {
        paths: Array.isArray(item.scope?.paths) ? item.scope.paths : [],
        tools: Array.isArray(item.scope?.tools) ? item.scope.tools : [],
      },
    };
  }

  private parseReceipt(data: unknown): Receipt {
    const item = data as Record<string, unknown>;
    return {
      receiptId: String(item.receipt_id || item.id) as ReceiptId,
      kind: String(item.kind),
      runId: String(item.run_id) as RunId,
      dagId: String(item.dag_id) as DagId,
      nodeId: String(item.node_id) as NodeId,
      wihId: String(item.wih_id) as WihId,
      timestamp: String(item.timestamp || item.created_at),
      payload: item.payload,
      hash: String(item.hash),
    };
  }
}

// Factory function
export function createRailsHttpAdapter(config: RailsHttpConfig): RailsHttpAdapter {
  return new RailsHttpAdapter(config);
}
