/**
 * Integration tests for goal-loop + WIH/session orchestration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoalLoopController, type TaskRunner, type Attempt } from './goal-loop-controller';
import { GoalLoopRecorder } from './goal-loop-persistence';
import { useBotSessionStore } from './bot-session-store';
import { createMemoryBotEventStore } from './bot-event-store';
import { GoalSchema, PlanSchema, TaskGraphSchema, type Goal } from './goal-task-contracts';

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

describe('goal-loop + WIH integration', () => {
  beforeEach(() => {
    useBotSessionStore.setState({ sessions: {}, wihs: {}, activeSessionIdByBot: {} });
  });

  it('materializes a WIH when the plan is accepted', () => {
    const eventStore = createMemoryBotEventStore();
    const sessionStore = useBotSessionStore.getState();
    const runner: TaskRunner = { runAttempt: vi.fn() };

    sessionStore.createSession('b_1', 'Test session', 'proj_1');
    const sessionId = sessionStore.getActiveSession('b_1')!.id;

    const controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: runner,
      sessionId,
      projectId: 'proj_1',
      onPlanAccepted: (goal, plan) => {
        sessionStore.materializeWIH('b_1', goal, plan, { sessionId, projectId: 'proj_1' });
      },
    });

    const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore });
    recorder.attach(controller);

    controller.materializePlan(makePlan());
    controller.acceptPlan('user_1');

    const wih = sessionStore.getActiveWIH('b_1');
    expect(wih).not.toBeNull();
    expect(wih?.goalId).toBe('g_1');
    expect(wih?.sessionId).toBe(sessionId);
    expect(wih?.projectId).toBe('proj_1');
    expect(wih?.status).toBe('active');

    const session = sessionStore.getSession(sessionId);
    expect(session?.wihIds).toContain(wih?.id);

    recorder.detach();
  });

  it('completes a full goal lifecycle with WIH tracking', async () => {
    const eventStore = createMemoryBotEventStore();
    const sessionStore = useBotSessionStore.getState();
    const runner: TaskRunner = {
      runAttempt: async (attempt) =>
        ({ ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt),
    };

    const controller = new GoalLoopController({
      botId: 'b_1',
      goal: makeGoal(),
      taskRunner: runner,
      onPlanAccepted: (goal, plan) => {
        sessionStore.materializeWIH('b_1', goal, plan);
      },
    });

    const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: 'g_1', eventStore });
    recorder.attach(controller);

    // Simple WIH lifecycle sync: update status on terminal goal events.
    controller.onEvent((event) => {
      const active = sessionStore.getActiveWIH('b_1');
      if (!active) return;
      if (event.type === 'goal.completed') {
        sessionStore.updateWIH(active.id, { status: 'completed' });
      } else if (event.type === 'goal.failed' || event.type === 'goal.cancelled') {
        sessionStore.updateWIH(active.id, { status: event.type === 'goal.failed' ? 'failed' : 'cancelled' });
      }
    });

    controller.materializePlan(makePlan());
    controller.acceptPlan('user_1');
    await controller.run();

    expect(controller.getState().goal.status).toBe('completed');
    const wih = sessionStore.getActiveWIH('b_1');
    expect(wih?.status).toBe('completed');

    recorder.detach();
  });
});
