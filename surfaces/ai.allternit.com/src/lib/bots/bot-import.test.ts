import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  previewBotImport,
  importBotFromZip,
  importAndStartBot,
  type BotImportOptions,
} from './bot-import';
import type { Agent, Bot } from '@/lib/agents/agent.types';

const mockCreateAgent = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>): Promise<Agent> => ({
    id: 'bot-imported-abc123',
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
    botProfile: input.botProfile as Bot['botProfile'],
    workspaceId: 'ws-imported',
  }))
);

const mockWorkspaceCreate = vi.hoisted(() => vi.fn());
const mockWorkspaceWriteFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/agents/agent.service', () => ({
  createAgent: mockCreateAgent,
}));

vi.mock('@/lib/agents/agent-workspace.service', () => ({
  agentWorkspaceService: {
    create: mockWorkspaceCreate,
    writeFile: mockWorkspaceWriteFile,
  },
}));

function makeValidBotJson(): Record<string, unknown> {
  return {
    id: 'deep-researcher-hermes',
    name: 'Deep Researcher',
    description: 'Imported research bot',
    type: 'specialist',
    model: 'claude-sonnet-4',
    provider: 'anthropic' as const,
    capabilities: ['research', 'web_search'],
    systemPrompt: 'You are a meticulous research assistant.',
    tools: ['web_search', 'citation'],
    maxIterations: 50,
    temperature: 0.7,
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBot: true,
    botProfile: {
      displayName: 'Deep Researcher',
      tagline: 'Find anything, cite everything',
      welcomeMessage: 'What are we investigating today?',
      starterPrompts: ['Research local LLM inference frameworks'],
      accentColor: '#8b5cf6',
      groupChatEnabled: true,
      botCategory: 'research',
    },
    connectorBindings: [
      {
        connectorId: 'conn-1',
        provider: 'slack',
        capabilities: ['notify'],
        autonomous: true,
      },
    ],
    secretRefs: [{ name: 'Search API Key', key: 'SEARCH_API_KEY', required: true }],
    vmOperator: {
      enabled: true,
      provider: 'opensandbox' as const,
      allowedActions: ['command', 'browser'] as const,
      persistence: 'persistent' as const,
    },
  };
}

async function botJsonToZipFile(
  botJson: Record<string, unknown>,
  extras?: Record<string, string>
): Promise<File> {
  const zip = new JSZip();
  zip.file('bot.json', JSON.stringify(botJson, null, 2));
  if (extras) {
    for (const [path, content] of Object.entries(extras)) {
      zip.file(path, content);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'import.zip', { type: 'application/zip' });
}

describe('bot-import', () => {
  beforeEach(() => {
    mockCreateAgent.mockClear();
    mockWorkspaceCreate.mockClear();
    mockWorkspaceWriteFile.mockClear();
  });

  describe('previewBotImport', () => {
    it('returns valid preview for a complete bot archive', async () => {
      const file = await botJsonToZipFile(makeValidBotJson(), {
        'memory/MEMORY.md': '# Memory',
        'skills/research.md': '# Research skill',
        'docs/README.md': '# Docs',
      });
      const preview = await previewBotImport(file);

      expect(preview.valid).toBe(true);
      expect(preview.botName).toBe('Deep Researcher');
      expect(preview.hasMemory).toBe(true);
      expect(preview.hasSkills).toBe(true);
      expect(preview.hasDocs).toBe(true);
      expect(preview.hasConnectors).toBe(true);
      expect(preview.hasSecrets).toBe(true);
      expect(preview.hasVMOperator).toBe(true);
      expect(preview.errors).toHaveLength(0);
    });

    it('rejects archive missing bot.json', async () => {
      const zip = new JSZip();
      zip.file('readme.md', '# readme');
      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'bad.zip', { type: 'application/zip' });

      const preview = await previewBotImport(file);
      expect(preview.valid).toBe(false);
      expect(preview.errors.some((e) => e.includes('bot.json'))).toBe(true);
    });

    it('rejects archive with invalid bot.json', async () => {
      const file = await botJsonToZipFile({ name: 'Broken' } as Record<string, unknown>);
      const preview = await previewBotImport(file);
      expect(preview.valid).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
    });

    it('warns when archive lacks workspace directories', async () => {
      const file = await botJsonToZipFile(makeValidBotJson());
      const preview = await previewBotImport(file);
      expect(preview.valid).toBe(true);
      expect(preview.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('importBotFromZip', () => {
    it('creates agent and copies workspace directories', async () => {
      const file = await botJsonToZipFile(makeValidBotJson(), {
        'memory/MEMORY.md': '# Memory',
        'skills/research.md': '# Research skill',
        'tasks/nightly.json': JSON.stringify({ name: 'Nightly Review' }),
        'identity/EMAIL.md': 'bot@allternit.com',
      });

      const result = await importBotFromZip(file, {
        importPrompt: 'Adapt this bot for Allternit.',
        userContext: { userId: 'user-1' },
      });

      expect(result.success).toBe(true);
      expect(result.agent).toBeDefined();
      expect(result.agent?.isBot).toBe(true);
      expect(result.agent?.workspaceId).toBe('ws-imported');
      expect(result.error).toBeUndefined();

      expect(mockCreateAgent).toHaveBeenCalledOnce();
      const createInput = mockCreateAgent.mock.calls[0][0] as Record<string, unknown>;
      expect(createInput.isBot).toBe(true);
      expect(createInput.botProfile).toMatchObject({ displayName: 'Deep Researcher' });
      expect(createInput.systemPrompt).toContain('Adapt this bot for Allternit.');
      expect(createInput.vmOperator).toMatchObject({ enabled: true, provider: 'opensandbox' });

      expect(mockWorkspaceCreate).toHaveBeenCalledOnce();
      expect(mockWorkspaceWriteFile).toHaveBeenCalledTimes(4);
    });

    it('renames bot when displayName option is provided', async () => {
      const file = await botJsonToZipFile(makeValidBotJson());
      const result = await importBotFromZip(file, { displayName: 'Renamed Bot' });

      expect(result.success).toBe(true);
      expect(result.agent?.name).toBe('Renamed Bot');
      expect(mockCreateAgent.mock.calls[0][0]).toMatchObject({
        name: 'Renamed Bot',
        botProfile: { displayName: 'Renamed Bot' },
      });
    });

    it('returns error for invalid bot package', async () => {
      const file = await botJsonToZipFile({ name: 'Broken' } as Record<string, unknown>);
      const result = await importBotFromZip(file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid bot package');
      expect(result.agent).toBeUndefined();
    });

    it('collects warnings for failed workspace writes', async () => {
      mockWorkspaceWriteFile.mockRejectedValueOnce(new Error('disk full'));
      const file = await botJsonToZipFile(makeValidBotJson(), {
        'memory/MEMORY.md': '# Memory',
      });

      const result = await importBotFromZip(file);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('disk full'))).toBe(true);
    });
  });

  describe('importAndStartBot', () => {
    it('returns same result as importBotFromZip', async () => {
      const file = await botJsonToZipFile(makeValidBotJson());
      const result = await importAndStartBot(file);
      expect(result.success).toBe(true);
      expect(result.agent).toBeDefined();
    });
  });
});
