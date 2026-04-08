/**
 * Circuit Breaker
 * 
 * Rate limiting and abuse prevention for browser automation.
 * Prevents rapid-fire actions that could be malicious or accidental.
 */

export interface CircuitBreakerConfig {
  maxActionsPerMinute: number;
  maxActionsPerHour: number;
  cooldownAfterBurst: number; // ms
  consecutiveErrorThreshold: number;
  cooldownAfterErrors: number; // ms
}

interface ActionRecord {
  timestamp: number;
  type: string;
  success: boolean;
}

export interface CircuitState {
  actions: ActionRecord[];
  consecutiveErrors: number;
  lastActionTime: number;
  isCoolingDown: boolean;
  cooldownEndTime: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxActionsPerMinute: 30,
  maxActionsPerHour: 300,
  cooldownAfterBurst: 5000,
  consecutiveErrorThreshold: 5,
  cooldownAfterErrors: 10000,
};

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      actions: [],
      consecutiveErrors: 0,
      lastActionTime: 0,
      isCoolingDown: false,
      cooldownEndTime: 0,
    };
  }

  /**
   * Check if action is allowed
   */
  canExecute(): { allowed: boolean; reason?: string; waitMs?: number } {
    const now = Date.now();
    
    // Check cooldown
    if (this.state.isCoolingDown) {
      if (now < this.state.cooldownEndTime) {
        const waitMs = this.state.cooldownEndTime - now;
        return {
          allowed: false,
          reason: `Cooldown in effect. Please wait ${Math.ceil(waitMs / 1000)} seconds.`,
          waitMs,
        };
      }
      this.state.isCoolingDown = false;
    }

    // Clean old actions
    this.cleanOldActions(now);

    // Check rate limits
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    const actionsLastMinute = this.state.actions.filter(a => a.timestamp > oneMinuteAgo).length;
    const actionsLastHour = this.state.actions.filter(a => a.timestamp > oneHourAgo).length;

    if (actionsLastMinute >= this.config.maxActionsPerMinute) {
      this.triggerCooldown(this.config.cooldownAfterBurst);
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxActionsPerMinute} actions per minute`,
        waitMs: this.config.cooldownAfterBurst,
      };
    }

    if (actionsLastHour >= this.config.maxActionsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxActionsPerHour} actions per hour`,
        waitMs: 60000,
      };
    }

    return { allowed: true };
  }

  /**
   * Record an action
   */
  recordAction(type: string, success: boolean): void {
    const now = Date.now();
    
    this.state.actions.push({
      timestamp: now,
      type,
      success,
    });
    
    this.state.lastActionTime = now;

    // Track consecutive errors
    if (success) {
      this.state.consecutiveErrors = 0;
    } else {
      this.state.consecutiveErrors++;
      
      // Trigger cooldown if too many errors
      if (this.state.consecutiveErrors >= this.config.consecutiveErrorThreshold) {
        this.triggerCooldown(this.config.cooldownAfterErrors);
      }
    }

    // Clean old actions periodically
    if (this.state.actions.length > 100) {
      this.cleanOldActions(now);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): {
    actionsLastMinute: number;
    actionsLastHour: number;
    consecutiveErrors: number;
    isCoolingDown: boolean;
    cooldownRemainingMs: number;
  } {
    const now = Date.now();
    this.cleanOldActions(now);

    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    return {
      actionsLastMinute: this.state.actions.filter(a => a.timestamp > oneMinuteAgo).length,
      actionsLastHour: this.state.actions.filter(a => a.timestamp > oneHourAgo).length,
      consecutiveErrors: this.state.consecutiveErrors,
      isCoolingDown: this.state.isCoolingDown,
      cooldownRemainingMs: Math.max(0, this.state.cooldownEndTime - now),
    };
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state = {
      actions: [],
      consecutiveErrors: 0,
      lastActionTime: 0,
      isCoolingDown: false,
      cooldownEndTime: 0,
    };
  }

  /**
   * Force cooldown
   */
  forceCooldown(durationMs: number): void {
    this.triggerCooldown(durationMs);
  }

  private triggerCooldown(durationMs: number): void {
    this.state.isCoolingDown = true;
    this.state.cooldownEndTime = Date.now() + durationMs;
  }

  private cleanOldActions(now: number): void {
    const oneHourAgo = now - 3600000;
    this.state.actions = this.state.actions.filter(a => a.timestamp > oneHourAgo);
  }
}

// Global circuit breaker instance
let globalBreaker: CircuitBreaker | null = null;

export function getCircuitBreaker(): CircuitBreaker {
  if (!globalBreaker) {
    globalBreaker = new CircuitBreaker();
  }
  return globalBreaker;
}

export function resetCircuitBreaker(): void {
  globalBreaker = null;
}
