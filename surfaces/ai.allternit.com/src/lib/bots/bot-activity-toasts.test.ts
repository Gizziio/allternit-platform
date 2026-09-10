/**
 * Tests for bot-activity-toasts: pref roundtrip (default OFF), archived /
 * hidden suppression via the lifecycle selector, DM detection, preview
 * clipping, and dispatch gating.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import { renderHook, act } from '@testing-library/react';
import {
  BOT_ACTIVITY_TOASTS_PREF_KEY,
  getBotActivityToastsPref,
  setBotActivityToastsPref,
  isToastableBot,
  detectBotDmMessage,
  clipPreview,
  TOAST_PREVIEW_CAP,
  useBotActivityToasts,
} from './bot-activity-toasts';
import { useBotActivityWatermarkStore } from './bot-activity-watermark';
import { useBotRosterStore } from './bot-roster.store';
import type { Agent } from '@/lib/agents/agent.types';

const addToastMock = vi.fn(() => `toast-${addToastMock.mock.calls.length}`);
const removeToastMock = vi.fn();

vi.mock('@/components/ui/toast-provider', () => ({
  useToast: () => ({ addToast: addToastMock, removeToast: removeToastMock }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: create(() => ({
    sessions: [] as Array<{
      id: string;
      updatedAt: string;
      messages?: Array<{ metadata?: Record<string, unknown>; content?: string }>;
    }>,
    activeSessionId: null as string | null,
  })),
}));

vi.mock('./bot-canonical-chat.service', () => ({
  openBotCanonicalChat: vi.fn(async () => 'session-mock'),
  openBotChatView: vi.fn(),
}));

// Bots are supplied through the agents hook, the same idiom the rail uses.
const botsRef: { current: Agent[] } = { current: [] };
vi.mock('@/lib/agents', () => ({
  useAgentsWithSwarms: () => botsRef.current,
}));

import { useChatSessionStore } from '@/views/chat/ChatSessionStore';

const CANONICAL = 'chat-bot-1';

function makeBot(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'bot-1',
    name: 'Researcher',
    isBot: true,
    botProfile: { displayName: 'Researcher' },
    ...overrides,
  } as Agent;
}

beforeEach(() => {
  addToastMock.mockClear();
  removeToastMock.mockClear();
  botsRef.current = [];
  useBotActivityWatermarkStore.getState().reset();
  useBotRosterStore.setState({ canonicalChatIds: { 'bot-1': CANONICAL } });
  useChatSessionStore.setState({ sessions: [], activeSessionId: null });
  globalThis.localStorage?.removeItem(BOT_ACTIVITY_TOASTS_PREF_KEY);
});

describe('pref (opt-in, default OFF)', () => {
  it('defaults to off and roundtrips', () => {
    expect(getBotActivityToastsPref()).toBe('off');
    setBotActivityToastsPref('on');
    expect(getBotActivityToastsPref()).toBe('on');
    setBotActivityToastsPref('off');
    expect(getBotActivityToastsPref()).toBe('off');
  });
});

describe('isToastableBot (lifecycle selector)', () => {
  it('suppresses archived, deprecated, and hidden bots', () => {
    expect(isToastableBot(makeBot())).toBe(true);
    expect(
      isToastableBot(makeBot({ botProfile: { displayName: 'R', lifecycle: 'archived' } } as Partial<Agent>)),
    ).toBe(false);
    expect(
      isToastableBot(makeBot({ botProfile: { displayName: 'R', lifecycle: 'deprecated' } } as Partial<Agent>)),
    ).toBe(false);
    expect(
      isToastableBot(makeBot({ botProfile: { displayName: 'R', hidden: true } } as Partial<Agent>)),
    ).toBe(false);
    expect(isToastableBot(undefined)).toBe(false);
  });
});

describe('detectBotDmMessage + clipPreview', () => {
  it('detects bot authorship from message metadata, else null', () => {
    expect(detectBotDmMessage({ id: 'm1', role: 'assistant', content: '', timestamp: '', metadata: { botId: 'bot-9' } })).toBe(true);
    expect(detectBotDmMessage({ id: 'm1', role: 'assistant', content: '', timestamp: '', metadata: { botId: '' } })).toBe(false);
    expect(detectBotDmMessage({ id: 'm1', role: 'assistant', content: '', timestamp: '' })).toBeNull();
  });

  it('clips previews to 140 chars with an ellipsis', () => {
    const long = `${'word '.repeat(60)}`;
    const clipped = clipPreview(long);
    expect(clipped.length).toBeLessThanOrEqual(TOAST_PREVIEW_CAP);
    expect(clipped.endsWith('…')).toBe(true);
    expect(clipPreview('short')).toBe('short');
  });
});

describe('useBotActivityToasts dispatch', () => {
  const t0 = '2026-09-07T08:00:00.000Z';
  const t1 = '2026-09-07T08:05:00.000Z';

  function sessionAt(updatedAt: string, metadata?: Record<string, unknown>) {
    return {
      id: CANONICAL,
      updatedAt,
      messages: [{ content: 'hello there', ...(metadata ? { metadata } : {}) }],
    };
  }

  it('does nothing while the pref is off', () => {
    setBotActivityToastsPref('off');
    botsRef.current = [makeBot()];
    useChatSessionStore.setState({ sessions: [sessionAt(t1)] });
    renderHook(() => useBotActivityToasts());
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it('toasts generic activity when authorship is not determinable', () => {
    setBotActivityToastsPref('on');
    botsRef.current = [makeBot()];
    useChatSessionStore.setState({ sessions: [sessionAt(t0)] });
    renderHook(() => useBotActivityToasts());

    act(() => {
      useChatSessionStore.setState({ sessions: [sessionAt(t1)] });
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    const toast = addToastMock.mock.calls[0][0];
    expect(toast.title).toBe('Researcher has new activity');
    expect(toast.description).toBe('hello there');
  });

  it('uses the DM form when the last message metadata marks bot authorship', () => {
    setBotActivityToastsPref('on');
    botsRef.current = [makeBot()];
    useChatSessionStore.setState({ sessions: [sessionAt(t0)] });
    renderHook(() => useBotActivityToasts());

    act(() => {
      useChatSessionStore.setState({
        sessions: [sessionAt(t1, { botId: 'bot-9' })],
      });
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    expect(addToastMock.mock.calls[0][0].title).toBe('🤖 New message for Researcher');
  });

  it('never toasts for archived bots (silent accumulation)', () => {
    setBotActivityToastsPref('on');
    botsRef.current = [makeBot({ botProfile: { displayName: 'Researcher', lifecycle: 'archived' } } as Partial<Agent>)];
    useChatSessionStore.setState({ sessions: [sessionAt(t0)] });
    renderHook(() => useBotActivityToasts());

    act(() => {
      useChatSessionStore.setState({ sessions: [sessionAt(t1)] });
    });

    expect(addToastMock).not.toHaveBeenCalled();
  });

  it('does not toast for the currently focused chat', () => {
    setBotActivityToastsPref('on');
    botsRef.current = [makeBot()];
    useChatSessionStore.setState({ sessions: [sessionAt(t0)] });
    useBotActivityWatermarkStore.getState().setFocusedSession(CANONICAL);
    renderHook(() => useBotActivityToasts());

    act(() => {
      useChatSessionStore.setState({ sessions: [sessionAt(t1)] });
    });

    expect(addToastMock).not.toHaveBeenCalled();
  });
});
