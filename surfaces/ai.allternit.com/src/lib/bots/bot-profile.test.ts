/**
 * Tests for bot-profile helpers, including Agent -> Bot conversion used by
 * the roster duplication flow.
 */

import { describe, it, expect } from 'vitest';
import { agentToBot, agentToCreateAgentInput, createBotAgent, getBotHandle, slugBotHandle } from './bot-profile';
import { BotSchema } from './orpc-contracts';
import type { Agent, BotProfile } from '../agents/agent.types';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  const botProfile: BotProfile = {
    displayName: 'Deep Researcher',
    handle: 'deep-researcher',
    tagline: 'Find anything, cite everything',
    welcomeMessage: 'Hello',
    starterPrompts: ['Research this'],
    accentColor: '#8b5cf6',
    groupChatEnabled: true,
    botCategory: 'research',
    lifecycle: 'active',
  };

  return createBotAgent(
    {
      id: 'bot_original',
      name: 'Deep Researcher',
      description: 'A research bot',
      type: 'specialist',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      systemPrompt: 'You are a researcher.',
      tools: ['web_search'],
      capabilities: ['research'],
      maxIterations: 50,
      temperature: 0.7,
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'organization',
      category: 'research',
      tags: ['research'],
      trustTier: 'standard',
      allowedSurfaces: ['chat'],
      ...overrides,
    } as Omit<Agent, 'isBot' | 'botProfile'>,
    botProfile,
  );
}

describe('bot-profile', () => {
  it('converts a packaged agent to the canonical Bot contract', () => {
    const agent = makeAgent();
    const bot = agentToBot(agent);

    const parsed = BotSchema.parse(bot);
    expect(parsed.id).toBe(agent.id);
    expect(parsed.name).toBe(agent.name);
    expect(parsed.isBot).toBe(true);
    expect(parsed.botProfile.displayName).toBe('Deep Researcher');
    expect(parsed.operationalState).toBeUndefined();
  });

  it('falls back non-canonical agent types to specialist', () => {
    const agent = makeAgent({ type: 'planner' as Agent['type'] });
    const bot = agentToBot(agent);

    expect(bot.type).toBe('specialist');
    expect(BotSchema.parse(bot)).toBeDefined();
  });

  it('strips agent-only fields that are not in the Bot contract', () => {
    const agent = makeAgent({ systemPrompt: 'secret prompt', tools: ['tool_a'] });
    const bot = agentToBot(agent);

    expect((bot as Record<string, unknown>).systemPrompt).toBeUndefined();
    expect((bot as Record<string, unknown>).tools).toBeUndefined();
  });
});

describe('agentToCreateAgentInput (share-auth / duplicate inheritance)', () => {
  it('strips operational history but keeps indirect secret refs', () => {
    const agent = makeAgent({
      totalRuns: 7,
      lastRunAt: '2026-09-01T00:00:00Z',
      assignedTaskIds: ['task-1', 'task-2'],
      secretRefs: [
        {
          name: 'API Key',
          key: 'API_KEY',
          vaultRef: 'vault://team/api-key',
          required: true,
          value: 'plaintext-should-not-inherit',
        },
      ],
    });

    const draft = agentToCreateAgentInput(agent) as Record<string, unknown>;

    // Hermes history-strip rule: no runs, tasks, or timestamps follow the copy.
    expect(draft.totalRuns).toBeUndefined();
    expect(draft.lastRunAt).toBeUndefined();
    expect(draft.assignedTaskIds).toBeUndefined();
    expect(draft.id).toBeUndefined();
    expect(draft.status).toBeUndefined();

    // Identity + persona DO inherit.
    expect(draft.systemPrompt).toBe('You are a researcher.');
    expect(draft.botProfile).toBeDefined();

    // Secret refs stay indirect: the vault reference is preserved but the
    // plaintext value is redacted so the new bot re-resolves via the store.
    const refs = draft.secretRefs as Array<Record<string, unknown>>;
    expect(refs).toHaveLength(1);
    expect(refs[0].vaultRef).toBe('vault://team/api-key');
    expect(refs[0].value).toBeUndefined();
  });
});

describe('getBotHandle', () => {
  it('prefers an explicit botProfile.handle', () => {
    expect(getBotHandle(makeAgent())).toBe('deep-researcher');
  });

  it('slugifies a spaced display name when handle is unset', () => {
    expect(slugBotHandle('Echo Alpha', 'id-ignored-when-slugable')).toBe('echo-alpha');
    const agent = makeAgent();
    agent.botProfile = { ...agent.botProfile!, displayName: 'Echo Beta', handle: undefined };
    expect(getBotHandle(agent)).toBe('echo-beta');
  });
});
