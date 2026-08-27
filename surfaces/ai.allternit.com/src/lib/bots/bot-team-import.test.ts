import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  parseTeamFile,
  previewTeamImport,
  importTeamFromContent,
  type TeamImportOptions,
} from './bot-team-import';
import type { Agent } from '@/lib/agents/agent.types';

const mockCreateAgent = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>): Promise<Agent> => ({
    id: `bot_${String(input.name).toLowerCase().replace(/\s+/g, '_')}`,
    name: input.name as string,
    description: (input.description as string) ?? '',
    type: (input.type as Agent['type']) || 'specialist',
    model: (input.model as string) || 'default',
    provider: (input.provider as Agent['provider']) || 'custom',
    capabilities: (input.capabilities as string[]) || [],
    tools: (input.tools as string[]) || [],
    maxIterations: (input.maxIterations as number) || 50,
    temperature: (input.temperature as number) || 0.7,
    config: (input.config as Record<string, unknown>) || {},
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBot: true,
    botProfile: input.botProfile as Agent['botProfile'],
    connectorBindings: input.connectorBindings as Agent['connectorBindings'],
  })),
);

vi.mock('@/lib/agents/agent.service', () => ({
  createAgent: mockCreateAgent,
}));

const mockCreateBotRoutine = vi.hoisted(() => vi.fn(() => ({ id: 'routine_1' })));

vi.mock('./bot-routine.service', () => ({
  createBotRoutine: mockCreateBotRoutine,
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-0000',
}));

describe('parseTeamFile', () => {
  it('parses markdown with YAML frontmatter', () => {
    const markdown = `---
name: Support Team
bots:
  - name: triage
    displayName: Triage Bot
    systemPrompt: Route incoming tickets
---

# Support Team
`;
    const manifest = parseTeamFile(markdown);
    expect(manifest.name).toBe('Support Team');
    expect(manifest.bots).toHaveLength(1);
    expect(manifest.bots[0].name).toBe('triage');
    expect(manifest.bots[0].displayName).toBe('Triage Bot');
  });

  it('parses plain YAML without frontmatter delimiters', () => {
    const yaml = `
name: Plain Team
bots:
  - name: helper
    displayName: Helper
`;
    const manifest = parseTeamFile(yaml);
    expect(manifest.name).toBe('Plain Team');
    expect(manifest.bots).toHaveLength(1);
  });

  it('normalizes connector bindings and identity channels', () => {
    const markdown = `---
name: App Team
bots:
  - name: sales
    displayName: Sales Bot
    connectors:
      - provider: slack
        capabilities:
          - notify
    channels:
      email:
        address: sales@example.com
---
`;
    const manifest = parseTeamFile(markdown);
    const bot = manifest.bots[0];
    expect(bot.connectorBindings).toHaveLength(1);
    expect(bot.connectorBindings?.[0].provider).toBe('slack');
    expect(bot.connectorBindings?.[0].capabilities).toContain('notify');
    expect(bot.identityChannels).toEqual({ email: { address: 'sales@example.com' } });
  });

  it('throws when bots array is missing', () => {
    expect(() => parseTeamFile('name: Empty')).toThrow('Team file must contain at least one bot');
  });
});

describe('previewTeamImport', () => {
  it('returns valid preview for a team with bots, channels, routines, and connectors', async () => {
    const markdown = `---
name: Full Team
bots:
  - name: scout
    displayName: Scout
channels:
  - botName: scout
    type: email
    config:
      address: scout@example.com
routines:
  - botName: scout
    title: Daily sweep
    instruction: Check for leads
    frequency: daily
---
`;
    const preview = await previewTeamImport(markdown);
    expect(preview.valid).toBe(true);
    expect(preview.teamName).toBe('Full Team');
    expect(preview.botCount).toBe(1);
    expect(preview.channelCount).toBe(1);
    expect(preview.routineCount).toBe(1);
    expect(preview.connectorCount).toBe(0);
  });

  it('reports errors for invalid content', async () => {
    const preview = await previewTeamImport('not yaml: [:');
    expect(preview.valid).toBe(false);
    expect(preview.errors.length).toBeGreaterThan(0);
  });
});

describe('importTeamFromContent', () => {
  beforeEach(() => {
    mockCreateAgent.mockClear();
    mockCreateBotRoutine.mockClear();
  });

  it('creates bots and routines from a team file', async () => {
    const markdown = `---
name: Import Test
bots:
  - name: scout
    displayName: Scout
    description: Finds leads
routines:
  - botName: scout
    title: Daily sweep
    instruction: Check for leads
    frequency: daily
---
`;
    const result = await importTeamFromContent(markdown);

    expect(result.success).toBe(true);
    expect(result.teamName).toBe('Import Test');
    expect(result.bots).toHaveLength(1);
    expect(result.bots[0].agent.name).toBe('scout');
    expect(result.routines).toHaveLength(1);
    expect(mockCreateAgent).toHaveBeenCalledTimes(1);
    expect(mockCreateBotRoutine).toHaveBeenCalledTimes(1);
  });

  it('applies import options and appends adaptation prompt', async () => {
    const markdown = `---
name: Adapted Team
bots:
  - name: writer
    displayName: Writer
    systemPrompt: Write copy
---
`;
    const options: TeamImportOptions = {
      teamName: 'Renamed Team',
      importPrompt: 'Always use British English.',
    };

    const result = await importTeamFromContent(markdown, options);

    expect(result.teamName).toBe('Renamed Team');
    const createInput = mockCreateAgent.mock.calls[0][0] as Record<string, unknown>;
    expect(createInput.systemPrompt).toContain('Write copy');
    expect(createInput.systemPrompt).toContain('Always use British English.');
  });
});
