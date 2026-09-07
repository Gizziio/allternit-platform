/**
 * Tests for routine delivery semantics (lib/bots/bot-routine.service.ts,
 * spec AD-5): routine output lands as a real inbound turn in the bot's
 * canonical chat; continuity prepends the previous output; monitor mode
 * hashes output and skips the LLM on no-change.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const openBotCanonicalChatMock = vi.fn();
const sendMessageMock = vi.fn();
const executeToolMock = vi.fn();
const isToolsApiEnabledMock = vi.fn();

vi.mock('./bot-canonical-chat.service', () => ({
  openBotCanonicalChat: (...args: unknown[]) => openBotCanonicalChatMock(...args),
}));

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: {
    getState: () => ({ sendMessage: sendMessageMock }),
  },
}));

vi.mock('@/integration/api-client', () => ({
  api: {
    executeTool: (...args: unknown[]) => executeToolMock(...args),
  },
}));

vi.mock('@/lib/env', () => ({
  isToolsApiEnabled: () => isToolsApiEnabledMock(),
}));

import {
  executeBotRoutine,
  useBotRoutineStore,
  calculateNextRun,
  type BotRoutine,
} from './bot-routine.service';
import { fnv1aHex } from './bot-capability-epoch';

function makeRoutine(overrides: Partial<BotRoutine> = {}): BotRoutine {
  return {
    id: 'bot-1::Morning summary',
    botId: 'bot-1',
    botName: 'Researcher',
    title: 'Morning summary',
    instruction: 'Summarize the overnight news.',
    frequency: 'daily',
    enabled: true,
    nextRunAt: 0,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

/**
 * Seed the routine into the (real) store — recordRun is a no-op for ids the
 * store does not know, matching production where the timer only runs due
 * routines that were created through createRoutine.
 */
function seedRoutine(overrides: Partial<BotRoutine> = {}): BotRoutine {
  const routine = makeRoutine(overrides);
  useBotRoutineStore.setState((s) => ({ routines: { ...s.routines, [routine.id]: routine } }));
  return routine;
}

function storedRoutine(id: string): BotRoutine | undefined {
  return useBotRoutineStore.getState().routines[id];
}

describe('executeBotRoutine — canonical chat delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBotRoutineStore.setState({ routines: {} });
    openBotCanonicalChatMock.mockResolvedValue('ses-canonical');
    sendMessageMock.mockResolvedValue(undefined);
  });

  it('delivers the routine as a [bot:<name>] inbound turn in the canonical chat', async () => {
    await executeBotRoutine(seedRoutine());

    expect(openBotCanonicalChatMock).toHaveBeenCalledWith({
      botId: 'bot-1',
      botName: 'Researcher',
      setActive: false,
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('ses-canonical', {
      text: '[bot:Researcher] Morning summary\n\nSummarize the overnight news.',
      skipContext: false,
    });

    const recorded = storedRoutine('bot-1::Morning summary');
    expect(recorded?.lastResult?.success).toBe(true);
    expect(recorded?.lastRunAt).toBeGreaterThan(0);
  });

  it('prepends the previous successful output for continuity (capped at 2KB)', async () => {
    const previous = 'x'.repeat(3 * 1024);
    await executeBotRoutine(
      seedRoutine({ lastResult: { success: true, output: previous } }),
    );

    const text = sendMessageMock.mock.calls[0][1].text as string;
    expect(text).toContain('Previous run output:\n');
    expect(text).not.toContain(previous);
    expect(text).toContain('x'.repeat(2048));
    expect(text.endsWith('x'.repeat(2048))).toBe(true);
  });

  it('does not prepend a failed previous run output', async () => {
    await executeBotRoutine(
      seedRoutine({ lastResult: { success: false, error: 'boom' } }),
    );
    const text = sendMessageMock.mock.calls[0][1].text as string;
    expect(text).toBe('[bot:Researcher] Morning summary\n\nSummarize the overnight news.');
  });

  it('records a failure and skips delivery when the canonical chat cannot open', async () => {
    openBotCanonicalChatMock.mockRejectedValue(new Error('agent store unreachable'));
    await executeBotRoutine(seedRoutine());
    expect(sendMessageMock).not.toHaveBeenCalled();
    const recorded = storedRoutine('bot-1::Morning summary');
    expect(recorded?.lastResult?.success).toBe(false);
    expect(recorded?.lastResult?.error).toContain('agent store unreachable');
  });
});

describe('executeBotRoutine — monitor mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBotRoutineStore.setState({ routines: {} });
    openBotCanonicalChatMock.mockResolvedValue('ses-canonical');
    sendMessageMock.mockResolvedValue(undefined);
  });

  it('fails closed when the local tools API is unavailable', async () => {
    isToolsApiEnabledMock.mockReturnValue(false);
    await executeBotRoutine(seedRoutine({ monitor: { command: 'uptime' } }));
    expect(executeToolMock).not.toHaveBeenCalled();
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(storedRoutine('bot-1::Morning summary')?.lastResult).toEqual({
      success: false,
      error: 'Monitor requires local API',
    });
  });

  it('runs silently (no LLM, no chat message) when the output hash is unchanged', async () => {
    isToolsApiEnabledMock.mockReturnValue(true);
    const output = 'same output';
    executeToolMock.mockResolvedValue({ success: true, output });
    await executeBotRoutine(
      seedRoutine({
        monitor: { command: 'uptime' },
        lastMonitorHash: fnv1aHex(output),
      }),
    );
    expect(sendMessageMock).not.toHaveBeenCalled();
    const recorded = storedRoutine('bot-1::Morning summary');
    expect(recorded?.lastResult?.success).toBe(true);
    expect(recorded?.lastResult?.output).toBe('no change');
  });

  it('delivers changed monitor output to the canonical chat (capped at 4KB) and stamps the hash', async () => {
    isToolsApiEnabledMock.mockReturnValue(true);
    const output = 'y'.repeat(5 * 1024);
    executeToolMock.mockResolvedValue({ success: true, output });
    await executeBotRoutine(seedRoutine({ monitor: { command: 'uptime' } }));

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    const text = sendMessageMock.mock.calls[0][1].text as string;
    expect(text.startsWith('[bot:Researcher] Morning summary\n\n')).toBe(true);
    expect(text).toContain('y'.repeat(4096));
    expect(text).not.toContain('y'.repeat(4097));

    const recorded = storedRoutine('bot-1::Morning summary');
    expect(recorded?.lastResult?.success).toBe(true);
    expect(recorded?.lastMonitorHash).toBe(fnv1aHex(output.slice(0, 4096)));
  });

  it('records a failure when the monitor command fails', async () => {
    isToolsApiEnabledMock.mockReturnValue(true);
    executeToolMock.mockResolvedValue({ success: false, error: 'exit 1' });
    await executeBotRoutine(seedRoutine({ monitor: { command: 'false' } }));
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(storedRoutine('bot-1::Morning summary')?.lastResult).toEqual({
      success: false,
      error: 'exit 1',
    });
  });
});

describe('calculateNextRun', () => {
  const from = Date.UTC(2026, 8, 7, 12, 0, 0); // Monday noon UTC

  it('once-routines never come due again; startup is due immediately', () => {
    expect(calculateNextRun('once', from)).toBe(Number.MAX_SAFE_INTEGER);
    expect(calculateNextRun('startup', from)).toBe(from);
  });

  it('interval respects a 1-hour floor', () => {
    expect(calculateNextRun('interval', from, 0)).toBe(from + 60 * 60 * 1000);
    expect(calculateNextRun('interval', from, 6)).toBe(from + 6 * 60 * 60 * 1000);
  });

  it('weekdays skips the weekend', () => {
    const friday = Date.UTC(2026, 8, 4, 12, 0, 0); // Friday
    const next = calculateNextRun('weekdays', friday);
    expect(new Date(next).getUTCDay()).toBe(1); // Monday
    expect(new Date(next).getUTCHours()).toBe(12);
  });
});
