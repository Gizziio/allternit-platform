/**
 * A2R Visual State Protocol (AVSP) Types
 * 
 * Defines the core types for agent mood, intensity, and confidence visualization.
 */

/**
 * Agent mood states - represents the current emotional/operational state
 */
export enum Mood {
  /** Agent is idle, waiting for input */
  Idle = 'idle',
  /** Agent is focused on a task */
  Focused = 'focused',
  /** Agent is processing/thinking */
  Thinking = 'thinking',
  /** Agent is uncertain about something */
  Uncertain = 'uncertain',
  /** Agent successfully completed something */
  Celebrating = 'celebrating',
  /** Agent is warning about something */
  Warning = 'warning',
  /** Agent encountered an error */
  Error = 'error',
  /** Agent is listening to user input */
  Listening = 'listening',
  /** Agent is speaking/providing output */
  Speaking = 'speaking',
  /** Agent is sleeping/inactive */
  Sleeping = 'sleeping',
  /** Agent is confused */
  Confused = 'confused',
}

/**
 * Intensity level - 1-10 scale representing the strength of the mood
 */
export type IntensityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Visual state - complete state representation for avatar rendering
 */
export interface VisualState {
  /** Current mood */
  mood: Mood;
  /** Intensity of the mood (1-10) */
  intensity: IntensityLevel;
  /** Confidence in current action (0-1) */
  confidence: number;
  /** Reliability score based on error rates (0-1) */
  reliability: number;
  /** Timestamp of state generation */
  timestamp: Date;
  /** Source component that generated this state */
  source: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AVSP Message - protocol message for state updates
 */
export interface AVSPMessage {
  /** Message version */
  version: '1.0';
  /** Agent ID */
  agentId: string;
  /** Visual state */
  state: VisualState;
  /** Previous state (for transition tracking) */
  previousState?: VisualState;
  /** Transition duration in ms */
  transitionMs?: number;
}

/**
 * Telemetry event - input for mood inference
 */
export interface TelemetryEvent {
  /** Event type */
  type: TelemetryEventType;
  /** Agent ID */
  agentId: string;
  /** Task ID if applicable */
  taskId?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Success status for completion events */
  success?: boolean;
  /** Error details for error events */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Telemetry event types
 */
export type TelemetryEventType = 
  | 'task_start'
  | 'task_complete'
  | 'task_error'
  | 'thinking'
  | 'waiting'
  | 'listening'
  | 'speaking'
  | 'idle'
  | 'tool_invoke'
  | 'tool_result'
  | 'llm_call'
  | 'llm_response'
  | 'user_message'
  | 'system_message';

/**
 * Mood rule for inference
 */
export interface MoodRule {
  /** Condition to match */
  when: {
    type?: TelemetryEventType;
    success?: boolean;
    error?: boolean;
  };
  /** Resulting mood and intensity */
  then: {
    mood: Mood;
    intensity: IntensityLevel;
    confidence?: number;
  };
  /** Rule priority (higher = more specific) */
  priority?: number;
}

/**
 * Avatar size options
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Avatar adapter interface
 */
export interface AvatarAdapter {
  /** Adapter name */
  name: string;
  /** Render function */
  render: (state: VisualState, size: AvatarSize) => React.ReactNode;
  /** Supported moods */
  supportedMoods: Mood[];
  /** Whether adapter supports intensity */
  supportsIntensity: boolean;
  /** Whether adapter supports confidence display */
  supportsConfidence: boolean;
}

/**
 * Visual state history entry
 */
export interface VisualStateHistoryEntry {
  state: VisualState;
  triggeredBy: TelemetryEvent;
}

/**
 * Visual state store
 */
export interface VisualStateStore {
  /** Current state by agent ID */
  states: Map<string, VisualState>;
  /** History by agent ID */
  history: Map<string, VisualStateHistoryEntry[]>;
  /** Get current state for agent */
  getState(agentId: string): VisualState | undefined;
  /** Set state for agent */
  setState(agentId: string, state: VisualState, triggeredBy: TelemetryEvent): void;
  /** Get history for agent */
  getHistory(agentId: string): VisualStateHistoryEntry[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get CSS color for a mood
 */
export function getMoodColor(mood: Mood): string {
  const colors: Record<Mood, string> = {
    [Mood.Idle]: '#9E9E9E',
    [Mood.Focused]: '#2196F3',
    [Mood.Thinking]: '#FF9800',
    [Mood.Uncertain]: '#FFC107',
    [Mood.Celebrating]: '#4CAF50',
    [Mood.Warning]: '#FF5722',
    [Mood.Error]: '#F44336',
    [Mood.Listening]: '#9C27B0',
    [Mood.Speaking]: '#00BCD4',
    [Mood.Sleeping]: '#607D8B',
    [Mood.Confused]: '#795548',
  };
  return colors[mood] || '#9E9E9E';
}

/**
 * Get display name for mood
 */
export function getMoodDisplayName(mood: Mood): string {
  const names: Record<Mood, string> = {
    [Mood.Idle]: 'Idle',
    [Mood.Focused]: 'Focused',
    [Mood.Thinking]: 'Thinking',
    [Mood.Uncertain]: 'Uncertain',
    [Mood.Celebrating]: 'Celebrating',
    [Mood.Warning]: 'Warning',
    [Mood.Error]: 'Error',
    [Mood.Listening]: 'Listening',
    [Mood.Speaking]: 'Speaking',
    [Mood.Sleeping]: 'Sleeping',
    [Mood.Confused]: 'Confused',
  };
  return names[mood] || mood;
}

/**
 * Get emoji for mood
 */
export function getMoodEmoji(mood: Mood): string {
  const emojis: Record<Mood, string> = {
    [Mood.Idle]: '😶',
    [Mood.Focused]: '🤔',
    [Mood.Thinking]: '🤯',
    [Mood.Uncertain]: '😕',
    [Mood.Celebrating]: '🎉',
    [Mood.Warning]: '⚠️',
    [Mood.Error]: '❌',
    [Mood.Listening]: '👂',
    [Mood.Speaking]: '💬',
    [Mood.Sleeping]: '😴',
    [Mood.Confused]: '😵‍💫',
  };
  return emojis[mood] || '❓';
}

/**
 * Validate intensity level
 */
export function validateIntensity(value: number): IntensityLevel {
  return Math.max(1, Math.min(10, Math.round(value))) as IntensityLevel;
}

/**
 * Calculate animation speed from intensity
 */
export function getAnimationSpeed(intensity: IntensityLevel): number {
  // Higher intensity = faster animation
  return 1 + (intensity / 10);
}

/**
 * Calculate glow intensity from confidence
 */
export function getGlowIntensity(confidence: number): number {
  return confidence * 20; // 0-20px glow
}
