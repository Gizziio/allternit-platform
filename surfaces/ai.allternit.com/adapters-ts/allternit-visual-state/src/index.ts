/**
 * Allternit Visual State Protocol (AVSP)
 * 
 * Agent mood, intensity, and confidence visualization system.
 * 
 * @example
 * ```typescript
 * import { MoodInferrer, Mood, getMoodEmoji } from '@allternit/visual-state';
 * 
 * const inferrer = new MoodInferrer();
 * 
 * const result = inferrer.infer({
 *   type: 'task_complete',
 *   agentId: 'agent-1',
 *   success: true,
 *   timestamp: new Date(),
 * });
 * 
 * if (result) {
 *   console.log(getMoodEmoji(result.state.mood));
 *   // Output: 🎉
 * }
 * ```
 */

// Types (enums are both values and types)
export { Mood } from './types';
export type {
  IntensityLevel,
  VisualState,
  AVSPMessage,
  TelemetryEvent,
  TelemetryEventType,
  MoodRule,
  AvatarSize,
  AvatarAdapter,
  VisualStateHistoryEntry,
  VisualStateStore,
} from './types';

// Type utilities
export {
  getMoodColor,
  getMoodDisplayName,
  getMoodEmoji,
  validateIntensity,
  getAnimationSpeed,
  getGlowIntensity,
} from './types';

// Inference
export {
  MoodInferrer,
  getMoodInferrer,
  resetMoodInferrer,
  defaultMoodRules,
  findMatchingRule,
  createRule,
  agentTypeRuleSets,
  calculateConfidence,
  calculateReliability,
  calculateTrend,
  calculateVolatility,
  calculateMetrics,
  getConfidenceColor,
  getReliabilityColor,
} from './inference';

// Version
export const AVSP_VERSION = '1.0.0';
