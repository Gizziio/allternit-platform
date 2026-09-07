/**
 * Tests for the attention slice in agent.store (spec Phase 0 — trust
 * foundations): only attention-class reasons badge, clear on demand, and
 * archived/hidden bots accumulate but are filtered from the visible view.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore, getVisibleAttention } from './agent.store';
import type { Agent } from './agent.types';

function makeBot(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: id,
    description: 'test bot',
    type: 'assistant',
    model: 'test-model',
    provider: 'openai',
    capabilities: [],
    tools: [],
    maxIterations: 1,
    temperature: 0,
    config: {},
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBot: true,
    botProfile: { displayName: id },
    ...overrides,
  } as unknown as Agent;
}

describe('attention slice', () => {
  beforeEach(() => {
    useAgentStore.setState({ attention: {}, agents: [] });
  });

  it('records attention only for attention-class reasons', () => {
    const { noteBotAttention } = useAgentStore.getState();

    noteBotAttention('bot-1', 'provider_auth_or_access');
    noteBotAttention('bot-2', 'provider_quota_limit');
    noteBotAttention('bot-3', 'missing_config');
    noteBotAttention('bot-4', 'agent_blocked');

    // Transient / never-badge classes are ignored.
    noteBotAttention('bot-5', 'provider_rate_limit');
    noteBotAttention('bot-6', 'provider_server_error');
    noteBotAttention('bot-7', 'runtime_offline');
    noteBotAttention('bot-8', 'delivery_timeout');
    noteBotAttention('bot-9', 'context_overflow');
    noteBotAttention('bot-10', 'unknown');

    const { attention } = useAgentStore.getState();
    expect(Object.keys(attention).sort()).toEqual(['bot-1', 'bot-2', 'bot-3', 'bot-4']);
    expect(attention['bot-1'].reason).toBe('provider_auth_or_access');
    expect(attention['bot-1'].hint.length).toBeGreaterThan(10);
    expect(attention['bot-1'].notedAt).toBeGreaterThan(0);
  });

  it('overwrites the entry when the reason changes', () => {
    const { noteBotAttention } = useAgentStore.getState();
    noteBotAttention('bot-1', 'missing_config');
    noteBotAttention('bot-1', 'provider_quota_limit');

    const { attention } = useAgentStore.getState();
    expect(attention['bot-1'].reason).toBe('provider_quota_limit');
    expect(Object.keys(attention)).toHaveLength(1);
  });

  it('clears attention for an agent', () => {
    const { noteBotAttention, clearBotAttention } = useAgentStore.getState();
    noteBotAttention('bot-1', 'missing_config');
    noteBotAttention('bot-2', 'agent_blocked');

    clearBotAttention('bot-1');
    expect(useAgentStore.getState().attention['bot-1']).toBeUndefined();
    expect(useAgentStore.getState().attention['bot-2']).toBeDefined();

    // Clearing a non-existent entry is a no-op.
    clearBotAttention('bot-404');
    expect(Object.keys(useAgentStore.getState().attention)).toHaveLength(1);
  });

  it('filters archived, deprecated, and hidden bots from the visible view', () => {
    const { noteBotAttention } = useAgentStore.getState();
    noteBotAttention('active-bot', 'missing_config');
    noteBotAttention('archived-bot', 'missing_config');
    noteBotAttention('deprecated-bot', 'missing_config');
    noteBotAttention('hidden-bot', 'missing_config');
    noteBotAttention('unloaded-bot', 'missing_config');

    const agents = [
      makeBot('active-bot', { botProfile: { displayName: 'Active', lifecycle: 'active' } }),
      makeBot('archived-bot', { botProfile: { displayName: 'Archived', lifecycle: 'archived' } }),
      makeBot('deprecated-bot', { botProfile: { displayName: 'Deprecated', lifecycle: 'deprecated' } }),
      makeBot('hidden-bot', { botProfile: { displayName: 'Hidden', hidden: true } }),
      // 'unloaded-bot' intentionally absent — not loaded, so not visible.
    ];

    const visible = getVisibleAttention(useAgentStore.getState().attention, agents);
    expect(Object.keys(visible)).toEqual(['active-bot']);
  });

  it('still accumulates attention for archived/hidden bots in state', () => {
    const { noteBotAttention } = useAgentStore.getState();
    noteBotAttention('archived-bot', 'provider_auth_or_access');

    const { attention } = useAgentStore.getState();
    expect(attention['archived-bot']).toBeDefined();
    // The lifecycle filter hides it until the bot is un-archived/un-hidden.
    expect(
      getVisibleAttention(attention, [makeBot('archived-bot', {
        botProfile: { displayName: 'Archived', lifecycle: 'archived' },
      })]),
    ).toEqual({});
  });
});
