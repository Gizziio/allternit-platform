/**
 * Tests for mention-handoff.service.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseMentions,
  resolveMention,
  executeMentionHandoff,
  formatAttributionMessage,
  shellQuote,
  shellDoubleQuote,
  buildHermesHandoffCommand,
} from '../mention-handoff.service';
import type { Agent } from '@/lib/agents/agent.types';
import type { StackedAgent } from '@/lib/bots/stacked-agent.service';
import type { AgentStackProvider } from '@/lib/bots/stack-providers/types';

function fakeAgent(overrides: Partial<Agent> & { id: string; name: string }): Agent {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    type: overrides.type ?? 'specialist',
    model: overrides.model ?? 'gpt-4o',
    provider: overrides.provider ?? 'openai',
    capabilities: overrides.capabilities ?? [],
    tools: overrides.tools ?? [],
    maxIterations: overrides.maxIterations ?? 10,
    temperature: overrides.temperature ?? 0.7,
    config: overrides.config ?? {},
    status: overrides.status ?? 'idle',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    ...overrides,
  } as Agent;
}

function fakeNativeBot(overrides: Partial<Agent> & { id: string; name: string }): Agent {
  return fakeAgent({
    isBot: true,
    botProfile: {
      displayName: overrides.name,
      ...(overrides.botProfile ?? {}),
    },
    ...overrides,
  });
}

function fakeProvider(id: string, replyChunks: string[] = []): AgentStackProvider {
  return {
    id,
    name: id,
    isInstalled: async () => true,
    listAgents: async () => [],
    sendMessage: vi.fn(async function* () {
      for (const chunk of replyChunks) {
        yield chunk;
      }
    }),
    getStatus: async () => 'idle',
  };
}

function fakeStackedAgent(
  providerId: string,
  externalId: string,
  displayName: string,
): StackedAgent {
  const provider = fakeProvider(providerId);
  return {
    agent: fakeAgent({
      id: `${providerId}:${externalId}`,
      name: externalId,
      botProfile: { displayName },
      isBot: true,
    }),
    provider,
    external: {
      providerId,
      externalId,
      displayName,
      capabilities: ['chat'],
    },
  };
}

describe('parseMentions', () => {
  it('returns empty array when no mentions exist', () => {
    expect(parseMentions('hello world')).toEqual([]);
  });

  it('parses a single mention', () => {
    expect(parseMentions('hey @researcher what is this')).toEqual([
      { mention: '@researcher', name: 'researcher' },
    ]);
  });

  it('parses multiple mentions', () => {
    expect(parseMentions('@coder review this; @writer fix docs')).toEqual([
      { mention: '@coder', name: 'coder' },
      { mention: '@writer', name: 'writer' },
    ]);
  });

  it('deduplicates repeated mentions', () => {
    expect(parseMentions('@coder and @coder again')).toEqual([
      { mention: '@coder', name: 'coder' },
    ]);
  });

  it('lowercases mention names', () => {
    expect(parseMentions('@Researcher')).toEqual([
      { mention: '@Researcher', name: 'researcher' },
    ]);
  });

  it('matches mentions after whitespace and preserves leading space in mention', () => {
    const result = parseMentions('hi  @coder');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('coder');
  });

  it('does not match email-like strings without leading space', () => {
    expect(parseMentions('email me at user@example.com')).toEqual([]);
  });
});

describe('attribution helpers', () => {
  it('formats Hermes-style attribution message', () => {
    expect(formatAttributionMessage('Coordinator', 'coord', '@researcher explain')).toBe(
      'Message from 🤖 Coordinator (@coord): @researcher explain',
    );
  });

  it('shell-quotes single quotes safely', () => {
    expect(shellQuote("it's done")).toBe("'it'\"'\"'s done'");
  });

  it('shell-double-quotes escapes metacharacters', () => {
    expect(shellDoubleQuote('say "hello" $USER `pwd` \\back')).toBe(
      'say \\"hello\\" \\$USER \\`pwd\\` \\\\back',
    );
  });

  it('builds Hermes handoff command with proper escaping', () => {
    const cmd = buildHermesHandoffCommand(
      'researcher',
      'Coordinator',
      'coordinator',
      '@researcher check this',
    );
    expect(cmd).toContain("hermes -p 'researcher'");
    expect(cmd).toContain('-c "Bot Chat"');
    expect(cmd).toContain(
      '-q "Message from 🤖 Coordinator (@coordinator): @researcher check this"',
    );
  });
});

describe('resolveMention', () => {
  const native = fakeNativeBot({
    id: 'native-coder',
    name: 'coder',
    botProfile: { displayName: 'Code Bot', handle: 'code-bot' },
  });

  const stacked = fakeStackedAgent('hermes', 'writer', 'Writer Bot');

  it('resolves native bot by name', () => {
    const target = resolveMention('coder', [native], []);
    expect(target?.agent?.id).toBe('native-coder');
  });

  it('resolves native bot by handle', () => {
    const target = resolveMention('code-bot', [native], []);
    expect(target?.agent?.id).toBe('native-coder');
  });

  it('resolves native bot by displayName', () => {
    const target = resolveMention('code bot', [native], []);
    expect(target?.agent?.id).toBe('native-coder');
  });

  it('resolves stacked bot by name', () => {
    const target = resolveMention('writer', [], [stacked]);
    expect(target?.stacked?.external.externalId).toBe('writer');
  });

  it('resolves stacked bot by displayName', () => {
    const target = resolveMention('writer bot', [], [stacked]);
    expect(target?.stacked?.external.externalId).toBe('writer');
  });

  it('returns undefined for unresolved mentions', () => {
    expect(resolveMention('missing', [native], [stacked])).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(resolveMention('CODE-BOT', [native], []).agent?.id).toBe('native-coder');
    expect(resolveMention('WRITER BOT', [], [stacked]).stacked?.external.externalId).toBe(
      'writer',
    );
  });
});

describe('executeMentionHandoff', () => {
  it('returns original text when there are no mentions', async () => {
    const result = await executeMentionHandoff({
      text: 'hello world',
      nativeAgents: [],
      stackedAgents: [],
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });

    expect(result.cleanText).toBe('hello world');
    expect(result.targets).toEqual([]);
    expect(result.replies).toEqual([]);
    expect(result.handoffNote).toBe('');
  });

  it('hands off to a native bot via Rails mail, returns the reply, and acknowledges it', async () => {
    const activeAgent = fakeNativeBot({
      id: 'active-agent',
      name: 'coordinator',
      botProfile: { displayName: 'Coordinator Bot', handle: 'coord' },
    });
    const native = fakeNativeBot({
      id: 'native-researcher',
      name: 'researcher',
      botProfile: { displayName: 'Researcher Bot' },
    });
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const fetchMail = vi.fn().mockResolvedValue([
      {
        id: 'msg-1',
        fromAgentId: 'native-researcher',
        body: 'Here is the answer.',
        subject: 'Re: Mention from chat',
        status: 'unread',
      },
    ]);
    const acknowledgeMail = vi.fn().mockResolvedValue(undefined);

    const result = await executeMentionHandoff({
      text: '@researcher explain this',
      nativeAgents: [activeAgent, native],
      stackedAgents: [],
      activeAgentId: 'active-agent',
      sendMail,
      fetchMail,
      acknowledgeMail,
    });

    expect(sendMail).toHaveBeenCalledWith(
      'active-agent',
      'native-researcher',
      'Mention from @coord',
      'Message from 🤖 Coordinator Bot (@coord): @researcher explain this',
    );
    expect(acknowledgeMail).toHaveBeenCalledWith('native-researcher', 'msg-1');
    expect(result.cleanText).toBe('explain this');
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].displayName).toBe('Researcher Bot');
    expect(result.replies[0].reply).toBe('Here is the answer.');
    expect(result.handoffNote).toContain('Researcher Bot replied:');
    expect(result.handoffNote).toContain('Here is the answer.');
  });

  it('polls native bot mail until a reply arrives', async () => {
    const native = fakeNativeBot({
      id: 'native-slow',
      name: 'slow',
      botProfile: { displayName: 'Slow Bot' },
    });
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const fetchMail = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'msg-2',
          fromAgentId: 'native-slow',
          body: 'Sorry for the delay.',
          subject: 'Re: Mention from chat',
          status: 'unread',
        },
      ]);
    const acknowledgeMail = vi.fn().mockResolvedValue(undefined);

    const result = await executeMentionHandoff({
      text: '@slow hello',
      nativeAgents: [native],
      stackedAgents: [],
      sendMail,
      fetchMail,
      acknowledgeMail,
      mailPollIntervalMs: 10,
      mailReplyTimeoutMs: 200,
    });

    expect(fetchMail).toHaveBeenCalledTimes(3);
    expect(result.replies[0].reply).toBe('Sorry for the delay.');
    expect(acknowledgeMail).toHaveBeenCalledWith('native-slow', 'msg-2');
  });

  it('returns a waiting placeholder when native bot mail times out', async () => {
    const native = fakeNativeBot({
      id: 'native-silent',
      name: 'silent',
      botProfile: { displayName: 'Silent Bot' },
    });
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const fetchMail = vi.fn().mockResolvedValue([]);

    const result = await executeMentionHandoff({
      text: '@silent ping',
      nativeAgents: [native],
      stackedAgents: [],
      sendMail,
      fetchMail,
      mailPollIntervalMs: 10,
      mailReplyTimeoutMs: 50,
    });

    expect(fetchMail).toHaveBeenCalled();
    expect(result.replies[0].reply).toBe('(waiting for reply)');
  });

  it('hands off to an external stacked bot via provider sendMessage with attribution', async () => {
    const stacked = fakeStackedAgent('hermes', 'coder', 'Hermes Coder');
    const sendMail = vi.fn();
    const fetchMail = vi.fn();

    const result = await executeMentionHandoff({
      text: '@coder refactor this',
      nativeAgents: [],
      stackedAgents: [stacked],
      senderName: 'Coordinator',
      senderHandle: 'coord',
      sendMail,
      fetchMail,
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(fetchMail).not.toHaveBeenCalled();
    expect(result.cleanText).toBe('refactor this');
    expect(result.replies[0].providerId).toBe('hermes');
    expect(result.replies[0].reply).toBe('');
    expect(result.handoffNote).toContain('Hermes Coder replied:');
    // The provider saw the attributed message.
    expect(stacked.provider.sendMessage).toHaveBeenCalledWith(
      'coder',
      'Allternit Mention',
      'Message from 🤖 Coordinator (@coord): @coder refactor this',
    );
  });

  it('collects replies from native and stacked bots together', async () => {
    const native = fakeNativeBot({
      id: 'native-writer',
      name: 'writer',
      botProfile: { displayName: 'Writer Native' },
    });
    const stacked = fakeStackedAgent('hermes', 'coder', 'Hermes Coder');

    const sendMail = vi.fn().mockResolvedValue(undefined);
    const fetchMail = vi.fn().mockResolvedValue([
      {
        fromAgentId: 'native-writer',
        body: 'Done writing.',
        subject: 'Re: Mention from chat',
        status: 'unread',
      },
    ]);

    const result = await executeMentionHandoff({
      text: '@writer draft it and @coder check code',
      nativeAgents: [native],
      stackedAgents: [stacked],
      sendMail,
      fetchMail,
    });

    expect(result.targets).toHaveLength(2);
    expect(result.replies).toHaveLength(2);
    expect(result.replies.map((r) => r.displayName)).toContain('Writer Native');
    expect(result.replies.map((r) => r.displayName)).toContain('Hermes Coder');
    expect(result.handoffNote).toContain('Done writing.');
  });

  it('records an error when a native handoff throws', async () => {
    const native = fakeNativeBot({
      id: 'native-broken',
      name: 'broken',
      botProfile: { displayName: 'Broken Bot' },
    });
    const sendMail = vi.fn().mockRejectedValue(new Error('mail down'));
    const fetchMail = vi.fn();

    const result = await executeMentionHandoff({
      text: '@broken help',
      nativeAgents: [native],
      stackedAgents: [],
      sendMail,
      fetchMail,
    });

    expect(result.replies[0].error).toBe('mail down');
    expect(result.handoffNote).toContain('could not deliver (mail down)');
  });

  it('records an error when an external handoff throws', async () => {
    const provider: AgentStackProvider = {
      id: 'hermes',
      name: 'hermes',
      isInstalled: async () => true,
      listAgents: async () => [],
      sendMessage: async function* () {
        throw new Error('provider offline');
      },
      getStatus: async () => 'idle',
    };
    const stacked: StackedAgent = {
      agent: fakeAgent({
        id: 'hermes:coder',
        name: 'coder',
        botProfile: { displayName: 'Hermes Coder' },
        isBot: true,
      }),
      provider,
      external: {
        providerId: 'hermes',
        externalId: 'coder',
        displayName: 'Hermes Coder',
        capabilities: ['chat'],
      },
    };

    const result = await executeMentionHandoff({
      text: '@coder refactor',
      nativeAgents: [],
      stackedAgents: [stacked],
      sendMail: vi.fn(),
      fetchMail: vi.fn(),
    });

    expect(result.replies[0].error).toBe('provider offline');
  });

  it('strips resolved mentions and keeps unresolved mentions in cleanText', async () => {
    const native = fakeNativeBot({
      id: 'native-known',
      name: 'known',
      botProfile: { displayName: 'Known Bot' },
    });

    const result = await executeMentionHandoff({
      text: '@known say hi to @unknown',
      nativeAgents: [native],
      stackedAgents: [],
      sendMail: vi.fn().mockResolvedValue(undefined),
      fetchMail: vi.fn().mockResolvedValue([]),
      mailPollIntervalMs: 10,
      mailReplyTimeoutMs: 50,
    });

    expect(result.cleanText).toBe('say hi to @unknown');
  });
});
