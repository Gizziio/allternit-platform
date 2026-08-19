/**
 * Wave 3 exit-gate test.
 *
 * Proves one bot can complete several bounded sessions and several WIHs,
 * search full history, resume selected work, and start a new session without
 * raw prior-transcript leakage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoalLoopController, type TaskRunner, type Attempt } from './goal-loop-controller';
import { GoalLoopRecorder } from './goal-loop-persistence';
import { useBotSessionStore } from './bot-session-store';
import { createMemoryBotEventStore } from './bot-event-store';
import { BotActivityAPI } from './bot-activity-api';
import { GoalSchema, PlanSchema, TaskGraphSchema, type Goal } from './goal-task-contracts';

const now = new Date().toISOString();

function makeGoal(id: string, objective: string, overrides: Partial<Goal> = {}): Goal {
  return GoalSchema.parse({
    id,
    botId: 'b_1',
    objective,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makePlan(goalId: string, taskIds: string[] = ['t_1']): ReturnType<typeof PlanSchema.parse> {
  return PlanSchema.parse({
    id: `p_${goalId}`,
    goalId,
    botId: 'b_1',
    summary: 'Plan',
    taskGraph: TaskGraphSchema.parse({
      id: `tg_${goalId}`,
      goalId,
      botId: 'b_1',
      nodes: taskIds.map((id) => ({ id: `n_${id}`, taskId: id, dependencies: [] })),
      createdAt: now,
      updatedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
  });
}

const succeedingRunner: TaskRunner = {
  runAttempt: async (attempt) =>
    ({ ...attempt, status: 'completed', updatedAt: new Date().toISOString() } as Attempt),
};

async function runGoalToCompletion(
  goal: Goal,
  eventStore: ReturnType<typeof createMemoryBotEventStore>,
  sessionStore: ReturnType<typeof useBotSessionStore.getState>,
  runner: TaskRunner = succeedingRunner,
): Promise<{ controller: GoalLoopController; wihId: string }> {
  const controller = new GoalLoopController({
    botId: 'b_1',
    goal,
    taskRunner: runner,
    onPlanAccepted: (g, p) => {
      sessionStore.materializeWIH('b_1', g, p);
    },
  });

  const recorder = new GoalLoopRecorder({ botId: 'b_1', goalId: goal.id, eventStore });
  recorder.attach(controller);

  controller.materializePlan(makePlan(goal.id));
  controller.acceptPlan('user_1');
  await controller.run();

  const wih = sessionStore.getActiveWIH('b_1');
  if (wih) {
    sessionStore.updateWIH(wih.id, {
      status: controller.getState().goal.status === 'completed' ? 'completed' : 'failed',
    });
  }

  recorder.detach();
  return { controller, wihId: wih?.id ?? '' };
}

describe('Wave 3 exit gate', () => {
  beforeEach(() => {
    useBotSessionStore.setState({ sessions: {}, wihs: {}, activeSessionIdByBot: {} });
  });

  it('completes several bounded sessions and WIHs, searches history, resumes work, and starts a clean new session', async () => {
    const eventStore = createMemoryBotEventStore();
    const sessionStore = useBotSessionStore.getState();
    const activityAPI = new BotActivityAPI(eventStore);

    // ── Session 1: first goal ────────────────────────────────────────────────
    const session1 = sessionStore.createSession('b_1', 'First research session');
    const { controller: c1 } = await runGoalToCompletion(
      makeGoal('g_1', 'Summarize Q1 metrics'),
      eventStore,
      sessionStore,
    );
    expect(c1.getState().goal.status).toBe('completed');
    sessionStore.setActiveSession('b_1', session1.id);
    sessionStore.setSessionSummary(session1.id, {
      id: 'sum_1',
      sessionId: session1.id,
      content: 'Q1 metrics summarized; key insight: revenue up 12%.',
      decisions: ['Focus on retention in Q2'],
      openLoops: [],
      artifacts: ['q1-summary.md'],
      unresolvedQuestions: [],
      memoryCandidates: ['q1-revenue-up-12'],
      sourceEventRange: { fromSequence: 1, toSequence: 50 },
      createdAt: now,
    });
    sessionStore.closeSession(session1.id);

    // ── Session 2: second goal (different bounded session) ───────────────────
    const session2 = sessionStore.createSession('b_1', 'Second research session');
    const { controller: c2 } = await runGoalToCompletion(
      makeGoal('g_2', 'Draft Q2 roadmap'),
      eventStore,
      sessionStore,
    );
    expect(c2.getState().goal.status).toBe('completed');
    sessionStore.closeSession(session2.id);

    // ── Bot has several bounded sessions and WIHs ────────────────────────────
    const allSessions = Object.values(useBotSessionStore.getState().sessions);
    expect(allSessions.length).toBeGreaterThanOrEqual(2);
    const allWihs = Object.values(useBotSessionStore.getState().wihs);
    expect(allWihs.length).toBeGreaterThanOrEqual(2);

    // ── Search full history ──────────────────────────────────────────────────
    const searchResults = activityAPI.search('b_1', 'roadmap');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some((e) => e.goalId === 'g_2')).toBe(true);

    const q1Results = activityAPI.search('b_1', 'Q1 metrics');
    expect(q1Results.some((e) => e.goalId === 'g_1')).toBe(true);

    // ── Resume selected work from session 1 ──────────────────────────────────
    const resumedState = await activityAPI.replayGoal('g_1', 'b_1');
    expect(resumedState).not.toBeNull();
    expect(resumedState?.goal.status).toBe('completed');
    expect(resumedState?.goal.objective).toBe('Summarize Q1 metrics');

    // ── Start a new session; context should NOT leak raw transcript ──────────
    const session3 = sessionStore.createSession('b_1', 'Follow-up session');
    const context = sessionStore.getSessionContext(session1.id);
    expect(context).not.toBeNull();
    expect(context?.summary?.content).toBe('Q1 metrics summarized; key insight: revenue up 12%.');
    expect(context?.memoryCandidates).toContain('q1-revenue-up-12');
    // Raw transcript events are not part of the session context.
    expect(context).not.toHaveProperty('events');
    expect(context).not.toHaveProperty('rawMessages');

    // The new session has no WIH yet.
    sessionStore.setActiveSession('b_1', session3.id);
    expect(sessionStore.getActiveWIH('b_1')).toBeNull();
  });
});
