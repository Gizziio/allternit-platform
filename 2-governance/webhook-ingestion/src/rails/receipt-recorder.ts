/**
 * Receipt Recorder
 * 
 * Records receipts for webhook processing events.
 * Receipts are immutable evidence artifacts.
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Receipt types for webhook processing
 */
export type ReceiptKind =
  | 'webhook_received'
  | 'webhook_validated'
  | 'webhook_normalized'
  | 'event_emitted'
  | 'work_request_created'
  | 'agent_mentioned'
  | 'duplicate_detected'
  | 'rate_limited'
  | 'signature_verified'
  | 'allowlist_checked';

/**
 * Receipt structure
 */
export interface Receipt {
  /** Unique receipt ID */
  receiptId: string;
  /** Receipt kind */
  kind: ReceiptKind;
  /** Associated run ID (if any) */
  runId?: string;
  /** Associated DAG ID (if any) */
  dagId?: string;
  /** Associated node ID (if any) */
  nodeId?: string;
  /** Associated WIH ID (if any) */
  wihId?: string;
  /** Payload data */
  payload: Record<string, unknown>;
  /** Payload reference (vault path) */
  payloadRef?: string;
  /** SHA-256 hash of payload */
  hash?: string;
  /** Correlation ID */
  correlationId: string;
  /** Timestamp */
  timestamp: string;
  /** Actor */
  actor: string;
}

/**
 * Receipt recorder
 */
export class ReceiptRecorder {
  private receipts: Receipt[];
  
  constructor() {
    this.receipts = [];
  }
  
  /**
   * Record a receipt
   */
  async record(
    kind: ReceiptKind,
    payload: Record<string, unknown>,
    options: {
      correlationId?: string;
      runId?: string;
      dagId?: string;
      nodeId?: string;
      wihId?: string;
      actor?: string;
    } = {}
  ): Promise<Receipt> {
    const receiptId = `rcpt_${uuidv4()}`;
    const timestamp = new Date().toISOString();
    const correlationId = options.correlationId || receiptId;
    const actor = options.actor || 'system:webhook';
    
    // Compute hash of payload
    const hash = computePayloadHash(payload);
    
    // Generate payload reference
    const payloadRef = `receipts/${receiptId}/payload.json`;
    
    const receipt: Receipt = {
      receiptId,
      kind,
      runId: options.runId,
      dagId: options.dagId,
      nodeId: options.nodeId,
      wihId: options.wihId,
      payload,
      payloadRef,
      hash,
      correlationId,
      timestamp,
      actor,
    };
    
    // Store receipt
    this.receipts.push(receipt);
    
    return receipt;
  }
  
  /**
   * Record webhook received
   */
  async recordWebhookReceived(
    source: string,
    eventType: string,
    idempotencyKey: string,
    correlationId: string
  ): Promise<Receipt> {
    return this.record('webhook_received', {
      source,
      eventType,
      idempotencyKey,
    }, { correlationId });
  }
  
  /**
   * Record signature verification
   */
  async recordSignatureVerified(
    source: string,
    algorithm: string,
    verified: boolean,
    correlationId: string
  ): Promise<Receipt> {
    return this.record('signature_verified', {
      source,
      algorithm,
      verified,
    }, { correlationId });
  }
  
  /**
   * Record allowlist check
   */
  async recordAllowlistChecked(
    source: string,
    eventType: string,
    allowed: boolean,
    reason?: string,
    correlationId?: string
  ): Promise<Receipt> {
    return this.record('allowlist_checked', {
      source,
      eventType,
      allowed,
      reason,
    }, { correlationId });
  }
  
  /**
   * Record normalization
   */
  async recordNormalized(
    source: string,
    originalType: string,
    normalizedType: string,
    correlationId: string
  ): Promise<Receipt> {
    return this.record('webhook_normalized', {
      source,
      originalType,
      normalizedType,
    }, { correlationId });
  }
  
  /**
   * Record event emission
   */
  async recordEventEmitted(
    eventType: string,
    eventId: string,
    correlationId: string
  ): Promise<Receipt> {
    return this.record('event_emitted', {
      eventType,
      eventId,
    }, { correlationId });
  }
  
  /**
   * Record work request creation
   */
  async recordWorkRequestCreated(
    requestId: string,
    role: string,
    correlationId: string
  ): Promise<Receipt> {
    return this.record('work_request_created', {
      requestId,
      role,
    }, { correlationId });
  }
  
  /**
   * Record duplicate detection
   */
  async recordDuplicateDetected(
    idempotencyKey: string,
    originalEventId: string,
    correlationId: string
  ): Promise<Receipt> {
    return this.record('duplicate_detected', {
      idempotencyKey,
      originalEventId,
    }, { correlationId });
  }
  
  /**
   * Get all receipts
   */
  getReceipts(): Receipt[] {
    return [...this.receipts];
  }
  
  /**
   * Get receipts by correlation ID
   */
  getByCorrelationId(correlationId: string): Receipt[] {
    return this.receipts.filter(r => r.correlationId === correlationId);
  }
  
  /**
   * Get receipts by kind
   */
  getByKind(kind: ReceiptKind): Receipt[] {
    return this.receipts.filter(r => r.kind === kind);
  }
  
  /**
   * Clear all receipts (for testing)
   */
  clear(): void {
    this.receipts = [];
  }
}

/**
 * Compute SHA-256 hash of payload
 */
function computePayloadHash(payload: Record<string, unknown>): string {
  // Canonicalize JSON (sorted keys)
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

/**
 * Create default receipt recorder
 */
export function createReceiptRecorder(): ReceiptRecorder {
  return new ReceiptRecorder();
}
