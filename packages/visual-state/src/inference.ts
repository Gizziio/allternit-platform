/**
 * Visual State Inference
 * 
 * Logic for inferring visual state from telemetry events and context.
 */

import { Mood, type VisualState, type TelemetryEvent, type IntensityLevel } from './types';

export interface MoodInferenceContext {
  recentEvents?: TelemetryEvent[];
  currentState?: VisualState;
  messageCount?: number;
  errorCount?: number;
  lastResponseTime?: number;
}

export interface MoodInferrer {
  inferFromEvent(event: TelemetryEvent, context?: MoodInferenceContext): Mood;
  inferIntensity(event: TelemetryEvent, mood: Mood, context?: MoodInferenceContext): IntensityLevel;
  inferVisualState(event: TelemetryEvent, context?: MoodInferenceContext): VisualState;
}

class DefaultMoodInferrer implements MoodInferrer {
  inferFromEvent(event: TelemetryEvent, context?: MoodInferenceContext): Mood {
    switch (event.type) {
      case 'llm_call':
        return Mood.THINKING;
      
      case 'llm_response':
        if (event.success === false) {
          return Mood.CONCERNED;
        }
        return context?.recentEvents?.some(e => e.type === 'tool_call') 
          ? Mood.WORKING 
          : Mood.FOCUSED;
      
      case 'user_message':
        return Mood.LISTENING;
      
      case 'tool_call':
        return Mood.WORKING;
      
      case 'error':
        return Mood.CONFUSED;
      
      case 'warning':
        return Mood.CONCERNED;
      
      case 'success':
        return Mood.CELEBRATING;
      
      default:
        return Mood.IDLE;
    }
  }

  inferIntensity(event: TelemetryEvent, mood: Mood, context?: MoodInferenceContext): IntensityLevel {
    const baseIntensity: IntensityLevel = 2;
    
    // Adjust based on event type
    switch (event.type) {
      case 'error':
        return Math.min(5, baseIntensity + 2) as IntensityLevel;
      
      case 'success':
        return Math.min(5, baseIntensity + 1) as IntensityLevel;
      
      case 'llm_call':
        // Higher intensity if there have been recent errors
        if (context?.errorCount && context.errorCount > 0) {
          return Math.min(5, baseIntensity + 1) as IntensityLevel;
        }
        return baseIntensity;
      
      default:
        return baseIntensity;
    }
  }

  inferVisualState(event: TelemetryEvent, context?: MoodInferenceContext): VisualState {
    const mood = this.inferFromEvent(event, context);
    const intensity = this.inferIntensity(event, mood, context);
    
    return {
      mood,
      intensity,
      confidence: this.calculateConfidence(event, context),
      timestamp: new Date(),
    };
  }

  private calculateConfidence(event: TelemetryEvent, context?: MoodInferenceContext): number {
    let confidence = 0.8;
    
    // Higher confidence if we have context
    if (context?.recentEvents && context.recentEvents.length > 0) {
      confidence += 0.1;
    }
    
    // Lower confidence for error states
    if (event.type === 'error') {
      confidence -= 0.2;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}

// Singleton instance
let globalInferrer: MoodInferrer | null = null;

export function getMoodInferrer(): MoodInferrer {
  if (!globalInferrer) {
    globalInferrer = new DefaultMoodInferrer();
  }
  return globalInferrer;
}

export function setMoodInferrer(inferrer: MoodInferrer): void {
  globalInferrer = inferrer;
}

export function inferMoodFromEvent(
  event: TelemetryEvent, 
  context?: MoodInferenceContext
): Mood {
  return getMoodInferrer().inferFromEvent(event, context);
}

export function inferIntensityFromEvent(
  event: TelemetryEvent,
  mood: Mood,
  context?: MoodInferenceContext
): IntensityLevel {
  return getMoodInferrer().inferIntensity(event, mood, context);
}

export function createVisualStateFromEvent(
  event: TelemetryEvent,
  context?: MoodInferenceContext
): VisualState {
  return getMoodInferrer().inferVisualState(event, context);
}
