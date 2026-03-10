/**
 * Escalation Handler
 * 
 * Handles escalation when agent chains are blocked.
 */

import type {
  EscalationRequest,
  EscalationResponse,
  EscalationHandlerConfig,
  EscalationReason,
} from './escalation-types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Escalation Handler Class
 */
export class EscalationHandler {
  private config: EscalationHandlerConfig;
  private escalations: Map<string, EscalationResponse>;

  constructor(config: Partial<EscalationHandlerConfig> = {}) {
    this.config = {
      defaultTarget: 'user',
      autoEscalateOnLoop: true,
      notifyOnEscalation: true,
      ...config,
    };
    
    this.escalations = new Map();
  }

  /**
   * Create and submit escalation
   */
  async escalate(request: EscalationRequest): Promise<EscalationResponse> {
    const escalationId = `esc_${uuidv4()}`;
    const createdAt = new Date().toISOString();

    const response: EscalationResponse = {
      escalationId,
      status: 'pending',
      createdAt,
      assignedTo: undefined,
      resolution: undefined,
      resolvedAt: undefined,
    };

    // Store escalation
    this.escalations.set(escalationId, response);

    // Log escalation
    console.log(`[EscalationHandler] Created escalation ${escalationId}`);
    console.log(`  Reason: ${request.reason}`);
    console.log(`  Target: ${request.target}`);
    console.log(`  Message: ${request.message}`);

    // Send notification if configured
    if (this.config.notifyOnEscalation) {
      await this.sendNotification(request, response);
    }

    // Send to webhook if configured
    if (this.config.webhookUrl) {
      await this.sendToWebhook(request, response);
    }

    return response;
  }

  /**
   * Create escalation from loop guard block
   */
  async escalateFromLoopGuard(
    correlationId: string,
    reason: string,
    hopCount: number,
    target: EscalationTarget = 'user'
  ): Promise<EscalationResponse> {
    const request: EscalationRequest = {
      correlationId,
      reason: 'MAX_HOPS_EXCEEDED',
      message: `Agent chain blocked: ${reason} (hops: ${hopCount})`,
      target,
      priority: 'medium',
      context: {
        hopCount,
        reason,
      },
    };

    return this.escalate(request);
  }

  /**
   * Acknowledge escalation
   */
  async acknowledge(escalationId: string, assignedTo: string): Promise<void> {
    const escalation = this.escalations.get(escalationId);
    
    if (!escalation) {
      throw new Error(`Escalation not found: ${escalationId}`);
    }

    escalation.status = 'acknowledged';
    escalation.assignedTo = assignedTo;

    console.log(`[EscalationHandler] Escalation ${escalationId} acknowledged by ${assignedTo}`);
  }

  /**
   * Resolve escalation
   */
  async resolve(
    escalationId: string,
    resolution: string
  ): Promise<void> {
    const escalation = this.escalations.get(escalationId);
    
    if (!escalation) {
      throw new Error(`Escalation not found: ${escalationId}`);
    }

    escalation.status = 'resolved';
    escalation.resolution = resolution;
    escalation.resolvedAt = new Date().toISOString();

    console.log(`[EscalationHandler] Escalation ${escalationId} resolved: ${resolution}`);
  }

  /**
   * Dismiss escalation
   */
  async dismiss(escalationId: string): Promise<void> {
    const escalation = this.escalations.get(escalationId);
    
    if (!escalation) {
      throw new Error(`Escalation not found: ${escalationId}`);
    }

    escalation.status = 'dismissed';
    escalation.resolvedAt = new Date().toISOString();

    console.log(`[EscalationHandler] Escalation ${escalationId} dismissed`);
  }

  /**
   * Get escalation by ID
   */
  get(escalationId: string): EscalationResponse | undefined {
    return this.escalations.get(escalationId);
  }

  /**
   * Get all pending escalations
   */
  getPending(): EscalationResponse[] {
    return Array.from(this.escalations.values())
      .filter(e => e.status === 'pending');
  }

  /**
   * Get all escalations
   */
  getAll(): EscalationResponse[] {
    return Array.from(this.escalations.values());
  }

  /**
   * Send notification (stub - implement with actual notification system)
   */
  private async sendNotification(
    request: EscalationRequest,
    response: EscalationResponse
  ): Promise<void> {
    // In production, would send email, Slack message, etc.
    console.log(`[EscalationHandler] Would send notification for ${response.escalationId}`);
  }

  /**
   * Send to webhook
   */
  private async sendToWebhook(
    request: EscalationRequest,
    response: EscalationResponse
  ): Promise<void> {
    if (!this.config.webhookUrl) {
      return;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalation: response,
          request,
        }),
      });
    } catch (error) {
      console.error('[EscalationHandler] Failed to send webhook:', error);
    }
  }

  /**
   * Clear all escalations (for testing)
   */
  clear(): void {
    this.escalations.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    pending: number;
    acknowledged: number;
    resolved: number;
    dismissed: number;
  } {
    const all = Array.from(this.escalations.values());
    
    return {
      total: all.length,
      pending: all.filter(e => e.status === 'pending').length,
      acknowledged: all.filter(e => e.status === 'acknowledged').length,
      resolved: all.filter(e => e.status === 'resolved').length,
      dismissed: all.filter(e => e.status === 'dismissed').length,
    };
  }
}

/**
 * Create escalation handler
 */
export function createEscalationHandler(
  config?: Partial<EscalationHandlerConfig>
): EscalationHandler {
  return new EscalationHandler(config);
}
