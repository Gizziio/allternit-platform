/**
 * Bot Memory Context Injection Tests
 *
 * Verifies that promoted/pinned memories are formatted and injected into bot
 * session system prompts without leaking candidate or forgotten memories.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { Agent } from '@/lib/agents/agent.types';
import {
  buildBotMemoryContext,
  injectBotMemoryIntoSystemPrompt,
  getBotMemoryStore,
  proposeBotMemory,
  resetBotMemoryStore,
  formatMemoryContext,
  recallBotMemories,
} from './bot-memory-context';

describe('bot-memory-context', () => {
  beforeEach(() => {
    // Each test gets a fresh singleton store.
    resetBotMemoryStore();
  });

  it('returns an empty string when no memories exist', () => {
    const context = buildBotMemoryContext('bot_empty');
    expect(context).toBe('');
  });

  it('includes only promoted memories by default', () => {
    const store = getBotMemoryStore();
    store.proposeMemory({
      tenantId: 'default',
      botId: 'bot_test',
      scope: 'bot',
      content: 'Candidate fact',
      provenance: { sourceType: 'assistant' },
      confidence: 0.8,
      sensitivity: 'internal',
      status: 'candidate',
    });

    const promoted = store.proposeMemory({
      tenantId: 'default',
      botId: 'bot_test',
      scope: 'bot',
      content: 'Approved fact',
      provenance: { sourceType: 'assistant' },
      confidence: 0.9,
      sensitivity: 'internal',
      status: 'promoted',
    });

    const context = buildBotMemoryContext('bot_test');
    expect(context).toContain('Approved fact');
    expect(context).not.toContain('Candidate fact');
    expect(context).toContain('Bot Memory');
  });

  it('includes pinned memories and marks them', () => {
    const store = getBotMemoryStore();
    store.proposeMemory({
      tenantId: 'default',
      botId: 'bot_pinned',
      scope: 'bot',
      content: 'Pinned fact',
      provenance: { sourceType: 'manual' },
      confidence: 1,
      sensitivity: 'public',
      status: 'pinned',
    });

    const context = buildBotMemoryContext('bot_pinned');
    expect(context).toContain('Pinned fact');
    expect(context).toContain('📌');
  });

  it('excludes memories above the requested sensitivity', () => {
    const store = getBotMemoryStore();
    store.proposeMemory({
      tenantId: 'default',
      botId: 'bot_secret',
      scope: 'bot',
      content: 'Secret plan',
      provenance: { sourceType: 'assistant' },
      confidence: 0.9,
      sensitivity: 'secret',
      status: 'promoted',
    });

    const context = buildBotMemoryContext('bot_secret', { maxSensitivity: 'internal' });
    expect(context).toBe('');

    const confidential = buildBotMemoryContext('bot_secret', { maxSensitivity: 'secret' });
    expect(confidential).toContain('Secret plan');
  });

  it('injects memory into a base system prompt', () => {
    const store = getBotMemoryStore();
    store.proposeMemory({
      tenantId: 'default',
      botId: 'bot_inject',
      scope: 'bot',
      content: 'User likes concise answers',
      provenance: { sourceType: 'assistant' },
      confidence: 0.9,
      sensitivity: 'internal',
      status: 'promoted',
    });

    const agent: Agent = {
      id: 'bot_inject',
      name: 'Test Bot',
      description: '',
      type: 'specialist',
      model: 'default',
      provider: 'custom',
      capabilities: [],
      tools: [],
      maxIterations: 10,
      temperature: 0.7,
      config: {},
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const prompt = injectBotMemoryIntoSystemPrompt(agent, 'You are a helpful assistant.');
    expect(prompt).toContain('You are a helpful assistant.');
    expect(prompt).toContain('User likes concise answers');
  });

  it('returns base prompt unchanged when agent has no id', () => {
    const agent: Agent = {
      id: '',
      name: 'Anonymous',
      description: '',
      type: 'specialist',
      model: 'default',
      provider: 'custom',
      capabilities: [],
      tools: [],
      maxIterations: 10,
      temperature: 0.7,
      config: {},
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const prompt = injectBotMemoryIntoSystemPrompt(agent, 'Base prompt');
    expect(prompt).toBe('Base prompt');
  });

  it('proposes a memory candidate via helper', () => {
    proposeBotMemory('bot_propose', 'Learned preference');
    const context = buildBotMemoryContext('bot_propose');
    expect(context).toBe('');

    const store = getBotMemoryStore();
    const candidates = store.queryMemories({
      tenantId: 'default',
      botId: 'bot_propose',
      status: 'candidate',
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].content).toBe('Learned preference');
  });

  describe('formatMemoryContext', () => {
    it('returns empty string for no memories', () => {
      expect(formatMemoryContext([])).toBe('');
    });

    it('formats promoted memories with scope, confidence, and sensitivity', () => {
      const store = getBotMemoryStore();
      store.proposeMemory({
        tenantId: 'default',
        botId: 'bot_fmt',
        scope: 'bot',
        content: 'Ada prefers concise answers',
        provenance: { sourceType: 'assistant' },
        confidence: 0.92,
        sensitivity: 'internal',
        status: 'promoted',
      });

      const context = formatMemoryContext(
        store.queryMemories({ tenantId: 'default', botId: 'bot_fmt' }),
      );
      expect(context).toContain('Bot Memory');
      expect(context).toContain('Ada prefers concise answers');
      expect(context).toContain('confidence: 92%');
      expect(context).toContain('sensitivity: internal');
    });

    it('includes session and project short ids when present', () => {
      const store = getBotMemoryStore();
      store.proposeMemory({
        tenantId: 'default',
        botId: 'bot_tags',
        scope: 'session',
        sessionId: 'sess_abcdef123456',
        content: 'Discussed roadmap',
        provenance: { sourceType: 'assistant' },
        confidence: 0.8,
        sensitivity: 'internal',
        status: 'promoted',
      });
      store.proposeMemory({
        tenantId: 'default',
        botId: 'bot_tags',
        scope: 'project',
        projectId: 'proj_xyz789uvw',
        content: 'Q3 goals',
        provenance: { sourceType: 'assistant' },
        confidence: 0.8,
        sensitivity: 'internal',
        status: 'promoted',
      });

      const context = formatMemoryContext(
        store.queryMemories({ tenantId: 'default', botId: 'bot_tags' }),
      );
      expect(context).toContain('[session:123456]');
      expect(context).toContain('[project:789uvw]');
    });
  });

  describe('recallBotMemories', () => {
    it('queries the bot memory store with promoted/pinned status and returns context', () => {
      const store = getBotMemoryStore();
      store.proposeMemory({
        tenantId: 'tenant_1',
        botId: 'bot_1',
        scope: 'bot',
        content: 'Ada prefers concise answers',
        provenance: { sourceType: 'assistant' },
        confidence: 0.92,
        sensitivity: 'internal',
        status: 'promoted',
      });

      const result = recallBotMemories({
        tenantId: 'tenant_1',
        botId: 'bot_1',
        query: 'prefers',
        limit: 3,
      });

      expect(result.memories).toHaveLength(1);
      expect(result.contextBlock).toContain('Ada prefers concise answers');
    });

    it('falls back to default limit when omitted', () => {
      const store = getBotMemoryStore();
      for (let i = 0; i < 10; i++) {
        store.proposeMemory({
          tenantId: 'tenant_default',
          botId: 'bot_default',
          scope: 'bot',
          content: `Memory ${i}`,
          provenance: { sourceType: 'assistant' },
          confidence: 0.9,
          sensitivity: 'internal',
          status: 'promoted',
        });
      }

      const result = recallBotMemories({ tenantId: 'tenant_default', botId: 'bot_default' });
      expect(result.memories).toHaveLength(5);
    });
  });
});
