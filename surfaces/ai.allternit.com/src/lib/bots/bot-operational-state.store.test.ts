/**
 * Tests for the bot operational state projection store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBotOperationalStateStore } from './bot-operational-state.store';
import { getBotOperationalState } from './bot-events-api';
import { type BotOperationalState } from './orpc-contracts';
import { type GoalLoopState } from './goal-loop-controller';
import {
  GoalSchema,
  PlanSchema,
  TaskSchema,
  TaskGraphSchema,
  LoopPolicySchema,
  type Task,
} from './goal-task-contracts';

vi.mock('./bot-events-api', () => ({
  getBotOperationalState: vi.fn(),
}));

const mockGetBotOperationalState = vi.mocked(getBotOperationalState);

const now = new Date().toISOString();

function makeGoal(overrides: Partial<ReturnType<typeof GoalSchema.parse>> = {}) {
  return GoalSchema.parse({
    id: 'g_1',
    botId: 'b_1',
    objective: 'Write a summary report',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makePlan(): ReturnType<typeof PlanSchema.parse> {
  return PlanSchema.parse({
    id: 'p_1',
    goalId: 'g_1',
    botId: 'b_1',
    summary: 'Plan',
    taskGraph: TaskGraphSchema.parse({
      id: 'tg_1',
      goalId: 'g_1',
      botId: 'b_1',
      nodes: [{ id: 'n_1', taskId: 't_1', dependencies: [] }],
      createdAt: now,
      updatedAt: now,
    }),
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
    title: 'Summarize findings',
    status: 'pending',
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeLoopState(overrides: Partial<GoalLoopState> = {}): GoalLoopState {
  return {
    botId: 'b_1',
    goal: makeGoal(),
    plan: makePlan(),
    tasks: { t_1: makeTask() },
    attempts: {},
    validations: {},
    loopPolicy: LoopPolicySchema.parse({ strategy: 'plan_execute_review', exitCondition: 'all_tasks_completed' }),
    iteration: 0,
    status: 'running',
    ...overrides,
  };
}

describe('bot-operational-state.store', () => {
  beforeEach(() => {
    useBotOperationalStateStore.setState({
      projections: {},
      cursors: {},
      fetchingBotIds: new Set(),
    });
    mockGetBotOperationalState.mockReset();
  });

  it('maps a running goal loop to working status', () => {
    const store = useBotOperationalStateStore.getState();
    const loopState = makeLoopState({
      status: 'running',
      tasks: { t_1: makeTask({ status: 'running' }) },
    });

    store.applyGoalLoopState('b_1', loopState);

    const projection = useBotOperationalStateStore.getState().getProjection('b_1');
    expect(projection).not.toBeNull();
    expect(projection?.state.status).toBe('working');
    expect(projection?.state.activeGoalId).toBe('g_1');
    expect(projection?.state.activeTaskId).toBe('t_1');
    expect(projection?.state.activityLabel).toBe('Summarize findings');
  });

  it('maps waiting_for_input tasks to waiting_input status', () => {
    const store = useBotOperationalStateStore.getState();
    const loopState = makeLoopState({
      status: 'running',
      tasks: { t_1: makeTask({ status: 'waiting_for_input' }) },
    });

    store.applyGoalLoopState('b_1', loopState);

    const status = useBotOperationalStateStore.getState().getStatus('b_1');
    expect(status).toBe('waiting_input');
  });

  it('maps waiting_for_approval tasks to waiting_approval status and count', () => {
    const store = useBotOperationalStateStore.getState();
    const loopState = makeLoopState({
      status: 'running',
      tasks: {
        t_1: makeTask({ status: 'waiting_for_approval' }),
        t_2: makeTask({ id: 't_2', graphNodeId: 'n_2', status: 'waiting_for_approval' }),
      },
    });

    store.applyGoalLoopState('b_1', loopState);

    const projection = useBotOperationalStateStore.getState().getProjection('b_1');
    expect(projection?.state.status).toBe('waiting_approval');
    expect(projection?.state.pendingApprovalsCount).toBe(2);
    expect(useBotOperationalStateStore.getState().hasPendingApprovals('b_1')).toBe(true);
  });

  it('preserves server-sourced fields when applying goal loop state', () => {
    const store = useBotOperationalStateStore.getState();
    store.applySnapshot('b_1', {
      status: 'idle',
      activeGoalId: 'g_old',
      activityLabel: 'Old activity',
      pendingApprovalsCount: 0,
      unreadMessagesCount: 5,
      computerState: 'running',
      nextRoutineRunAt: '2026-08-18T09:00:00.000Z',
      lastEventSequence: 42,
      updatedAt: now,
    });

    const loopState = makeLoopState({
      status: 'running',
      tasks: { t_1: makeTask({ status: 'running' }) },
    });

    store.applyGoalLoopState('b_1', loopState);

    const projection = useBotOperationalStateStore.getState().getProjection('b_1');
    expect(projection?.state.status).toBe('working');
    expect(projection?.state.activeGoalId).toBe('g_1');
    expect(projection?.state.unreadMessagesCount).toBe(5);
    expect(projection?.state.computerState).toBe('running');
    expect(projection?.state.nextRoutineRunAt).toBe('2026-08-18T09:00:00.000Z');
    expect(projection?.state.lastEventSequence).toBe(42);
  });

  it('updates lastFetchedAt when applying goal loop state', () => {
    const before = new Date().toISOString();
    const store = useBotOperationalStateStore.getState();
    const loopState = makeLoopState({ status: 'completed' });

    store.applyGoalLoopState('b_1', loopState);

    const projection = useBotOperationalStateStore.getState().getProjection('b_1');
    expect(projection?.lastFetchedAt).not.toBeNull();
    expect(projection?.lastFetchedAt >= before).toBe(true);
    expect(projection?.subscriptionState).toBe('connected');
  });

  it('maps a blocked loop to blocked status', () => {
    const store = useBotOperationalStateStore.getState();
    const loopState = makeLoopState({ status: 'blocked' });

    store.applyGoalLoopState('b_1', loopState);

    const status = useBotOperationalStateStore.getState().getStatus('b_1');
    expect(status).toBe('blocked');
    expect(useBotOperationalStateStore.getState().needsAttention('b_1')).toBe(true);
  });
});

describe('fetchOperationalState', () => {
  function serverState(overrides: Partial<BotOperationalState> = {}): BotOperationalState {
    return {
      status: 'idle',
      pendingApprovalsCount: 0,
      unreadMessagesCount: 0,
      computerState: 'none',
      lastEventSequence: 0,
      updatedAt: now,
      ...overrides,
    };
  }

  it('merges server fields into the entry and preserves subscription state and cursors', async () => {
    const store = useBotOperationalStateStore.getState();

    // Seed a local entry with goal-loop-sourced fields plus subscription
    // bookkeeping and a resume cursor that the server fetch must not clobber.
    store.applyGoalLoopState('b_1', makeLoopState({
      status: 'running',
      tasks: { t_1: makeTask({ status: 'running' }) },
    }));
    store.markStale('b_1');
    store.setCursor('b_1', { botId: 'b_1', lastSequence: 99, updatedAt: now });

    mockGetBotOperationalState.mockResolvedValue(serverState({
      status: 'working',
      activityLabel: 'Server-side run',
      computerState: 'running',
      lastEventSequence: 42,
      updatedAt: '2026-08-19T00:00:00.000Z',
    }));

    const ok = await useBotOperationalStateStore.getState().fetchOperationalState('b_1');
    expect(ok).toBe(true);
    expect(mockGetBotOperationalState).toHaveBeenCalledWith('b_1');

    const projection = useBotOperationalStateStore.getState().getProjection('b_1');
    // Server-sourced fields win.
    expect(projection?.state.status).toBe('working');
    expect(projection?.state.activityLabel).toBe('Server-side run');
    expect(projection?.state.computerState).toBe('running');
    expect(projection?.state.lastEventSequence).toBe(42);
    expect(projection?.state.updatedAt).toBe('2026-08-19T00:00:00.000Z');
    // Subscription bookkeeping and resume cursor are preserved.
    expect(projection?.subscriptionState).toBe('stale');
    expect(useBotOperationalStateStore.getState().cursors.b_1).toEqual({
      botId: 'b_1',
      lastSequence: 99,
      updatedAt: now,
    });
    // Fetching flag is cleared once the fetch completes.
    expect(useBotOperationalStateStore.getState().fetchingBotIds.has('b_1')).toBe(false);
  });

  it('returns false and leaves the entry untouched when the fetch fails', async () => {
    const store = useBotOperationalStateStore.getState();
    store.applyGoalLoopState('b_1', makeLoopState({
      status: 'running',
      tasks: { t_1: makeTask({ status: 'running' }) },
    }));
    const before = useBotOperationalStateStore.getState().getProjection('b_1');

    mockGetBotOperationalState.mockRejectedValue(new Error('server unreachable'));

    const ok = await useBotOperationalStateStore.getState().fetchOperationalState('b_1');
    expect(ok).toBe(false);

    const after = useBotOperationalStateStore.getState().getProjection('b_1');
    expect(after?.state).toEqual(before?.state);
    expect(after?.subscriptionState).toBe(before?.subscriptionState);
    expect(useBotOperationalStateStore.getState().fetchingBotIds.has('b_1')).toBe(false);
  });
});
