/**
 * Tests for bot-routine.service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useBotRoutineStore,
  createBotRoutine,
  deleteBotRoutine,
  enableBotRoutine,
  disableBotRoutine,
  getRoutinesForBot,
  executeBotRoutine,
  runDueBotRoutines,
  type BotRoutineFrequency,
} from '../bot-routine.service';

const sendMessageMock = vi.fn();

vi.mock('../bot-canonical-chat.service', () => ({
  openBotCanonicalChat: vi.fn(async ({ botId }: { botId: string }) => `session-${botId}`),
}));

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: {
    getState: () => ({
      sendMessage: sendMessageMock,
    }),
  },
}));

beforeEach(() => {
  sendMessageMock.mockReset();
  useBotRoutineStore.setState({ routines: {} });
});

function createRoutine(botId: string, title: string, frequency: BotRoutineFrequency) {
  return createBotRoutine({
    botId,
    botName: 'Test Bot',
    title,
    instruction: 'Say hello',
    frequency,
  });
}

describe('bot-routine store', () => {
  it('creates a routine with calculated nextRunAt', () => {
    const before = Date.now();
    const routine = createRoutine('bot-1', 'Morning check', 'daily');
    const after = Date.now();

    expect(routine.id).toBe('bot-1::Morning check');
    expect(routine.botId).toBe('bot-1');
    expect(routine.enabled).toBe(true);
    expect(routine.nextRunAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);
    expect(routine.nextRunAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000);
  });

  it('lists routines scoped to a bot', () => {
    createRoutine('bot-1', 'A', 'daily');
    createRoutine('bot-1', 'B', 'weekly');
    createRoutine('bot-2', 'C', 'daily');

    const routines = getRoutinesForBot('bot-1');
    expect(routines).toHaveLength(2);
    expect(routines.map((r) => r.title).sort()).toEqual(['A', 'B']);
  });

  it('deletes a routine by botId and title', () => {
    createRoutine('bot-1', 'A', 'daily');
    expect(getRoutinesForBot('bot-1')).toHaveLength(1);

    deleteBotRoutine('bot-1', 'A');
    expect(getRoutinesForBot('bot-1')).toHaveLength(0);
  });

  it('disables and re-enables a routine', () => {
    createRoutine('bot-1', 'A', 'daily');
    disableBotRoutine('bot-1', 'A');

    let routines = getRoutinesForBot('bot-1');
    expect(routines[0].enabled).toBe(false);

    const beforeEnable = Date.now();
    enableBotRoutine('bot-1', 'A');
    const afterEnable = Date.now();

    routines = getRoutinesForBot('bot-1');
    expect(routines[0].enabled).toBe(true);
    expect(routines[0].nextRunAt).toBeGreaterThanOrEqual(beforeEnable);
    expect(routines[0].nextRunAt).toBeLessThanOrEqual(afterEnable + 24 * 60 * 60 * 1000 + 1000);
  });

  it('returns due routines', () => {
    const dueRoutine = createRoutine('bot-1', 'Due', 'startup');
    createRoutine('bot-1', 'Future', 'monthly');

    const due = useBotRoutineStore.getState().getDueRoutines();
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(dueRoutine.id);
  });
});

describe('executeBotRoutine', () => {
  it('opens canonical chat, sends prompt, and records success', async () => {
    const routine = createRoutine('bot-1', 'Morning check', 'daily');

    await executeBotRoutine(routine);

    const { openBotCanonicalChat } = await import('../bot-canonical-chat.service');
    expect(openBotCanonicalChat).toHaveBeenCalledWith({
      botId: 'bot-1',
      botName: 'Test Bot',
      setActive: false,
    });
    expect(sendMessageMock).toHaveBeenCalledWith('session-bot-1', {
      text: '[bot:Test Bot] Morning check\n\nSay hello',
      skipContext: false,
    });

    const stored = useBotRoutineStore.getState().routines[routine.id];
    expect(stored.lastResult?.success).toBe(true);
    expect(stored.lastRunAt).toBeGreaterThan(0);
  });

  it('records failure when sendMessage throws', async () => {
    sendMessageMock.mockRejectedValueOnce(new Error('chat offline'));
    const routine = createRoutine('bot-1', 'Broken', 'daily');

    await executeBotRoutine(routine);

    const stored = useBotRoutineStore.getState().routines[routine.id];
    expect(stored.lastResult?.success).toBe(false);
    expect(stored.lastResult?.error).toBe('chat offline');
  });
});

describe('runDueBotRoutines', () => {
  it('runs only due routines', async () => {
    createRoutine('bot-1', 'Due', 'startup');
    createRoutine('bot-1', 'Future', 'monthly');

    await runDueBotRoutines();

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });
});
