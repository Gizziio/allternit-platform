/**
 * Policy Module
 * 
 * Policy injection, enforcement, and verification for deterministic execution.
 */

export { PolicyInjector, createInjectionMarker, validatePolicyMarkers } from './injection';
export type {
  InjectionMarker,
  InjectionContext,
  InjectorConfig,
  InjectionPoint
} from './injection';

export type {
  Policy,
  PolicyRule,
  PolicyAction,
  PolicyCondition,
  PolicyEffect,
  ConditionOperator,
  PolicyBundle,
  EvaluationContext,
  PolicyDecision,
  PolicyEngineConfig,
  PolicyCheckRequest,
  PolicyCheckResult,
  PolicyObligation,
  PolicyViolation
} from './types';
