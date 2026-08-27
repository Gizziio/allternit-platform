import { describe, expect, it, vi } from 'vitest';
import {
  formatMemoryContext,
  recallBotMemories,
  type RecallBotMemoriesOptions,
} from './bot-memory-injection';
import type { BotMemoryRecord } from './bot-memory-contracts';

const mockQueryMemories = vi.hoisted(() => vi.fn());

vi.mock('./bot-memory-store', () => ({
  createBotMemoryStore: () => ({
    queryMemories: mockQueryMemories,
  }),
}));

function makeMemory(overrides: Partial<BotMemoryRecord> = {}): BotMemoryRecord {
  return {
    id: 'mem_1',
    botId: 'bot_1',
    tenantId: 'tenant_1',
    scope: 'bot',
    content: 'Ada prefers concise answers',
    provenance: {
      sourceType: 'assistant',
    },
    confidence: 0.92,
    sensitivity: 'internal',
    status: 'promoted',
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('formatMemoryContext', () => {
  it('returns empty string for no memories', () => {
    expect(formatMemoryContext([])).toBe('');
  });

  it('formats promoted memories with scope, confidence, and sensitivity', () => {
    const result = formatMemoryContext([
      makeMemory({ content: 'Ada prefers concise answers', confidence: 0.92 }),
    ]);
    expect(result).toContain('Bot Memory');
    expect(result).toContain('Ada prefers concise answers');
    expect(result).toContain('confidence: 92%');
    expect(result).toContain('sensitivity: internal');
  });

  it('includes session and project short ids when present', () => {
    const result = formatMemoryContext([
      makeMemory({
        scope: 'session',
        sessionId: 'sess_abcdef123456',
        content: 'Discussed roadmap',
      }),
      makeMemory({
        scope: 'project',
        projectId: 'proj_xyz789uvw',
        content: 'Q3 goals',
      }),
    ]);
    expect(result).toContain('[session:123456]');
    expect(result).toContain('[project:789uvw]');
  });
});

describe('recallBotMemories', () => {
  it('queries the bot memory store with promoted/pinned status and returns context', () => {
    const memory = makeMemory();
    mockQueryMemories.mockReturnValue([memory]);

    const options: RecallBotMemoriesOptions = {
      tenantId: 'tenant_1',
      botId: 'bot_1',
      query: 'preferences',
      limit: 3,
    };

    const result = recallBotMemories(options);

    expect(mockQueryMemories).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      contains: 'preferences',
      status: ['promoted', 'pinned'],
      limit: 3,
      includeExpired: false,
    });
    expect(result.memories).toHaveLength(1);
    expect(result.contextBlock).toContain('Ada prefers concise answers');
  });

  it('falls back to default limit when omitted', () => {
    mockQueryMemories.mockReturnValue([]);

    recallBotMemories({ tenantId: 'tenant_1', botId: 'bot_1' });

    expect(mockQueryMemories).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });
});
