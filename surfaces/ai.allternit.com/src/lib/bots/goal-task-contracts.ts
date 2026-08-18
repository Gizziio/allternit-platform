/**
 * Wave 2 — Goal, Plan, Task, Attempt, Validation, and Loop Contracts
 *
 * Canonical TypeScript/Zod contracts for the packaged-bot work runtime.
 * These contracts replace the legacy Ralph loop as the source of truth for
 * goal decomposition, planning, task execution, validation, and policy-driven
 * loops.
 *
 * @module goal-task-contracts
 */

import { z } from 'zod';

// ============================================================================
// Shared Primitives
// ============================================================================

export const GoalStatusSchema = z.enum([
  'draft',
  'planning',
  'active',
  'waiting',
  'blocked',
  'validating',
  'completed',
  'failed',
  'cancelled',
]);

export const TaskStatusSchema = z.enum([
  'pending',
  'ready',
  'running',
  'waiting_for_input',
  'waiting_for_approval',
  'validating',
  'completed',
  'failed',
  'cancelled',
]);

export const AttemptStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export const ValidationVerdictSchema = z.enum([
  'pass',
  'fail',
  'needs_work',
  'inconclusive',
]);

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export type GoalStatus = z.infer<typeof GoalStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;
export type ValidationVerdict = z.infer<typeof ValidationVerdictSchema>;
export type Priority = z.infer<typeof PrioritySchema>;

/** Stable ID references used across goal/plan/task contracts. */
export interface WorkIds {
  botId: string;
  sessionId?: string;
  projectId?: string;
  goalId?: string;
  planId?: string;
  taskGraphId?: string;
  taskId?: string;
  attemptId?: string;
  wihId?: string;
  runId?: string;
}

// ============================================================================
// Budgets (W2-044)
// ============================================================================

export const BudgetPolicySchema = z.object({
  maxTurns: z.number().int().nonnegative().optional(),
  maxTokens: z.number().int().nonnegative().optional(),
  maxCostCents: z.number().int().nonnegative().optional(),
  maxWallClockMs: z.number().int().nonnegative().optional(),
  maxRecursionDepth: z.number().int().nonnegative().optional(),
  maxSpawnedWorkers: z.number().int().nonnegative().optional(),
});

export const BudgetUsageSchema = z.object({
  turns: z.number().int().nonnegative().default(0),
  tokens: z.number().int().nonnegative().default(0),
  costCents: z.number().int().nonnegative().default(0),
  wallClockMs: z.number().int().nonnegative().default(0),
  recursionDepth: z.number().int().nonnegative().default(0),
  spawnedWorkers: z.number().int().nonnegative().default(0),
});

export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;
export type BudgetUsage = z.infer<typeof BudgetUsageSchema>;

/**
 * Returns true if any budget limit is exceeded.
 */
export function isBudgetExceeded(policy: BudgetPolicy, usage: BudgetUsage): boolean {
  if (policy.maxTurns !== undefined && usage.turns > policy.maxTurns) return true;
  if (policy.maxTokens !== undefined && usage.tokens > policy.maxTokens) return true;
  if (policy.maxCostCents !== undefined && usage.costCents > policy.maxCostCents) return true;
  if (policy.maxWallClockMs !== undefined && usage.wallClockMs > policy.maxWallClockMs) return true;
  if (policy.maxRecursionDepth !== undefined && usage.recursionDepth > policy.maxRecursionDepth)
    return true;
  if (policy.maxSpawnedWorkers !== undefined && usage.spawnedWorkers > policy.maxSpawnedWorkers)
    return true;
  return false;
}

// ============================================================================
// Milestones & Validation Criteria
// ============================================================================

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  completed: z.boolean().default(false),
  completedAt: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
});

export const ValidationCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  validator: z.enum(['human', 'auto', 'hybrid']).default('auto'),
  toolName: z.string().optional(),
  policyId: z.string().optional(),
  required: z.boolean().default(true),
  weight: z.number().min(0).max(1).default(1),
});

export type Milestone = z.infer<typeof MilestoneSchema>;
export type ValidationCriterion = z.infer<typeof ValidationCriterionSchema>;

// ============================================================================
// Goal Contract (W2-020, W2-021)
// ============================================================================

export const GoalOutcomeSchema = z.object({
  verdict: ValidationVerdictSchema,
  summary: z.string(),
  completedAt: z.string(),
  validatedBy: z.string().optional(),
});

export const GoalSchema = z.object({
  id: z.string(),
  botId: z.string(),
  sessionId: z.string().optional(),
  projectId: z.string().optional(),

  // Identity
  objective: z.string().min(1),
  description: z.string().optional(),

  // Planning
  definitionOfDone: z.string().optional(),
  constraints: z.array(z.string()).default([]),
  milestones: z.array(MilestoneSchema).default([]),
  validationCriteria: z.array(ValidationCriterionSchema).default([]),

  // Execution
  status: GoalStatusSchema.default('draft'),
  priority: PrioritySchema.default('medium'),
  deadline: z.string().optional(),

  // Progress
  progress: z.number().min(0).max(100).default(0),

  // Budgets
  budget: BudgetPolicySchema.optional(),
  budgetUsage: BudgetUsageSchema.default({}),

  // Blocker audit (W2-022)
  blockers: z.array(z.string()).default([]),
  repeatedBlockerAudit: z.array(z.object({ blocker: z.string(), observedAt: z.string() })).default([]),

  // Outcome
  outcome: GoalOutcomeSchema.optional(),

  // Metadata
  version: z.number().int().nonnegative().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Goal = z.infer<typeof GoalSchema>;
export type GoalOutcome = z.infer<typeof GoalOutcomeSchema>;

/** Goal statuses that allow work to proceed. */
export const GOAL_ACTIVE_STATUSES: GoalStatus[] = ['planning', 'active', 'waiting', 'validating'];

/** Goal statuses that are terminal. */
export const GOAL_TERMINAL_STATUSES: GoalStatus[] = ['completed', 'failed', 'cancelled'];

// ============================================================================
// Plan & TaskGraph Contracts (W2-023, W2-024, W2-025)
// ============================================================================

export const TaskGraphNodeSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  dependencies: z.array(z.string()).default([]),
});

export const TaskGraphSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  botId: z.string(),
  nodes: z.array(TaskGraphNodeSchema).default([]),
  version: z.number().int().nonnegative().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PlanSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  botId: z.string(),
  sessionId: z.string().optional(),

  // Content
  summary: z.string(),
  taskGraph: TaskGraphSchema,
  rationale: z.string().optional(),

  // Acceptance
  acceptedAt: z.string().optional(),
  acceptedBy: z.string().optional(),
  userEdits: z
    .array(
      z.object({
        editedAt: z.string(),
        editedBy: z.string(),
        changeSummary: z.string(),
      }),
    )
    .default([]),

  version: z.number().int().nonnegative().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskGraphNode = z.infer<typeof TaskGraphNodeSchema>;
export type TaskGraph = z.infer<typeof TaskGraphSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export interface GraphMutationReceipt {
  planId: string;
  previousVersion: number;
  newVersion: number;
  addedNodes: TaskGraphNode[];
  removedNodes: TaskGraphNode[];
  reorderedNodes: TaskGraphNode[];
  cycleDetected: boolean;
  affectedTaskIds: string[];
}

/**
 * Detect cycles in a task graph using DFS. Returns the first cycle found, or null.
 */
export function detectCycle(graph: TaskGraph): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, node.dependencies);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(nodeId: string): string[] | null {
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      return path.slice(cycleStart).concat(nodeId);
    }
    if (visited.has(nodeId)) return null;

    visiting.add(nodeId);
    path.push(nodeId);

    for (const dep of adjacency.get(nodeId) ?? []) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }

    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    return null;
  }

  for (const node of graph.nodes) {
    const cycle = visit(node.id);
    if (cycle) return cycle;
  }

  return null;
}

/**
 * Validate that all dependency references point to existing nodes.
 */
export function validateDependencies(graph: TaskGraph): { valid: boolean; missing: string[] } {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const missing: string[] = [];
  for (const node of graph.nodes) {
    for (const dep of node.dependencies) {
      if (!nodeIds.has(dep)) missing.push(dep);
    }
  }
  return { valid: missing.length === 0, missing: [...new Set(missing)] };
}

/**
 * Return a topologically ordered list of node IDs, or null if the graph has a cycle.
 */
export function topologicalOrder(graph: TaskGraph): string[] | null {
  if (detectCycle(graph)) return null;

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  for (const node of graph.nodes) {
    for (const dep of node.dependencies) {
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      dependents.get(dep)?.push(node.id);
    }
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const nextDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, nextDegree);
      if (nextDegree === 0) queue.push(dependent);
    }
  }

  return ordered.length === graph.nodes.length ? ordered : null;
}

// ============================================================================
// Task Contract (W2-040, W2-041)
// ============================================================================

export const TaskInputSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  source: z.enum(['user', 'parent_task', 'memory', 'tool_result', 'generated']).optional(),
});

export const TaskArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  mimeType: z.string().optional(),
  producedByAttemptId: z.string().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  planId: z.string(),
  graphNodeId: z.string(),
  botId: z.string(),

  // Identity
  title: z.string().min(1),
  description: z.string().optional(),
  expectedResult: z.string().optional(),

  // Assignment & scope
  assignee: z.enum(['bot', 'user', 'subagent']).default('bot'),
  assigneeId: z.string().optional(),
  tools: z.array(z.string()).default([]),
  writeScope: z.array(z.string()).default([]),

  // Inputs
  inputs: z.array(TaskInputSchema).default([]),

  // State
  status: TaskStatusSchema.default('pending'),
  dependencies: z.array(z.string()).default([]),

  // Execution
  retryPolicy: z
    .object({
      maxAttempts: z.number().int().positive().default(3),
      backoffMs: z.number().int().nonnegative().default(1000),
      backoffMultiplier: z.number().positive().default(2),
      maxBackoffMs: z.number().int().nonnegative().default(60000),
      retryableStatuses: z.array(z.enum(['failed', 'timed_out'])).default(['failed']),
    })
    .default({}),

  // Validation
  validationCriteria: z.array(ValidationCriterionSchema).default([]),

  // Artifacts
  artifacts: z.array(TaskArtifactSchema).default([]),

  // Budgets
  budget: BudgetPolicySchema.optional(),
  budgetUsage: BudgetUsageSchema.default({}),

  version: z.number().int().nonnegative().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskInput = z.infer<typeof TaskInputSchema>;
export type TaskArtifact = z.infer<typeof TaskArtifactSchema>;
export type Task = z.infer<typeof TaskSchema>;

/** Task statuses that allow execution. */
export const TASK_EXECUTABLE_STATUSES: TaskStatus[] = ['ready', 'running', 'validating'];

/** Task statuses that are terminal. */
export const TASK_TERMINAL_STATUSES: TaskStatus[] = ['completed', 'failed', 'cancelled'];

/**
 * Determine whether a task is ready to run given the completed task IDs.
 */
export function isTaskReady(task: Task, completedTaskIds: Set<string>): boolean {
  if (task.status !== 'pending') return false;
  return task.dependencies.every((dep) => completedTaskIds.has(dep));
}

// ============================================================================
// Attempt Contract (W2-042, W2-043)
// ============================================================================

export const AttemptSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  goalId: z.string(),
  botId: z.string(),
  runId: z.string().optional(),

  attemptNumber: z.number().int().positive(),
  status: AttemptStatusSchema.default('running'),

  // Inputs copied at attempt start so they remain stable across retries
  inputs: z.array(TaskInputSchema).default([]),

  // Checkpoint support
  checkpointId: z.string().optional(),
  checkpointData: z.record(z.unknown()).optional(),

  // Lifecycle
  startedAt: z.string(),
  endedAt: z.string().optional(),
  timedOutAt: z.string().optional(),
  cancelledAt: z.string().optional(),
  cancelledBy: z.string().optional(),

  // Result
  result: z.unknown().optional(),
  error: z.string().optional(),

  // Continuation
  continuationToken: z.string().optional(),

  version: z.number().int().nonnegative().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Attempt = z.infer<typeof AttemptSchema>;

/**
 * Compute the next backoff delay for a retry attempt.
 */
export function computeBackoff(
  attemptNumber: number,
  baseMs: number,
  multiplier: number,
  maxMs: number,
): number {
  const delay = baseMs * Math.pow(multiplier, attemptNumber - 1);
  return Math.min(delay, maxMs);
}

// ============================================================================
// Validation Result Contract
// ============================================================================

export const ValidationResultSchema = z.object({
  id: z.string(),
  criterionId: z.string(),
  attemptId: z.string(),
  taskId: z.string(),
  goalId: z.string(),
  verdict: ValidationVerdictSchema,
  reasoning: z.string().optional(),
  evidence: z.array(z.object({ type: z.string(), reference: z.string() })).default([]),
  validatedAt: z.string(),
  validatedBy: z.string().optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Aggregate validation results into an overall verdict.
 */
export function aggregateValidation(results: ValidationResult[]): ValidationVerdict {
  if (results.length === 0) return 'inconclusive';
  if (results.some((r) => r.verdict === 'fail')) return 'fail';
  if (results.some((r) => r.verdict === 'needs_work')) return 'needs_work';
  if (results.every((r) => r.verdict === 'pass')) return 'pass';
  return 'inconclusive';
}

// ============================================================================
// Repeated Blocker Audit (W2-022)
// ============================================================================

export const REPEATED_BLOCKER_THRESHOLD = 3;

/**
 * Audit repeated blockers before a goal can be declared blocked.
 * Returns true only after the same blocker has been observed threshold times.
 */
export function auditRepeatedBlocker(
  goal: Goal,
  blocker: string,
  threshold = REPEATED_BLOCKER_THRESHOLD,
): { blocked: boolean; audit: Goal['repeatedBlockerAudit'] } {
  const now = new Date().toISOString();
  const updatedAudit = [...goal.repeatedBlockerAudit, { blocker, observedAt: now }];
  const count = updatedAudit.filter((entry) => entry.blocker === blocker).length;
  return { blocked: count >= threshold, audit: updatedAudit };
}

// ============================================================================
// Loop Strategies (W2-060 – W2-072)
// ============================================================================

export const LoopStrategySchema = z.enum([
  'single_pass',
  'retry_on_failure',
  'iterate_until_valid',
  'plan_execute_review',
  'generator_critic',
  'tool_result_continuation',
  'scheduled_recurrence',
  'human_approval_continuation',
  'goal_decomposition',
  'bounded_parallel_map',
  'multi_agent_consensus',
]);

export type LoopStrategy = z.infer<typeof LoopStrategySchema>;

export const LoopPolicySchema = z.object({
  strategy: LoopStrategySchema,
  exitCondition: z.string().optional(),
  maxIterations: z.number().int().nonnegative().optional(),
  validatorCriteria: z.array(ValidationCriterionSchema).default([]),
  allowHumanContinuation: z.boolean().default(false),
  sandboxRequired: z.boolean().default(true),
});

export type LoopPolicy = z.infer<typeof LoopPolicySchema>;

/**
 * Guard against unbounded loops: enforce max iterations and explicit exit.
 * `maxIterations` counts as an explicit exit condition.
 */
export function canContinueLoop(
  policy: LoopPolicy,
  currentIteration: number,
  lastVerdict?: ValidationVerdict,
): { ok: boolean; reason?: string } {
  if (policy.maxIterations !== undefined && currentIteration >= policy.maxIterations) {
    return { ok: false, reason: `max_iterations_reached:${policy.maxIterations}` };
  }
  if (lastVerdict === 'pass') {
    return { ok: false, reason: 'validator_passed' };
  }
  if (!policy.exitCondition && policy.maxIterations === undefined) {
    return { ok: false, reason: 'missing_exit_condition' };
  }
  return { ok: true };
}

// ============================================================================
// Delegation Contract
// ============================================================================

export const DelegationTypeSchema = z.enum(['subagent', 'child_bot', 'tool']);

export const DelegationSchema = z.object({
  id: z.string(),
  type: DelegationTypeSchema,
  parentBotId: z.string(),
  childBotId: z.string().optional(),
  subagentId: z.string().optional(),
  taskId: z.string(),
  goalId: z.string(),
  scope: z.record(z.unknown()).default({}),
  budget: BudgetPolicySchema.optional(),
  approved: z.boolean().default(false),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  createdAt: z.string(),
});

export type DelegationType = z.infer<typeof DelegationTypeSchema>;
export type Delegation = z.infer<typeof DelegationSchema>;

// ============================================================================
// Canonical Events (W2-045)
// ============================================================================

export const GoalEventTypeSchema = z.enum([
  'goal.created',
  'goal.activated',
  'goal.updated',
  'goal.blocked',
  'goal.validating',
  'goal.completed',
  'goal.failed',
  'goal.cancelled',
]);

export const PlanEventTypeSchema = z.enum([
  'plan.created',
  'plan.accepted',
  'plan.user_edited',
  'plan.task_graph_updated',
]);

export const TaskEventTypeSchema = z.enum([
  'task.created',
  'task.ready',
  'task.running',
  'task.waiting_for_input',
  'task.waiting_for_approval',
  'task.validating',
  'task.completed',
  'task.failed',
  'task.cancelled',
]);

export const AttemptEventTypeSchema = z.enum([
  'attempt.started',
  'attempt.checkpointed',
  'attempt.retried',
  'attempt.timed_out',
  'attempt.cancelled',
  'attempt.completed',
  'attempt.failed',
]);

export const ValidationEventTypeSchema = z.enum([
  'validation.started',
  'validation.result_recorded',
  'validation.completed',
]);

export const DelegationEventTypeSchema = z.enum([
  'delegation.requested',
  'delegation.approved',
  'delegation.rejected',
  'delegation.completed',
]);

export type GoalEventType = z.infer<typeof GoalEventTypeSchema>;
export type PlanEventType = z.infer<typeof PlanEventTypeSchema>;
export type TaskEventType = z.infer<typeof TaskEventTypeSchema>;
export type AttemptEventType = z.infer<typeof AttemptEventTypeSchema>;
export type ValidationEventType = z.infer<typeof ValidationEventTypeSchema>;
export type DelegationEventType = z.infer<typeof DelegationEventTypeSchema>;

/**
 * Build a strongly typed event payload wrapper for a goal/task event.
 * The caller still appends the canonical envelope (sequence, actor, etc.).
 */
export function createGoalEventPayload(
  eventType: GoalEventType,
  goal: Goal,
): { eventType: GoalEventType; payload: unknown } {
  return { eventType, payload: goal };
}

export function createPlanEventPayload(
  eventType: PlanEventType,
  plan: Plan,
  receipt?: GraphMutationReceipt,
): { eventType: PlanEventType; payload: unknown } {
  return { eventType, payload: { plan, receipt } };
}

export function createTaskEventPayload(
  eventType: TaskEventType,
  task: Task,
): { eventType: TaskEventType; payload: unknown } {
  return { eventType, payload: task };
}

export function createAttemptEventPayload(
  eventType: AttemptEventType,
  attempt: Attempt,
): { eventType: AttemptEventType; payload: unknown } {
  return { eventType, payload: attempt };
}

export function createValidationEventPayload(
  eventType: ValidationEventType,
  result: ValidationResult,
): { eventType: ValidationEventType; payload: unknown } {
  return { eventType, payload: result };
}

export function createDelegationEventPayload(
  eventType: DelegationEventType,
  delegation: Delegation,
): { eventType: DelegationEventType; payload: unknown } {
  return { eventType, payload: delegation };
}
