/**
 * Unified memory orchestrator for Cowork.
 * Ties together 4 backends: Prisma, MCP memory-service (:8761), mem0 (:8765), CoworkMemoryService.
 *
 * Server-side only — do not import in 'use client' files.
 */
import { prisma } from '@/lib/db';
import { createCoworkMemoryStore, CoworkMemoryService } from '@allternit/cowork-engine';
import { storeMemory, searchMemory, addAgentMemory, searchAgentMemory } from './memory-client';
import type { CoworkMemoryCreateInput, CoworkMemoryEntry } from '@allternit/cowork-engine';

export interface UnifiedMemoryResult {
  content: string;
  source: 'prisma' | 'mcp' | 'mem0';
  score?: number;
  tags?: string[];
  type?: string;
}

const store = createCoworkMemoryStore(prisma);

const service = new CoworkMemoryService({
  store,
  semanticSearchUrl: process.env.COWORK_MEMORY_MCP_URL ?? 'http://localhost:8761',
  semanticSearchApiKey: process.env.COWORK_MEMORY_MCP_API_KEY,
});

export const memoryOrchestrator = {
  /** Write to Prisma (primary). Also fan-out to MCP :8761 and mem0 :8765 (fire-and-forget). */
  async remember(input: CoworkMemoryCreateInput): Promise<CoworkMemoryEntry> {
    const entry = await service.remember(input);

    // Fan-out to sidecars — do not await, do not throw
    storeMemory({
      content: input.content,
      tags: input.tags ?? [],
      memory_type: input.type ?? 'context',
    }).catch(() => {});

    addAgentMemory({
      messages: [{ role: 'assistant', content: input.content }],
      metadata: { source: input.source ?? 'orchestrator', tags: input.tags ?? [] },
    }).catch(() => {});

    return entry;
  },

  /** Keyword + semantic search across Prisma/:8761, then optionally enrich from mem0. */
  async search(params: {
    query: string;
    userId: string;
    projectId?: string | null;
    limit?: number;
    tags?: string[];
  }): Promise<UnifiedMemoryResult[]> {
    const limit = params.limit ?? 10;

    const [prismaResults, mem0Raw] = await Promise.allSettled([
      service.search({ ...params, limit }),
      searchAgentMemory({ query: params.query, limit }),
    ]);

    const seen = new Set<string>();
    const results: UnifiedMemoryResult[] = [];

    if (prismaResults.status === 'fulfilled') {
      for (const r of prismaResults.value) {
        const key = r.entry.content.slice(0, 80);
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            content: r.entry.content,
            source: (r.entry.source === 'semantic' ? 'mcp' : 'prisma') as UnifiedMemoryResult['source'],
            score: r.score,
            tags: r.entry.tags,
            type: r.entry.type,
          });
        }
      }
    }

    if (mem0Raw.status === 'fulfilled') {
      const mem0Data = mem0Raw.value as { results?: Array<{ memory?: string; score?: number; metadata?: { tags?: string[] } }> };
      for (const r of (mem0Data.results ?? [])) {
        const content = r.memory ?? '';
        const key = content.slice(0, 80);
        if (content && !seen.has(key)) {
          seen.add(key);
          results.push({
            content,
            source: 'mem0',
            score: r.score,
            tags: r.metadata?.tags ?? [],
          });
        }
      }
    }

    // Re-sort by score descending, preserve insertion order for ties
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return results.slice(0, limit);
  },

  /** Return formatted context string for injection into agent prompts. */
  async buildContext(params: {
    userId: string;
    projectId?: string | null;
    sessionId?: string | null;
    maxEntries?: number;
  }): Promise<string> {
    return service.buildContext(params);
  },

  /** Search mem0 sidecar for a semantic query, falling back to empty on error. */
  async searchMem0(params: { query: string; limit?: number }): Promise<UnifiedMemoryResult[]> {
    try {
      const data = (await searchAgentMemory({ query: params.query, limit: params.limit ?? 10 })) as {
        results?: Array<{ memory?: string; score?: number; metadata?: { tags?: string[] } }>;
      };
      return (data.results ?? []).map((r) => ({
        content: r.memory ?? '',
        source: 'mem0' as const,
        score: r.score,
        tags: r.metadata?.tags ?? [],
      })).filter((r) => r.content);
    } catch {
      return [];
    }
  },

  /** MCP memory-service search (:8761). */
  async searchMcp(params: { query: string; limit?: number; tags?: string[] }): Promise<UnifiedMemoryResult[]> {
    try {
      const data = await searchMemory({ query: params.query, limit: params.limit ?? 10, tags: params.tags });
      return (data.results ?? []).map((r) => ({
        content: r.content,
        source: 'mcp' as const,
        score: r.score,
        tags: r.tags ?? [],
        type: r.memory_type,
      }));
    } catch {
      return [];
    }
  },
};
