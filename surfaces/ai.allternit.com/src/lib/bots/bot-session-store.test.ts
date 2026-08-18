/**
 * Tests for the bot session and WIH store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useBotSessionStore } from './bot-session-store';
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

describe('bot-session-store', () => {
  beforeEach(() => {
    useBotSessionStore.setState({ sessions: {}, wihs: {}, activeSessionIdByBot: {} });
  });

  it('creates a session and marks it active', () => {
    const store = useBotSessionStore.getState();
    const session = store.createSession('b_1', 'Research session', 'proj_1');

    expect(session.botId).toBe('b_1');
    expect(session.title).toBe('Research session');
    expect(session.projectId).toBe('proj_1');
    expect(session.status).toBe('active');
    expect(store.getActiveSession('b_1')?.id).toBe(session.id);
  });

  it('materializes a WIH linked to the active session', () => {
    const store = useBotSessionStore.getState();
    const goal = makeGoal();
    const plan = makePlan();

    const wih = store.materializeWIH('b_1', goal, plan);

    expect(wih.botId).toBe('b_1');
    expect(wih.goalId).toBe('g_1');
    expect(wih.taskGraphId).toBe('tg_1');
    expect(wih.status).toBe('active');

    const session = store.getSession(wih.sessionId);
    expect(session).not.toBeNull();
    expect(session?.goalIds).toContain('g_1');
    expect(session?.wihIds).toContain(wih.id);
    expect(session?.currentWihId).toBe(wih.id);
  });

  it('links a WIH to an explicitly provided session', () => {
    const store = useBotSessionStore.getState();
    const session = store.createSession('b_1', 'Explicit session');
    const wih = store.materializeWIH('b_1', makeGoal(), makePlan(), { sessionId: session.id });

    expect(wih.sessionId).toBe(session.id);
    expect(store.getSession(session.id)?.wihIds).toContain(wih.id);
  });

  it('updates WIH status and current task', () => {
    const store = useBotSessionStore.getState();
    const wih = store.materializeWIH('b_1', makeGoal(), makePlan());

    store.updateWIH(wih.id, { currentTaskId: 't_1', status: 'waiting_approval' });

    const updated = store.getWIH(wih.id);
    expect(updated?.currentTaskId).toBe('t_1');
    expect(updated?.status).toBe('waiting_approval');
  });

  it('closes a session', () => {
    const store = useBotSessionStore.getState();
    const session = store.createSession('b_1', 'To close');
    store.closeSession(session.id);

    const closed = store.getSession(session.id);
    expect(closed?.status).toBe('closed');
    expect(closed?.closedAt).toBeDefined();
  });

  it('sets session context budget and summary', () => {
    const store = useBotSessionStore.getState();
    const session = store.createSession('b_1', 'Budgeted session');

    store.setSessionContextBudget(session.id, { maxTokens: 4096, maxMessages: 20 });
    const updated = store.getSession(session.id);
    expect(updated?.contextBudget).toEqual({ maxTokens: 4096, maxMessages: 20 });

    store.setSessionSummary(session.id, {
      id: 'sum_1',
      sessionId: session.id,
      content: 'Summary',
      sourceEventRange: { fromSequence: 1, toSequence: 10 },
      createdAt: now,
    });
    const withSummary = store.getSession(session.id);
    expect(withSummary?.summary?.content).toBe('Summary');
  });
});
