/**
 * Tests for mention handoff (lib/bots/mention-handoff.service.ts) — focus on
 * the Hermes attribution contract: `Message from 🤖 Name (@handle): <msg>`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const wakeBotMock = vi.fn();
const noteBotAttentionMock = vi.fn();

vi.mock('@/lib/bots/bot-wake.service', () => ({
  wakeBot: (...args: unknown[]) => wakeBotMock(...args),
}));

vi.mock('@/lib/agents/agent.store', () => ({
  useAgentStore: {
    getState: () => ({ noteBotAttention: noteBotAttentionMock }),
  },
}));

import {
  formatAttributionMessage,
  buildHermesHandoffCommand,
  parseMentions,
  resolveMention,
  executeMentionHandoff,
} from './mention-handoff.service';
import type { Agent } from '@/lib/agents/agent.types';
import type { StackedAgent } from './stacked-agent.service';

function makeBot(id: string, displayName: string, handle?: string): Agent {
  return {
    id,
    name: id,
    description: `${displayName} bot`,
    isBot: true,
    botProfile: { displayName, handle },
  } as unknown as Agent;
}

const ALPHA = makeBot('bot-alpha', 'Alpha', 'alpha');

const STACKED: StackedAgent = {
  agent: makeBot('stacked-1', 'Stacky'),
  provider: {
    id: 'hermes',
    sendMessage: async function* () {
      yield 'stacked reply';
    },
  } as unknown as StackedAgent['provider'],
  external: { externalId: 'ext-1' } as StackedAgent['external'],
};

describe('formatAttributionMessage', () => {
  it('formats the Hermes attribution string exactly', () => {
    expect(formatAttributionMessage('Alpha', 'alpha', 'hello there')).toBe(
      'Message from 🤖 Alpha (@alpha): hello there',
    );
  });

  it('includes handles verbatim (no @ stripping or re-adding)', () => {
    expect(formatAttributionMessage('Bot', '@bot', 'hi')).toBe('Message from 🤖 Bot (@@bot): hi');
  });

  it('round-trips through buildHermesHandoffCommand quoting', () => {
    const cmd = buildHermesHandoffCommand('alpha', 'Writer', 'writer', 'say "hi" $HOME');
    expect(cmd).toContain('Message from 🤖 Writer (@writer): say \\"hi\\" \\$HOME');
    expect(cmd).toContain(`-p 'alpha'`);
  });
});

describe('parseMentions', () => {
  it('finds mentions after whitespace or at the start, case-insensitively', () => {
    expect(parseMentions('hey @Alpha and @beta_two.2 check @alpha again')).toEqual([
      { mention: '@Alpha', name: 'alpha' },
      { mention: '@beta_two.2', name: 'beta_two.2' },
    ]);
  });

  it('does not match emails or mid-word @', () => {
    expect(parseMentions('mail me at a@b.com or x@y')).toEqual([]);
  });
});

describe('resolveMention', () => {
  it('resolves native bots by name, handle, or display name', () => {
    expect(resolveMention('bot-alpha', [ALPHA], [])?.agent?.id).toBe('bot-alpha');
    expect(resolveMention('alpha', [ALPHA], [])?.agent?.id).toBe('bot-alpha');
    expect(resolveMention('ALPHA', [ALPHA], [])?.agent?.id).toBe('bot-alpha');
  });

  it('resolves stacked agents by name or display name', () => {
    expect(resolveMention('stacky', [], [STACKED])?.stacked?.external.externalId).toBe('ext-1');
    expect(resolveMention('stacked-1', [], [STACKED])?.stacked?.external.externalId).toBe('ext-1');
  });

  it('returns undefined for unknown mentions and prefers native over stacked', () => {
    expect(resolveMention('ghost', [ALPHA], [STACKED])).toBeUndefined();
    const both = resolveMention('stacky', [makeBot('stacky', 'Stacky')], [STACKED]);
    expect(both?.agent?.id).toBe('stacky');
  });
});

describe('executeMentionHandoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wakeBotMock.mockResolvedValue({ reply: 'woken reply' });
  });

  it('returns an empty result when no mentions resolve', async () => {
    const result = await executeMentionHandoff({
      text: 'no mentions here',
      nativeAgents: [ALPHA],
      stackedAgents: [],
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });
    expect(result.targets).toEqual([]);
    expect(result.replies).toEqual([]);
    expect(result.handoffNote).toBe('');
    expect(result.cleanText).toBe('no mentions here');
  });

  it('hands off to a native bot with the attributed message as the default user sender', async () => {
    const result = await executeMentionHandoff({
      text: 'hey @alpha can you review this?',
      nativeAgents: [ALPHA],
      stackedAgents: [],
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });

    expect(wakeBotMock).toHaveBeenCalledTimes(1);
    const wakeArg = wakeBotMock.mock.calls[0][0] as { botId: string; message: string };
    expect(wakeArg.botId).toBe('bot-alpha');
    expect(wakeArg.message).toBe('Message from 🤖 you (@user): hey @alpha can you review this?');

    // The mention is stripped from the clean text, the reply lands in the note.
    expect(result.cleanText).toBe('hey can you review this?');
    expect(result.targets).toHaveLength(1);
    expect(result.replies[0].reply).toBe('woken reply');
    expect(result.handoffNote).toContain('Alpha replied:');
    expect(result.handoffNote).toContain('woken reply');
  });

  it('attributes to the active agent when one is set', async () => {
    const sender = makeBot('bot-sender', 'Sender', 'sender');
    await executeMentionHandoff({
      text: '@alpha ping',
      nativeAgents: [ALPHA, sender],
      stackedAgents: [],
      activeAgentId: 'bot-sender',
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });
    const wakeArg = wakeBotMock.mock.calls[0][0] as { message: string };
    expect(wakeArg.message).toBe('Message from 🤖 Sender (@sender): @alpha ping');
  });

  it('explicit senderName/senderHandle outrank the active agent', async () => {
    const sender = makeBot('bot-sender', 'Sender', 'sender');
    await executeMentionHandoff({
      text: '@alpha ping',
      nativeAgents: [ALPHA, sender],
      stackedAgents: [],
      activeAgentId: 'bot-sender',
      senderName: 'Boss',
      senderHandle: 'boss',
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });
    const wakeArg = wakeBotMock.mock.calls[0][0] as { message: string };
    expect(wakeArg.message).toBe('Message from 🤖 Boss (@boss): @alpha ping');
  });

  it('hands off to a stacked provider bot and collects the streamed reply', async () => {
    const result = await executeMentionHandoff({
      text: '@stacky summarize',
      nativeAgents: [],
      stackedAgents: [STACKED],
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].providerId).toBe('hermes');
    expect(result.replies[0].reply).toBe('stacked reply');
    expect(result.handoffNote).toContain('Stacky replied:');
  });

  it('classifies wake failures and records them as typed failures', async () => {
    wakeBotMock.mockResolvedValue({ error: 'invalid api key', reason: 'provider_auth_or_access' });
    const result = await executeMentionHandoff({
      text: '@alpha check',
      nativeAgents: [ALPHA],
      stackedAgents: [],
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });
    expect(result.failures).toHaveLength(1);
    expect(result.failures?.[0]).toMatchObject({
      target: '@alpha',
      reason: 'provider_auth_or_access',
    });
    expect(result.handoffNote).toContain('could not deliver');
  });
});
