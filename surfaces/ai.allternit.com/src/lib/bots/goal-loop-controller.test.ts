/**
 * Tests for the Goal Loop Controller.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  GoalLoopController,
  type TaskRunner,
  type GoalLoopEvent,
} from './goal-loop-controller';
import {
  GoalSchema,
  PlanSchema,
  TaskGraphSchema,
  type Goal,
  type Attempt,
  type ValidationResult,
} from './goal-task-contracts';

const now = new Date().toISOString();

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return GoalSchema.parse({
    id: 'g_1',
    botId: 'b_1',
    objective: 'Write a summary report',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makePlan(taskIds: string[] = ['t_1']): ReturnType<typeof PlanSchema.parse> {
  return PlanSchema.parse({
    id: 'p_1',
    goalId: 'g_1',
    botId: 'b_1',
    summary: 'Plan',
    taskGraph: TaskGraphSchema.parse({
      id: 'tg_1',
      goalId: 'g_1',
      botId: 'b_1',
      nodes: taskIds.map((id) => ({ id: `n_${id}`, taskId: id, dependencies: [] })),
      createdAt: now,
      updatedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
  });
}

function collectEvents(controller: GoalLoopController): GoalLoopEvent[] {
  const events: GoalLoopEvent[] = [];
  controller.onEvent((e) => events.push(e));
  return events;
}

describe('GoalLoopController lifecycle', () => {
  it('materializes a plan and creates tasks', () => {
    const runner: TaskRunner = { runAttempt: vi.fn() };
    const controller = new GoalLoopController({ botId: 'b_1', goal: makeGoal(), taskRunner: runner });
    const plan = makePlan(['t_1', 't_2']);

    controller.materializePlan(plan);
    const state = controller.getState();

    expect(state.goal.status).toBe('planning');
    expect(state.plan).not.toBeNull();
    expect(Object.keys(state.tasks)).toHaveLength(2);
    expect(state.tasks.t_1.status).toBe('pending');
  });

  it('rejects plan materialization when the graph has a cycle', () => {
    const runner: TaskRunner = { runAttempt: vi.fn() };
    const controller = new GoalLoopController({ botId: 'b_1', goal: makeGoal(), taskRunner: runner });
    const plan = PlanSchema.parse({
      id: 'p_1',
      goalId: 'g_1',
      botId: 'b_1',
      summary: 'Bad plan',
      taskGraph: TaskGraphSchema.parse({
        id: 'tg_1',
        goalId: 'g_1',
        botId: 'b_1',
        nodes: [
          { id: 'n_a', taskId: 't_a', dependencies: ['n_b'] },
          { id: 'n_b', taskId: 't_b', dependencies: ['n_a'] },
        ],
        createdAt: now,
        updatedAt: now,
      }),
      createdAt: now,
      updatedAt: now,
    });

    expect(() => controller.materializePlan(plan)).toThrow('cycle');
  });

  it('executes a single task to completion', async () => {
    const runner: TaskRunner = {
      runAttempt: async (attempt) => ({
        ...attempt,
        status: 'completed',
        result: [{ id: 'art_1', name: 'report.md', uri: '/tmp/report.md' }],
        endedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Attempt),
    };

    const goal = makeGoal();
    const controller = new GoalLoopController({ botId: 'b_1', goal, taskRunner: runner });
    const events = collectEvents(controller);
    controller.materializePlan(makePlan(['t_1']));
    controller.acceptPlan('user_1');

    await controller.run();
    const state = controller.getState();

    expect(state.goal.status).toBe('completed');
    expect(state.tasks.t_1.status).toBe('completed');
    expect(state.attempts.t_1).toHaveLength(1);
    expect(state.attempts.t_1[0].status).toBe('completed');
    expect(events.some((e) => e.type === 'goal.completed')).toBe(true);
    expect(events.some((e) => e.type === 'task.completed')).toBe(true);
  });

  it('retries failed attempts up to the retry policy limit', async () => {
    let calls = 0;
    const runner: TaskRunner = {
      runAttempt: async (attempt) => {
        calls++;
        if (calls < 3) {
          return { ...attempt, status: 'failed', error: 'transient', updatedAt: new Date().toISOString() } as Attempt;
        }
        return { ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt;
      },
    };

    const goal = makeGoal();
    const controller = new GoalLoopController({ botId: 'b_1', goal, taskRunner: runner });
    const plan = makePlan(['t_1']);
    controller.materializePlan(plan);
    controller.acceptPlan('user_1');

    await controller.run();
    const state = controller.getState();

    expect(state.tasks.t_1.status).toBe('completed');
    expect(state.attempts.t_1).toHaveLength(3);
    expect(calls).toBe(3);
  });

  it('fails the goal when all retries are exhausted', async () => {
    const runner: TaskRunner = {
      runAttempt: async (attempt) =>
        ({ ...attempt, status: 'failed', error: 'persistent', updatedAt: new Date().toISOString() } as Attempt),
    };

    const goal = makeGoal();
    const controller = new GoalLoopController({ botId: 'b_1', goal, taskRunner: runner });
    controller.materializePlan(makePlan(['t_1']));
    controller.acceptPlan('user_1');

    await controller.run();
    const state = controller.getState();

    expect(state.tasks.t_1.status).toBe('failed');
    expect(state.goal.status).toBe('failed');
  });

  it('waits for validation results before completing a task', async () => {
    const runner: TaskRunner = {
      runAttempt: async (attempt) =>
        ({ ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt),
    };

    const goal = makeGoal();
    const controller = new GoalLoopController({ botId: 'b_1', goal, taskRunner: runner });
    controller.materializePlan(makePlan(['t_1']));
    controller.getState().tasks.t_1.validationCriteria = [
      { id: 'vc_1', description: 'Check output', validator: 'human', required: true },
    ];
    controller.acceptPlan('user_1');

    await controller.run();
    const midState = controller.getState();
    expect(midState.tasks.t_1.status).toBe('validating');
    expect(midState.goal.status).toBe('active');

    await controller.submitValidationResults('t_1', [
      {
        id: 'v_1',
        criterionId: 'vc_1',
        attemptId: midState.attempts.t_1[0].id,
        taskId: 't_1',
        goalId: 'g_1',
        verdict: 'pass',
        validatedAt: new Date().toISOString(),
      },
    ]);

    const finalState = controller.getState();
    expect(finalState.tasks.t_1.status).toBe('completed');
    expect(finalState.goal.status).toBe('completed');
  });

  it('returns a failed task to ready when validation fails', async () => {
    const runner: TaskRunner = {
      runAttempt: async (attempt) =>
        ({ ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt),
    };

    const goal = makeGoal();
    const controller = new GoalLoopController({ botId: 'b_1', goal, taskRunner: runner });
    controller.materializePlan(makePlan(['t_1']));
    controller.getState().tasks.t_1.validationCriteria = [
      { id: 'vc_1', description: 'Check output', validator: 'human', required: true },
    ];
    controller.acceptPlan('user_1');

    await controller.run();
    const midState = controller.getState();
    await controller.submitValidationResults('t_1', [
      {
        id: 'v_1',
        criterionId: 'vc_1',
        attemptId: midState.attempts.t_1[0].id,
        taskId: 't_1',
        goalId: 'g_1',
        verdict: 'fail',
        validatedAt: new Date().toISOString(),
      },
    ]);

    const finalState = controller.getState();
    expect(finalState.tasks.t_1.status).toBe('ready');
  });

  it('cancels the goal and all tasks', () => {
    const runner: TaskRunner = { runAttempt: vi.fn() };
    const controller = new GoalLoopController({ botId: 'b_1', goal: makeGoal(), taskRunner: runner });
    controller.materializePlan(makePlan(['t_1', 't_2']));

    controller.cancel('user_1');
    const state = controller.getState();

    expect(state.goal.status).toBe('cancelled');
    expect(state.tasks.t_1.status).toBe('cancelled');
    expect(state.tasks.t_2.status).toBe('cancelled');
  });

  it('handles user input continuation', async () => {
    let controller!: GoalLoopController;
    const runner: TaskRunner = {
      runAttempt: async (attempt, task) => {
        if (task.inputs.some((i) => i.key === 'answer')) {
          return { ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt;
        }
        // Simulate the runner requesting input mid-flight
        controller.requestUserInput('t_1', 'What is the answer?');
        return { ...attempt, status: 'failed', error: 'needs_input', updatedAt: new Date().toISOString() } as Attempt;
      },
    };

    controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: runner,
      loopPolicy: { strategy: 'human_approval_continuation', exitCondition: 'completed' },
    });
    controller.materializePlan(makePlan(['t_1']));
    controller.getState().tasks.t_1.retryPolicy = { maxAttempts: 1 };
    controller.acceptPlan('user_1');

    // Start execution; runner will request input and fail the attempt
    const runPromise = controller.run();
    // Yield so the async run() reaches the runner
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(controller.getState().tasks.t_1.status).toBe('waiting_for_input');

    await controller.submitUserInput('t_1', { key: 'answer', value: '42' });
    await runPromise;

    const state = controller.getState();
    expect(state.tasks.t_1.status).toBe('completed');
  });

  it('enforces the loop maxIterations guard', async () => {
    const runner: TaskRunner = {
      runAttempt: async (attempt) =>
        ({ ...attempt, status: 'failed', error: 'oops', updatedAt: new Date().toISOString() } as Attempt),
    };

    const controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: runner,
      loopPolicy: { strategy: 'retry_on_failure', exitCondition: 'completed', maxIterations: 1 },
    });
    controller.materializePlan(makePlan(['t_1']));
    controller.acceptPlan('user_1');

    await controller.run();
    const state = controller.getState();
    expect(state.goal.status).toBe('failed');
    expect(state.error).toBe('max_iterations_reached:1');
  });
});
