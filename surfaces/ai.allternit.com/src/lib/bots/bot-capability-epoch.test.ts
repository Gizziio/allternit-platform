/**
 * Tests for the bot capability epoch (spec AD-4).
 */

import { describe, it, expect } from 'vitest';
import { computeCapabilityEpoch, capabilityEpochLine, hasEpochDrifted } from './bot-capability-epoch';
import type { Agent } from '../agents/agent.types';

let counter = 0;

function makeBot(overrides: Partial<Agent> = {}): Agent {
  counter += 1;
  return {
    id: `bot-${counter}`,
    name: 'researcher',
    description: 'Researches things',
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
    botProfile: {
      displayName: 'Researcher',
      tagline: 'I research',
      starterPrompts: ['Find X', 'Summarize Y'],
    },
    systemPrompt: 'You are a diligent researcher.',
    allowedSkills: ['web-search'],
    allowedTools: ['browser'],
    connectorBindings: [
      { connectorId: 'conn-1', provider: 'slack', capabilities: [], autonomous: true },
    ],
    secretRefs: [{ name: 'API key', key: 'API_KEY' }],
    ...overrides,
  } as unknown as Agent;
}

const ROSTER = [
  { name: 'researcher', handle: 'researcher' },
  { name: 'writer', handle: 'writer' },
];

describe('computeCapabilityEpoch', () => {
  it('is stable for the same bot and roster', () => {
    const bot = makeBot();
    const a = computeCapabilityEpoch(bot, ROSTER);
    const b = computeCapabilityEpoch(makeBot({ ...bot, id: bot.id }), ROSTER);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is independent of ordering of skills/tools/roster', () => {
    const bot = makeBot();
    const reordered = makeBot({
      ...bot,
      allowedSkills: ['web-search'],
      allowedTools: ['browser'],
      connectorBindings: [
        { connectorId: 'conn-1', provider: 'slack', capabilities: [], autonomous: true },
      ],
      secretRefs: [{ name: 'API key', key: 'API_KEY' }],
    });
    expect(computeCapabilityEpoch(bot, ROSTER)).toBe(
      computeCapabilityEpoch(reordered, [...ROSTER].reverse()),
    );
  });

  it('drifts when the tagline changes', () => {
    const before = makeBot();
    const after = makeBot({ ...before, botProfile: { ...before.botProfile!, tagline: 'New tagline' } });
    expect(computeCapabilityEpoch(before, ROSTER)).not.toBe(
      computeCapabilityEpoch(after, ROSTER),
    );
  });

  it('drifts when the description changes', () => {
    const before = makeBot();
    const after = makeBot({ ...before, description: 'Something else entirely' });
    expect(computeCapabilityEpoch(before, ROSTER)).not.toBe(
      computeCapabilityEpoch(after, ROSTER),
    );
  });

  it('drifts when system-prompt presence flips', () => {
    const withPrompt = makeBot();
    const withoutPrompt = makeBot({ ...withPrompt, systemPrompt: '' });
    expect(computeCapabilityEpoch(withPrompt, ROSTER)).not.toBe(
      computeCapabilityEpoch(withoutPrompt, ROSTER),
    );
  });

  it('drifts when starter prompts, skills, tools, connectors, or secrets change', () => {
    const base = makeBot();
    const baseEpoch = computeCapabilityEpoch(base, ROSTER);

    const starterDrift = makeBot({
      ...base,
      botProfile: { ...base.botProfile!, starterPrompts: ['Only one'] },
    });
    expect(computeCapabilityEpoch(starterDrift, ROSTER)).not.toBe(baseEpoch);

    const skillDrift = makeBot({ ...base, allowedSkills: ['web-search', 'code'] });
    expect(computeCapabilityEpoch(skillDrift, ROSTER)).not.toBe(baseEpoch);

    const toolDrift = makeBot({ ...base, allowedTools: [] });
    expect(computeCapabilityEpoch(toolDrift, ROSTER)).not.toBe(baseEpoch);

    const connectorDrift = makeBot({ ...base, connectorBindings: [] });
    expect(computeCapabilityEpoch(connectorDrift, ROSTER)).not.toBe(baseEpoch);

    const secretDrift = makeBot({ ...base, secretRefs: [] });
    expect(computeCapabilityEpoch(secretDrift, ROSTER)).not.toBe(baseEpoch);
  });

  it('drifts when the roster changes', () => {
    const bot = makeBot();
    const epoch = computeCapabilityEpoch(bot, ROSTER);
    const biggerRoster = [...ROSTER, { name: 'critic', handle: 'critic' }];
    expect(computeCapabilityEpoch(bot, biggerRoster)).not.toBe(epoch);
  });

  it('does not drift on changes outside the capability surface', () => {
    const base = makeBot();
    const baseEpoch = computeCapabilityEpoch(base, ROSTER);
    const renamed = makeBot({ ...base, name: 'renamed-but-same-capabilities' });
    const recolored = makeBot({
      ...base,
      botProfile: { ...base.botProfile!, accentColor: '#ff0000', welcomeMessage: 'Hi!' },
    });
    expect(computeCapabilityEpoch(renamed, ROSTER)).toBe(baseEpoch);
    expect(computeCapabilityEpoch(recolored, ROSTER)).toBe(baseEpoch);
  });
});

describe('capabilityEpochLine', () => {
  it('formats the epoch stamp', () => {
    expect(capabilityEpochLine('abc123def456')).toBe('Capability epoch: abc123def456');
  });
});

describe('hasEpochDrifted (rebuild-once-per-drift gate)', () => {
  it('drifts when the stored epoch is missing (pre-epoch sessions get stamped once)', () => {
    expect(hasEpochDrifted(undefined, 'abc123def456')).toBe(true);
  });

  it('drifts when the stored epoch has a different value or shape', () => {
    expect(hasEpochDrifted('000000000000', 'abc123def456')).toBe(true);
    expect(hasEpochDrifted(123, 'abc123def456')).toBe(true);
    expect(hasEpochDrifted(null, 'abc123def456')).toBe(true);
  });

  it('does not drift when the stored epoch matches the computed one', () => {
    expect(hasEpochDrifted('abc123def456', 'abc123def456')).toBe(false);
  });

  it('triggers exactly one rebuild across consecutive starts', () => {
    const bot = makeBot();
    const initialEpoch = computeCapabilityEpoch(bot, ROSTER);

    // First start of a legacy session: no stored epoch → one rebuild.
    let storedEpoch: unknown = undefined;
    expect(hasEpochDrifted(storedEpoch, initialEpoch)).toBe(true);
    // The rebuild stamps the session metadata with the current epoch…
    storedEpoch = initialEpoch;
    // …so the next start sees no drift and leaves the session untouched.
    expect(hasEpochDrifted(storedEpoch, initialEpoch)).toBe(false);

    // A capability edit drifts the epoch once; the stamp then re-syncs.
    const edited = makeBot({
      ...bot,
      botProfile: { ...bot.botProfile!, tagline: 'Edited tagline' },
    });
    const driftedEpoch = computeCapabilityEpoch(edited, ROSTER);
    expect(driftedEpoch).not.toBe(initialEpoch);
    expect(hasEpochDrifted(storedEpoch, driftedEpoch)).toBe(true);
    storedEpoch = driftedEpoch;
    expect(hasEpochDrifted(storedEpoch, driftedEpoch)).toBe(false);
  });
});
