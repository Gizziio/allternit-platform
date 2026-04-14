/**
 * Receipts and Audit Layer
 * 
 * Provides institutional audit trail for all operator actions.
 * Every meaningful action emits a receipt with:
 * - Request metadata
 * - Plan executed
 * - Actions taken
 * - Verification results
 * - Model/backend routing
 * - Privacy compliance markers
 * 
 * Receipts are:
 * - Immutable once written
 * - Exportable for compliance
 * - Queryable by task/user/course
 */

import { EventEmitter } from 'events';
import { WihId, RunId, ReceiptId, DagId, NodeId } from '../types';

/**
 * Receipt status types
 */
export type ReceiptStatus = 
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'cancelled'
  | 'blocked';

/**
 * Execution backend metadata
 */
export type ExecutionBackend =
  | 'connector'
  | 'browser_automation'
  | 'electron_native'
  | 'os_automation'
  | 'file_system'
  | 'manual';

/**
 * Risk level assessment
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Created object reference
 */
export interface CreatedObject {
  type: string;
  name: string;
  id?: string;
  url?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Modified object reference
 */
export interface ModifiedObject {
  type: string;
  name: string;
  id: string;
  changes: string[];
  beforeHash?: string;
  afterHash?: string;
}

/**
 * Action step in the receipt
 */
export interface ActionStep {
  stepNumber: number;
  action: string;
  target: string;
  status: 'success' | 'failed' | 'skipped';
  backend: ExecutionBackend;
  durationMs: number;
  error?: string;
  verification?: {
    method: string;
    passed: boolean;
    details?: string;
  };
}

/**
 * Privacy routing metadata
 */
export interface PrivacyRouting {
  modelRouting: 'local' | 'private_cloud' | 'external';
  modelId?: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  piiDetected: boolean;
  studentDataFlagged: boolean;
  policyVersion: string;
}

/**
 * Receipt schema - the main audit record
 */
export interface Receipt {
  // Identity
  id: ReceiptId;
  requestId: string;
  wihId: WihId;
  runId: RunId;
  dagId?: DagId;
  nodeId?: NodeId;

  // User context
  userId: string;
  userRole: string;
  tenantId?: string;

  // Task details
  userIntent: string;
  targetSystem: string;
  targetContext: Record<string, unknown>;

  // Execution details
  executionMode: 'plan_only' | 'plan_then_execute' | 'execute_direct';
  backend: ExecutionBackend;
  routingReason: string;

  // Plan and actions
  planSummary: {
    goal: string;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
  };
  actions: ActionStep[];

  // Results
  status: ReceiptStatus;
  createdObjects: CreatedObject[];
  modifiedObjects: ModifiedObject[];
  errors: string[];
  warnings: string[];

  // Verification
  verification: {
    overallPassed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message?: string;
    }>;
  };

  // Privacy and compliance
  privacy: PrivacyRouting;

  // Timing
  startedAt: number;
  completedAt: number;
  durationMs: number;

  // Metadata
  metadata: {
    clientVersion: string;
    platformVersion: string;
    sessionId?: string;
  };

  // Integrity
  hash: string;
  previousReceiptId?: ReceiptId;
  createdAt: string;
}

/**
 * Receipt query options
 */
export interface ReceiptQuery {
  userId?: string;
  tenantId?: string;
  targetSystem?: string;
  status?: ReceiptStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Receipt store interface
 */
export interface ReceiptStore {
  save(receipt: Receipt): Promise<void>;
  findById(id: ReceiptId): Promise<Receipt | null>;
  findByRequestId(requestId: string): Promise<Receipt | null>;
  findByRunId(runId: RunId): Promise<Receipt | null>;
  query(options: ReceiptQuery): Promise<Receipt[]>;
  export(receipts: Receipt[]): Promise<string>;
}

/**
 * Receipt manager - handles receipt lifecycle
 */
export class ReceiptManager extends EventEmitter {
  private store: ReceiptStore;
  private receipts: Map<ReceiptId, Receipt> = new Map();

  constructor(store: ReceiptStore) {
    super();
    this.store = store;
  }

  /**
   * Create a new receipt
   */
  createReceipt(options: {
    requestId: string;
    wihId: WihId;
    runId: RunId;
    userId: string;
    userRole: string;
    tenantId?: string;
    userIntent: string;
    targetSystem: string;
    targetContext: Record<string, unknown>;
    executionMode: 'plan_only' | 'plan_then_execute' | 'execute_direct';
    backend: ExecutionBackend;
    routingReason: string;
    privacy: PrivacyRouting;
  }): Receipt {
    const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as ReceiptId;
    
    const receipt: Receipt = {
      id: receiptId,
      requestId: options.requestId,
      wihId: options.wihId,
      runId: options.runId,
      userId: options.userId,
      userRole: options.userRole,
      tenantId: options.tenantId,
      userIntent: options.userIntent,
      targetSystem: options.targetSystem,
      targetContext: options.targetContext,
      executionMode: options.executionMode,
      backend: options.backend,
      routingReason: options.routingReason,
      planSummary: {
        goal: options.userIntent,
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
      },
      actions: [],
      status: 'success',
      createdObjects: [],
      modifiedObjects: [],
      errors: [],
      warnings: [],
      verification: {
        overallPassed: false,
        checks: [],
      },
      privacy: options.privacy,
      startedAt: Date.now(),
      completedAt: 0,
      durationMs: 0,
      metadata: {
        clientVersion: '1.0.0',
        platformVersion: '1.0.0',
      },
      hash: '',
      createdAt: new Date().toISOString(),
    };

    return receipt;
  }

  /**
   * Add an action step to the receipt
   */
  addActionStep(receipt: Receipt, step: ActionStep): void {
    receipt.actions.push(step);
    receipt.planSummary.totalSteps = receipt.actions.length;
    receipt.planSummary.completedSteps = receipt.actions.filter(a => a.status === 'success').length;
    receipt.planSummary.failedSteps = receipt.actions.filter(a => a.status === 'failed').length;
  }

  /**
   * Record a created object
   */
  addCreatedObject(receipt: Receipt, obj: CreatedObject): void {
    receipt.createdObjects.push(obj);
  }

  /**
   * Record a verification check
   */
  addVerificationCheck(
    receipt: Receipt,
    name: string,
    passed: boolean,
    message?: string
  ): void {
    receipt.verification.checks.push({ name, passed, message });
    receipt.verification.overallPassed = receipt.verification.checks.every(c => c.passed);
  }

  /**
   * Record an error
   */
  addError(receipt: Receipt, error: string): void {
    receipt.errors.push(error);
    if (receipt.errors.length > 0) {
      receipt.status = receipt.errors.length === receipt.planSummary.failedSteps 
        ? 'failed' 
        : 'partial_success';
    }
  }

  /**
   * Finalize and save the receipt
   */
  async finalizeReceipt(receipt: Receipt): Promise<void> {
    receipt.completedAt = Date.now();
    receipt.durationMs = receipt.completedAt - receipt.startedAt;
    
    // Compute hash for integrity
    receipt.hash = await this.computeHash(receipt);
    
    // Save to store
    await this.store.save(receipt);
    this.receipts.set(receipt.id, receipt);
    
    this.emit('receipt:created', receipt);
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(id: ReceiptId): Promise<Receipt | null> {
    return this.store.findById(id);
  }

  /**
   * Get receipt by request ID
   */
  async getByRequestId(requestId: string): Promise<Receipt | null> {
    return this.store.findByRequestId(requestId);
  }

  /**
   * Query receipts
   */
  async queryReceipts(options: ReceiptQuery): Promise<Receipt[]> {
    return this.store.query(options);
  }

  /**
   * Export receipts as JSON
   */
  async exportReceipts(receiptIds: ReceiptId[]): Promise<string> {
    const receipts: Receipt[] = [];
    for (const id of receiptIds) {
      const receipt = await this.store.findById(id);
      if (receipt) {
        receipts.push(receipt);
      }
    }
    return this.store.export(receipts);
  }

  /**
   * Compute hash for receipt integrity
   */
  private async computeHash(receipt: Receipt): Promise<string> {
    const data = JSON.stringify({
      id: receipt.id,
      requestId: receipt.requestId,
      wihId: receipt.wihId,
      runId: receipt.runId,
      userId: receipt.userId,
      userIntent: receipt.userIntent,
      status: receipt.status,
      createdObjects: receipt.createdObjects,
      actions: receipt.actions,
      startedAt: receipt.startedAt,
      completedAt: receipt.completedAt,
    });
    
    // Simple hash - in production use crypto.subtle or similar
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256:${hash.toString(16)}`;
  }
}

/**
 * In-memory receipt store (for development)
 */
export class InMemoryReceiptStore implements ReceiptStore {
  private receipts: Map<ReceiptId, Receipt> = new Map();
  private byRequestId: Map<string, Receipt> = new Map();
  private byRunId: Map<RunId, Receipt> = new Map();

  async save(receipt: Receipt): Promise<void> {
    this.receipts.set(receipt.id, receipt);
    this.byRequestId.set(receipt.requestId, receipt);
    if (receipt.runId) {
      this.byRunId.set(receipt.runId, receipt);
    }
  }

  async findById(id: ReceiptId): Promise<Receipt | null> {
    return this.receipts.get(id) || null;
  }

  async findByRequestId(requestId: string): Promise<Receipt | null> {
    return this.byRequestId.get(requestId) || null;
  }

  async findByRunId(runId: RunId): Promise<Receipt | null> {
    return this.byRunId.get(runId) || null;
  }

  async query(options: ReceiptQuery): Promise<Receipt[]> {
    let results = Array.from(this.receipts.values());

    if (options.userId) {
      results = results.filter(r => r.userId === options.userId);
    }
    if (options.tenantId) {
      results = results.filter(r => r.tenantId === options.tenantId);
    }
    if (options.targetSystem) {
      results = results.filter(r => r.targetSystem === options.targetSystem);
    }
    if (options.status) {
      results = results.filter(r => r.status === options.status);
    }
    if (options.startDate) {
      results = results.filter(r => new Date(r.createdAt) >= options.startDate!);
    }
    if (options.endDate) {
      results = results.filter(r => new Date(r.createdAt) <= options.endDate!);
    }

    const offset = options.offset || 0;
    const limit = options.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async export(receipts: Receipt[]): Promise<string> {
    return JSON.stringify(receipts, null, 2);
  }
}

/**
 * Factory function to create receipt manager
 */
export function createReceiptManager(store?: ReceiptStore): ReceiptManager {
  const receiptStore = store || new InMemoryReceiptStore();
  return new ReceiptManager(receiptStore);
}
