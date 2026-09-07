/**
 * Tests for deriveBotPresence — the pure presence derivation behind the
 * TEAMMATES rail presence dots.
 */

import { describe, it, expect, vi } from 'vitest';
import { deriveBotPresence, ACTIVE_WINDOW_S, type PresenceSources } from './bot-presence';

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: { getState: () => ({}) },
}));

vi.mock('./bot-canonical-chat.service', () => ({
  openBotCanonicalChat: vi.fn(async () => 'session-mock'),
}));

const NOW = 1_800_000_000_000;

function sources(overrides: Partial<PresenceSources> = {}): PresenceSources {
  return { streaming: false, sessionActivityAt: 0, routineActivityAt: 0, ...overrides };
}

describe('deriveBotPresence', () => {
  it('is idle with no activity and no streaming', () => {
    expect(deriveBotPresence(sources(), NOW)).toEqual({ presence: 'idle', lastActivityAt: 0 });
  });

  it('is working while streaming, regardless of activity age', () => {
    const result = deriveBotPresence(
      sources({ streaming: true, sessionActivityAt: NOW - 10 * ACTIVE_WINDOW_S }),
      NOW,
    );
    expect(result.presence).toBe('working');
    expect(result.lastActivityAt).toBe(NOW - 10 * ACTIVE_WINDOW_S);
  });

  it('is active within the activity window', () => {
    const at = NOW - ACTIVE_WINDOW_S + 1;
    expect(deriveBotPresence(sources({ sessionActivityAt: at }), NOW)).toEqual({
      presence: 'active',
      lastActivityAt: at,
    });
  });

  it('is idle when activity is older than the window', () => {
    const at = NOW - ACTIVE_WINDOW_S;
    expect(deriveBotPresence(sources({ sessionActivityAt: at }), NOW).presence).toBe('idle');
  });

  it('treats routine runs as activity', () => {
    const at = NOW - 30_000;
    expect(
      deriveBotPresence(sources({ routineActivityAt: at }), NOW).presence,
    ).toBe('active');
  });

  it('uses the newest activity across sources', () => {
    const result = deriveBotPresence(
      sources({ sessionActivityAt: NOW - 60_000, routineActivityAt: NOW - 10_000 }),
      NOW,
    );
    expect(result.lastActivityAt).toBe(NOW - 10_000);
  });
});
