/**
 * Tests for the IngestAgent bulk/fast ingest mode.
 *
 * Covers R1–R5 from the memory-bulk-fast-ingest build spec.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import * as fs from 'fs/promises';
import { IngestAgent } from './ingest-agent.js';
import { MemoryStore } from './store/sqlite-store.js';
import { LocalModelManager } from './models/local-model.js';
import type { MemoryImportance } from './types/memory.types.js';

const testDbPath = '/tmp/test-ingest-agent.db';

class MockModelManager extends LocalModelManager {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor() {
    // Point to a non-existent Ollama host so the base class never accidentally
    // talks to a real server if a mock is bypassed.
    super('127.0.0.1', 1);
  }

  override async summarize(text: string, maxLength: number = 200): Promise<string> {
    this.calls.push({ method: 'summarize', args: [text, maxLength] });
    return `summary of ${text.slice(0, 20)}`;
  }

  override async extractEntities(text: string): Promise<{ entities: string[]; topics: string[] }> {
    this.calls.push({ method: 'extractEntities', args: [text] });
    return { entities: ['entity-a'], topics: ['topic-a'] };
  }

  override async assessImportance(text: string): Promise<MemoryImportance> {
    this.calls.push({ method: 'assessImportance', args: [text] });
    return 'high';
  }

  override async enrichContent(text: string, maxLength: number = 150): Promise<{
    summary: string;
    entities: string[];
    topics: string[];
    importance: MemoryImportance;
  }> {
    this.calls.push({ method: 'enrichContent', args: [text, maxLength] });
    return {
      summary: `summary of ${text.slice(0, 20)}`,
      entities: ['entity-a'],
      topics: ['topic-a'],
      importance: 'high',
    };
  }
}

describe('IngestAgent bulk ingest mode', () => {
  let store: MemoryStore;
  let modelManager: MockModelManager;
  let agent: IngestAgent;

  beforeEach(async () => {
    try {
      await fs.unlink(testDbPath);
    } catch {
      // ignore
    }

    store = new MemoryStore(testDbPath);
    modelManager = new MockModelManager();
    agent = new IngestAgent(modelManager, store, { watchDirectory: '/tmp/nonexistent-watch' });
  });

  afterEach(() => {
    store.close();
  });

  afterAll(async () => {
    try {
      await fs.unlink(testDbPath);
    } catch {
      // ignore
    }
  });

  it('R1 + R2 — bulk ingest stores a memory without LLM enrichment', async () => {
    const content = 'Memory agents store embeddings';
    const result = await agent.ingestContent({
      content,
      source: 'taste-corpus',
      metadata: { mode: 'bulk' },
    });

    expect(result.success).toBe(true);
    expect(result.memoryId).toBeDefined();

    const memory = store.getMemory(result.memoryId!);
    expect(memory).toBeDefined();
    expect(memory!.summary).toBe(content);
    expect(memory!.entities).toEqual([]);
    expect(memory!.topics).toEqual([]);
    expect(memory!.importance).toBe('medium');

    // No LLM calls were made
    expect(modelManager.calls).toHaveLength(0);
  });

  it('R1 — bulk mode summary is truncated to the first 500 characters', async () => {
    const content = 'x'.repeat(750);
    const result = await agent.ingestContent({
      content,
      source: 'taste-corpus',
      metadata: { mode: 'bulk' },
    });

    const memory = store.getMemory(result.memoryId!);
    expect(memory!.summary).toHaveLength(500);
    expect(memory!.summary).toBe(content.slice(0, 500));
  });

  it('R3 — bulk memories appear in text search without mode filtering', async () => {
    await agent.ingestContent({
      content: 'Memory agents store embeddings',
      source: 'taste-corpus',
      metadata: { mode: 'bulk' },
    });

    const results = store.searchMemories('memory agents');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.mode).toBe('bulk');
  });

  it('R4 — normal ingest still enriches via LLM', async () => {
    const content = 'Memory agents store embeddings';
    const result = await agent.ingestContent({
      content,
      source: 'direct-input',
    });

    expect(result.success).toBe(true);

    const memory = store.getMemory(result.memoryId!);
    expect(memory).toBeDefined();
    expect(memory!.summary).not.toBe(content);
    expect(memory!.entities).toEqual(['entity-a']);
    expect(memory!.topics).toEqual(['topic-a']);
    expect(memory!.importance).toBe('high');

    // Single combined enrichment call was made instead of three separate calls
    expect(modelManager.calls.map((c) => c.method)).toEqual(['enrichContent']);
  });

  it('R5 — bulk mode preserves source, trust_tier, and provenance_ref metadata', async () => {
    const content = 'Memory agents store embeddings';
    const result = await agent.ingestContent({
      content,
      source: 'direct-input',
      metadata: {
        mode: 'bulk',
        source: 'taste-corpus-v2',
        trust_tier: 'unverified',
        provenance_ref: 'manual://live-pipeline-cycle-2026-08-02',
      },
    });

    const memory = store.getMemory(result.memoryId!);
    expect(memory).toBeDefined();
    expect(memory!.metadata).toMatchObject({
      mode: 'bulk',
      source: 'taste-corpus-v2',
      trust_tier: 'unverified',
      provenance_ref: 'manual://live-pipeline-cycle-2026-08-02',
    });
  });

  it('ignores case-sensitive or non-bulk mode values', async () => {
    const content = 'Memory agents store embeddings';

    // "BULK" is not the literal string "bulk"
    const resultUpper = await agent.ingestContent({
      content,
      metadata: { mode: 'BULK' },
    });
    expect(resultUpper.success).toBe(true);
    expect(modelManager.calls.length).toBeGreaterThan(0);

    // Reset
    modelManager.calls = [];

    // No metadata at all
    const resultNormal = await agent.ingestContent({ content });
    expect(resultNormal.success).toBe(true);
    expect(modelManager.calls.length).toBeGreaterThan(0);
  });
});
