/**
 * Visual State types for agent avatar rendering.
 * Extracted from the private @allternit/visual-state package.
 */

export enum Mood {
  Idle = 'Idle',
  Focused = 'Focused',
  Thinking = 'Thinking',
  Uncertain = 'Uncertain',
  Celebrating = 'Celebrating',
  Warning = 'Warning',
  Error = 'Error',
  Listening = 'Listening',
  Speaking = 'Speaking',
  Sleeping = 'Sleeping',
  Confused = 'Confused',
}

export type IntensityLevel = number & { readonly __brand: unique symbol }; // 1-10 branded type

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface VisualState {
  mood: Mood;
  intensity: IntensityLevel;
  confidence: number;
  reliability: number;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryEvent {
  type: string;
  agentId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  error?: string;
  success?: boolean;
}

export function getMoodDisplayName(mood: Mood): string {
  return mood;
}

export function getMoodColor(mood: Mood): string {
  const colors: Record<Mood, string> = {
    [Mood.Idle]: 'var(--ui-text-muted)',
    [Mood.Focused]: 'var(--status-info)',
    [Mood.Thinking]: 'var(--ui-text-muted)',
    [Mood.Uncertain]: 'var(--status-warning)',
    [Mood.Celebrating]: 'var(--status-success)',
    [Mood.Warning]: 'var(--status-warning)',
    [Mood.Error]: 'var(--status-error)',
    [Mood.Listening]: '#06B6D4',
    [Mood.Speaking]: '#6366F1',
    [Mood.Sleeping]: 'var(--ui-text-muted)',
    [Mood.Confused]: '#F97316',
  };
  return colors[mood];
}

export function getAnimationSpeed(intensity: IntensityLevel): number {
  return 0.5 + (intensity / 10) * 1.5;
}

export function getGlowIntensity(confidence: number): number {
  return confidence * 20;
}
