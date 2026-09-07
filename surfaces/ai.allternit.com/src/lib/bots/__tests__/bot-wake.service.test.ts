/**
 * Tests for bot-wake.service: typed failure reasons, retry-once policy for
 * transient classes, and attention bookkeeping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wakeBot } from '../bot-wake.service';
import { useAgentStore } from '@/lib/agents/agent.store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { openBotCanonicalChat } from '../bot-canonical-chat.service';

vi.mock('../bot-canonical-chat.service', () => ({
  openBotCanonicalChat: vi.fn(async ({ botId }: { botId: string }) => `session-${botId}`),
}));

const sendMessageStream = vi.fn();
const sendMessage = vi.fn();

vi.mock('@/views/chat/ChatSessionStore', () => ({
  useChatSessionStore: {
    getState: () => ({
      sendMessageStream,
      sendMessage,
      sessions: [
        {
          id: 'session-bot-1',
          messages: [{ role: 'assistant', content: 'all good' }],
        },
      ],
    }),
  },
}));

describe('wakeBot', () => {
  beforeEach(() => {
    sendMessageStream.mockReset();
    sendMessage.mockReset();
    useAgentStore.setState({ attention: {}, agents: [] });
    vi.mocked(openBotCanonicalChat).mockClear();
  });

  it('returns empty result for a blank message without waking', async () => {
    const result = await wakeBot({ botId: 'bot-1', botName: 'Bot', message: '   ' });
    expect(result).toEqual({});
    expect(sendMessageStream).not.toHaveBeenCalled();
  });

  it('delivers and reads the last assistant reply', async () => {
    sendMessageStream.mockResolvedValueOnce(undefined);
    const result = await wakeBot({
      botId: 'bot-1',
      botName: 'Bot',
      message: 'hi',
      waitForReply: true,
    });
    expect(result).toEqual({ reply: 'all good' });
    expect(sendMessageStream).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures exactly once and then succeeds', async () => {
    sendMessageStream
      .mockRejectedValueOnce(new Error('HTTP 503 service unavailable'))
      .mockResolvedValueOnce(undefined);

    const result = await wakeBot({
      botId: 'bot-1',
      botName: 'Bot',
      message: 'hi',
      waitForReply: true,
    });

    expect(sendMessageStream).toHaveBeenCalledTimes(2);
    expect(result.reason).toBeUndefined();
    expect(result).toEqual({ reply: 'all good' });
  });

  it('gives up after one retry and reports the typed reason', async () => {
    sendMessageStream.mockRejectedValue(new Error('HTTP 503 service unavailable'));

    const result = await wakeBot({
      botId: 'bot-1',
      botName: 'Bot',
      message: 'hi',
      waitForReply: true,
    });

    expect(sendMessageStream).toHaveBeenCalledTimes(2);
    expect(result.reason).toBe('provider_server_error');
    expect(result.error).toBeTruthy();
  });

  it('never retries auth failures and badges attention', async () => {
    sendMessageStream.mockRejectedValue(new Error('HTTP 401 invalid api key'));

    const result = await wakeBot({
      botId: 'bot-1',
      botName: 'Bot',
      message: 'hi',
      waitForReply: true,
    });

    expect(sendMessageStream).toHaveBeenCalledTimes(1);
    expect(result.reason).toBe('provider_auth_or_access');

    const attention = useAgentStore.getState().attention;
    expect(attention['bot-1']).toBeDefined();
    expect(attention['bot-1'].reason).toBe('provider_auth_or_access');
    expect(attention['bot-1'].hint.length).toBeGreaterThan(10);
  });

  it('does not badge attention for transient failures', async () => {
    sendMessageStream.mockRejectedValue(new Error('HTTP 503 service unavailable'));

    await wakeBot({ botId: 'bot-1', botName: 'Bot', message: 'hi', waitForReply: true });

    expect(useAgentStore.getState().attention['bot-1']).toBeUndefined();
  });

  it('clears attention after a successful turn', async () => {
    useAgentStore.getState().noteBotAttention('bot-1', 'missing_config');
    sendMessageStream.mockResolvedValueOnce(undefined);

    await wakeBot({ botId: 'bot-1', botName: 'Bot', message: 'hi', waitForReply: true });

    expect(useAgentStore.getState().attention['bot-1']).toBeUndefined();
  });

  it('fire-and-forget mode records the reason without retrying', async () => {
    sendMessageStream.mockRejectedValue(new Error('HTTP 402 out of funds'));
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await wakeBot({ botId: 'bot-1', botName: 'Bot', message: 'hi' });

    expect(result).toEqual({});
    // Flush the fire-and-forget catch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sendMessageStream).toHaveBeenCalledTimes(1);
    expect(useAgentStore.getState().attention['bot-1']?.reason).toBe('provider_quota_limit');

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
