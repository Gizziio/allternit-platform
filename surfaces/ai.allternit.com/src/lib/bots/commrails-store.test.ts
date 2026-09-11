import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dropSeedBotSessions } from './commrails-store';
import {
  fetchVisibility,
  isExecutorThread,
  isSeedBotSession,
  paneStateToOperational,
  EMPTY_VISIBILITY,
} from './commrails-visibility';
import type { BotRailItem } from './commrails-types';

vi.mock('@/lib/env', () => ({
  isRailsApiEnabled: () => true,
}));

vi.mock('@/lib/agents/api-config', () => ({
  GATEWAY_BASE_URL: 'http://127.0.0.1:8013',
}));

describe('seed bot drop', () => {
  it('drops the three seed session names', () => {
    const items: BotRailItem[] = [
      {
        id: 'bot-session-deep-researcher',
        label: 'Deep Researcher',
        payload: 'x',
        botId: 'deep-researcher-001',
      },
      {
        id: 'live-1',
        label: 'Real bot',
        payload: 'real',
        botId: 'bot-real',
      },
    ];
    expect(dropSeedBotSessions(items).map((i) => i.id)).toEqual(['live-1']);
  });

  it('isSeedBotSession matches id or botId', () => {
    expect(isSeedBotSession('bot-session-code-reviewer')).toBe(true);
    expect(isSeedBotSession('other', 'writing-partner-001')).toBe(true);
    expect(isSeedBotSession('live', 'bot-real')).toBe(false);
  });
});

describe('executor threads', () => {
  it('keeps the wih:executor- prefix', () => {
    expect(isExecutorThread('wih:executor-ba-0b-commrails')).toBe(true);
    expect(isExecutorThread('wih:bot-abc')).toBe(false);
  });
});

describe('pane state map', () => {
  it('maps ao pane states onto operational status', () => {
    expect(paneStateToOperational('working')).toBe('working');
    expect(paneStateToOperational('blocked')).toBe('waiting_input');
    expect(paneStateToOperational('idle')).toBe('idle');
  });
});

describe('fetchVisibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty dto and does not throw when fetch fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down'));
    const dto = await fetchVisibility(fetchImpl as unknown as typeof fetch);
    expect(dto).toEqual(EMPTY_VISIBILITY);
    expect(dto.aoRunning).toBe(false);
  });

  it('parses a successful commrails visibility payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        panes: [{ id: 'p1', label: 'ao-ba-0b', state: 'working' }],
        machines: [],
        fabricDevices: [],
        needsYou: [],
      }),
    });
    const dto = await fetchVisibility(fetchImpl as unknown as typeof fetch);
    expect(dto.aoRunning).toBe(true);
    expect(dto.panes).toEqual([
      { id: 'p1', label: 'ao-ba-0b', state: 'working' },
    ]);
  });
});
