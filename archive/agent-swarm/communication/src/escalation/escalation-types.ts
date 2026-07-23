/**
 * Escalation Handler Types
 */

/**
 * Escalation reason codes
 */
export type EscalationReason =
  | 'MAX_HOPS_EXCEEDED'
  | 'LOOP_DETECTED'
  | 'COOLDOWN_VIOLATION'
  | 'GATE_DENIED'
  | 'TEST_FAILURE'
  | 'POLICY_BLOCK'
  | 'AMBIGUOUS_REQUIREMENT'
  | 'MISSING_INPUT'
  | 'OTHER';

/**
 * Escalation target
 */
export type EscalationTarget = 'user' | 'human' | 'security' | 'admin';

/**
 * Escalation request
 */
export interface EscalationRequest {
  /** Correlation ID */
  correlationId: string;
  /** DAG ID */
  dagId?: string;
  /** Node ID */
  nodeId?: string;
  /** WIH ID */
  wihId?: string;
  /** Reason code */
  reason: EscalationReason;
  /** Human-readable message */
  message: string;
  /** Context data */
  context?: Record<string, unknown>;
  /** Hop history */
  hopHistory?: Array<{
    timestamp: string;
    sourceAgent: string;
    targetAgent: string;
    action: string;
  }>;
  /** Target for escalation */
  target: EscalationTarget;
  /** Priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Escalation response
 */
export interface EscalationResponse {
  /** Escalation ID */
  escalationId: string;
  /** Status */
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  /** Created timestamp */
  createdAt: string;
  /** Assigned to */
  assignedTo?: string;
  /** Resolution notes */
  resolution?: string;
  /** Resolved timestamp */
  resolvedAt?: string;
}

/**
 * Escalation handler configuration
 */
export interface EscalationHandlerConfig {
  /** Default escalation target */
  defaultTarget: EscalationTarget;
  /** Auto-escalate on loop detection */
  autoEscalateOnLoop: boolean;
  /** Notify on escalation */
  notifyOnEscalation: boolean;
  /** Escalation webhook URL */
  webhookUrl?: string;
}
