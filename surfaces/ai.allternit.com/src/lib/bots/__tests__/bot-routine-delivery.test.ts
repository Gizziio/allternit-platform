/**
 * Tests for routine delivery semantics added in Phase 1:
 * - continuity prepend (previous run output, capped at 2KB)
 * - monitor mode (hash-based change suppression, 4KB delivery cap, local-API guard)
 * - frequency → nextRunAt mapping (calculateNextRun)
 * - startup inclusion in the due sweep
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useBotRoutineStore,
  createBotRoutine,
  executeBotRoutine,
  runDueBotRoutines,
  calculateNextRun,
  type BotRoutine,
} from '../bot-routine.service';

const sendMessageMock = vi.fn();
const executeToolMock = vi.fn();

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

vi.mock('@/integration/api-client', () => ({
  api: {
    // Lazy wrapper: the factory is hoisted, so the module-level mock ref must
    // not be touched until call time.
    executeTool: (...args: unknown[]) =>
      executeToolMock(...(args as [string, Record<string, unknown>])),
  },
}));

const TOOLS_ENV = 'NEXT_PUBLIC_ALLTERNIT_TOOLS_API';

beforeEach(() => {
  sendMessageMock.mockReset();
  executeToolMock.mockReset();
  useBotRoutineStore.setState({ routines: {} });
  vi.stubEnv(TOOLS_ENV, '1');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function storedRoutine(id: string): BotRoutine {
  return useBotRoutineStore.getState().routines[id];
}

describe('continuity prepend (context_from: self)', () => {
  it('prepends the previous successful output to the routine prompt', async () => {
    const routine = createBotRoutine({
      botId: 'bot-1',
      botName: 'Test Bot',
      title: 'Digest',
      instruction: 'Summarize the logs',
      frequency: 'daily',
    });
    useBotRoutineStore.getState().recordRun(routine.id, { success: true, output: 'PREV-OUTPUT' });

    await executeBotRoutine(storedRoutine(routine.id));

    const text = sendMessageMock.mock.calls[0][1].text as string;
    expect(text).toContain('Summarize the logs');
    expect(text).toContain('Previous run output:\nPREV-OUTPUT');
  });

  it('does not prepend when the previous run failed', async () => {
    const routine = createBotRoutine({
      botId: 'bot-1',
      botName: 'Test Bot',
      title: 'Digest',
      instruction: 'Summarize the logs',
      frequency: 'daily',
    });
    useBotRoutineStore
      .getState()
      .recordRun(routine.id, { success: false, error: 'boom', output: 'STALE' });

    await executeBotRoutine(storedRoutine(routine.id));

    const text = sendMessageMock.mock.calls[0][1].text as string;
    expect(text).not.toContain('Previous run output:');
  });

  it('caps the prepended output at 2KB', async () => {
    const routine = createBotRoutine({
      botId: 'bot-1',
      botName: 'Test Bot',
      title: 'Digest',
      instruction: 'Summarize the logs',
      frequency: 'daily',
    });
    const big = 'x'.repeat(5_000);
    useBotRoutineStore.getState().recordRun(routine.id, { success: true, output: big });

    await executeBotRoutine(storedRoutine(routine.id));

    const text = sendMessageMock.mock.calls[0][1].text as string;
    const marker = 'Previous run output:\n';
    const idx = text.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    expect(text.length - idx - marker.length).toBeLessThanOrEqual(2 * 1024);
    expect(text).not.toContain('x'.repeat(4_000));
  });
});

describe('monitor routines', () => {
  function createMonitorRoutine(command = 'git status') {
    return createBotRoutine({
      botId: 'bot-1',
      botName: 'Test Bot',
      title: 'Watch repo',
      instruction: 'ignored in monitor mode',
      frequency: 'hourly',
      monitor: { command },
    });
  }

  it('delivers the first run and suppresses unchanged output', async () => {
    executeToolMock.mockResolvedValue({ success: true, output: 'same' });
    const routine = createMonitorRoutine();

    await executeBotRoutine(storedRoutine(routine.id));
    expect(executeToolMock).toHaveBeenCalledWith('shell', { command: 'git status' });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(storedRoutine(routine.id).lastResult?.output).toContain('delivered');

    // Second run with identical output: silent — no new chat message.
    await executeBotRoutine(storedRoutine(routine.id));
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(storedRoutine(routine.id).lastResult?.output).toBe('no change');
  });

  it('delivers when the output changes and caps at 4KB', async () => {
    executeToolMock.mockResolvedValueOnce({ success: true, output: 'before' });
    const routine = createMonitorRoutine();
    await executeBotRoutine(storedRoutine(routine.id));
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    const big = 'y'.repeat(9_000);
    executeToolMock.mockResolvedValueOnce({ success: true, output: big });
    await executeBotRoutine(storedRoutine(routine.id));

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    const text = sendMessageMock.mock.calls[1][1].text as string;
    expect(text).not.toContain('y'.repeat(5_000));
    expect(text).toContain('[bot:Test Bot] Watch repo');
  });

  it('fails closed without the local tools API', async () => {
    vi.stubEnv(TOOLS_ENV, '0');
    const routine = createMonitorRoutine();

    await executeBotRoutine(storedRoutine(routine.id));

    expect(executeToolMock).not.toHaveBeenCalled();
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(storedRoutine(routine.id).lastResult?.success).toBe(false);
    expect(storedRoutine(routine.id).lastResult?.error).toBe('Monitor requires local API');
  });

  it('records command failures without touching the chat', async () => {
    executeToolMock.mockResolvedValue({ success: false, error: 'exit 1' });
    const routine = createMonitorRoutine();

    await executeBotRoutine(storedRoutine(routine.id));

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(storedRoutine(routine.id).lastResult?.success).toBe(false);
    expect(storedRoutine(routine.id).lastResult?.error).toBe('exit 1');
  });
});

describe('calculateNextRun frequency mapping', () => {
  const FROM = new Date('2026-09-04T12:00:00Z').getTime(); // a Friday
  const H = 60 * 60 * 1000;
  const D = 24 * H;

  it('maps each frequency to its next-run timestamp', () => {
    expect(calculateNextRun('startup', FROM)).toBe(FROM);
    expect(calculateNextRun('once', FROM)).toBe(Number.MAX_SAFE_INTEGER);
    expect(calculateNextRun('hourly', FROM)).toBe(FROM + H);
    expect(calculateNextRun('daily', FROM)).toBe(FROM + D);
    expect(calculateNextRun('weekly', FROM)).toBe(FROM + 7 * D);
    expect(calculateNextRun('monthly', FROM)).toBe(FROM + 30 * D);
  });

  it('honours interval hours and defaults to 24h', () => {
    expect(calculateNextRun('interval', FROM, 6)).toBe(FROM + 6 * H);
    expect(calculateNextRun('interval', FROM)).toBe(FROM + 24 * H);
    expect(calculateNextRun('interval', FROM, 0)).toBe(FROM + H);
  });

  it('skips the weekend for weekdays schedules', () => {
    // Friday 12:00 → Monday 12:00
    expect(calculateNextRun('weekdays', FROM)).toBe(FROM + 3 * D);
    // Sunday 12:00 → Monday 12:00
    const sunday = new Date('2026-09-06T12:00:00Z').getTime();
    expect(calculateNextRun('weekdays', sunday)).toBe(sunday + D);
    // Thursday 12:00 → Friday 12:00
    const thursday = new Date('2026-09-03T12:00:00Z').getTime();
    expect(calculateNextRun('weekdays', thursday)).toBe(thursday + D);
  });
});

describe('runDueBotRoutines startup handling', () => {
  it('excludes startup routines by default and includes them on request', async () => {
    createBotRoutine({
      botId: 'bot-1',
      botName: 'Test Bot',
      title: 'Launch',
      instruction: 'Boot check',
      frequency: 'startup',
    });

    await runDueBotRoutines();
    expect(sendMessageMock).not.toHaveBeenCalled();

    await runDueBotRoutines({ includeStartup: true });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });
});
