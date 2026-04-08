/**
 * Visual State Inference - Mood inference engine.
 * Extracted from the private @allternit/visual-state/inference package.
 */

import { Mood, type VisualState, type TelemetryEvent, type IntensityLevel } from '@/types/visual-state';

interface AgentState {
  currentState: VisualState;
  history: TelemetryEvent[];
}

export class MoodInferrer {
  private agentStates = new Map<string, AgentState>();

  infer(event: TelemetryEvent): VisualState {
    const agentState = this.getOrCreateAgentState(event.agentId);
    agentState.history.push(event);

    const mood = this.inferMood(event);
    const intensity = this.inferIntensity(event);

    const state: VisualState = {
      mood,
      intensity,
      confidence: this.inferConfidence(event),
      reliability: this.inferReliability(event),
      timestamp: event.timestamp,
      source: event.type,
      metadata: event.metadata,
    };

    agentState.currentState = state;
    return state;
  }

  getCurrentState(agentId: string): VisualState | undefined {
    return this.agentStates.get(agentId)?.currentState;
  }

  getHistory(agentId: string): TelemetryEvent[] {
    return this.agentStates.get(agentId)?.history ?? [];
  }

  clearHistory(agentId: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.history = [];
    }
  }

  private getOrCreateAgentState(agentId: string): AgentState {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, {
        currentState: {
          mood: Mood.Idle,
          intensity: 1 as IntensityLevel,
          confidence: 0.5,
          reliability: 0.5,
          timestamp: Date.now(),
          source: 'init',
        },
        history: [],
      });
    }
    return this.agentStates.get(agentId)!;
  }

  private inferMood(event: TelemetryEvent): Mood {
    if (event.error) {
      return Mood.Error;
    }

    switch (event.type) {
      case 'thinking':
      case 'reasoning':
        return Mood.Thinking;
      case 'speaking':
      case 'responding':
        return Mood.Speaking;
      case 'listening':
      case 'waiting':
        return Mood.Listening;
      case 'completed':
      case 'success':
        return Mood.Celebrating;
      case 'warning':
        return Mood.Warning;
      case 'uncertain':
      case 'clarifying':
        return Mood.Uncertain;
      case 'confused':
        return Mood.Confused;
      case 'idle':
      case 'sleep':
        return Mood.Sleeping;
      case 'focused':
      case 'working':
        return Mood.Focused;
      default:
        return Mood.Idle;
    }
  }

  private inferIntensity(event: TelemetryEvent): IntensityLevel {
    const metadata = event.metadata as Record<string, unknown> | undefined;
    const explicitIntensity = metadata?.intensity as number | undefined;
    if (explicitIntensity !== undefined) {
      return Math.max(1, Math.min(10, explicitIntensity)) as IntensityLevel;
    }

    // Infer from event type
    if (event.error) return 8 as IntensityLevel;
    if (event.type === 'thinking' || event.type === 'reasoning') return 6 as IntensityLevel;
    if (event.type === 'working' || event.type === 'focused') return 5 as IntensityLevel;
    if (event.type === 'idle' || event.type === 'sleep') return 1 as IntensityLevel;
    return 3 as IntensityLevel;
  }

  private inferConfidence(event: TelemetryEvent): number {
    if (event.error) return 0.1;
    if (event.success) return 0.9;
    return 0.5;
  }

  private inferReliability(event: TelemetryEvent): number {
    const metadata = event.metadata as Record<string, unknown> | undefined;
    const explicitReliability = metadata?.reliability as number | undefined;
    if (explicitReliability !== undefined) {
      return Math.max(0, Math.min(1, explicitReliability));
    }
    if (event.error) return 0.2;
    if (event.success) return 0.8;
    return 0.5;
  }
}

let singleton: MoodInferrer | undefined;

export function getMoodInferrer(): MoodInferrer {
  if (!singleton) {
    singleton = new MoodInferrer();
  }
  return singleton;
}
