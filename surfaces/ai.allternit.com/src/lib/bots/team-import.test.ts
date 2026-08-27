import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  teamImportPreview,
  previewTeamImport,
  importTeamFromText,
  type TeamManifestV1,
  type TeamManifestV2,
  type TeamManifestPackage,
} from './team-import';
import type { Agent } from '@/lib/agents/agent.types';

const mockCreateAgent = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>): Promise<Agent> => ({
    id: `bot_${String(input.name).toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    name: input.name as string,
    description: input.description as string,
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
    isBot: input.isBot === true,
    botProfile: input.botProfile as Agent['botProfile'],
  })),
);

vi.mock('@/lib/agents/agent.service', () => ({
  createAgent: mockCreateAgent,
}));

const mockCreateBotRoutine = vi.hoisted(() => vi.fn(() => ({ id: 'routine_1' })));

vi.mock('./bot-routine.service', () => ({
  createBotRoutine: mockCreateBotRoutine,
}));

describe('team import preview', () => {
  beforeEach(() => {
    mockCreateAgent.mockClear();
    mockCreateBotRoutine.mockClear();
  });

  it.each([1, 2])('previews version %s team files', (version) => {
    const manifest = {
      format: 'openmaus.team',
      version,
      team: {
        name: ' Engineering ',
        description: ' Ships software ',
        members: [{ key: 'ada', name: ' Ada ', title: ' Tech Lead ' }],
        ...(version === 1
          ? { room: { name: 'Engineering', bulletin: '', defaultResponder: { kind: 'everyone' as const } } }
          : {}),
      },
    };

    const preview = teamImportPreview(manifest);

    expect(preview).toMatchObject({
      kind: 'team',
      name: 'Engineering',
      description: 'Ships software',
      members: [{ key: 'ada', name: 'Ada', title: 'Tech Lead' }],
      rooms: version === 1 ? [{ name: 'Engineering' }] : [],
    });
  });

  it('rejects unsupported and empty files', () => {
    expect(() => teamImportPreview({ format: 'openmaus.team', version: 3, team: {} })).toThrow('not supported');
    expect(() =>
      teamImportPreview({ format: 'openmaus.team', version: 2, team: { name: 'Empty', members: [] } }),
    ).toThrow('at least one member');
  });

  it('previews the complete package setup before installation', () => {
    const manifest: TeamManifestPackage = {
      format: 'openmaus.package',
      version: 1,
      package: {
        name: 'Lead Desk',
        summary: 'Find qualified conversations.',
        agents: [
          { key: 'scout', name: 'Scout', title: 'Researcher' },
          { key: 'writer', name: 'Writer', title: 'Outreach' },
        ],
        chiefOfStaff: 'scout',
        rooms: [{ name: 'Lead Desk Room' }],
        playbooks: [{ name: 'Qualify', description: 'Qualify leads' }],
        routines: [{ name: 'Daily sweep', instruction: 'Check for new leads', frequency: 'daily' }],
        requirements: {
          apps: [{ label: 'Reddit' }, { label: 'Google Sheets', optional: true }],
        },
      },
    };

    const preview = teamImportPreview(manifest);

    expect(preview).toMatchObject({
      kind: 'package',
      name: 'Lead Desk',
      chiefOfStaff: 'Scout',
      rooms: [{ name: 'Lead Desk Room' }],
      playbooks: [{ name: 'Qualify' }],
      routines: [{ name: 'Daily sweep', frequency: 'daily' }],
      apps: [
        { label: 'Reddit', optional: false },
        { label: 'Google Sheets', optional: true },
      ],
    });
  });

  it('previews a portable Markdown playbook', async () => {
    const markdown = `---
botmrr: 1
name: Lead Desk
summary: Find qualified conversations.
agents:
  - key: scout
    name: Scout
    title: Researcher
chiefOfStaff: scout
rooms: []
playbooks: []
routines: []
requirements:
  apps:
    - label: Reddit
---

# Lead Desk

## Activation

Create the team.`;

    const preview = await previewTeamImport(markdown);

    expect(preview.valid).toBe(true);
    expect(preview.name).toBe('Lead Desk');
    expect(preview.kind).toBe('package');
    expect(preview.memberCount).toBe(1);
    expect(preview.chiefOfStaff).toBe('Scout');
    expect(preview.appCount).toBe(1);
  });
});

describe('team import execution', () => {
  beforeEach(() => {
    mockCreateAgent.mockClear();
    mockCreateBotRoutine.mockClear();
  });

  it('imports a package and creates bots, routines, and connector bindings', async () => {
    const manifest: TeamManifestPackage = {
      format: 'openmaus.package',
      version: 1,
      package: {
        name: 'Lead Desk',
        summary: 'Find qualified conversations.',
        agents: [
          { key: 'scout', name: 'Scout', title: 'Researcher', description: 'Finds leads' },
          { key: 'writer', name: 'Writer', title: 'Outreach' },
        ],
        routines: [{ name: 'Daily sweep', instruction: 'Check for new leads', frequency: 'daily' }],
        requirements: {
          apps: [{ label: 'Reddit' }],
        },
      },
    };

    const result = await importTeamFromText(JSON.stringify(manifest));

    expect(result.success).toBe(true);
    expect(result.teamName).toBe('Lead Desk');
    expect(result.bots).toHaveLength(2);
    expect(result.routines).toHaveLength(2);
    expect(result.connectorBindings).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);

    expect(mockCreateAgent).toHaveBeenCalledTimes(2);
    const createInput = mockCreateAgent.mock.calls[0][0] as Record<string, unknown>;
    expect(createInput.isBot).toBe(true);
    expect(createInput.botProfile).toMatchObject({ displayName: 'Scout' });
    expect(createInput.systemPrompt).toContain('Finds leads');
    expect(createInput.connectorBindings).toHaveLength(1);
    expect((createInput.connectorBindings as Array<Record<string, unknown>>)[0]).toMatchObject({
      provider: 'reddit',
      label: 'Reddit',
    });
  });

  it('imports a legacy team manifest and normalizes it to a package', async () => {
    const manifest: TeamManifestV2 = {
      format: 'openmaus.team',
      version: 2,
      team: {
        name: 'Engineering',
        description: 'Ships software',
        members: [{ key: 'ada', name: 'Ada', title: 'Tech Lead' }],
      },
    };

    const result = await importTeamFromText(JSON.stringify(manifest));

    expect(result.success).toBe(true);
    expect(result.teamName).toBe('Engineering');
    expect(result.bots).toHaveLength(1);
    expect(result.bots[0].agent.name).toBe('Ada');
  });

  it('returns an error for invalid input', async () => {
    const result = await importTeamFromText('not a team');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.bots).toHaveLength(0);
  });
});
