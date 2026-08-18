/**
 * Tests for bot-profile helpers, including Agent -> Bot conversion used by
 * the roster duplication flow.
 */

import { describe, it, expect } from 'vitest';
import { agentToBot, createBotAgent } from './bot-profile';
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
