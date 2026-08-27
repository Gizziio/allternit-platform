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
});
