/**
 * Tests for the bot clone service (Wave 4 duplication).
 */

import { describe, it, expect } from 'vitest';
import {
  cloneBot,
  provisionIdentities,
  previewChildBotGraph,
  cloneBotGraph,
  previewClone,
} from './bot-clone.service';
import { BotSchema } from './orpc-contracts';
import { BotCloneError } from './bot-duplication-contracts';

function makeBot(overrides: Partial<ReturnType<typeof BotSchema.parse>> = {}) {
  return BotSchema.parse({
    id: 'bot_source',
    name: 'Researcher',
    description: 'A research bot',
    type: 'specialist',
    model: 'claude-sonnet-4',
    provider: 'anthropic',
    isBot: true,
    botProfile: {
      displayName: 'Researcher',
      handle: 'researcher',
      tagline: 'Finds things',
      botCategory: 'research',
      lifecycle: 'active',
    },
    operationalState: {
      status: 'working',
      activeGoalId: 'g_1',
      activityLabel: 'Summarizing',
      pendingApprovalsCount: 0,
      unreadMessagesCount: 3,
      computerState: 'running',
      lastEventSequence: 42,
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

describe('bot-clone.service', () => {
  it('creates a new bot with a new id and different handle', () => {
    const source = makeBot();
    const { bot, receipt } = cloneBot(source);

    expect(bot.id).not.toBe(source.id);
    expect(bot.name).toBe('Researcher (Clone)');
    expect(bot.botProfile.displayName).toBe('Researcher (Clone)');
    expect(bot.botProfile.handle).not.toBe('researcher');
    expect(bot.botProfile.handle?.startsWith('researcher-clone-')).toBe(true);

    expect(receipt.sourceBotId).toBe(source.id);
    expect(receipt.newBotId).toBe(bot.id);
    expect(receipt.newHandle).toBe(bot.botProfile.handle);
  });

  it('strips runtime state from the clone', () => {
    const source = makeBot();
    const { bot } = cloneBot(source);

    expect(bot.operationalState).toBeUndefined();
    expect((bot as any).sessions).toBeUndefined();
    expect((bot as any).activeRuns).toBeUndefined();
    expect((bot as any).runningJobs).toBeUndefined();
  });

  it('copies identity, profile, model, and category', () => {
    const source = makeBot();
    const { bot } = cloneBot(source);

    expect(bot.type).toBe(source.type);
    expect(bot.model).toBe(source.model);
    expect(bot.provider).toBe(source.provider);
    expect(bot.botProfile.botCategory).toBe('research');
    expect(bot.botProfile.tagline).toBe('Finds things');
  });

  it('excludes memory and routines by default', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source);

    const memoryMapping = receipt.idMappings.find((m) => m.entityType === 'memory');
    expect(memoryMapping?.copied).toBe(false);

    const routineMapping = receipt.idMappings.find((m) => m.entityType === 'routine');
    expect(routineMapping?.copied).toBe(false);
  });

  it('includes memory and routines when requested', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source, { includeMemory: true, includeRoutines: true });

    const memoryMapping = receipt.idMappings.find((m) => m.entityType === 'memory');
    expect(memoryMapping?.copied).toBe(true);

    const routineMapping = receipt.idMappings.find((m) => m.entityType === 'routine');
    expect(routineMapping?.copied).toBe(true);
  });

  it('marks connector bindings as requiring re-authorization when copied', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source, { copyConnectorBindings: true });

    const connectorMapping = receipt.idMappings.find((m) => m.entityType === 'connector');
    expect(connectorMapping?.copied).toBe(true);
    expect(connectorMapping?.reauthorizationRequired).toBe(true);
    expect(connectorMapping?.redacted).toBe(true);
    expect(receipt.warnings.some((w) => w.includes('re-authorization'))).toBe(true);
  });

  it('never copies sessions or receipt identities', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source, { includeMemory: true, includeRoutines: true, includeChildTopology: true });

    const sessionMapping = receipt.idMappings.find((m) => m.entityType === 'session');
    expect(sessionMapping?.copied).toBe(false);

    const receiptMapping = receipt.idMappings.find((m) => m.entityType === 'receipt');
    expect(receiptMapping?.copied).toBe(false);
  });

  it('applies explicit display name and handle overrides', () => {
    const source = makeBot();
    const { bot, receipt } = cloneBot(source, { displayName: 'Deep Researcher Copy', handle: 'deep-copy-42' });

    expect(bot.botProfile.displayName).toBe('Deep Researcher Copy');
    expect(bot.botProfile.handle).toBe('deep-copy-42');
    expect(receipt.newHandle).toBe('deep-copy-42');
  });

  it('records a redacted duplication receipt with id mappings', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source, {
      includeMemory: true,
      includeRoutines: true,
      copyConnectorBindings: true,
      includeComputerTemplate: true,
      includeChildTopology: true,
    });

    expect(receipt.idMappings.some((m) => m.entityType === 'bot' && m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'memory' && m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'routine' && m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'connector' && m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'computer' && m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'child_bot' && m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'session' && !m.copied)).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'receipt' && !m.copied)).toBe(true);
  });

  it('provisions placeholder identities when requested', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source, { provisionNewIdentities: true });

    expect(receipt.warnings.some((w) => w.includes('New unique identities'))).toBe(true);
    expect(receipt.idMappings.some((m) => m.entityType === 'child_bot' && m.copied)).toBe(true);
  });

  it('warns when unique identities are not provisioned', () => {
    const source = makeBot();
    const { receipt } = cloneBot(source, { provisionNewIdentities: false });

    expect(receipt.warnings.some((w) => w.includes('No unique identities'))).toBe(true);
    const identityMappings = receipt.idMappings.filter((m) => m.entityType === 'child_bot');
    expect(identityMappings.length).toBe(1); // child_topology only
  });

  describe('provisionIdentities', () => {
    it('returns empty identities and a warning when disabled', () => {
      const result = provisionIdentities('bot_a', 'bot_b', false);
      expect(result.identities).toHaveLength(0);
      expect(result.warnings[0]).toContain('No unique identities');
    });

    it('returns redacted placeholder identities for every kind when enabled', () => {
      const result = provisionIdentities('bot_a', 'bot_b', true);
      expect(result.identities.length).toBeGreaterThan(0);
      expect(result.identities.every((i) => i.redacted && !i.activated)).toBe(true);
      expect(result.warnings.some((w) => w.includes('New unique identities'))).toBe(true);
    });
  });

  describe('previewChildBotGraph', () => {
    function makeChild(id: string, parentId?: string) {
      return makeBot({ id, parentBotId: parentId, name: `Child ${id}` });
    }

    it('walks a tree up to the recursion limit', async () => {
      const root = makeBot({ id: 'root' });
      const c1 = makeChild('c1', 'root');
      const c2 = makeChild('c2', 'c1');
      const c3 = makeChild('c3', 'c2');

      const childrenByParent: Record<string, Bot[]> = {
        root: [c1],
        c1: [c2],
        c2: [c3],
      };

      const preview = await previewChildBotGraph({
        rootBotId: root.id,
        getChildren: (id) => childrenByParent[id] ?? [],
        recursionLimit: 2,
        includeChildTopology: true,
      });

      expect(preview.totalNodes).toBe(3); // root + c1 + c2
      expect(preview.reachedDepthLimit).toBe(true);
      expect(preview.nodesToCopy).toBe(3);
      expect(preview.hasCycle).toBe(false);
    });

    it('detects cycles', async () => {
      const a = makeBot({ id: 'a' });
      const b = makeBot({ id: 'b', parentBotId: 'a' });

      const childrenByParent: Record<string, Bot[]> = {
        a: [b],
        b: [a],
      };

      const preview = await previewChildBotGraph({
        rootBotId: a.id,
        getChildren: (id) => childrenByParent[id] ?? [],
        recursionLimit: 5,
      });

      expect(preview.hasCycle).toBe(true);
      expect(preview.cyclePath).toContain('a');
      expect(preview.cyclePath).toContain('b');
    });
  });

  describe('cloneBotGraph', () => {
    function makeChild(id: string, parentId?: string) {
      return makeBot({ id, parentBotId: parentId, name: `Child ${id}` });
    }

    it('clones the root and children and remaps IDs', async () => {
      const root = makeBot({ id: 'root' });
      const c1 = makeChild('c1', 'root');
      const c2 = makeChild('c2', 'root');

      const childrenByParent: Record<string, Bot[]> = {
        root: [c1, c2],
      };

      const result = await cloneBotGraph({
        rootBot: root,
        getChildren: (id) => childrenByParent[id] ?? [],
        options: { includeChildTopology: true },
        graphOptions: { recursionLimit: 2, includeChildTopology: true },
      });

      expect(result.root.bot.id).not.toBe('root');
      expect(result.children).toHaveLength(2);
      expect(result.children.every((c) => c.bot.parentBotId === result.root.bot.id)).toBe(true);
      expect(result.receipt.idMappings.some((m) => m.sourceId === 'c1' && m.entityType === 'child_bot')).toBe(true);
      expect(result.receipt.idMappings.some((m) => m.sourceId === 'c2' && m.entityType === 'child_bot')).toBe(true);
      expect(result.rolledBack).toBe(false);
    });

    it('rolls back when a cycle is detected', async () => {
      const a = makeBot({ id: 'a' });
      const b = makeBot({ id: 'b', parentBotId: 'a' });

      const childrenByParent: Record<string, Bot[]> = {
        a: [b],
        b: [a],
      };

      await expect(
        cloneBotGraph({
          rootBot: a,
          getChildren: (id) => childrenByParent[id] ?? [],
          options: { includeChildTopology: true },
          graphOptions: { recursionLimit: 5, includeChildTopology: true, abortOnCycle: true },
        }),
      ).rejects.toBeInstanceOf(BotCloneError);
    });

    it('enforces the recursion limit and rolls back', async () => {
      const root = makeBot({ id: 'root' });
      const c1 = makeChild('c1', 'root');
      const c2 = makeChild('c2', 'c1');

      const childrenByParent: Record<string, Bot[]> = {
        root: [c1],
        c1: [c2],
      };

      await expect(
        cloneBotGraph({
          rootBot: root,
          getChildren: (id) => childrenByParent[id] ?? [],
          options: { includeChildTopology: true },
          graphOptions: { recursionLimit: 0, includeChildTopology: true },
        }),
      ).rejects.toBeInstanceOf(BotCloneError);
    });
  });

  describe('previewClone', () => {
    it('returns a preview with identity provisions and child graph', async () => {
      const root = makeBot({ id: 'root' });
      const child = makeBot({ id: 'child', parentBotId: 'root' });

      const preview = await previewClone({
        source: root,
        options: { provisionNewIdentities: true, includeChildTopology: true },
        graphOptions: { recursionLimit: 2 },
        getChildren: (id) => (id === 'root' ? [child] : []),
      });

      expect(preview.sourceBotId).toBe('root');
      expect(preview.newBotId).not.toBe('root');
      expect(preview.identityProvisions.length).toBeGreaterThan(0);
      expect(preview.childGraph).toBeDefined();
      expect(preview.childGraph?.totalNodes).toBe(2);
    });
  });
});
