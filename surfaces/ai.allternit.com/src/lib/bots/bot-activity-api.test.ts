/**
 * Tests for the bot activity API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BotActivityAPI } from './bot-activity-api';
import { createMemoryBotEventStore } from './bot-event-store';

describe('BotActivityAPI', () => {
  it('returns an empty page when no events exist', () => {
    const api = new BotActivityAPI(createMemoryBotEventStore());
    const page = api.query({ botId: 'b_1' });
    expect(page.events).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });

  it('paginates events by cursor', () => {
    const store = createMemoryBotEventStore();
    for (let i = 1; i <= 5; i++) {
      store.append({
        sequence: i,
        botId: 'b_1',
        goalId: 'g_1',
        type: 'task.running',
        payload: { id: `t_${i}`, goalId: 'g_1', botId: 'b_1' },
        occurredAt: new Date().toISOString(),
      });
    }

    const api = new BotActivityAPI(store);
    const first = api.query({ botId: 'b_1', limit: 2 });
    expect(first.events).toHaveLength(2);
    expect(first.events[0]?.sequence).toBe(1);
    expect(first.events[1]?.sequence).toBe(2);
    expect(first.hasMore).toBe(true);

    const second = api.query({ botId: 'b_1', limit: 2, afterSequence: parseInt(first.nextCursor ?? '0') });
    expect(second.events[0]?.sequence).toBe(3);
    expect(second.events[1]?.sequence).toBe(4);

    const third = api.query({ botId: 'b_1', limit: 2, afterSequence: parseInt(second.nextCursor ?? '0') });
    expect(third.events[0]?.sequence).toBe(5);
    expect(third.hasMore).toBe(false);
  });

  it('filters events by goalId', () => {
    const store = createMemoryBotEventStore();
    store.append({ sequence: 1, botId: 'b_1', goalId: 'g_1', type: 'goal.created', payload: {}, occurredAt: new Date().toISOString() });
    store.append({ sequence: 2, botId: 'b_1', goalId: 'g_2', type: 'goal.created', payload: {}, occurredAt: new Date().toISOString() });

    const api = new BotActivityAPI(store);
    const page = api.query({ botId: 'b_1', goalId: 'g_2' });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]?.goalId).toBe('g_2');
  });

  it('filters events by event type', () => {
    const store = createMemoryBotEventStore();
    store.append({ sequence: 1, botId: 'b_1', goalId: 'g_1', type: 'goal.created', payload: {}, occurredAt: new Date().toISOString() });
    store.append({ sequence: 2, botId: 'b_1', goalId: 'g_1', type: 'task.running', payload: { id: 't_1' }, occurredAt: new Date().toISOString() });

    const api = new BotActivityAPI(store);
    const page = api.query({ botId: 'b_1', eventTypes: ['task.running'] });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]?.eventType).toBe('task.running');
  });
});
