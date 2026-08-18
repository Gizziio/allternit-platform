/**
 * Tests for Wave 2 goal/task contract utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  detectCycle,
  validateDependencies,
  topologicalOrder,
  isTaskReady,
  isBudgetExceeded,
  computeBackoff,
  aggregateValidation,
  auditRepeatedBlocker,
  canContinueLoop,
  TaskGraphSchema,
  TaskSchema,
  GoalSchema,
  LoopPolicySchema,
  ValidationResultSchema,
  type TaskGraph,
  type Task,
  type Goal,
} from './goal-task-contracts';

const now = new Date().toISOString();

function makeGraph(nodes: TaskGraph['nodes']): TaskGraph {
  return TaskGraphSchema.parse({
    id: 'tg_1',
    goalId: 'g_1',
    botId: 'b_1',
    nodes,
    createdAt: now,
    updatedAt: now,
  });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return TaskSchema.parse({
    id: 't_1',
    goalId: 'g_1',
    planId: 'p_1',
    graphNodeId: 'n_1',
    botId: 'b_1',
    title: 'Test task',
    status: 'pending',
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('detectCycle', () => {
  it('returns null for an acyclic graph', () => {
    const graph = makeGraph([
      { id: 'a', taskId: 't_a', dependencies: [] },
      { id: 'b', taskId: 't_b', dependencies: ['a'] },
      { id: 'c', taskId: 't_c', dependencies: ['b'] },
    ]);
    expect(detectCycle(graph)).toBeNull();
  });

  it('returns the cycle for a cyclic graph', () => {
    const graph = makeGraph([
      { id: 'a', taskId: 't_a', dependencies: ['c'] },
      { id: 'b', taskId: 't_b', dependencies: ['a'] },
      { id: 'c', taskId: 't_c', dependencies: ['b'] },
    ]);
    const cycle = detectCycle(graph);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
    expect(cycle).toContain('c');
  });
});

describe('validateDependencies', () => {
  it('reports valid for consistent dependencies', () => {
    const graph = makeGraph([
      { id: 'a', taskId: 't_a', dependencies: [] },
      { id: 'b', taskId: 't_b', dependencies: ['a'] },
    ]);
    expect(validateDependencies(graph)).toEqual({ valid: true, missing: [] });
  });

  it('reports missing dependencies', () => {
    const graph = makeGraph([
      { id: 'a', taskId: 't_a', dependencies: ['missing'] },
    ]);
    expect(validateDependencies(graph)).toEqual({ valid: false, missing: ['missing'] });
  });
});

describe('topologicalOrder', () => {
  it('orders dependencies before dependents', () => {
    const graph = makeGraph([
      { id: 'c', taskId: 't_c', dependencies: ['b'] },
      { id: 'a', taskId: 't_a', dependencies: [] },
      { id: 'b', taskId: 't_b', dependencies: ['a'] },
    ]);
    expect(topologicalOrder(graph)).toEqual(['a', 'b', 'c']);
  });

  it('returns null for a cyclic graph', () => {
    const graph = makeGraph([
      { id: 'a', taskId: 't_a', dependencies: ['b'] },
      { id: 'b', taskId: 't_b', dependencies: ['a'] },
    ]);
    expect(topologicalOrder(graph)).toBeNull();
  });
});

describe('isTaskReady', () => {
  it('is ready when pending and all dependencies completed', () => {
    const task = makeTask({ dependencies: ['d1', 'd2'] });
    expect(isTaskReady(task, new Set(['d1', 'd2']))).toBe(true);
  });

  it('is not ready when dependencies are missing', () => {
    const task = makeTask({ dependencies: ['d1', 'd2'] });
    expect(isTaskReady(task, new Set(['d1']))).toBe(false);
  });

  it('is not ready when status is not pending', () => {
    const task = makeTask({ status: 'running', dependencies: [] });
    expect(isTaskReady(task, new Set())).toBe(false);
  });
});

describe('isBudgetExceeded', () => {
  it('returns false when under budget', () => {
    expect(isBudgetExceeded({ maxTurns: 5 }, { turns: 4 })).toBe(false);
  });

  it('returns true when over budget', () => {
    expect(isBudgetExceeded({ maxTurns: 5 }, { turns: 6 })).toBe(true);
  });

  it('returns false when no limits are set', () => {
    expect(isBudgetExceeded({}, { turns: 999 })).toBe(false);
  });
});

describe('computeBackoff', () => {
  it('doubles each attempt up to the cap', () => {
    expect(computeBackoff(1, 1000, 2, 10000)).toBe(1000);
    expect(computeBackoff(2, 1000, 2, 10000)).toBe(2000);
    expect(computeBackoff(3, 1000, 2, 10000)).toBe(4000);
    expect(computeBackoff(10, 1000, 2, 10000)).toBe(10000);
  });
});

describe('aggregateValidation', () => {
  it('passes only when all pass', () => {
    const results = [
      ValidationResultSchema.parse({ id: 'r1', criterionId: 'c1', attemptId: 'a1', taskId: 't1', goalId: 'g1', verdict: 'pass', validatedAt: now }),
      ValidationResultSchema.parse({ id: 'r2', criterionId: 'c2', attemptId: 'a1', taskId: 't1', goalId: 'g1', verdict: 'pass', validatedAt: now }),
    ];
    expect(aggregateValidation(results)).toBe('pass');
  });

  it('fails if any fails', () => {
    const results = [
      ValidationResultSchema.parse({ id: 'r1', criterionId: 'c1', attemptId: 'a1', taskId: 't1', goalId: 'g1', verdict: 'pass', validatedAt: now }),
      ValidationResultSchema.parse({ id: 'r2', criterionId: 'c2', attemptId: 'a1', taskId: 't1', goalId: 'g1', verdict: 'fail', validatedAt: now }),
    ];
    expect(aggregateValidation(results)).toBe('fail');
  });

  it('needs_work takes precedence over pass', () => {
    const results = [
      ValidationResultSchema.parse({ id: 'r1', criterionId: 'c1', attemptId: 'a1', taskId: 't1', goalId: 'g1', verdict: 'pass', validatedAt: now }),
      ValidationResultSchema.parse({ id: 'r2', criterionId: 'c2', attemptId: 'a1', taskId: 't1', goalId: 'g1', verdict: 'needs_work', validatedAt: now }),
    ];
    expect(aggregateValidation(results)).toBe('needs_work');
  });
});

describe('auditRepeatedBlocker', () => {
  it('does not block until threshold is reached', () => {
    const goal = GoalSchema.parse({ id: 'g1', botId: 'b1', objective: 'test', createdAt: now, updatedAt: now });
    expect(auditRepeatedBlocker(goal, 'auth', 3).blocked).toBe(false);
  });

  it('blocks after threshold repetitions', () => {
    let goal: Goal = GoalSchema.parse({ id: 'g1', botId: 'b1', objective: 'test', createdAt: now, updatedAt: now });
    for (let i = 0; i < 2; i++) {
      const audit = auditRepeatedBlocker(goal, 'auth', 3);
      goal = { ...goal, repeatedBlockerAudit: audit.audit };
    }
    const final = auditRepeatedBlocker(goal, 'auth', 3);
    expect(final.blocked).toBe(true);
    expect(final.audit.filter((e) => e.blocker === 'auth').length).toBe(3);
  });
});

describe('canContinueLoop', () => {
  it('stops after max iterations', () => {
    const policy = LoopPolicySchema.parse({ strategy: 'iterate_until_valid', maxIterations: 3 });
    expect(canContinueLoop(policy, 3).ok).toBe(false);
  });

  it('stops when validator passes', () => {
    const policy = LoopPolicySchema.parse({ strategy: 'iterate_until_valid', exitCondition: 'pass' });
    expect(canContinueLoop(policy, 1, 'pass').ok).toBe(false);
  });

  it('stops when exit condition is missing', () => {
    const policy = LoopPolicySchema.parse({ strategy: 'single_pass' });
    expect(canContinueLoop(policy, 1).ok).toBe(false);
  });

  it('allows continuation with iterations remaining and an exit condition', () => {
    const policy = LoopPolicySchema.parse({ strategy: 'iterate_until_valid', exitCondition: 'pass', maxIterations: 5 });
    expect(canContinueLoop(policy, 2).ok).toBe(true);
  });
});
