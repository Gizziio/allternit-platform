/**
 * Tests for group-chat session creation hygiene (lib/bots/startBotGroupChat.ts).
 *
 * Hermes rule under test: the session NAME is exactly `Group: <roomId>` so a
 * same-name room recreate never resumes a stale session.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSessionMock = vi.fn();
const createGroupMock = vi.fn();

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: {
    getState: () => ({
      createSession: createSessionMock,
    }),
  },
}));

vi.mock('./group-chat.store', () => ({
  useGroupChatStore: {
    getState: () => ({
      createGroup: createGroupMock,
    }),
  },
}));

import { startBotGroupChat } from './startBotGroupChat';
import type { Agent } from '@/lib/agents/agent.types';

function makeBot(id: string, displayName: string): Agent {
  return {
    id,
    name: id,
    description: `${displayName} bot`,
    isBot: true,
    botProfile: { displayName },
  } as unknown as Agent;
}

const ALPHA = makeBot('bot-alpha', 'Alpha');
const BETA = makeBot('bot-beta', 'Beta');

describe('startBotGroupChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createGroupMock.mockReturnValue('alpha-beta');
    createSessionMock.mockResolvedValue('ses-group-1');
  });

  it('names the session exactly Group: <roomId>', async () => {
    const result = await startBotGroupChat({ bots: [ALPHA, BETA] });
    expect(result).toEqual({ sessionId: 'ses-group-1', groupId: 'alpha-beta' });
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const arg = createSessionMock.mock.calls[0][0] as { name: string };
    expect(arg.name).toBe('Group: alpha-beta');
  });

  it('keeps the human-readable name on the group, not the session', async () => {
    await startBotGroupChat({ bots: [ALPHA, BETA], name: 'Weekly sync' });
    expect(createGroupMock).toHaveBeenCalledWith(
      'Weekly sync',
      expect.arrayContaining([
        expect.objectContaining({ botId: 'bot-alpha', displayName: 'Alpha', handle: 'alpha' }),
        expect.objectContaining({ botId: 'bot-beta', displayName: 'Beta', handle: 'beta' }),
      ]),
    );
    const arg = createSessionMock.mock.calls[0][0] as { name: string };
    expect(arg.name).toBe('Group: alpha-beta');
    expect(arg.name).not.toContain('Weekly sync');
  });

  it('defaults the group name to member display names when no name is given', async () => {
    await startBotGroupChat({ bots: [ALPHA, BETA] });
    expect(createGroupMock).toHaveBeenCalledWith(
      'Alpha, Beta',
      expect.any(Array),
    );
  });

  it('a recreated same-name room mints a fresh session name (no stale resume)', async () => {
    await startBotGroupChat({ bots: [ALPHA, BETA], name: 'Weekly sync' });
    // Recreate: the store dedupes the group id for the same display name.
    createGroupMock.mockReturnValue('alpha-beta-2');
    await startBotGroupChat({ bots: [ALPHA, BETA], name: 'Weekly sync' });
    const first = createSessionMock.mock.calls[0][0] as { name: string };
    const second = createSessionMock.mock.calls[1][0] as { name: string };
    expect(first.name).toBe('Group: alpha-beta');
    expect(second.name).toBe('Group: alpha-beta-2');
    expect(first.name).not.toBe(second.name);
  });

  it('tags the session as a group chat with the groupId reference', async () => {
    await startBotGroupChat({ bots: [ALPHA, BETA] });
    const arg = createSessionMock.mock.calls[0][0] as {
      sessionMode: string;
      metadata: Record<string, unknown>;
    };
    expect(arg.sessionMode).toBe('agent');
    expect(arg.metadata.isGroupChat).toBe(true);
    expect(arg.metadata.groupId).toBe('alpha-beta');
    expect(arg.metadata.botIds).toEqual(['bot-alpha', 'bot-beta']);
  });

  it('refuses invalid group sizes', async () => {
    expect(await startBotGroupChat({ bots: [ALPHA] })).toBeNull();
    const seven = [ALPHA, BETA, makeBot('c', 'C'), makeBot('d', 'D'), makeBot('e', 'E'), makeBot('f', 'F'), makeBot('g', 'G')];
    expect(await startBotGroupChat({ bots: seven })).toBeNull();
    expect(createGroupMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
