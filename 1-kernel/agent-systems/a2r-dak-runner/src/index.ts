/**
 * DAK Runner - Deterministic Agent Kernel
 * 
 * Execution runtime for A2R that stays entirely execution-plane,
 * proxying all state changes through Rails gates.
 */

// Types
export * from './types';

// Core runtime
export { HookRuntime, createHookRuntime } from './hooks/runtime';
export type { 
  HookRuntimeConfig, 
  GateChecker, 
  ToolExecutor, 
  ReceiptEmitter,
  HookHandler 
} from './hooks/runtime';

// Tools
export { ToolRegistry, getToolRegistry, resetToolRegistry } from './tools/registry';
export type { ToolHandler, ToolRegistration, ToolMatcher } from './tools/registry';
export { ToolEnforcement, createToolEnforcement } from './tools/enforce';
export type { EnforcementContext, EnforcementResult } from './tools/enforce';

// Policy
export { PolicyBundleBuilder, createPolicyBundle } from './policy/bundle-builder';
export type { 
  PolicyBundle, 
  PolicyConstraints, 
  InjectionMarker,
  AgentProfile 
} from './policy/bundle-builder';
export { PolicyEngine, createPolicyEngine } from './policy_engine/engine';
export type { PolicyDecision, PolicyRule, PolicyEvaluationRequest } from './policy_engine/engine';

// Adapters
export { RailsAdapter, createRailsAdapter } from './adapters/rails_api';
export type { 
  RailsConfig, 
  GateCheckRequest, 
  GateCheckResponse,
  WorkClaimResult 
} from './adapters/rails_api';

// Context
export { ContextPackBuilder, createContextPackBuilder } from './context/builder';
export type { 
  ContextPackInputs, 
  ContextPackBuilderConfig,
  DagSlice,
  DagEdge,
  PlanArtifacts,
  LeaseInfo 
} from './context/builder';

// Plan
export { PlanManager, createPlanManager } from './plan/manager';
export type { 
  PlanFiles, 
  TodoItem, 
  ProgressEntry, 
  Finding 
} from './plan/manager';

// Workers
export { WorkerManager, createWorkerManager } from './workers/manager';
export type { 
  WorkerConfig, 
  Worker, 
  WorkerResult, 
  WorkerContext 
} from './workers/manager';

// Loop
export { RalphLoop, createRalphLoop } from './loop/ralph';
export type { 
  RalphLoopConfig, 
  NodeExecutionRequest, 
  RalphLoopResult
} from './loop/ralph';

// Observability
export { ObservabilityLogger, createObservabilityLogger } from './observability/events';
export type { 
  ObservabilityConfig, 
  EventLogEntry, 
  RunManifest 
} from './observability/events';
export { ReplayEngine, createReplayEngine } from './observability/replay';
export type { 
  ReplayConfig, 
  ReplayPlan, 
  ReplayStep,
  DiffResult,
  Difference 
} from './observability/replay';

// Runner
export { AgentRunner, createAgentRunner } from './runner/agent-runner';
export type { 
  AgentRunnerConfig, 
  AgentRunnerContext 
} from './runner/agent-runner';

// Prompt Pack Service Client
export { PromptPackClient, createPromptPackClient } from './adapters/prompt_pack';
export type { 
  PromptPackConfig, 
  RenderRequest, 
  RenderResult,
  PromptReceipt,
  PackVersionInfo 
} from './adapters/prompt_pack';

// DAG
export { DagParser, createDagParser } from './dag/parser';
export { DagExecutor, createDagExecutor } from './dag/executor';
export type { 
  DagDefinition, 
  DagNode,
  NodeExecutionResult,
  GateEvaluation,
  DagExecutionContext,
  DagDefaults,
  RoleAssignments,
  LoopConfig,
  StopConditions,
  OutputConfig,
  DagHooks,
  ConcurrencyPolicy,
  ExecutionPermissionMode,
  GateName,
  OnFailAction,
  NodeStatus 
} from './dag/types';

// WIH
export { WIHParser, createWIHParser } from './wih/parser';
export type { 
  WIH, 
  WIHScope, 
  WIHInputs, 
  WIHOutputs,
  RoleAssignments as WIHRoleAssignments,
  AcceptanceCriteria,
  Blockers,
  StopConditions as WIHStopConditions,
  ArtifactRootPolicy,
  Violation,
  BuilderReport,
  ArtifactInfo,
  CoverageMetrics,
  SecurityReport,
  SecurityFinding
} from './wih/types';

// Reports
export {
  validateValidatorReport,
  validateBuilderReport,
  validateSecurityReport,
  validateReviewReport,
  createValidatorReport,
  createBuilderReport,
  createSecurityReport,
  createReviewReport,
  serializeReport,
  deserializeReport,
  ValidatorReportSchema,
  BuilderReportSchema,
  SecurityReportSchema,
  ReviewReportSchema,
} from './reports/schemas';
export type {
  ValidatorReport as ValidatedValidatorReport,
  BuilderReport as ValidatedBuilderReport,
  SecurityReport as ValidatedSecurityReport,
  ReviewReport as ValidatedReviewReport,
} from './reports/schemas';

// Policy Injection (New)
export { PolicyInjector, createInjectionMarker, validatePolicyMarkers } from './policy/injection';
export type {
  InjectionContext,
  InjectorConfig,
  InjectionPoint
} from './policy/injection';
export type {
  Policy,
  PolicyAction,
  PolicyCondition,
  PolicyEffect,
  ConditionOperator,
  EvaluationContext,
  PolicyEngineConfig,
  PolicyCheckRequest,
  PolicyCheckResult,
  PolicyObligation,
  PolicyViolation
} from './policy/types';

// Tool Snapshots (New) - Note: ReplayEngine is also in observability/replay
export { SnapshotStore } from './snapshots/store';
export { withSnapshots, DEFAULT_REPLAY_CONFIG } from './snapshots/replay';
export type {
  Snapshot,
  SnapshotMetadata,
  SnapshotStoreConfig,
  SnapshotQuery,
  ReplayResult,
  SnapshotBundle,
  SnapshotStats,
  SnapshotToolWrapper
} from './snapshots/types';

// Monitoring (New)
export { CircuitBreaker, CircuitBreakerError, createCircuitBreaker } from './monitoring/circuit-breaker';
export { RetryExecutor, withRetry, RetryPresets, WithRetry } from './monitoring/retry';
export { MetricsCollector, globalMetrics, CountMetric, TimeMetric } from './monitoring/metrics';
export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics
} from './monitoring/circuit-breaker';
export type { RetryConfig, RetryResult } from './monitoring/retry';
export type { MetricValue, MetricSeries, HistogramBucket, HistogramMetric } from './monitoring/metrics';

// Rails Adapters (Priority 1)
export { RailsHttpAdapter, createRailsHttpAdapter } from './adapters/rails_http';
export { RailsUnifiedAdapter, createRailsUnifiedAdapter } from './adapters/rails_unified';
export type { RailsHttpConfig, RailsError } from './adapters/rails_http';
export type { UnifiedRailsConfig } from './adapters/rails_unified';

// Lease Management (Priority 1)
export { LeaseManager, createLeaseManager } from './lease/manager';
export type { LeaseManagerConfig, ManagedLease, LeaseManagerEvents } from './lease/manager';

// No-Stop Scheduler
export { RalphNoStopScheduler, createRalphNoStopScheduler } from './loop/no-stop-scheduler';
export type { SchedulerConfig, ReadyNode, SchedulerStats } from './loop/no-stop-scheduler';
