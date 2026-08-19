/**
 * Goal Loop Controller
 *
 * Drives a Goal through its full lifecycle: planning → active → validating →
 * completed/failed/cancelled. Replaces the legacy Ralph loop as the canonical
 * orchestration runtime for packaged bots.
 *
 * The controller is state-machine based and emits canonical Goal/Plan/Task/
 * Attempt/Validation events. It does not execute tools itself; tool execution is
 * delegated to a caller-provided `TaskRunner` so the same controller can be used
 * in local, cloud, and test environments.
 *
 * @module goal-loop-controller
 */

import { z } from 'zod';
import { createModuleLogger } from '@/lib/logger';
import {
  type Goal,
  type Plan,
  type Task,
  type Attempt,
  type ValidationResult,
  type TaskGraph,
  type LoopPolicy,
  type BudgetPolicy,
  type BudgetUsage,
  type GoalEventType,
  type PlanEventType,
  type TaskEventType,
  type AttemptEventType,
  type ValidationEventType,
  type DelegationEventType,
  GoalStatusSchema,
  TaskStatusSchema,
  AttemptStatusSchema,
  ValidationVerdictSchema,
  GoalSchema,
  PlanSchema,
  TaskSchema,
  AttemptSchema,
  ValidationResultSchema,
  LoopPolicySchema,
  auditRepeatedBlocker,
  aggregateValidation,
  isBudgetExceeded,
  computeBackoff,
  canContinueLoop,
  isTaskReady,
  topologicalOrder,
  detectCycle,
  createGoalEventPayload,
  createPlanEventPayload,
  createTaskEventPayload,
  createAttemptEventPayload,
  createValidationEventPayload,
} from './goal-task-contracts';

const logger = createModuleLogger('GoalLoopController');

// ============================================================================
// Task Runner Contract
// ============================================================================

/**
 * Implemented by the execution environment (local runtime, cloud worker, test
 * harness) to actually run a task attempt. The controller calls this and waits
 * for the result.
 */
export interface TaskRunner {
  /**
   * Execute one attempt of a task. Returns the completed/failed attempt record.
   * The runner is responsible for tool calls, budget tracking, checkpoints,
   * timeouts, and emitting any tool-specific telemetry.
   */
  runAttempt(attempt: Attempt, task: Task, goal: Goal): Promise<Attempt>;

  /**
   * Optional: run automated validation for a criterion. If omitted, validation
   * is assumed to be manual or handled externally.
   */
  runValidation?(
    criterionId: string,
    task: Task,
    attempt: Attempt,
    goal: Goal,
  ): Promise<ValidationResult | null>;
}

// ============================================================================
// Controller State
// ============================================================================

export interface GoalLoopState {
  botId: string;
  sessionId?: string;
  projectId?: string;
  goal: Goal;
  plan: Plan | null;
  tasks: Record<string, Task>;
  attempts: Record<string, Attempt[]>;
  validations: Record<string, ValidationResult[]>;
  loopPolicy: LoopPolicy;
  iteration: number;
  status: 'idle' | 'running' | 'waiting_input' | 'waiting_approval' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export const GoalLoopStateSchema = z.object({
  botId: z.string(),
  sessionId: z.string().optional(),
  projectId: z.string().optional(),
  goal: GoalSchema,
  plan: PlanSchema.nullable(),
  tasks: z.record(z.string(), TaskSchema),
  attempts: z.record(z.string(), z.array(AttemptSchema)),
  validations: z.record(z.string(), z.array(ValidationResultSchema)),
  loopPolicy: LoopPolicySchema,
  iteration: z.number().int().nonnegative(),
  status: z.enum([
    'idle',
    'running',
    'waiting_input',
    'waiting_approval',
    'blocked',
    'completed',
    'failed',
    'cancelled',
  ]),
  error: z.string().optional(),
});

export type GoalLoopEventType =
  | GoalEventType
  | PlanEventType
  | TaskEventType
  | AttemptEventType
  | ValidationEventType
  | DelegationEventType
  | 'loop.snapshot';

export interface GoalLoopEvent {
  type: GoalLoopEventType;
  payload: unknown;
  occurredAt: string;
}

// ============================================================================
// Controller
// ============================================================================

export interface GoalLoopControllerOptions {
  botId: string;
  goal: Goal;
  taskRunner: TaskRunner;
  loopPolicy?: LoopPolicy;
  /** Optional bounded session id; recorded in emitted events for activity correlation. */
  sessionId?: string;
  /** Optional project id; recorded in emitted events for activity correlation. */
  projectId?: string;
  /** Called when a plan is accepted and execution is about to begin. */
  onPlanAccepted?: (goal: Goal, plan: Plan) => void;
}

export class GoalLoopController {
  private state: GoalLoopState;
  private taskRunner: TaskRunner;
  private eventHandlers: Set<(event: GoalLoopEvent) => void> = new Set();
  private running = false;
  private onPlanAccepted?: (goal: Goal, plan: Plan) => void;

  constructor(options: GoalLoopControllerOptions) {
    this.taskRunner = options.taskRunner;
    this.onPlanAccepted = options.onPlanAccepted;
    this.state = {
      botId: options.botId,
      sessionId: options.sessionId,
      projectId: options.projectId,
      goal: GoalSchema.parse(options.goal),
      plan: null,
      tasks: {},
      attempts: {},
      validations: {},
      loopPolicy:
        options.loopPolicy ??
        LoopPolicySchema.parse({ strategy: 'plan_execute_review', exitCondition: 'all_tasks_completed' }),
      iteration: 0,
      status: 'idle',
    };
  }

  /**
   * Resume a controller from a previously persisted GoalLoopState snapshot.
   * The caller must supply a TaskRunner; all other runtime state is restored.
   */
  static resume(taskRunner: TaskRunner, state: GoalLoopState): GoalLoopController {
    const parsed = GoalLoopStateSchema.parse(state);
    const controller = new GoalLoopController({
      botId: parsed.botId,
      goal: parsed.goal,
      taskRunner,
      loopPolicy: parsed.loopPolicy,
    });
    controller.state = parsed;
    logger.info({ goalId: parsed.goal.id, status: parsed.status }, 'Goal loop resumed from snapshot');
    return controller;
  }

  // ── Event subscription ────────────────────────────────────────────────────

  onEvent(handler: (event: GoalLoopEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private emit(event: GoalLoopEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        logger.error({ err }, 'Goal loop event handler threw');
      }
    }
  }

  private emitGoalEvent(type: GoalEventType): void {
    this.emit({ type, payload: this.state.goal, occurredAt: new Date().toISOString() });
  }

  private emitPlanEvent(type: PlanEventType): void {
    if (!this.state.plan) return;
    this.emit({ type, payload: this.state.plan, occurredAt: new Date().toISOString() });
  }

  private emitTaskEvent(type: TaskEventType, task: Task): void {
    this.emit({ type, payload: task, occurredAt: new Date().toISOString() });
  }

  private emitAttemptEvent(type: AttemptEventType, attempt: Attempt): void {
    this.emit({ type, payload: attempt, occurredAt: new Date().toISOString() });
  }

  private emitValidationEvent(type: ValidationEventType, result: ValidationResult): void {
    this.emit({ type, payload: result, occurredAt: new Date().toISOString() });
  }

  // ── State access ──────────────────────────────────────────────────────────

  getState(): GoalLoopState {
    return { ...this.state };
  }

  private updateGoal(updater: (goal: Goal) => Goal): void {
    this.state.goal = updater(this.state.goal);
  }

  private updateTask(taskId: string, updater: (task: Task) => Task): void {
    const task = this.state.tasks[taskId];
    if (!task) return;
    this.state.tasks[taskId] = updater(task);
  }

  // ── Lifecycle: plan materialization ───────────────────────────────────────

  /**
   * Materialize a plan for the goal. This creates the task graph and moves the
   * goal into the `planning` state. The plan must be accepted before execution.
   */
  materializePlan(plan: Plan): void {
    if (this.state.goal.status !== 'draft' && this.state.goal.status !== 'planning') {
      throw new Error(`Cannot materialize plan when goal is ${this.state.goal.status}`);
    }

    const cycle = detectCycle(plan.taskGraph);
    if (cycle) {
      throw new Error(`Plan task graph has a cycle: ${cycle.join(' -> ')}`);
    }

    this.state.plan = PlanSchema.parse(plan);

    // Initialize task records from graph nodes
    for (const node of plan.taskGraph.nodes) {
      const task = TaskSchema.parse({
        id: node.taskId,
        goalId: this.state.goal.id,
        planId: plan.id,
        graphNodeId: node.id,
        botId: this.state.botId,
        title: `Task ${node.taskId}`,
        status: 'pending',
        dependencies: node.dependencies,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.state.tasks[task.id] = task;
    }

    this.updateGoal((g) => ({ ...g, status: 'planning', updatedAt: new Date().toISOString() }));
    this.emitGoalEvent('goal.updated');
    this.emitPlanEvent('plan.created');

    logger.info({ goalId: this.state.goal.id, planId: plan.id }, 'Plan materialized');
  }

  /**
   * Accept the current plan and transition the goal to `active`.
   */
  acceptPlan(acceptedBy: string): void {
    if (!this.state.plan) {
      throw new Error('No plan to accept');
    }
    if (this.state.goal.status !== 'planning') {
      throw new Error(`Cannot accept plan when goal is ${this.state.goal.status}`);
    }

    const now = new Date().toISOString();
    this.state.plan = {
      ...this.state.plan,
      acceptedAt: now,
      acceptedBy,
      updatedAt: now,
    };

    this.updateGoal((g) => ({ ...g, status: 'active', updatedAt: now }));
    this.emitPlanEvent('plan.accepted');
    this.emitGoalEvent('goal.activated');

    if (this.state.plan) {
      this.onPlanAccepted?.(this.state.goal, this.state.plan);
    }

    logger.info({ goalId: this.state.goal.id, acceptedBy }, 'Plan accepted');
  }

  // ── Lifecycle: execution loop ─────────────────────────────────────────────

  /**
   * Start or continue executing the goal. This is the main loop entry point.
   */
  async run(): Promise<void> {
    if (this.running) {
      logger.warn({ goalId: this.state.goal.id }, 'Goal loop is already running');
      return;
    }

    if (this.state.goal.status === 'draft') {
      throw new Error('Goal must have an accepted plan before running');
    }

    this.running = true;
    try {
      await this.tick();
    } finally {
      this.running = false;
    }
  }

  private async tick(): Promise<void> {
    if (this.state.goal.status === 'completed' || this.state.goal.status === 'failed' || this.state.goal.status === 'cancelled') {
      return;
    }

    // Budget check for the goal
    if (this.state.goal.budget && isBudgetExceeded(this.state.goal.budget, this.state.goal.budgetUsage)) {
      await this.failGoal('goal_budget_exceeded');
      return;
    }

    // Loop guard
    const loopCheck = canContinueLoop(this.state.loopPolicy, this.state.iteration);
    if (!loopCheck.ok) {
      await this.failGoal(loopCheck.reason ?? 'loop_guard_stopped');
      return;
    }
    this.state.iteration++;

    // Promote ready tasks
    const completedIds = new Set(
      Object.values(this.state.tasks)
        .filter((t) => t.status === 'completed')
        .map((t) => t.id),
    );

    for (const task of Object.values(this.state.tasks)) {
      if (isTaskReady(task, completedIds)) {
        this.updateTask(task.id, (t) => ({ ...t, status: 'ready', updatedAt: new Date().toISOString() }));
        this.emitTaskEvent('task.ready', this.state.tasks[task.id]);
      }
    }

    // Run one ready task at a time (bounded sequential execution)
    const readyTasks = Object.values(this.state.tasks).filter((t) => t.status === 'ready');
    if (readyTasks.length === 0) {
      // No ready tasks: check if all tasks are terminal
      const terminalTasks = Object.values(this.state.tasks).filter(
        (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled',
      );
      if (terminalTasks.length === Object.keys(this.state.tasks).length && Object.keys(this.state.tasks).length > 0) {
        await this.validateAndCompleteGoal();
      }
      return;
    }

    const task = readyTasks[0];
    await this.executeTask(task);

    // Re-tick if there is more work to do
    if (this.state.goal.status === 'active') {
      await this.tick();
    }
  }

  private async executeTask(task: Task): Promise<void> {
    this.updateTask(task.id, (t) => ({ ...t, status: 'running', updatedAt: new Date().toISOString() }));
    this.emitTaskEvent('task.running', this.state.tasks[task.id]);

    const maxAttempts = task.retryPolicy.maxAttempts ?? 1;
    let attemptNumber = (this.state.attempts[task.id]?.length ?? 0) + 1;
    let lastAttempt: Attempt | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      const attempt = AttemptSchema.parse({
        id: `att_${task.id}_${attemptNumber}`,
        taskId: task.id,
        goalId: this.state.goal.id,
        botId: this.state.botId,
        attemptNumber,
        status: 'running',
        inputs: task.inputs,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (!this.state.attempts[task.id]) this.state.attempts[task.id] = [];
      this.state.attempts[task.id].push(attempt);
      this.emitAttemptEvent('attempt.started', attempt);

      try {
        lastAttempt = await this.taskRunner.runAttempt(attempt, task, this.state.goal);
        lastAttempt = AttemptSchema.parse(lastAttempt);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        lastAttempt = { ...attempt, status: 'failed', error: errorMessage, updatedAt: new Date().toISOString() };
      }

      // Update stored attempt
      const attempts = this.state.attempts[task.id];
      attempts[attempts.length - 1] = lastAttempt;

      if (lastAttempt.status === 'completed') {
        this.emitAttemptEvent('attempt.completed', lastAttempt);
        break;
      }

      this.emitAttemptEvent(lastAttempt.status === 'cancelled' ? 'attempt.cancelled' : 'attempt.failed', lastAttempt);

      const shouldRetry =
        i < maxAttempts - 1 &&
        task.retryPolicy.retryableStatuses.includes(lastAttempt.status as 'failed' | 'timed_out');
      if (!shouldRetry) break;

      // Retry backoff
      const delay = computeBackoff(
        attemptNumber,
        task.retryPolicy.backoffMs,
        task.retryPolicy.backoffMultiplier,
        task.retryPolicy.maxBackoffMs,
      );
      this.emitAttemptEvent('attempt.retried', { ...lastAttempt, continuationToken: `retry_${attemptNumber}` } as Attempt);
      await sleep(delay);
      attemptNumber++;
    }

    if (!lastAttempt) {
      await this.failTask(task.id, 'no_attempt_created');
      return;
    }

    // If the runner paused the task (e.g., requested user input or approval),
    // preserve that state and do not fail the attempt.
    const currentTask = this.state.tasks[task.id];
    if (currentTask.status === 'waiting_for_input' || currentTask.status === 'waiting_for_approval') {
      if (lastAttempt.status === 'completed') {
        this.emitAttemptEvent('attempt.completed', lastAttempt);
      } else {
        this.emitAttemptEvent(
          lastAttempt.status === 'cancelled' ? 'attempt.cancelled' : 'attempt.failed',
          lastAttempt,
        );
      }
      return;
    }

    if (lastAttempt.status === 'completed') {
      // Move to validating if there are validation criteria; otherwise complete
      if (task.validationCriteria.length > 0) {
        this.updateTask(task.id, (t) => ({
          ...t,
          status: 'validating',
          artifacts: lastAttempt?.result ? [...t.artifacts, ...(Array.isArray(lastAttempt.result) ? lastAttempt.result : [])] : t.artifacts,
          updatedAt: new Date().toISOString(),
        }));
        this.emitTaskEvent('task.validating', this.state.tasks[task.id]);
      } else {
        this.updateTask(task.id, (t) => ({
          ...t,
          status: 'completed',
          artifacts: lastAttempt?.result ? [...t.artifacts, ...(Array.isArray(lastAttempt.result) ? lastAttempt.result : [])] : t.artifacts,
          updatedAt: new Date().toISOString(),
        }));
        this.emitTaskEvent('task.completed', this.state.tasks[task.id]);
      }
    } else {
      await this.failTask(task.id, lastAttempt.error ?? 'attempt_failed');
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Submit validation results for a task. If all required criteria pass, the
   * task is marked completed; otherwise it moves back to ready for rework.
   */
  async submitValidationResults(taskId: string, results: ValidationResult[]): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task || task.status !== 'validating') {
      throw new Error(`Task ${taskId} is not awaiting validation`);
    }

    const parsed = results.map((r) => ValidationResultSchema.parse(r));
    for (const result of parsed) {
      if (!this.state.validations[taskId]) this.state.validations[taskId] = [];
      this.state.validations[taskId].push(result);
      this.emitValidationEvent('validation.result_recorded', result);
    }

    const verdict = aggregateValidation(parsed);
    if (verdict === 'pass') {
      this.updateTask(taskId, (t) => ({ ...t, status: 'completed', updatedAt: new Date().toISOString() }));
      this.emitTaskEvent('task.completed', this.state.tasks[taskId]);

      // Continue executing remaining work or finalize the goal
      if (this.state.goal.status === 'active') {
        await this.run();
      }
    } else {
      this.updateTask(taskId, (t) => ({ ...t, status: 'ready', updatedAt: new Date().toISOString() }));
      this.emitTaskEvent('task.ready', this.state.tasks[taskId]);
      // Leave re-execution to the caller so validation failures can be inspected
    }
  }

  private async validateAndCompleteGoal(): Promise<void> {
    const failedTasks = Object.values(this.state.tasks).filter((t) => t.status === 'failed');
    if (failedTasks.length > 0) {
      await this.failGoal('task_failed');
      return;
    }

    const allTaskResults: ValidationResult[] = [];
    for (const taskId of Object.keys(this.state.validations)) {
      allTaskResults.push(...this.state.validations[taskId]);
    }

    const goalVerdict = aggregateValidation(allTaskResults);
    if (goalVerdict === 'pass' || allTaskResults.length === 0) {
      const now = new Date().toISOString();
      this.updateGoal((g) => ({
        ...g,
        status: 'validating',
        progress: 100,
        updatedAt: now,
      }));
      this.emitGoalEvent('goal.validating');

      // Final goal-level validation could be inserted here.
      this.updateGoal((g) => ({
        ...g,
        status: 'completed',
        progress: 100,
        outcome: { verdict: 'pass', summary: 'All tasks completed successfully.', completedAt: now },
        updatedAt: now,
      }));
      this.emitGoalEvent('goal.completed');
      this.state.status = 'completed';
      logger.info({ goalId: this.state.goal.id }, 'Goal completed');
    } else {
      await this.failGoal('goal_validation_failed');
    }
  }

  // ── User input / approval ─────────────────────────────────────────────────

  /**
   * Provide input that a task was waiting for.
   */
  async submitUserInput(taskId: string, input: { key: string; value: unknown }): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task || task.status !== 'waiting_for_input') {
      throw new Error(`Task ${taskId} is not awaiting input`);
    }

    this.updateTask(taskId, (t) => ({
      ...t,
      status: 'ready',
      inputs: [...t.inputs, { key: input.key, value: input.value, source: 'user' }],
      updatedAt: new Date().toISOString(),
    }));
    this.emitTaskEvent('task.ready', this.state.tasks[taskId]);

    if (this.state.goal.status === 'active') {
      await this.run();
    }
  }

  /**
   * Approve a task that was waiting for human approval.
   */
  async approveTask(taskId: string, approvedBy: string): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task || task.status !== 'waiting_for_approval') {
      throw new Error(`Task ${taskId} is not awaiting approval`);
    }

    this.updateTask(taskId, (t) => ({ ...t, status: 'ready', updatedAt: new Date().toISOString() }));
    this.emitTaskEvent('task.ready', this.state.tasks[taskId]);

    if (this.state.goal.status === 'active') {
      await this.run();
    }
  }

  /**
   * Mark a task as waiting for user input.
   */
  requestUserInput(taskId: string, prompt: string): void {
    const task = this.state.tasks[taskId];
    if (!task || task.status !== 'running') {
      throw new Error(`Task ${taskId} cannot request input from status ${task?.status}`);
    }

    this.updateTask(taskId, (t) => ({ ...t, status: 'waiting_for_input', updatedAt: new Date().toISOString() }));
    this.state.status = 'waiting_input';
    this.emitTaskEvent('task.waiting_for_input', this.state.tasks[taskId]);
    logger.info({ taskId, prompt }, 'Task waiting for user input');
  }

  /**
   * Mark a task as waiting for human approval.
   */
  requestApproval(taskId: string, prompt: string): void {
    const task = this.state.tasks[taskId];
    if (!task || task.status !== 'running') {
      throw new Error(`Task ${taskId} cannot request approval from status ${task?.status}`);
    }

    this.updateTask(taskId, (t) => ({ ...t, status: 'waiting_for_approval', updatedAt: new Date().toISOString() }));
    this.state.status = 'waiting_approval';
    this.emitTaskEvent('task.waiting_for_approval', this.state.tasks[taskId]);
    logger.info({ taskId, prompt }, 'Task waiting for approval');
  }

  // ── Failure / cancellation ────────────────────────────────────────────────

  private async failTask(taskId: string, error: string): Promise<void> {
    this.updateTask(taskId, (t) => ({ ...t, status: 'failed', updatedAt: new Date().toISOString() }));
    this.emitTaskEvent('task.failed', this.state.tasks[taskId]);

    // Repeated blocker audit (default threshold: 3 consecutive occurrences)
    const audit = auditRepeatedBlocker(this.state.goal, error);
    this.updateGoal((g) => ({
      ...g,
      repeatedBlockerAudit: audit.audit,
      updatedAt: new Date().toISOString(),
    }));

    if (audit.blocked) {
      this.updateGoal((g) => ({ ...g, status: 'blocked', updatedAt: new Date().toISOString() }));
      this.state.status = 'blocked';
      this.emitGoalEvent('goal.blocked');
      logger.info({ goalId: this.state.goal.id, error }, 'Goal blocked after repeated blocker');
    }
  }

  private async failGoal(error: string): Promise<void> {
    this.updateGoal((g) => ({
      ...g,
      status: 'failed',
      updatedAt: new Date().toISOString(),
    }));
    this.state.status = 'failed';
    this.state.error = error;
    this.emitGoalEvent('goal.failed');
    logger.error({ goalId: this.state.goal.id, error }, 'Goal failed');
  }

  /**
   * Cancel the goal and all non-terminal tasks.
   */
  cancel(cancelledBy: string): void {
    for (const task of Object.values(this.state.tasks)) {
      if (task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled') {
        this.updateTask(task.id, (t) => ({ ...t, status: 'cancelled', updatedAt: new Date().toISOString() }));
        this.emitTaskEvent('task.cancelled', this.state.tasks[task.id]);
      }
    }

    this.updateGoal((g) => ({
      ...g,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }));
    this.state.status = 'cancelled';
    this.emitGoalEvent('goal.cancelled');
    logger.info({ goalId: this.state.goal.id, cancelledBy }, 'Goal cancelled');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
