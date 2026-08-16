import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AGENT_COMMUNICATION_TOOL_DEFINITION,
  executeAgentCommunicationTool,
} from './agent-comm.tool';
import { useCommRailsMailStore } from '@/lib/bots/comrails-mail.store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';

vi.mock('@/lib/bots/comrails-mail.store', () => ({
  useCommRailsMailStore: {
    getState: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: {
    getState: vi.fn(() => ({
      sessions: [],
    })),
  },
}));

describe('agent-comm.tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a valid tool definition', () => {
    expect(AGENT_COMMUNICATION_TOOL_DEFINITION.name).toBe('agent_communicate');
    expect(AGENT_COMMUNICATION_TOOL_DEFINITION.parameters.required).toContain('to_agent_id');
    expect(AGENT_COMMUNICATION_TOOL_DEFINITION.parameters.required).toContain('subject');
    expect(AGENT_COMMUNICATION_TOOL_DEFINITION.parameters.required).toContain('body');
  });

  it('returns an error when no agent id is associated with the session', async () => {
    vi.mocked(useChatSessionStore.getState).mockReturnValue({ sessions: [] } as any);

    const result = await executeAgentCommunicationTool('sess-1', 'tc-1', {
      action: 'send',
      to_agent_id: 'bot-b',
      subject: 'Hello',
      body: 'Please help',
    });

    expect(result.error).toContain('no agent id associated');
    expect(result.result).toBeNull();
  });

  it('sends mail when session has an agent id', async () => {
    const sendMail = vi.fn().mockResolvedValue({ sent: true, messageId: 'msg-123' });
    vi.mocked(useCommRailsMailStore.getState).mockReturnValue({ sendMail } as any);
    vi.mocked(useChatSessionStore.getState).mockReturnValue({
      sessions: [
        {
          id: 'sess-1',
          metadata: { agentId: 'bot-a' },
        },
      ],
    } as any);

    const result = await executeAgentCommunicationTool('sess-1', 'tc-1', {
      action: 'send',
      to_agent_id: 'bot-b',
      subject: 'Handoff',
      body: '@bot-b please take over',
      priority: 'high',
      requires_ack: true,
    });

    expect(sendMail).toHaveBeenCalledWith('bot-a', {
      toAgentId: 'bot-b',
      subject: 'Handoff',
      body: '@bot-b please take over',
      priority: 'high',
      requiresAck: true,
    });
    expect(result.error).toBeUndefined();
    expect(result.result).toMatchObject({
      sent: true,
      messageId: 'msg-123',
      fromAgentId: 'bot-a',
      toAgentId: 'bot-b',
      subject: 'Handoff',
    });
  });

  it('rejects sending to self', async () => {
    vi.mocked(useChatSessionStore.getState).mockReturnValue({
      sessions: [
        {
          id: 'sess-1',
          metadata: { agentId: 'bot-a' },
        },
      ],
    } as any);

    const result = await executeAgentCommunicationTool('sess-1', 'tc-1', {
      action: 'send',
      to_agent_id: 'bot-a',
      subject: 'Loop',
      body: 'to myself',
    });

    expect(result.error).toContain('yourself');
  });

  it('prefixes correlation id to subject when provided', async () => {
    const sendMail = vi.fn().mockResolvedValue({ sent: true, messageId: 'msg-456' });
    vi.mocked(useCommRailsMailStore.getState).mockReturnValue({ sendMail } as any);
    vi.mocked(useChatSessionStore.getState).mockReturnValue({
      sessions: [{ id: 'sess-1', metadata: { agentId: 'bot-a' } }],
    } as any);

    await executeAgentCommunicationTool('sess-1', 'tc-1', {
      action: 'send',
      to_agent_id: 'bot-b',
      subject: 'Update',
      body: 'status update',
      correlation_id: 'task-42',
    });

    expect(sendMail).toHaveBeenCalledWith(
      'bot-a',
      expect.objectContaining({ subject: '[task-42] Update' }),
    );
  });
});
