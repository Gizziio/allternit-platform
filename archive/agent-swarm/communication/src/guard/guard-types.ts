/**
 * Loop Guard Types
 */

/**
 * Loop guard configuration
 */
export interface LoopGuardConfig {
  /** Maximum agent-to-agent hops before escalation */
  maxAgentHops: number;
  /** Cooldown period between agent triggers (ms) */
  cooldownMs: number;
  /** Enable human passthrough (humans bypass loop guard) */
  humanPassthrough: boolean;
  /** Enable loop detection */
  loopDetection: boolean;
  /** Maximum loop window (ms) */
  loopWindowMs: number;
  /** Escalation target */
  escalationTarget: 'user' | 'human' | 'security';
}

/**
 * Hop counter state
 */
export interface HopCounterState {
  /** Correlation ID */
  correlationId: string;
  /** Current hop count */
  count: number;
  /** First hop timestamp */
  firstHopAt: string;
  /** Last hop timestamp */
  lastHopAt: string;
  /** Hop history */
  history: HopEntry[];
}

/**
 * Hop entry
 */
export interface HopEntry {
  /** Timestamp */
  timestamp: string;
  /** Source agent */
  sourceAgent: string;
  /** Target agent */
  targetAgent: string;
  /** Action triggered */
  action: string;
}

/**
 * Loop guard check result
 */
export interface LoopGuardResult {
  /** Whether action is allowed */
  allowed: boolean;
  /** Reason if blocked */
  reason?: string;
  /** Current hop count */
  hopCount?: number;
  /** Whether to escalate */
  escalate?: boolean;
  /** Escalation target */
  escalationTarget?: string;
  /** Cooldown remaining (ms) */
  cooldownRemaining?: number;
}

/**
 * Cooldown tracker entry
 */
export interface CooldownEntry {
  /** Agent ID */
  agentId: string;
  /** Last trigger timestamp */
  lastTriggeredAt: string;
  /** Trigger count in window */
  triggerCount: number;
}

/**
 * Default loop guard configuration
 */
export const DEFAULT_LOOP_GUARD_CONFIG: LoopGuardConfig = {
  maxAgentHops: 4,
  cooldownMs: 5000, // 5 seconds
  humanPassthrough: true,
  loopDetection: true,
  loopWindowMs: 60000, // 1 minute
  escalationTarget: 'user',
};
