/**
 * Visual State Types
 * 
 * Core types for agent visual state management and avatar rendering.
 */

// ============================================================================
// Enums
// ============================================================================

export enum Mood {
  IDLE = 'idle',
  THINKING = 'thinking',
  WORKING = 'working',
  CONFUSED = 'confused',
  EXCITED = 'excited',
  CONCERNED = 'concerned',
  CELEBRATING = 'celebrating',
  FOCUSED = 'focused',
  LISTENING = 'listening',
  SPEAKING = 'speaking',
}

export enum AvatarSize {
  XS = 'xs',
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl',
}

// ============================================================================
// Core Types
// ============================================================================

export type IntensityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface VisualState {
  mood: Mood;
  intensity: IntensityLevel;
  confidence: number;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface TelemetryEvent {
  agentId: string;
  type: 'llm_call' | 'llm_response' | 'user_message' | 'tool_call' | 'error' | 'warning' | 'success';
  taskId?: string;
  timestamp: Date;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MoodTransition {
  from: Mood;
  to: Mood;
  duration: number;
  easing?: string;
}

export interface VisualStateConfig {
  defaultMood: Mood;
  defaultIntensity: IntensityLevel;
  maxHistoryLength: number;
  transitionDuration: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getMoodDisplayName(mood: Mood): string {
  const displayNames: Record<Mood, string> = {
    [Mood.IDLE]: 'Idle',
    [Mood.THINKING]: 'Thinking',
    [Mood.WORKING]: 'Working',
    [Mood.CONFUSED]: 'Confused',
    [Mood.EXCITED]: 'Excited',
    [Mood.CONCERNED]: 'Concerned',
    [Mood.CELEBRATING]: 'Celebrating',
    [Mood.FOCUSED]: 'Focused',
    [Mood.LISTENING]: 'Listening',
    [Mood.SPEAKING]: 'Speaking',
  };
  return displayNames[mood] || mood;
}

export function getMoodColor(mood: Mood): string {
  const colors: Record<Mood, string> = {
    [Mood.IDLE]: '#9CA3AF',
    [Mood.THINKING]: '#60A5FA',
    [Mood.WORKING]: '#34D399',
    [Mood.CONFUSED]: '#FBBF24',
    [Mood.EXCITED]: '#F472B6',
    [Mood.CONCERNED]: '#F87171',
    [Mood.CELEBRATING]: '#A78BFA',
    [Mood.FOCUSED]: '#22D3EE',
    [Mood.LISTENING]: '#818CF8',
    [Mood.SPEAKING]: '#34D399',
  };
  return colors[mood] || colors[Mood.IDLE];
}

export function getAnimationSpeed(mood: Mood, intensity: IntensityLevel): number {
  const baseSpeeds: Record<Mood, number> = {
    [Mood.IDLE]: 1,
    [Mood.THINKING]: 0.8,
    [Mood.WORKING]: 1.2,
    [Mood.CONFUSED]: 0.5,
    [Mood.EXCITED]: 1.5,
    [Mood.CONCERNED]: 0.7,
    [Mood.CELEBRATING]: 1.8,
    [Mood.FOCUSED]: 0.9,
    [Mood.LISTENING]: 1,
    [Mood.SPEAKING]: 1.3,
  };
  const baseSpeed = baseSpeeds[mood] || 1;
  return baseSpeed * (0.5 + intensity * 0.2);
}

export function getGlowIntensity(mood: Mood, intensity: IntensityLevel): number {
  const baseIntensity: Record<Mood, number> = {
    [Mood.IDLE]: 0.2,
    [Mood.THINKING]: 0.4,
    [Mood.WORKING]: 0.5,
    [Mood.CONFUSED]: 0.3,
    [Mood.EXCITED]: 0.8,
    [Mood.CONCERNED]: 0.4,
    [Mood.CELEBRATING]: 0.9,
    [Mood.FOCUSED]: 0.5,
    [Mood.LISTENING]: 0.3,
    [Mood.SPEAKING]: 0.6,
  };
  const base = baseIntensity[mood] || 0.3;
  return Math.min(1, base * (intensity / 3));
}

export function createTelemetryEvent(
  agentId: string,
  type: TelemetryEvent['type'],
  options?: Omit<Partial<TelemetryEvent>, 'agentId' | 'type'>
): TelemetryEvent {
  return {
    agentId,
    type,
    timestamp: new Date(),
    ...options,
  };
}

export const DEFAULT_VISUAL_STATE_CONFIG: VisualStateConfig = {
  defaultMood: Mood.IDLE,
  defaultIntensity: 2,
  maxHistoryLength: 100,
  transitionDuration: 300,
};
