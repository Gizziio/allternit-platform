import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommRailsMailStore, useCommRailsUnreadCount } from './comrails-mail.store';
import { railsApi } from '@/lib/agents/rails.service';
import type { MailMessage } from '@/lib/agents/rails.service';

vi.mock('@/lib/agents/rails.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agents/rails.service')>();
  return {
    ...actual,
    railsApi: {
      mail: {
        inbox: vi.fn(),
        threads: vi.fn(),
        ensureThread: vi.fn(),
        send: vi.fn(),
        ack: vi.fn(),
      },
    },
  };
});

const mockedRailsApi = railsApi as unknown as {
  mail: {
    inbox: ReturnType<typeof vi.fn>;
    threads: ReturnType<typeof vi.fn>;
    ensureThread: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    ack: ReturnType<typeof vi.fn>;
  };
};

function makeRailsMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    message_id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    thread_id: 'thread-1',
    from_agent: 'agent-a',
    to_agent: 'agent-b',
    body: 'Hello',
    timestamp: new Date().toISOString(),
    acknowledged: false,
    subject: 'Test',
    priority: 'normal',
    ...overrides,
  };
}

describe('comrails-mail.store', () => {
  beforeEach(() => {
    useCommRailsMailStore.getState().reset();
    vi.clearAllMocks();
  });

  it('loads inbox messages from Rails', async () => {
    mockedRailsApi.mail.inbox.mockResolvedValueOnce({
      agent_id: 'agent-b',
      messages: [makeRailsMessage()],
    });

    await act(async () => {
      await useCommRailsMailStore.getState().loadInbox('agent-b', 50);
    });

    expect(useCommRailsMailStore.getState().messages).toHaveLength(1);
    expect(useCommRailsMailStore.getState().messages[0].status).toBe('unread');
    expect(useCommRailsMailStore.getState().isLoading).toBe(false);
  });

  it('loads threads from Rails', async () => {
    mockedRailsApi.mail.inbox.mockResolvedValueOnce({
      agent_id: 'agent-b',
      messages: [makeRailsMessage()],
    });
    mockedRailsApi.mail.threads.mockResolvedValueOnce({
      threads: [{ thread_id: 'thread-1', messages: 1, last_ts: new Date().toISOString() }],
    });

    await act(async () => {
      await useCommRailsMailStore.getState().refreshInbox('agent-b', 50);
    });

    expect(useCommRailsMailStore.getState().threads).toHaveLength(1);
    expect(useCommRailsMailStore.getState().threads[0].messageCount).toBe(1);
  });

  it('sends mail via Rails', async () => {
    mockedRailsApi.mail.ensureThread.mockResolvedValueOnce({ thread_id: 'thread-1' });
    mockedRailsApi.mail.send.mockResolvedValueOnce({ sent: true });

    const result = await act(async () =>
      useCommRailsMailStore.getState().sendMail('agent-a', {
        toAgentId: 'agent-b',
        subject: 'Hello',
        body: 'World',
      }),
    );

    expect(result.sent).toBe(true);
    expect(mockedRailsApi.mail.ensureThread).toHaveBeenCalledWith('Hello', ['agent-a', 'agent-b']);
    expect(mockedRailsApi.mail.send).toHaveBeenCalled();
  });

  it('acknowledges mail via Rails', async () => {
    mockedRailsApi.mail.ack.mockResolvedValueOnce(undefined);

    useCommRailsMailStore.setState({
      messages: [
        {
          id: 'thread-1-msg-1',
          threadId: 'thread-1',
          fromAgentId: 'agent-a',
          toAgentId: 'agent-b',
          subject: 'Test',
          body: 'Body',
          status: 'unread',
          priority: 'normal',
          timestamp: new Date().toISOString(),
          requiresAck: true,
        },
      ],
    });

    await act(async () => {
      await useCommRailsMailStore.getState().acknowledgeMail('agent-b', 'thread-1-msg-1');
    });

    expect(mockedRailsApi.mail.ack).toHaveBeenCalledWith('thread-1', 'thread-1-msg-1');
    expect(useCommRailsMailStore.getState().messages[0].status).toBe('acknowledged');
  });

  it('counts unread messages for an agent', async () => {
    useCommRailsMailStore.setState({
      messages: [
        {
          id: '1',
          threadId: 't1',
          fromAgentId: 'agent-a',
          toAgentId: 'agent-b',
          subject: 'S1',
          body: 'B1',
          status: 'unread',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          threadId: 't1',
          fromAgentId: 'agent-a',
          toAgentId: 'agent-b',
          subject: 'S2',
          body: 'B2',
          status: 'read',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          id: '3',
          threadId: 't1',
          fromAgentId: 'agent-c',
          toAgentId: 'agent-b',
          subject: 'S3',
          body: 'B3',
          status: 'unread',
          priority: 'normal',
          timestamp: new Date().toISOString(),
          requiresAck: true,
        },
      ],
    });

    expect(useCommRailsMailStore.getState().getUnreadCount('agent-b')).toBe(2);
    expect(useCommRailsMailStore.getState().getUnreadCount('agent-a')).toBe(0);
  });

  it('exposes a reactive unread count hook', () => {
    useCommRailsMailStore.setState({
      messages: [
        {
          id: '1',
          threadId: 't1',
          fromAgentId: 'agent-a',
          toAgentId: 'agent-b',
          subject: 'S',
          body: 'B',
          status: 'unread',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const { result } = renderHook(() => useCommRailsUnreadCount('agent-b'));
    expect(result.current).toBe(1);
  });

  it('creates a group thread with multiple members', async () => {
    mockedRailsApi.mail.ensureThread.mockResolvedValueOnce({ thread_id: 'group-1' });

    const result = await act(async () =>
      useCommRailsMailStore.getState().createGroupThread('agent-a', {
        name: 'Swarm Planning',
        memberIds: ['agent-b', 'agent-c'],
      }),
    );

    expect(result.created).toBe(true);
    expect(result.threadId).toBe('group-1');
    expect(mockedRailsApi.mail.ensureThread).toHaveBeenCalledWith('Swarm Planning', [
      'agent-a',
      'agent-b',
      'agent-c',
    ]);
  });

  it('sends mail to a group thread', async () => {
    mockedRailsApi.mail.send.mockResolvedValueOnce({ sent: true });

    const result = await act(async () =>
      useCommRailsMailStore.getState().sendGroupMail('agent-a', {
        threadId: 'group-1',
        subject: 'Update',
        body: 'Here is the plan.',
        priority: 'high',
      }),
    );

    expect(result.sent).toBe(true);
    expect(mockedRailsApi.mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        thread_id: 'group-1',
        body: 'Here is the plan.',
        subject: 'Update',
        priority: 'high',
      }),
    );
  });
});
