/**
 * Tests for goal-loop durability and restart recovery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoalLoopController, type TaskRunner, type Attempt } from './goal-loop-controller';
import { GoalLoopRecorder, rebuildGoalLoopState, resumeGoalLoopController } from './goal-loop-persistence';
import { createMemoryBotEventStore } from './bot-event-store';
import { GoalSchema, PlanSchema, TaskGraphSchema, type Goal } from './goal-task-contracts';
import { type BotEventsApi, type BotEventRow } from './bot-events-api';

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

describe('GoalLoopRecorder', () => {
  it('records controller events with monotonic sequence', () => {
    const store = createMemoryBotEventStore();
    const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });
    const controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: { runAttempt: vi.fn() },
    });

    recorder.attach(controller);
    controller.materializePlan(makePlan(['t_1']));
    recorder.detach();

    const events = store.readEvents('b_1', 'g_1');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.sequence).toBe(1);
    expect(events[events.length - 1]?.sequence).toBe(events.length);
    expect(events.some((e) => e.type === 'plan.created')).toBe(true);
    expect(events.some((e) => e.type === 'loop.snapshot')).toBe(true);
  });

  it('resumes sequence numbering across recorder instances', () => {
    const store = createMemoryBotEventStore();
    const controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: { runAttempt: vi.fn() },
    });

    const recorder1 = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });
    recorder1.attach(controller);
    controller.materializePlan(makePlan());
    recorder1.detach();

    const firstCount = store.readEvents('b_1', 'g_1').length;

    const recorder2 = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });
    recorder2.attach(controller);
    controller.acceptPlan('user_1');
    recorder2.detach();

    const events = store.readEvents('b_1', 'g_1');
    expect(events.length).toBeGreaterThan(firstCount);
    expect(events[events.length - 1]?.sequence).toBe(events.length);
  });

  describe('server dual-write', () => {
    function mockEventsApi(appendBotEvent?: ReturnType<typeof vi.fn>): BotEventsApi & {
      appendBotEvent: ReturnType<typeof vi.fn>;
    } {
      return {
        appendBotEvent: appendBotEvent ?? vi.fn(async () => ({} as unknown as BotEventRow)),
        queryBotEvents: vi.fn(),
        getBotOperationalState: vi.fn(),
      };
    }

    it('writes every recorded event to both the local store and the server', () => {
      const store = createMemoryBotEventStore();
      const eventsApi = mockEventsApi();
      const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store, eventsApi });
      const controller = new GoalLoopController({
        botId: 'b_1',
        goal: makeGoal(),
        taskRunner: { runAttempt: vi.fn() },
      });

      recorder.attach(controller);
      controller.materializePlan(makePlan(['t_1']));
      recorder.detach();

      const events = store.readEvents('b_1', 'g_1');
      expect(events.length).toBeGreaterThan(0);
      expect(eventsApi.appendBotEvent).toHaveBeenCalledTimes(events.length);

      events.forEach((event, i) => {
        expect(eventsApi.appendBotEvent).toHaveBeenNthCalledWith(i + 1, 'b_1', {
          eventType: event.type,
          actor: { type: 'bot', id: 'b_1' },
          payload: event.payload,
          occurredAt: event.occurredAt,
          goalId: 'g_1',
          idempotencyKey: `b_1:g_1:${event.sequence}`,
        });
      });
    });

    it('logs server failures without breaking the local append or the controller', async () => {
      const store = createMemoryBotEventStore();
      const eventsApi = mockEventsApi(vi.fn(async () => {
        throw new Error('server unreachable');
      }));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store, eventsApi });
      const controller = new GoalLoopController({
        botId: 'b_1',
        goal: makeGoal(),
        taskRunner: { runAttempt: vi.fn() },
      });

      recorder.attach(controller);
      controller.materializePlan(makePlan(['t_1']));
      recorder.detach();

      // The local replica recorded everything despite the server failure.
      const events = store.readEvents('b_1', 'g_1');
      expect(events.length).toBeGreaterThan(0);
      expect(eventsApi.appendBotEvent).toHaveBeenCalledTimes(events.length);

      // The rejection was caught and surfaced via the logger (console.error).
      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Failed to append event to server ledger');
      errorSpy.mockRestore();
    });

    it('does not call the server when no events API is configured', () => {
      const store = createMemoryBotEventStore();
      const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });
      const controller = new GoalLoopController({
        botId: 'b_1',
        goal: makeGoal(),
        taskRunner: { runAttempt: vi.fn() },
      });

      recorder.attach(controller);
      controller.materializePlan(makePlan(['t_1']));
      recorder.detach();

      expect(store.readEvents('b_1', 'g_1').length).toBeGreaterThan(0);
    });
  });
});

describe('rebuildGoalLoopState', () => {
  it('returns null for an empty event log', () => {
    const state = rebuildGoalLoopState([]);
    expect(state).toBeNull();
  });

  it('rebuilds state from recorded events', () => {
    const store = createMemoryBotEventStore();
    const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });
    const controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: { runAttempt: vi.fn() },
    });

    recorder.attach(controller);
    controller.materializePlan(makePlan(['t_1', 't_2']));
    controller.acceptPlan('user_1');
    recorder.detach();

    const state = rebuildGoalLoopState(store.readEvents('b_1', 'g_1'));
    expect(state).not.toBeNull();
    expect(state?.goal.status).toBe('active');
    expect(state?.plan).not.toBeNull();
    expect(Object.keys(state?.tasks ?? {})).toHaveLength(2);
    expect(state?.tasks.t_1?.status).toBe('pending');
  });

  it('recovers a paused waiting-for-approval state', async () => {
    const store = createMemoryBotEventStore();
    const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });

    let controller!: GoalLoopController;
    const runner: TaskRunner = {
      runAttempt: async (attempt, task) => {
        controller.requestApproval(task.id, 'Approve this output?');
        return { ...attempt, status: 'failed', error: 'needs_approval', updatedAt: new Date().toISOString() } as Attempt;
      },
    };

    controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: runner,
    });
    controller.materializePlan(makePlan(['t_1']));
    controller.getState().tasks.t_1.retryPolicy = { maxAttempts: 1 };
    controller.acceptPlan('user_1');

    recorder.attach(controller);
    const runPromise = controller.run();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await runPromise;
    recorder.detach();

    const events = store.readEvents('b_1', 'g_1');
    const state = rebuildGoalLoopState(events);
    expect(state?.tasks.t_1?.status).toBe('waiting_for_approval');
    expect(state?.status).toBe('waiting_approval');
  });
});

describe('resumeGoalLoopController', () => {
  it('resumes and completes a goal after a simulated restart', async () => {
    const store = createMemoryBotEventStore();
    const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore: store });

    let originalController!: GoalLoopController;
    const runner: TaskRunner = {
      runAttempt: async (attempt, task) => {
        originalController.requestApproval(task.id, 'Approve this output?');
        return { ...attempt, status: 'failed', error: 'needs_approval', updatedAt: new Date().toISOString() } as Attempt;
      },
    };

    originalController = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: runner,
    });
    originalController.materializePlan(makePlan(['t_1']));
    originalController.getState().tasks.t_1.retryPolicy = { maxAttempts: 1 };
    originalController.acceptPlan('user_1');

    recorder.attach(originalController);
    const runPromise = originalController.run();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await runPromise;
    recorder.detach();

    expect(originalController.getState().tasks.t_1?.status).toBe('waiting_for_approval');

    // Simulate restart: create a new controller from the event log with a
    // runner that now succeeds once the task is approved.
    const resumedController = resumeGoalLoopController('b_1', 'g_1', {
      runAttempt: async (attempt) =>
        ({ ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt),
    }, store);

    expect(resumedController).not.toBeNull();
    expect(resumedController?.getState().tasks.t_1?.status).toBe('waiting_for_approval');

    await resumedController?.approveTask('t_1', 'user_1');

    const finalState = resumedController?.getState();
    expect(finalState?.tasks.t_1?.status).toBe('completed');
    expect(finalState?.goal.status).toBe('completed');
  });

  it('returns null when no event history exists', () => {
    const store = createMemoryBotEventStore();
    const resumed = resumeGoalLoopController('b_1', 'g_unknown', {
      runAttempt: vi.fn(),
    }, store);
    expect(resumed).toBeNull();
  });
});
