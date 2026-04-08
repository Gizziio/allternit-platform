/**
 * Mood Inference Rules
 * 
 * Defines the mapping from telemetry events to visual states.
 */

import { Mood, MoodRule, IntensityLevel, TelemetryEvent } from '../types';

/**
 * Default mood inference rules
 * Ordered by priority (higher priority = more specific)
 */
export const defaultMoodRules: MoodRule[] = [
  // Error states (highest priority)
  {
    when: { type: 'task_error' },
    then: { mood: Mood.Error, intensity: 9, confidence: 0.3 },
    priority: 100,
  },
  {
    when: { type: 'tool_result', error: true },
    then: { mood: Mood.Warning, intensity: 7, confidence: 0.5 },
    priority: 95,
  },
  
  // Success states
  {
    when: { type: 'task_complete', success: true },
    then: { mood: Mood.Celebrating, intensity: 8, confidence: 0.9 },
    priority: 90,
  },
  {
    when: { type: 'tool_result', success: true },
    then: { mood: Mood.Focused, intensity: 6, confidence: 0.8 },
    priority: 85,
  },
  
  // Active processing states
  {
    when: { type: 'thinking' },
    then: { mood: Mood.Thinking, intensity: 7, confidence: 0.6 },
    priority: 80,
  },
  {
    when: { type: 'llm_call' },
    then: { mood: Mood.Thinking, intensity: 8, confidence: 0.5 },
    priority: 75,
  },
  {
    when: { type: 'task_start' },
    then: { mood: Mood.Focused, intensity: 6, confidence: 0.7 },
    priority: 70,
  },
  {
    when: { type: 'tool_invoke' },
    then: { mood: Mood.Focused, intensity: 5, confidence: 0.6 },
    priority: 65,
  },
  
  // Communication states
  {
    when: { type: 'listening' },
    then: { mood: Mood.Listening, intensity: 5, confidence: 0.8 },
    priority: 60,
  },
  {
    when: { type: 'speaking' },
    then: { mood: Mood.Speaking, intensity: 6, confidence: 0.9 },
    priority: 55,
  },
  {
    when: { type: 'user_message' },
    then: { mood: Mood.Listening, intensity: 5, confidence: 0.8 },
    priority: 50,
  },
  {
    when: { type: 'llm_response' },
    then: { mood: Mood.Speaking, intensity: 6, confidence: 0.7 },
    priority: 45,
  },
  
  // Waiting states
  {
    when: { type: 'waiting' },
    then: { mood: Mood.Uncertain, intensity: 4, confidence: 0.4 },
    priority: 40,
  },
  {
    when: { type: 'idle' },
    then: { mood: Mood.Idle, intensity: 2, confidence: 0.5 },
    priority: 35,
  },
  
  // System states
  {
    when: { type: 'system_message' },
    then: { mood: Mood.Focused, intensity: 4, confidence: 0.6 },
    priority: 30,
  },
];

/**
 * Find matching rule for a telemetry event
 */
export function findMatchingRule(
  event: TelemetryEvent,
  rules: MoodRule[] = defaultMoodRules
): MoodRule | undefined {
  const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  return sortedRules.find((rule) => {
    const { when } = rule;
    
    // Check event type
    if (when.type && when.type !== event.type) {
      return false;
    }
    
    // Check success status
    if (when.success !== undefined && when.success !== event.success) {
      return false;
    }
    
    // Check error status
    if (when.error !== undefined) {
      const hasError = event.error !== undefined || event.success === false;
      if (when.error !== hasError) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Custom rule builder
 */
export function createRule(
  when: MoodRule['when'],
  then: MoodRule['then'],
  priority: number = 50
): MoodRule {
  return { when, then, priority };
}

/**
 * Rule set for different agent types
 */
export const agentTypeRuleSets: Record<string, MoodRule[]> = {
  // Coding agent - more focused on thinking/celebrating
  coder: [
    {
      when: { type: 'thinking' },
      then: { mood: Mood.Thinking, intensity: 8, confidence: 0.7 },
      priority: 100,
    },
    {
      when: { type: 'task_complete', success: true },
      then: { mood: Mood.Celebrating, intensity: 7, confidence: 0.95 },
      priority: 95,
    },
    ...defaultMoodRules,
  ],
  
  // Support agent - more listening/speaking focused
  support: [
    {
      when: { type: 'listening' },
      then: { mood: Mood.Listening, intensity: 6, confidence: 0.9 },
      priority: 100,
    },
    {
      when: { type: 'speaking' },
      then: { mood: Mood.Speaking, intensity: 7, confidence: 0.85 },
      priority: 95,
    },
    ...defaultMoodRules,
  ],
  
  // Research agent - more uncertain/thinking
  researcher: [
    {
      when: { type: 'thinking' },
      then: { mood: Mood.Thinking, intensity: 6, confidence: 0.5 },
      priority: 100,
    },
    {
      when: { type: 'waiting' },
      then: { mood: Mood.Uncertain, intensity: 5, confidence: 0.4 },
      priority: 95,
    },
    ...defaultMoodRules,
  ],
};
