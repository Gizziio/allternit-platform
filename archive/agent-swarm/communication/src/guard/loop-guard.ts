/**
 * Loop Guard
 * 
 * Prevents runaway agent-to-agent communication chains.
 * Reverse engineered from agentchattr pattern, implemented for allternit.
 */

import type {
  LoopGuardConfig,
  LoopGuardResult,
  HopCounterState,
  HopEntry,
  CooldownEntry,
} from './guard-types.js';
import { DEFAULT_LOOP_GUARD_CONFIG } from './guard-types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Loop Guard Class
 */
export class LoopGuard {
  private config: LoopGuardConfig;
  private hopCounters: Map<string, HopCounterState>;
  private cooldowns: Map<string, CooldownEntry>;
  private loopHistory: Map<string, string[]>; // agent -> recent targets

  constructor(config: Partial<LoopGuardConfig> = {}) {
    this.config = {
      ...DEFAULT_LOOP_GUARD_CONFIG,
      ...config,
    };
    
    this.hopCounters = new Map();
    this.cooldowns = new Map();
    this.loopHistory = new Map();
  }

  /**
   * Check if agent-to-agent action is allowed
   */
  async check(
    sourceAgent: string,
    targetAgent: string,
    correlationId: string,
    isHuman: boolean = false
  ): Promise<LoopGuardResult> {
    // Human passthrough
    if (isHuman && this.config.humanPassthrough) {
      return { allowed: true };
    }

    // Check cooldown
    const cooldownResult = await this.checkCooldown(sourceAgent);
    if (!cooldownResult.allowed) {
      return cooldownResult;
    }

    // Check hop count
    const hopResult = await this.checkHopCount(correlationId);
    if (!hopResult.allowed) {
      return {
        ...hopResult,
        escalate: true,
        escalationTarget: this.config.escalationTarget,
      };
    }

    // Check for loops
    if (this.config.loopDetection) {
      const loopResult = await this.checkForLoop(sourceAgent, targetAgent);
      if (!loopResult.allowed) {
        return loopResult;
      }
    }

    return { allowed: true };
  }

  /**
   * Check cooldown for agent
   */
  private async checkCooldown(agentId: string): Promise<LoopGuardResult> {
    const entry = this.cooldowns.get(agentId);
    
    if (!entry) {
      return { allowed: true };
    }

    const now = Date.now();
    const lastTriggered = new Date(entry.lastTriggeredAt).getTime();
    const elapsed = now - lastTriggered;

    if (elapsed < this.config.cooldownMs) {
      const remaining = this.config.cooldownMs - elapsed;
      
      return {
        allowed: false,
        reason: `Agent in cooldown period (${Math.ceil(remaining / 1000)}s remaining)`,
        cooldownRemaining: remaining,
      };
    }

    return { allowed: true };
  }

  /**
   * Check hop count for correlation chain
   */
  private async checkHopCount(correlationId: string): Promise<LoopGuardResult> {
    let state = this.hopCounters.get(correlationId);

    if (!state) {
      // Initialize new counter
      state = {
        correlationId,
        count: 0,
        firstHopAt: new Date().toISOString(),
        lastHopAt: new Date().toISOString(),
        history: [],
      };
      this.hopCounters.set(correlationId, state);
    }

    // Check if max hops exceeded
    if (state.count >= this.config.maxAgentHops) {
      return {
        allowed: false,
        reason: `Maximum agent hops exceeded (${state.count}/${this.config.maxAgentHops})`,
        hopCount: state.count,
      };
    }

    return {
      allowed: true,
      hopCount: state.count,
    };
  }

  /**
   * Check for communication loops
   */
  private async checkForLoop(
    sourceAgent: string,
    targetAgent: string
  ): Promise<LoopGuardResult> {
    let history = this.loopHistory.get(sourceAgent);

    if (!history) {
      history = [];
      this.loopHistory.set(sourceAgent, history);
    }

    // Add current target
    history.push(targetAgent);

    // Trim to window
    const windowStart = Date.now() - this.config.loopWindowMs;
    // Keep only recent entries (simplified - in production would use timestamps)
    while (history.length > 10) {
      history.shift();
    }

    // Check for loop pattern (same target twice in recent history)
    const targetCount = history.filter(t => t === targetAgent).length;
    
    if (targetCount >= 2) {
      return {
        allowed: false,
        reason: `Potential loop detected: ${sourceAgent} -> ${targetAgent} (${targetCount} times in window)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a hop (call after successful action)
   */
  async recordHop(
    correlationId: string,
    sourceAgent: string,
    targetAgent: string,
    action: string
  ): Promise<void> {
    // Update hop counter
    let state = this.hopCounters.get(correlationId);
    
    if (!state) {
      state = {
        correlationId,
        count: 0,
        firstHopAt: new Date().toISOString(),
        lastHopAt: new Date().toISOString(),
        history: [],
      };
      this.hopCounters.set(correlationId, state);
    }

    state.count++;
    state.lastHopAt = new Date().toISOString();
    state.history.push({
      timestamp: state.lastHopAt,
      sourceAgent,
      targetAgent,
      action,
    });

    // Update cooldown
    const cooldownEntry: CooldownEntry = {
      agentId: sourceAgent,
      lastTriggeredAt: new Date().toISOString(),
      triggerCount: (this.cooldowns.get(sourceAgent)?.triggerCount || 0) + 1,
    };
    this.cooldowns.set(sourceAgent, cooldownEntry);
  }

  /**
   * Reset hop counter for correlation ID
   */
  reset(correlationId: string): void {
    this.hopCounters.delete(correlationId);
  }

  /**
   * Get current hop count for correlation ID
   */
  getHopCount(correlationId: string): number {
    const state = this.hopCounters.get(correlationId);
    return state?.count || 0;
  }

  /**
   * Get hop history for correlation ID
   */
  getHopHistory(correlationId: string): HopEntry[] {
    const state = this.hopCounters.get(correlationId);
    return state?.history || [];
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.hopCounters.clear();
    this.cooldowns.clear();
    this.loopHistory.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoopGuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeChains: number;
    agentsOnCooldown: number;
    totalHops: number;
  } {
    const totalHops = Array.from(this.hopCounters.values())
      .reduce((sum, state) => sum + state.count, 0);

    return {
      activeChains: this.hopCounters.size,
      agentsOnCooldown: this.cooldowns.size,
      totalHops,
    };
  }
}

/**
 * Create loop guard with default config
 */
export function createLoopGuard(config?: Partial<LoopGuardConfig>): LoopGuard {
  return new LoopGuard(config);
}
