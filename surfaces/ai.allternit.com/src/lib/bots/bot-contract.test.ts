import { describe, it, expect } from 'vitest';
import {
  validateBot,
  isValidBot,
  packageAgentAsBot,
  listBotPrimitives,
  describeBotContract,
  botProfileSchema,
} from './bot-contract';
import type { Agent } from '@/lib/agents/agent.types';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'test-agent',
    description: 'A test agent',
    type: 'specialist',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    capabilities: ['chat'],
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {},
    ...overrides,
  };
}

describe('bot-contract', () => {
  it('rejects a plain agent as an invalid bot', () => {
    const agent = makeAgent();
    const result = validateBot(agent);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('isBot'))).toBe(true);
  });

  it('accepts a complete bot package', () => {
    const bot = makeAgent({
      isBot: true,
      botProfile: {
        displayName: 'Test Bot',
        tagline: 'A helpful test bot',
        botCategory: 'research',
        accentColor: '#D4B08C',
      },
    });
    const result = validateBot(bot);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(isValidBot(bot)).toBe(true);
  });

  it('requires a displayName in botProfile', () => {
    const bot = makeAgent({
      isBot: true,
      botProfile: {} as any,
    });
    const result = validateBot(bot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('botProfile.displayName'))).toBe(true);
  });

  it('packages an agent as a bot', () => {
    const agent = makeAgent();
    const bot = packageAgentAsBot({
      agent,
      botProfile: {
        displayName: 'Packaged Bot',
        botCategory: 'ops',
      },
      connectorBindings: [
        { connectorId: 'slack-1', provider: 'slack', label: 'Slack', capabilities: ['notify'], autonomous: true },
      ],
      secretRefs: [{ name: 'API Key', key: 'API_KEY', required: true }],
    });

    expect(bot.isBot).toBe(true);
    expect(bot.botProfile.displayName).toBe('Packaged Bot');
    expect(bot.connectorBindings).toHaveLength(1);
    expect(bot.secretRefs).toHaveLength(1);
  });

  it('throws when packaging produces an invalid bot', () => {
    const agent = makeAgent();
    expect(() =>
      packageAgentAsBot({
        agent,
        botProfile: {} as any,
      })
    ).toThrow();
  });

  it('lists primitives and missing required secrets', () => {
    const bot = makeAgent({
      isBot: true,
      botProfile: { displayName: 'Primitive Bot' },
      connectorBindings: [{ connectorId: 'c1', provider: 'github', capabilities: ['code'], autonomous: true }],
      secretRefs: [
        { name: 'Required Secret', key: 'REQ_SECRET', required: true },
        { name: 'Optional Secret', key: 'OPT_SECRET', required: false, vaultRef: 'vault://opt' },
      ],
      messagingConfig: { photonEnabled: true },
      identityChannels: { email: { address: 'bot@allternit.com', provider: 'commrails', sendEnabled: true, receiveEnabled: true } },
      vmOperator: {
        enabled: true,
        provider: 'opensandbox',
        image: 'opensandbox/desktop:v1.0.0',
        allowedActions: ['command', 'browser', 'desktop'],
      },
    });

    const primitives = listBotPrimitives(bot);
    expect(primitives.hasConnectors).toBe(true);
    expect(primitives.hasSecrets).toBe(true);
    expect(primitives.hasMessaging).toBe(true);
    expect(primitives.hasIdentityChannels).toBe(true);
    expect(primitives.hasVMOperator).toBe(true);
    expect(primitives.missingRequiredSecrets).toEqual(['REQ_SECRET']);
  });

  it('validates a bot with a vmOperator', () => {
    const bot = makeAgent({
      isBot: true,
      botProfile: { displayName: 'VM Bot' },
      vmOperator: {
        enabled: true,
        provider: 'opensandbox',
        image: 'opensandbox/desktop:v1.0.0',
        allowedActions: ['command', 'browser'],
        networkPolicy: 'restricted',
        persistence: 'session',
        timeoutMinutes: 30,
      },
    });

    const result = validateBot(bot);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates accentColor format', () => {
    expect(botProfileSchema.safeParse({ displayName: 'OK', accentColor: '#D4B08C' }).success).toBe(true);
    expect(botProfileSchema.safeParse({ displayName: 'OK', accentColor: 'not-a-color' }).success).toBe(false);
  });

  it('describes the contract', () => {
    const description = describeBotContract();
    expect(description).toContain('Bot is an Agent');
    expect(description).toContain('connectorBindings');
    expect(description).toContain('identityChannels');
    expect(description).toContain('vmOperator');
  });
});
