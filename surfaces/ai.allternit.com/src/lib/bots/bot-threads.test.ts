import { describe, expect, it } from 'vitest';
import type { ModeSession } from '@/lib/agents/mode-session-store';
import { isBotThreadSession, listBotThreads, threadByline, visibleBotThreads } from './bot-threads';

function session(partial: Partial<ModeSession> & { id: string }): ModeSession {
  return {
    name: 'Bot Chat',
    createdAt: '2026-09-15T00:00:00Z',
    updatedAt: '2026-09-15T00:00:00Z',
    messages: [],
    metadata: { isBot: true, agentId: 'bot-1' },
    ...partial,
  } as ModeSession;
}

describe('bot-threads', () => {
  it('treats canonical and extra sessions as the same bot without mixing groups', () => {
    expect(
      isBotThreadSession(
        session({ id: 'a', metadata: { isBot: true, botCanonicalFor: 'bot-1' } }),
        'bot-1',
      ),
    ).toBe(true);
    expect(
      isBotThreadSession(
        session({ id: 'b', metadata: { isBot: true, botThreadOf: 'bot-1' } }),
        'bot-1',
      ),
    ).toBe(true);
    expect(
      isBotThreadSession(
        session({ id: 'c', metadata: { isBot: true, isGroupChat: true, agentId: 'bot-1' } }),
        'bot-1',
      ),
    ).toBe(false);
  });

  it('lists both threads and does not drop the canonical when extras exist', () => {
    const threads = listBotThreads(
      'bot-1',
      [
        session({ id: 'canon', name: 'Bot Chat', metadata: { isBot: true, botCanonicalFor: 'bot-1' } }),
        session({
          id: 'extra',
          name: 'New thread',
          updatedAt: '2026-09-16T00:00:00Z',
          metadata: { isBot: true, botThreadOf: 'bot-1' },
        }),
      ],
      'canon',
    );
    expect(threads.map((t) => t.sessionId)).toEqual(['extra', 'canon']);
    expect(threads.find((t) => t.sessionId === 'canon')?.isCanonical).toBe(true);
    expect(threads.find((t) => t.sessionId === 'extra')?.isCanonical).toBe(false);
    expect(threads.every((t) => t.folderId === null)).toBe(true);
  });

  it('keeps archived threads only when they demand attention', () => {
    const threads = listBotThreads(
      'bot-1',
      [
        session({ id: 'old', metadata: { isBot: true, agentId: 'bot-1', archived: true } }),
        session({ id: 'live', metadata: { isBot: true, agentId: 'bot-1' } }),
      ],
      'live',
    );
    expect(visibleBotThreads(threads, 'live').map((t) => t.sessionId)).toEqual(['live']);
    expect(visibleBotThreads(threads, 'old').map((t) => t.sessionId)).toContain('old');
  });

  it('labels archived threads the way OpenMaus does', () => {
    expect(threadByline({ archived: true, lastMessage: 'hi' })).toBe('Archived');
    expect(threadByline({ archived: false, lastMessage: 'hi' })).toBe('hi');
  });
});
