/**
 * Tests for bot-activity-watermark: seeding (history never unread),
 * markSeen/markAllSeen, focused-chat refresh-in-place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import { renderHook, act } from '@testing-library/react';
import {
  useBotActivityWatermarkStore,
  useBotHasNewActivity,
  computeHasNewActivity,
  canonicalActivityAt,
} from './bot-activity-watermark';
import { useBotRosterStore } from './bot-roster.store';

// Lightweight stand-in for the chat session store.
vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: create(() => ({
    sessions: [] as Array<{ id: string; updatedAt: string }>,
    activeSessionId: null as string | null,
  })),
}));

vi.mock('./bot-canonical-chat.service', () => ({
  openBotCanonicalChat: vi.fn(async () => 'session-mock'),
}));

import { useChatSessionStore } from '@/views/chat/ChatSessionStore';

const CANONICAL = 'chat-bot-1';

function setSession(updatedAt: string) {
  useChatSessionStore.setState({
    sessions: [{ id: CANONICAL, updatedAt }],
    activeSessionId: null,
  });
}

beforeEach(() => {
  useBotActivityWatermarkStore.getState().reset();
  useBotRosterStore.setState({ canonicalChatIds: { 'bot-1': CANONICAL } });
  useChatSessionStore.setState({ sessions: [], activeSessionId: null });
});

describe('watermark store', () => {
  it('seeds only when absent — history never marks unread', () => {
    const store = useBotActivityWatermarkStore.getState();
    store.seedWatermark('bot-1', 1_000);
    expect(useBotActivityWatermarkStore.getState().watermarks['bot-1']).toBe(1_000);

    // A later seed call (e.g. re-mount) must not clobber a newer watermark.
    store.seedWatermark('bot-1', 500);
    expect(useBotActivityWatermarkStore.getState().watermarks['bot-1']).toBe(1_000);
  });

  it('markSeen advances monotonically and markAllSeen batches', () => {
    const store = useBotActivityWatermarkStore.getState();
    store.markSeen('bot-1', 1_000);
    store.markSeen('bot-1', 800); // older activity must not regress
    expect(useBotActivityWatermarkStore.getState().watermarks['bot-1']).toBe(1_000);

    store.markAllSeen([
      { botId: 'bot-1', activityAt: 2_000 },
      { botId: 'bot-2', activityAt: 3_000 },
    ]);
    const watermarks = useBotActivityWatermarkStore.getState().watermarks;
    expect(watermarks['bot-1']).toBe(2_000);
    expect(watermarks['bot-2']).toBe(3_000);
  });

  it('computeHasNewActivity compares against the watermark', () => {
    expect(computeHasNewActivity(1_500, 1_000)).toBe(true);
    expect(computeHasNewActivity(1_000, 1_000)).toBe(false);
    expect(computeHasNewActivity(0, undefined)).toBe(false);
    expect(computeHasNewActivity(500, undefined)).toBe(true); // no watermark yet
  });

  it('canonicalActivityAt reads the canonical session updatedAt', () => {
    setSession('2026-09-07T08:00:00Z');
    const at = canonicalActivityAt('bot-1', useChatSessionStore.getState().sessions, {
      'bot-1': CANONICAL,
    });
    expect(at).toBe(new Date('2026-09-07T08:00:00Z').getTime());
    expect(canonicalActivityAt('bot-x', [], {})).toBe(0);
  });
});

describe('useBotHasNewActivity (focused chat = refresh-in-place)', () => {
  it('badges new activity when the chat is not focused', () => {
    const t0 = '2026-09-07T08:00:00.000Z';
    setSession(t0);
    // Seed at the same activity → no unread.
    useBotActivityWatermarkStore.getState().seedWatermark('bot-1', new Date(t0).getTime());
    const { result } = renderHook(() => useBotHasNewActivity('bot-1'));
    expect(result.current).toBe(false);

    // New activity arrives → unread.
    act(() => setSession('2026-09-07T08:05:00.000Z'));
    expect(renderHook(() => useBotHasNewActivity('bot-1')).result.current).toBe(true);
  });

  it('marks seen instead of badging when the canonical chat is focused', () => {
    const t0 = '2026-09-07T08:00:00.000Z';
    setSession(t0);
    useBotActivityWatermarkStore.getState().seedWatermark('bot-1', new Date(t0).getTime());

    const { result } = renderHook(() => useBotHasNewActivity('bot-1'));
    expect(result.current).toBe(false);

    // Focus the canonical chat, then new activity arrives.
    act(() => {
      useBotActivityWatermarkStore.getState().setFocusedSession(CANONICAL);
      setSession('2026-09-07T08:05:00.000Z');
    });

    // Still not badged (focused)…
    expect(result.current).toBe(false);
    // …and the watermark followed the activity (refresh-in-place).
    expect(useBotActivityWatermarkStore.getState().watermarks['bot-1']).toBe(
      new Date('2026-09-07T08:05:00.000Z').getTime(),
    );

    // Switching away afterwards shows no stale unread.
    act(() => {
      useBotActivityWatermarkStore.getState().setFocusedSession(null);
    });
    expect(result.current).toBe(false);
  });
});
