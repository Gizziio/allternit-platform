/**
 * Tests for the bot activity API.
 */

import { describe, it, expect, vi } from 'vitest';
import { BotActivityAPI, botEventRowToActivityEvent } from './bot-activity-api';
import { createMemoryBotEventStore } from './bot-event-store';
import { type BotEventsApi, type BotEventRow, type BotEventPage } from './bot-events-api';
import { GoalSchema, type Goal } from './goal-task-contracts';

const now = new Date().toISOString();

function makeRow(overrides: Partial<BotEventRow> = {}): BotEventRow {
  return {
    id: 'evt_1',
    sequence: 1,
    botId: 'b_1',
    goalId: 'g_1',
    eventType: 'task.running',
    actor: { type: 'bot', id: 'b_1' },
    payload: {},
    occurredAt: now,
    ...overrides,
  };
}

function mockEventsApi(pages: BotEventPage[]): BotEventsApi & {
  queryBotEvents: ReturnType<typeof vi.fn>;
} {
  const queue = [...pages];
  return {
    appendBotEvent: vi.fn(),
    queryBotEvents: vi.fn(async () => queue.shift() ?? { events: [], hasMore: false }),
    getBotOperationalState: vi.fn(),
  };
}

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

describe('botEventRowToActivityEvent', () => {
  it('maps a server row to an ActivityEvent', () => {
    const row = makeRow({
      id: 'srv_42',
      sequence: 7,
      sessionId: 's_1',
      wihId: 'w_1',
      taskId: 't_1',
      eventType: 'task.completed',
      actor: { type: 'user', id: 'u_1' },
      payload: { result: 'ok' },
    });

    const event = botEventRowToActivityEvent(row);
    expect(event.id).toBe('srv_42');
    expect(event.sequence).toBe(7);
    expect(event.botId).toBe('b_1');
    expect(event.sessionId).toBe('s_1');
    expect(event.goalId).toBe('g_1');
    expect(event.wihId).toBe('w_1');
    expect(event.taskId).toBe('t_1');
    expect(event.eventType).toBe('task.completed');
    expect(event.actor).toEqual({ type: 'user', id: 'u_1' });
    expect(event.payload).toEqual({ result: 'ok' });
    expect(event.occurredAt).toBe(now);
  });
});

describe('BotActivityAPI.query', () => {
  it('returns an empty page when no events exist', async () => {
    const eventsApi = mockEventsApi([{ events: [], hasMore: false }]);
    const api = new BotActivityAPI(eventsApi, createMemoryBotEventStore());

    const page = await api.query({ botId: 'b_1' });
    expect(page.events).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
    expect(eventsApi.queryBotEvents).toHaveBeenCalledWith('b_1', {
      afterSequence: undefined,
      limit: 50,
      eventTypes: undefined,
    });
  });

  it('passes cursor, limit, and event types through to the server', async () => {
    const eventsApi = mockEventsApi([
      { events: [makeRow({ sequence: 3 }), makeRow({ sequence: 4 })], nextCursor: '4', hasMore: true },
    ]);
    const api = new BotActivityAPI(eventsApi, createMemoryBotEventStore());

    const page = await api.query({
      botId: 'b_1',
      afterSequence: 2,
      limit: 2,
      eventTypes: ['task.running'],
    });

    expect(eventsApi.queryBotEvents).toHaveBeenCalledWith('b_1', {
      afterSequence: 2,
      limit: 2,
      eventTypes: ['task.running'],
    });
    expect(page.events.map((e) => e.sequence)).toEqual([3, 4]);
    expect(page.nextCursor).toBe('4');
    expect(page.hasMore).toBe(true);
  });

  it('filters the returned page by goalId client-side', async () => {
    const eventsApi = mockEventsApi([
      {
        events: [makeRow({ sequence: 1, goalId: 'g_1' }), makeRow({ sequence: 2, goalId: 'g_2' })],
        nextCursor: '2',
        hasMore: false,
      },
    ]);
    const api = new BotActivityAPI(eventsApi, createMemoryBotEventStore());

    const page = await api.query({ botId: 'b_1', goalId: 'g_2' });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]?.goalId).toBe('g_2');
  });
});

describe('BotActivityAPI.search', () => {
  it('searches the local offline replica without hitting the server', () => {
    const store = createMemoryBotEventStore();
    store.append({
      sequence: 1,
      botId: 'b_1',
      goalId: 'g_1',
      type: 'goal.created',
      payload: { objective: 'Summarize Q1 metrics' },
      occurredAt: now,
    });
    store.append({
      sequence: 2,
      botId: 'b_1',
      goalId: 'g_1',
      type: 'goal.created',
      payload: { objective: 'Draft Q2 roadmap' },
      occurredAt: now,
    });

    const eventsApi = mockEventsApi([]);
    const api = new BotActivityAPI(eventsApi, store);

    const results = api.search('b_1', 'roadmap');
    expect(results).toHaveLength(1);
    expect(results[0]?.sequence).toBe(2);
    expect(eventsApi.queryBotEvents).not.toHaveBeenCalled();
  });
});

describe('BotActivityAPI.replayGoal', () => {
  it('pages through the server ledger and rebuilds goal state', async () => {
    const goal = makeGoal({ status: 'draft' });
    const eventsApi = mockEventsApi([
      {
        events: [
          makeRow({ id: 'e1', sequence: 1, goalId: 'g_1', eventType: 'goal.created', payload: goal }),
          makeRow({ id: 'e2', sequence: 2, goalId: 'g_other', eventType: 'goal.created', payload: makeGoal({ id: 'g_other' }) }),
        ],
        nextCursor: '2',
        hasMore: true,
      },
      {
        events: [
          makeRow({ id: 'e3', sequence: 3, goalId: 'g_1', eventType: 'goal.activated', payload: { ...goal, status: 'active' } }),
        ],
        nextCursor: '3',
        hasMore: false,
      },
    ]);
    const api = new BotActivityAPI(eventsApi, createMemoryBotEventStore());

    const state = await api.replayGoal('g_1', 'b_1');
    expect(state).not.toBeNull();
    expect(state?.goal.id).toBe('g_1');
    expect(state?.goal.status).toBe('active');

    // Resumed the second page with the cursor from the first.
    expect(eventsApi.queryBotEvents).toHaveBeenNthCalledWith(1, 'b_1', { afterSequence: undefined, limit: 200 });
    expect(eventsApi.queryBotEvents).toHaveBeenNthCalledWith(2, 'b_1', { afterSequence: 2, limit: 200 });
  });

  it('returns null when the goal has no events', async () => {
    const eventsApi = mockEventsApi([
      { events: [makeRow({ goalId: 'g_other', payload: makeGoal({ id: 'g_other' }) })], hasMore: false },
    ]);
    const api = new BotActivityAPI(eventsApi, createMemoryBotEventStore());

    const state = await api.replayGoal('g_1', 'b_1');
    expect(state).toBeNull();
  });
});
