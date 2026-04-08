/**
 * Receipt Service - Production receipt generation and storage
 * 
 * Aligned with:
 * - Receipts.json schema (/Users/macbook/Desktop/spec/BrowserAgent/Receipts.json)
 * - LAW-AUT-004 (Evidence/Receipts Queryability)
 * - LAW-ENF-002 (Auditability)
 * - LAW-SWM-005 (Evidence-First Outputs)
 */

import { v4 as uuidv4 } from 'uuid';
import { getAuditTrailService } from './auditTrailService';
import { getRedisClient } from '@/lib/redis/client';
import {
  BrowserReceipt,
  BrowserAction,
  PageState,
  Artifact,
  PolicyDecision,
  TraceEvent,
  RiskTier,
  createTraceEvent,
} from './browserAgent.types';

// ============================================================================
// Receipt Store Interface
// ============================================================================

export interface ReceiptStore {
  // Write operations
  saveReceipt(receipt: BrowserReceipt): Promise<void>;
  
  // Query operations (LAW-AUT-004)
  queryReceipts(params: ReceiptQueryParams): Promise<ReceiptQueryResult>;
  getReceiptById(receiptId: string): Promise<BrowserReceipt | null>;
  getReceiptsByRunId(runId: string): Promise<BrowserReceipt[]>;
  getReceiptsByWihId(wihId: string): Promise<BrowserReceipt[]>;
  getReceiptsByKind(kind: string): Promise<BrowserReceipt[]>;
  getReceiptsByCorrelationId(correlationId: string): Promise<BrowserReceipt[]>;
  
  // Utility
  clear(): Promise<void>;
}

// ============================================================================
// Query Parameters (LAW-AUT-004)
// ============================================================================

export interface ReceiptQueryParams {
  runId?: string;
  wihId?: string;
  type?: string;
  correlationId?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceiptQueryResult {
  receipts: BrowserReceipt[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// In-Memory Store (for development)
// TODO: Replace with persistent storage (SQLite/Postgres) for production
// ============================================================================

export class InMemoryReceiptStore implements ReceiptStore {
  private receipts: Map<string, BrowserReceipt> = new Map();

  async saveReceipt(receipt: BrowserReceipt): Promise<void> {
    this.receipts.set(receipt.runId + ':' + receipt.actionId, receipt);
  }

  async queryReceipts(params: ReceiptQueryParams): Promise<ReceiptQueryResult> {
    let filtered = Array.from(this.receipts.values());

    // Apply filters
    if (params.runId) {
      filtered = filtered.filter(r => r.runId === params.runId);
    }
    if (params.wihId) {
      filtered = filtered.filter(r => 
        r.trace.some(e => e.data?.wihId === params.wihId)
      );
    }
    if (params.type) {
      filtered = filtered.filter(r => 
        r.trace.some(e => e.type === params.type)
      );
    }
    if (params.correlationId) {
      filtered = filtered.filter(r => 
        r.trace.some(e => e.data?.correlationId === params.correlationId)
      );
    }
    if (params.status) {
      filtered = filtered.filter(r => r.status === params.status);
    }
    if (params.startTime) {
      filtered = filtered.filter(r => r.startedAt >= params.startTime!);
    }
    if (params.endTime) {
      filtered = filtered.filter(r => r.endedAt <= params.endTime!);
    }

    // Pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return {
      receipts: paginated,
      total: filtered.length,
      page,
      pageSize,
      hasMore: end < filtered.length,
    };
  }

  async getReceiptById(receiptId: string): Promise<BrowserReceipt | null> {
    // Search by receipt ID in trace
    for (const receipt of this.receipts.values()) {
      if (receipt.runId + ':' + receipt.actionId === receiptId) {
        return receipt;
      }
    }
    return null;
  }

  async getReceiptsByRunId(runId: string): Promise<BrowserReceipt[]> {
    return Array.from(this.receipts.values()).filter(r => r.runId === runId);
  }

  async getReceiptsByWihId(wihId: string): Promise<BrowserReceipt[]> {
    return Array.from(this.receipts.values()).filter(r =>
      r.trace.some(e => e.data?.wihId === wihId)
    );
  }

  async getReceiptsByKind(kind: string): Promise<BrowserReceipt[]> {
    return Array.from(this.receipts.values()).filter(r =>
      r.trace.some(e => e.type === kind)
    );
  }

  async getReceiptsByCorrelationId(correlationId: string): Promise<BrowserReceipt[]> {
    return Array.from(this.receipts.values()).filter(r =>
      r.trace.some(e => e.data?.correlationId === correlationId)
    );
  }

  async clear(): Promise<void> {
    this.receipts.clear();
  }
}

// ============================================================================
// Receipt Generator Service
// ============================================================================

export interface ReceiptGeneratorConfig {
  version: string;  // Receipt schema version
  environmentId: string;
  sessionId: string;
}

export class ReceiptGenerator {
  private config: ReceiptGeneratorConfig;
  private store: ReceiptStore;

  constructor(config: ReceiptGeneratorConfig, store: ReceiptStore) {
    this.config = config;
    this.store = store;
  }

  /**
   * Generate receipt for completed action
   * Aligned with Receipts.json schema
   */
  async generateReceipt(params: {
    runId: string;
    actionId: string;
    action: BrowserAction;
    status: 'success' | 'fail' | 'blocked' | 'needs_confirm' | 'skipped';
    beforeState: PageState;
    afterState: PageState;
    policyDecision?: PolicyDecision;
    resolvedTarget?: {
      selectorUsed: { strategy: string; value: string };
      elementFingerprint?: string;
    };
    artifacts: Artifact[];
    error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    trace: TraceEvent[];
    wihId?: string;
    correlationId?: string;
  }): Promise<BrowserReceipt> {
    const now = new Date().toISOString();
    const audit = getAuditTrailService();

    const receipt: BrowserReceipt = {
      version: this.config.version,
      runId: params.runId,
      actionId: params.actionId,
      status: params.status,
      startedAt: params.trace.find(e => e.type === 'action_start')?.t || now,
      endedAt: now,
      riskTier: params.action.riskTier,
      policyDecision: params.policyDecision,
      before: params.beforeState,
      after: params.afterState,
      resolvedTarget: params.resolvedTarget as any,
      artifacts: params.artifacts,
      error: params.error,
      trace: params.trace,
    };

    // Add correlation metadata to trace
    if (params.correlationId) {
      receipt.trace.forEach(e => {
        e.data = { ...e.data, correlationId: params.correlationId };
      });
    }

    // Add WIH metadata to trace
    if (params.wihId) {
      receipt.trace.forEach(e => {
        e.data = { ...e.data, wihId: params.wihId };
      });
    }

    // Save receipt
    await this.store.saveReceipt(receipt);

    // Log audit event for receipt generation
    await audit.record({
      event_type: 'receipt.generate',
      description: `Receipt generated for action ${params.actionId}`,
      category: 'evidence',
      target: { type: 'receipt', id: params.runId + ':' + params.actionId },
      risk_level: params.status === 'fail' || params.status === 'blocked' ? 'high' : 'low',
      success: params.status === 'success',
      error_code: params.error?.code,
      error_message: params.error?.message,
      metadata: {
        status: params.status,
        actionType: params.action.type,
        riskTier: params.action.riskTier,
      },
      law_references: ['LAW-AUT-004', 'LAW-ENF-002', 'LAW-SWM-005'],
      run_id: params.runId,
      correlation_id: params.correlationId,
    });

    return receipt;
  }

  /**
   * Start receipt generation for an action
   */
  async startAction(params: {
    runId: string;
    actionId: string;
    action: BrowserAction;
    beforeState: PageState;
    wihId?: string;
    correlationId?: string;
  }): Promise<{ trace: TraceEvent[] }> {
    const trace: TraceEvent[] = [
      createTraceEvent('policy_check', {
        actionId: params.actionId,
        riskTier: params.action.riskTier,
        wihId: params.wihId,
        correlationId: params.correlationId,
      }),
      createTraceEvent('selector_resolve', {
        actionId: params.actionId,
        selector: params.action.target,
        wihId: params.wihId,
        correlationId: params.correlationId,
      }),
      createTraceEvent('action_start', {
        actionId: params.actionId,
        actionType: params.action.type,
        beforeState: params.beforeState,
        wihId: params.wihId,
        correlationId: params.correlationId,
      }),
    ];

    return { trace };
  }

  /**
   * Query receipts (LAW-AUT-004)
   */
  async queryReceipts(params: ReceiptQueryParams): Promise<ReceiptQueryResult> {
    return this.store.queryReceipts(params);
  }

  /**
   * Get receipts for Ralph Loop decision making
   */
  async getReceiptsForNode(runId: string, nodeId: string): Promise<{
    isComplete: boolean;
    receipts: BrowserReceipt[];
    lastReceiptHash?: string;
  }> {
    const receipts = await this.store.queryReceipts({
      runId,
      page: 1,
      pageSize: 100,
    });

    const nodeReceipts = receipts.receipts.filter(r =>
      r.trace.some(e => e.data?.nodeId === nodeId)
    );

    const isComplete = nodeReceipts.some(r =>
      r.status === 'success' || r.status === 'skipped'
    );

    const lastReceipt = nodeReceipts[nodeReceipts.length - 1];
    const lastReceiptHash = lastReceipt
      ? this.computeReceiptHash(lastReceipt)
      : undefined;

    return {
      isComplete,
      receipts: nodeReceipts,
      lastReceiptHash,
    };
  }

  /**
   * Compute receipt hash for integrity verification
   */
  private computeReceiptHash(receipt: BrowserReceipt): string {
    // Simple hash for now - should use proper cryptographic hash in production
    const content = JSON.stringify({
      runId: receipt.runId,
      actionId: receipt.actionId,
      status: receipt.status,
      startedAt: receipt.startedAt,
      endedAt: receipt.endedAt,
      artifacts: receipt.artifacts.map(a => a.sha256),
    });

    return 'hash_' + btoa(content).slice(0, 32);
  }
}

// ============================================================================
// Singleton Instance (for development)
// TODO: Replace with proper dependency injection in production
// ============================================================================

let _receiptStore: ReceiptStore | null = null;
let _receiptGenerator: ReceiptGenerator | null = null;

export function getReceiptStore(): ReceiptStore {
  if (!_receiptStore) {
    const redis = getRedisClient();
    if (redis) {
      const { RedisReceiptStore } = require('./redisStores') as typeof import('./redisStores');
      _receiptStore = new RedisReceiptStore(redis);
    } else {
      _receiptStore = new InMemoryReceiptStore();
    }
  }
  return _receiptStore;
}

export function getReceiptGenerator(): ReceiptGenerator {
  if (!_receiptGenerator) {
    _receiptGenerator = new ReceiptGenerator(
      {
        version: 'v1.0.0',
        environmentId: 'dev',
        sessionId: 'session_' + Date.now(),
      },
      getReceiptStore()
    );
  }
  return _receiptGenerator;
}
