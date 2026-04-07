/**
 * Mood Inferrer
 * 
 * Infers visual state from telemetry events using configurable rules.
 */

import {
  Mood,
  VisualState,
  TelemetryEvent,
  MoodRule,
  VisualStateHistoryEntry,
} from '../types';
import { findMatchingRule, defaultMoodRules } from './rules';
import { calculateConfidence, calculateReliability } from './confidence-calculator';

export interface MoodInferrerConfig {
  /** Custom rules to use (defaults to defaultMoodRules) */
  rules?: MoodRule[];
  /** Enable mood transition smoothing */
  enableSmoothing?: boolean;
  /** Smoothing factor (0-1, higher = smoother) */
  smoothingFactor?: number;
  /** Minimum time between state updates (ms) */
  minUpdateInterval?: number;
  /** Maximum history entries to keep per agent */
  maxHistoryEntries?: number;
}

export interface InferredState {
  state: VisualState;
  rule: MoodRule;
  smoothed: boolean;
}

/**
 * Mood Inferrer - converts telemetry events to visual states
 */
export class MoodInferrer {
  private config: Required<MoodInferrerConfig>;
  private history: Map<string, VisualStateHistoryEntry[]> = new Map();
  private lastUpdate: Map<string, number> = new Map();
  private taskSuccessCounts: Map<string, { success: number; total: number }> = new Map();

  constructor(config: MoodInferrerConfig = {}) {
    this.config = {
      rules: config.rules || defaultMoodRules,
      enableSmoothing: config.enableSmoothing ?? true,
      smoothingFactor: config.smoothingFactor ?? 0.3,
      minUpdateInterval: config.minUpdateInterval ?? 100,
      maxHistoryEntries: config.maxHistoryEntries ?? 100,
    };
  }

  /**
   * Infer visual state from telemetry event
   */
  infer(event: TelemetryEvent): InferredState | null {
    const { agentId } = event;
    
    // Check minimum update interval
    const now = Date.now();
    const lastUpdate = this.lastUpdate.get(agentId) || 0;
    if (now - lastUpdate < this.config.minUpdateInterval) {
      return null;
    }

    // Find matching rule
    const rule = findMatchingRule(event, this.config.rules);
    if (!rule) {
      return null;
    }

    // Track task outcomes for confidence calculation
    this.trackTaskOutcome(event);

    // Calculate metrics
    const confidence = rule.then.confidence ?? this.calculateAgentConfidence(agentId);
    const reliability = calculateReliability(this.getAgentHistory(agentId));

    // Create new state
    const newState: VisualState = {
      mood: rule.then.mood,
      intensity: rule.then.intensity,
      confidence,
      reliability,
      timestamp: event.timestamp,
      source: event.type,
      metadata: event.metadata,
    };

    // Apply smoothing if enabled
    let smoothed = false;
    if (this.config.enableSmoothing) {
      const smoothedState = this.applySmoothing(agentId, newState);
      if (smoothedState) {
        smoothed = true;
        Object.assign(newState, smoothedState);
      }
    }

    // Store in history
    this.addToHistory(agentId, newState, event);
    this.lastUpdate.set(agentId, now);

    return {
      state: newState,
      rule,
      smoothed,
    };
  }

  /**
   * Get current visual state for an agent
   */
  getCurrentState(agentId: string): VisualState | undefined {
    const history = this.history.get(agentId);
    return history?.[history.length - 1]?.state;
  }

  /**
   * Get visual state history for an agent
   */
  getHistory(agentId: string): VisualStateHistoryEntry[] {
    return this.history.get(agentId) || [];
  }

  /**
   * Clear history for an agent
   */
  clearHistory(agentId: string): void {
    this.history.delete(agentId);
    this.lastUpdate.delete(agentId);
    this.taskSuccessCounts.delete(agentId);
  }

  /**
   * Get all agent IDs with history
   */
  getAgentIds(): string[] {
    return Array.from(this.history.keys());
  }

  /**
   * Update inferrer rules
   */
  updateRules(rules: MoodRule[]): void {
    this.config.rules = rules;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private trackTaskOutcome(event: TelemetryEvent): void {
    const { agentId, type, success } = event;
    
    if (type === 'task_start') {
      // Initialize tracking
      const counts = this.taskSuccessCounts.get(agentId) || { success: 0, total: 0 };
      this.taskSuccessCounts.set(agentId, counts);
    } else if (type === 'task_complete' || type === 'task_error') {
      const counts = this.taskSuccessCounts.get(agentId) || { success: 0, total: 0 };
      counts.total++;
      if (success) {
        counts.success++;
      }
      this.taskSuccessCounts.set(agentId, counts);
    }
  }

  private calculateAgentConfidence(agentId: string): number {
    const counts = this.taskSuccessCounts.get(agentId);
    if (!counts || counts.total === 0) {
      return 0.5; // Default neutral confidence
    }
    return counts.success / counts.total;
  }

  private getAgentHistory(agentId: string): VisualStateHistoryEntry[] {
    return this.history.get(agentId) || [];
  }

  private addToHistory(
    agentId: string,
    state: VisualState,
    triggeredBy: TelemetryEvent
  ): void {
    let agentHistory = this.history.get(agentId);
    if (!agentHistory) {
      agentHistory = [];
      this.history.set(agentId, agentHistory);
    }

    agentHistory.push({ state, triggeredBy });

    // Trim history if needed
    if (agentHistory.length > this.config.maxHistoryEntries) {
      agentHistory.shift();
    }
  }

  private applySmoothing(agentId: string, newState: VisualState): Partial<VisualState> | null {
    const currentState = this.getCurrentState(agentId);
    if (!currentState) {
      return null;
    }

    const factor = this.config.smoothingFactor;
    const changes: Partial<VisualState> = {};

    // Smooth intensity
    if (newState.intensity !== currentState.intensity) {
      changes.intensity = Math.round(
        currentState.intensity * factor + newState.intensity * (1 - factor)
      ) as any;
    }

    // Smooth confidence
    if (Math.abs(newState.confidence - currentState.confidence) > 0.1) {
      changes.confidence = 
        currentState.confidence * factor + newState.confidence * (1 - factor);
    }

    // Don't smooth mood - it should change immediately for responsiveness
    // But we could add mood transition delay here if needed

    return Object.keys(changes).length > 0 ? changes : null;
  }
}

/**
 * Create a global mood inferrer instance
 */
let globalInferrer: MoodInferrer | null = null;

export function getMoodInferrer(config?: MoodInferrerConfig): MoodInferrer {
  if (!globalInferrer) {
    globalInferrer = new MoodInferrer(config);
  }
  return globalInferrer;
}

export function resetMoodInferrer(): void {
  globalInferrer = null;
}
