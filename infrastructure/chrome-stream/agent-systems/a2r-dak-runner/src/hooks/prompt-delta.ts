/**
 * PromptDeltaNeeded Hook
 *
 * Implements SYSTEM_LAW.md LAW-AUT-005 (Prompt Delta Escape Hatch Rule)
 * 
 * Requirements:
 * - If blocked by missing context, emit PromptDeltaNeeded as structured request
 * - Continue with other READY nodes (never idle on missing context)
 * - Resume blocked WIH when delta is provided
 */

import { EventEmitter } from 'events';
import { RailsHttpAdapter } from '../adapters/rails_http';
import { DagId, NodeId, WihId, CorrelationId, ReceiptId } from '../types';

export type PromptDeltaReasonCode =
  | 'MISSING_INPUT'
  | 'AMBIGUOUS_REQUIREMENT'
  | 'PERMISSION_APPROVAL_REQUIRED'
  | 'OTHER';

export interface PromptDeltaRequest {
  type: 'PromptDeltaNeeded';
  dagId: DagId;
  nodeId: NodeId;
  wihId: WihId;
  reasonCode: PromptDeltaReasonCode;
  requestedFields: string[];
  correlationId: CorrelationId;
  context?: {
    currentPlan?: string;
    blockedAction?: string;
    additionalInfo?: string;
  };
}

export interface PromptDeltaResponse {
  deltaId: string;
  providedFields: Record<string, string>;
  resolvedAt: string;
}

export interface PromptDeltaEvent {
  request: PromptDeltaRequest;
  receiptId: ReceiptId;
  emittedAt: string;
  status: 'pending' | 'resolved' | 'timeout';
}

export class PromptDeltaHook extends EventEmitter {
  private rails: RailsHttpAdapter;
  private pendingDeltas: Map<string, PromptDeltaEvent>;

  constructor(rails: RailsHttpAdapter) {
    super();
    this.rails = rails;
    this.pendingDeltas = new Map();
  }

  /**
   * Emit PromptDeltaNeeded when blocked by missing context
   * 
   * LAW-AUT-005: If progress is blocked by missing context, the runner must emit 
   * PromptDeltaNeeded as a structured request and continue with other READY nodes.
   */
  async emitPromptDeltaNeeded(request: Omit<PromptDeltaRequest, 'type' | 'correlationId'>): Promise<ReceiptId> {
    const correlationId: CorrelationId = `corr_delta_${Date.now()}`;
    
    const fullRequest: PromptDeltaRequest = {
      type: 'PromptDeltaNeeded',
      dagId: request.dagId,
      nodeId: request.nodeId,
      wihId: request.wihId,
      reasonCode: request.reasonCode,
      requestedFields: request.requestedFields,
      correlationId,
      context: request.context,
    };

    // Create receipt
    const receiptId: ReceiptId = `rcpt_delta_${Date.now()}`;

    // Store pending delta
    const event: PromptDeltaEvent = {
      request: fullRequest,
      receiptId,
      emittedAt: new Date().toISOString(),
      status: 'pending',
    };

    this.pendingDeltas.set(correlationId, event);

    // Emit to Rails (in real implementation, this would call Rails API)
    // For now, emit event for handlers
    this.emit('delta:emitted', event);

    // Log the delta request
    console.log(`[PromptDelta] Emitted delta for WIH ${request.wihId}: ${request.reasonCode}`);
    console.log(`[PromptDelta] Requested fields: ${request.requestedFields.join(', ')}`);

    return receiptId;
  }

  /**
   * Mark a delta as resolved
   */
  resolveDelta(correlationId: CorrelationId, response: PromptDeltaResponse): void {
    const event = this.pendingDeltas.get(correlationId);
    if (!event) {
      this.emit('delta:error', {
        correlationId,
        error: 'Delta not found',
      });
      return;
    }

    event.status = 'resolved';
    this.emit('delta:resolved', {
      event,
      response,
    });

    // Remove from pending
    this.pendingDeltas.delete(correlationId);
  }

  /**
   * Mark a delta as timed out
   */
  timeoutDelta(correlationId: CorrelationId): void {
    const event = this.pendingDeltas.get(correlationId);
    if (!event) {
      return;
    }

    event.status = 'timeout';
    this.emit('delta:timeout', event);

    // Remove from pending
    this.pendingDeltas.delete(correlationId);
  }

  /**
   * Get pending deltas for a WIH
   */
  getPendingDeltasForWih(wihId: WihId): PromptDeltaEvent[] {
    return Array.from(this.pendingDeltas.values())
      .filter(event => event.request.wihId === wihId && event.status === 'pending');
  }

  /**
   * Get all pending deltas
   */
  getPendingDeltas(): PromptDeltaEvent[] {
    return Array.from(this.pendingDeltas.values())
      .filter(event => event.status === 'pending');
  }

  /**
   * Check if a WIH is blocked by pending deltas
   */
  isWihBlocked(wihId: WihId): boolean {
    const pending = this.getPendingDeltasForWih(wihId);
    return pending.length > 0;
  }

  /**
   * Create a structured delta request for common scenarios
   */
  static createMissingInputRequest(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    missingFields: string[],
    additionalInfo?: string
  ): Omit<PromptDeltaRequest, 'type' | 'correlationId'> {
    return {
      dagId,
      nodeId,
      wihId,
      reasonCode: 'MISSING_INPUT',
      requestedFields: missingFields,
      context: {
        additionalInfo,
      },
    };
  }

  /**
   * Create a structured delta request for ambiguous requirements
   */
  static createAmbiguousRequirementRequest(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    ambiguousFields: string[],
    currentPlan?: string
  ): Omit<PromptDeltaRequest, 'type' | 'correlationId'> {
    return {
      dagId,
      nodeId,
      wihId,
      reasonCode: 'AMBIGUOUS_REQUIREMENT',
      requestedFields: ambiguousFields,
      context: {
        currentPlan,
      },
    };
  }

  /**
   * Create a structured delta request for permission approval
   */
  static createPermissionApprovalRequest(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    blockedAction: string
  ): Omit<PromptDeltaRequest, 'type' | 'correlationId'> {
    return {
      dagId,
      nodeId,
      wihId,
      reasonCode: 'PERMISSION_APPROVAL_REQUIRED',
      requestedFields: ['approval_decision'],
      context: {
        blockedAction,
      },
    };
  }
}

// Factory function
export function createPromptDeltaHook(rails: RailsHttpAdapter): PromptDeltaHook {
  return new PromptDeltaHook(rails);
}
