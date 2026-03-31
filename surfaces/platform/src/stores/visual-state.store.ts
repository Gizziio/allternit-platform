/**
 * Visual State Store
 *
 * Manages agent visual state (mood, intensity, confidence) for avatar rendering.
 * Connects telemetry events to visual state updates.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { VisualState, TelemetryEvent, IntensityLevel } from '@allternit/visual-state/types';
import { Mood } from '@allternit/visual-state/types';
import { getMoodDisplayName } from '@allternit/visual-state/types';

// ============================================================================
// Store State
// ============================================================================

export interface VisualStateStoreState {
  /** Current visual states by agent ID */
  states: Map<string, VisualState>;
  
  /** Visual state history by agent ID */
  history: Map<string, VisualStateHistoryEntry[]>;
  
  /** Set visual state for an agent */
  setState: (agentId: string, newState: VisualState, triggeredBy?: TelemetryEvent) => void;
  
  /** Process telemetry event and update visual state */
  processTelemetry: (event: TelemetryEvent) => void;
  
  /** Get current state for an agent */
  getState: (agentId: string) => VisualState | undefined;
  
  /** Get history for an agent */
  getHistory: (agentId: string) => VisualStateHistoryEntry[];
  
  /** Clear state for an agent */
  clearState: (agentId: string) => void;
  
  /** Clear all states */
  clearAll: () => void;
}

export interface VisualStateHistoryEntry {
  state: VisualState;
  timestamp: Date;
  triggeredBy?: TelemetryEvent;
}

// ============================================================================
// Telemetry to Mood Mapping Rules
// ============================================================================

interface MoodRule {
  match: (event: TelemetryEvent) => boolean;
  getMood: (event: TelemetryEvent) => { mood: Mood; intensity: IntensityLevel; confidence?: number };
  priority: number;
}

const moodRules: MoodRule[] = [
  // Error events - highest priority
  {
    match: (event) => event.type === 'task_error' || event.error !== undefined,
    getMood: (event) => ({
      mood: Mood.Error,
      intensity: 8 as IntensityLevel,
      confidence: 0.2,
    }),
    priority: 100,
  },
  
  // Task completion
  {
    match: (event) => event.type === 'task_complete' && event.success === true,
    getMood: (event) => ({
      mood: Mood.Celebrating,
      intensity: 9 as IntensityLevel,
      confidence: 0.95,
    }),
    priority: 90,
  },
  
  // Task completion with failure
  {
    match: (event) => event.type === 'task_complete' && event.success === false,
    getMood: (event) => ({
      mood: Mood.Warning,
      intensity: 6 as IntensityLevel,
      confidence: 0.5,
    }),
    priority: 85,
  },
  
  // LLM response received
  {
    match: (event) => event.type === 'llm_response',
    getMood: (event) => ({
      mood: Mood.Speaking,
      intensity: 7 as IntensityLevel,
      confidence: 0.85,
    }),
    priority: 80,
  },
  
  // LLM call in progress
  {
    match: (event) => event.type === 'llm_call',
    getMood: (event) => ({
      mood: Mood.Thinking,
      intensity: 8 as IntensityLevel,
      confidence: 0.7,
    }),
    priority: 75,
  },
  
  // Tool invocation
  {
    match: (event) => event.type === 'tool_invoke',
    getMood: (event) => ({
      mood: Mood.Focused,
      intensity: 7 as IntensityLevel,
      confidence: 0.8,
    }),
    priority: 70,
  },
  
  // Tool result received
  {
    match: (event) => event.type === 'tool_result',
    getMood: (event) => ({
      mood: Mood.Focused,
      intensity: 6 as IntensityLevel,
      confidence: 0.85,
    }),
    priority: 65,
  },
  
  // User message received
  {
    match: (event) => event.type === 'user_message',
    getMood: (event) => ({
      mood: Mood.Listening,
      intensity: 8 as IntensityLevel,
      confidence: 0.9,
    }),
    priority: 60,
  },
  
  // System message
  {
    match: (event) => event.type === 'system_message',
    getMood: (event) => ({
      mood: Mood.Idle,
      intensity: 3 as IntensityLevel,
      confidence: 1.0,
    }),
    priority: 50,
  },
  
  // Waiting state
  {
    match: (event) => event.type === 'waiting',
    getMood: (event) => ({
      mood: Mood.Uncertain,
      intensity: 4 as IntensityLevel,
      confidence: 0.5,
    }),
    priority: 40,
  },
  
  // Task start
  {
    match: (event) => event.type === 'task_start',
    getMood: (event) => ({
      mood: Mood.Focused,
      intensity: 6 as IntensityLevel,
      confidence: 0.75,
    }),
    priority: 30,
  },
  
  // Idle state - lowest priority
  {
    match: () => true,
    getMood: () => ({
      mood: Mood.Idle,
      intensity: 2 as IntensityLevel,
      confidence: 1.0,
    }),
    priority: 0,
  },
];

// ============================================================================
// Store Implementation
// ============================================================================

const MAX_HISTORY_LENGTH = 50;

export const useVisualStateStore = create<VisualStateStoreState>()(
  subscribeWithSelector((set, get) => ({
    states: new Map<string, VisualState>(),
    history: new Map<string, VisualStateHistoryEntry[]>(),
    
    setState: (agentId, newState, triggeredBy) => {
      set((storeState) => {
        const newStates = new Map(storeState.states);
        newStates.set(agentId, newState);
        
        // Add to history
        const newHistory = new Map(storeState.history);
        const agentHistory = newHistory.get(agentId) || [];
        const historyEntry: VisualStateHistoryEntry = {
          state: newState,
          timestamp: new Date(),
          triggeredBy,
        };
        agentHistory.unshift(historyEntry);
        if (agentHistory.length > MAX_HISTORY_LENGTH) {
          agentHistory.pop();
        }
        newHistory.set(agentId, agentHistory);
        
        return {
          states: newStates,
          history: newHistory,
        };
      });
    },
    
    processTelemetry: (event) => {
      const { agentId } = event;
      
      // Find matching rule (highest priority first)
      const sortedRules = [...moodRules].sort((a, b) => b.priority - a.priority);
      const matchingRule = sortedRules.find((rule) => rule.match(event));
      
      if (!matchingRule) return;
      
      const { mood, intensity, confidence } = matchingRule.getMood(event);
      
      const currentState = get().states.get(agentId);
      const previousState = currentState;
      
      const newState: VisualState = {
        mood,
        intensity,
        confidence: confidence ?? currentState?.confidence ?? 1.0,
        reliability: currentState?.reliability ?? 1.0,
        timestamp: new Date(),
        source: event.type,
        metadata: event.metadata,
      };
      
      // Update reliability based on error rate
      if (event.type === 'task_error') {
        newState.reliability = Math.max(0, (currentState?.reliability ?? 1.0) - 0.1);
      } else if (event.type === 'task_complete' && event.success === true) {
        newState.reliability = Math.min(1.0, (currentState?.reliability ?? 0.5) + 0.05);
      }
      
      // Set the new state
      get().setState(agentId, newState);
      
      // Log state transition
      console.log(`[VisualState] Agent ${agentId}: ${previousState?.mood ?? 'init'} → ${mood} (${intensity}/10)`);
    },
    
    getState: (agentId) => {
      return get().states.get(agentId);
    },
    
    getHistory: (agentId) => {
      return get().history.get(agentId) || [];
    },
    
    clearState: (agentId) => {
      set((state) => {
        const newStates = new Map(state.states);
        newStates.delete(agentId);
        
        const newHistory = new Map(state.history);
        newHistory.delete(agentId);
        
        return {
          states: newStates,
          history: newHistory,
        };
      });
    },
    
    clearAll: () => {
      set({
        states: new Map<string, VisualState>(),
        history: new Map<string, VisualStateHistoryEntry[]>(),
      });
    },
  }))
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a telemetry event from agent action
 */
export function createTelemetryEvent(
  agentId: string,
  type: TelemetryEvent['type'],
  options?: Partial<Omit<TelemetryEvent, 'type' | 'agentId' | 'timestamp'>>
): TelemetryEvent {
  return {
    type,
    agentId,
    timestamp: new Date(),
    ...options,
  };
}

/**
 * Get display text for current agent state
 */
export function getAgentStateDisplay(state: VisualState | undefined): string {
  if (!state) return 'Agent ready';
  
  const moodName = getMoodDisplayName(state.mood);
  const intensityText = `${state.intensity}/10`;
  const confidenceText = `${Math.round(state.confidence * 100)}%`;
  
  return `${moodName} • ${intensityText} • ${confidenceText}`;
}

/**
 * Subscribe to agent state changes
 */
export function subscribeToAgentState(
  agentId: string,
  callback: (state: VisualState | undefined) => void
): () => void {
  return useVisualStateStore.subscribe(
    (state) => state.states.get(agentId),
    callback
  );
}
