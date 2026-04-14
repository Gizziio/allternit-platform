/**
 * Mood Inference Module
 * 
 * Exports mood inference functionality.
 */

export { MoodInferrer, getMoodInferrer, resetMoodInferrer } from './mood-inferrer';
export { defaultMoodRules, findMatchingRule, createRule, agentTypeRuleSets } from './rules';
export {
  calculateConfidence,
  calculateReliability,
  calculateTrend,
  calculateVolatility,
  calculateMetrics,
  getConfidenceColor,
  getReliabilityColor,
} from './confidence-calculator';

export type { MoodInferrerConfig, InferredState } from './mood-inferrer';
export type { ConfidenceMetrics } from './confidence-calculator';
