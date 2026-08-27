/**
 * Tests for the versioned canonical bot workspace serializer and store.
 */

import { describe, it, expect } from 'vitest';
import { BotSchema } from './orpc-contracts';
import {
  BOT_WORKSPACE_FILES,
  BotWorkspaceConflictError,
} from './bot-workspace-contracts';
import {
  serializeBotWorkspace,
  deserializeBotWorkspace,
  computeWorkspaceRevision,
} from './bot-workspace-serializer';
import { createBotWorkspaceStore } from './bot-workspace-store';

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
      version: '1.0.0',
      tagline: 'Finds things',
      welcomeMessage: 'Hello',
      starterPrompts: ['Prompt A', 'Prompt B'],
      accentColor: '#8b5cf6',
      botCategory: 'research',
      lifecycle: 'active',
      groupChatEnabled: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

describe('bot-workspace-serializer', () => {
  it('serializes a bot to canonical workspace files', () => {
    const bot = makeBot();
    const files = serializeBotWorkspace(bot);

    expect(files[BOT_WORKSPACE_FILES.agents]).toContain('Researcher');
    expect(files[BOT_WORKSPACE_FILES.soul]).toContain('SOUL');
    expect(files[BOT_WORKSPACE_FILES.soul]).toContain('Finds things');
    expect(files[BOT_WORKSPACE_FILES.user]).toContain('USER');
    expect(files[BOT_WORKSPACE_FILES.governance]).toContain('GOVERNANCE');
    expect(files[BOT_WORKSPACE_FILES.tools]).toContain('TOOLS');
    expect(files[BOT_WORKSPACE_FILES.skills]).toContain('"skills"');
    expect(files[BOT_WORKSPACE_FILES.heartbeat]).toContain('HEARTBEAT');
    expect(files[BOT_WORKSPACE_FILES.memory]).toContain('MEMORY');
  });

  it('round-trips through serialization and deserialization', () => {
    const bot = makeBot();
    const files = serializeBotWorkspace(bot);
    const restored = deserializeBotWorkspace(files);

    expect(restored.name).toBe(bot.name);
    expect(restored.description).toBe(bot.description);
    expect(restored.type).toBe(bot.type);
    expect(restored.model).toBe(bot.model);
    expect(restored.provider).toBe(bot.provider);
    expect(restored.botProfile.displayName).toBe(bot.botProfile.displayName);
    expect(restored.botProfile.handle).toBe(bot.botProfile.handle);
    expect(restored.botProfile.tagline).toBe(bot.botProfile.tagline);
    expect(restored.botProfile.welcomeMessage).toBe(bot.botProfile.welcomeMessage);
    expect(restored.botProfile.starterPrompts).toEqual(bot.botProfile.starterPrompts);
    expect(restored.botProfile.lifecycle).toBe(bot.botProfile.lifecycle);
  });

  it('computes stable revision hashes', async () => {
    const bot = makeBot();
    const files = serializeBotWorkspace(bot);
    const a = await computeWorkspaceRevision(files);
    const b = await computeWorkspaceRevision(files);

    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different revisions for different content', async () => {
    const botA = makeBot();
    const botB = makeBot({ name: 'Other Bot' });

    const revA = await computeWorkspaceRevision(serializeBotWorkspace(botA));
    const revB = await computeWorkspaceRevision(serializeBotWorkspace(botB));

    expect(revA).not.toBe(revB);
  });

  it('preserves unsupported content during direct file edit round-trips (W4-005)', () => {
    const bot = makeBot();
    const originalFiles = serializeBotWorkspace(bot);
    const customNote = '## Designer notes\n\nKeep this section.\n';
    const existingFiles = {
      ...originalFiles,
      [BOT_WORKSPACE_FILES.soul]: originalFiles[BOT_WORKSPACE_FILES.soul].replace(
        '# SOUL\n\n',
        '# SOUL\n\n' + customNote + '\n',
      ),
      '.allternit/bot/extra.md': '# Extra\n\nUnknown file.',
    };

    const editedBot = makeBot({
      name: 'Renamed Researcher',
      botProfile: {
        ...bot.botProfile,
        displayName: 'Renamed Researcher',
        tagline: 'Updated tagline',
      },
    });

    const updatedFiles = serializeBotWorkspace(editedBot, existingFiles);

    // Known field updated.
    expect(updatedFiles[BOT_WORKSPACE_FILES.soul]).toContain('Updated tagline');

    // Unsupported body content preserved.
    expect(updatedFiles[BOT_WORKSPACE_FILES.soul]).toContain('Designer notes');

    // Unknown file preserved.
    expect(updatedFiles['.allternit/bot/extra.md']).toContain('Unknown file');

    // Bot can still be deserialized from the updated files.
    const restored = deserializeBotWorkspace(updatedFiles);
    expect(restored.name).toBe('Renamed Researcher');
    expect(restored.botProfile.tagline).toBe('Updated tagline');
  });
});

describe('bot-workspace-store', () => {
  it('writes a workspace and returns a snapshot with a revision', async () => {
    const store = createBotWorkspaceStore();
    const bot = makeBot();
    const files = serializeBotWorkspace(bot);

    const snapshot = await store.writeWorkspace(bot.id, files);

    expect(snapshot.botId).toBe(bot.id);
    expect(snapshot.revision).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.schemaVersion).toBeGreaterThan(0);
    expect(snapshot.files.some((f) => f.path === BOT_WORKSPACE_FILES.manifest)).toBe(true);
  });

  it('loads a previously written workspace', async () => {
    const store = createBotWorkspaceStore();
    const bot = makeBot();
    const files = serializeBotWorkspace(bot);

    await store.writeWorkspace(bot.id, files);
    const loaded = await store.loadWorkspace(bot.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.revision).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects compare-and-swap conflicts', async () => {
    const store = createBotWorkspaceStore();
    const bot = makeBot();
    const files = serializeBotWorkspace(bot);

    const first = await store.writeWorkspace(bot.id, files);
    const staleFiles = serializeBotWorkspace(makeBot({ name: 'Stale' }));

    await expect(
      store.writeWorkspace(bot.id, staleFiles, undefined, 'wrong-revision'),
    ).rejects.toBeInstanceOf(BotWorkspaceConflictError);

    await expect(
      store.writeWorkspace(bot.id, staleFiles, undefined, first.revision),
    ).resolves.toBeDefined();
  });

  it('records audit history', async () => {
    const store = createBotWorkspaceStore();
    const bot = makeBot();

    const first = await store.writeWorkspace(bot.id, serializeBotWorkspace(bot), 'user_1');
    await store.writeWorkspace(
      bot.id,
      serializeBotWorkspace(makeBot({ name: 'Updated' })),
      'user_1',
      first.revision,
    );

    const history = store.getAuditHistory(bot.id);
    expect(history).toHaveLength(2);
    expect(history[0].action).toBe('write');
    expect(history[0].actorId).toBe('user_1');
    expect(history[1].action).toBe('write');
  });

  it('rolls back to a previous revision', async () => {
    const store = createBotWorkspaceStore();
    const bot = makeBot();

    const first = await store.writeWorkspace(bot.id, serializeBotWorkspace(bot));
    const second = await store.writeWorkspace(
      bot.id,
      serializeBotWorkspace(makeBot({ name: 'Updated' })),
      undefined,
      first.revision,
    );

    expect(second.revision).not.toBe(first.revision);

    const rolled = await store.rollbackWorkspace(bot.id, first.revision, 'user_2');
    expect(rolled.revision).toBe(first.revision);

    const loaded = await store.loadWorkspace(bot.id);
    expect(loaded!.revision).toBe(first.revision);

    const history = store.getAuditHistory(bot.id);
    expect(history[0].action).toBe('rollback');
    expect(history[0].actorId).toBe('user_2');
  });

  it('loads a bot from the workspace', async () => {
    const store = createBotWorkspaceStore();
    const bot = makeBot();
    await store.writeWorkspace(bot.id, serializeBotWorkspace(bot));

    const loaded = await store.loadBot(bot.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe(bot.name);
    expect(loaded!.botProfile.displayName).toBe(bot.botProfile.displayName);
  });
});
