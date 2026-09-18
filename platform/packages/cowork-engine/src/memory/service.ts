import type { CoworkMemoryStore } from './store.js';
import type { CoworkMemoryEntry, CoworkMemoryCreateInput, CoworkMemoryEntryType } from './types.js';

export interface CoworkMemorySearchResult {
  entry: CoworkMemoryEntry;
  score?: number;
}

export interface CoworkMemoryServiceOptions {
  store: CoworkMemoryStore;
  semanticSearchUrl?: string;
  semanticSearchApiKey?: string;
}

export class CoworkMemoryService {
  private store: CoworkMemoryStore;
  private semanticUrl: string | null;
  private semanticKey: string | null;

  constructor(opts: CoworkMemoryServiceOptions) {
    this.store = opts.store;
    this.semanticUrl = opts.semanticSearchUrl ?? process.env.COWORK_MEMORY_MCP_URL ?? null;
    this.semanticKey = opts.semanticSearchApiKey ?? process.env.COWORK_MEMORY_MCP_API_KEY ?? null;
  }

  async remember(input: CoworkMemoryCreateInput): Promise<CoworkMemoryEntry> {
    return this.store.add(input);
  }

  async recall(params: {
    userId: string;
    projectId?: string | null;
    sessionId?: string | null;
    type?: CoworkMemoryEntryType;
    tags?: string[];
    limit?: number;
  }): Promise<CoworkMemoryEntry[]> {
    return this.store.list(params);
  }

  async search(params: {
    query: string;
    userId: string;
    projectId?: string | null;
    limit?: number;
    tags?: string[];
  }): Promise<CoworkMemorySearchResult[]> {
    if (this.semanticUrl) {
      try {
        return await this.semanticSearch(params);
      } catch {
        // fall through to keyword search
      }
    }
    return this.keywordSearch(params);
  }

  private async semanticSearch(params: { query: string; userId: string; limit?: number; tags?: string[] }): Promise<CoworkMemorySearchResult[]> {
    const url = `${this.semanticUrl}/api/search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.semanticKey ?? ''}` },
      body: JSON.stringify({ query: params.query, limit: params.limit ?? 10, tags: params.tags }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Semantic search failed: ${res.status}`);
    const payload = (await res.json()) as { results?: Array<{ content?: string; score?: number; tags?: string[]; memory_type?: string }> };
    const results = payload.results ?? [];
    return results.map((r, i) => ({
      entry: {
        id: String(i),
        userId: params.userId,
        projectId: null,
        sessionId: null,
        content: r.content ?? '',
        type: (r.memory_type ?? 'context') as CoworkMemoryEntryType,
        tags: r.tags ?? [],
        source: 'semantic',
        createdAt: new Date(),
      },
      score: r.score,
    }));
  }

  private async keywordSearch(params: { query: string; userId: string; projectId?: string | null; limit?: number }): Promise<CoworkMemorySearchResult[]> {
    const all = await this.store.list({ userId: params.userId, projectId: params.projectId, limit: 200 });
    const q = params.query.toLowerCase();
    const scored = all
      .map((e) => ({ entry: e, score: e.content.toLowerCase().includes(q) ? 1 : 0 }))
      .filter((r) => r.score > 0)
      .slice(0, params.limit ?? 10);
    return scored;
  }

  async forget(id: string): Promise<void> {
    await this.store.delete(id);
  }

  async forgetSession(sessionId: string): Promise<void> {
    await this.store.deleteBySession(sessionId);
  }

  async forgetProject(projectId: string): Promise<void> {
    await this.store.deleteByProject(projectId);
  }

  async buildContext(params: { userId: string; projectId?: string | null; sessionId?: string | null; maxEntries?: number }): Promise<string> {
    const entries = await this.store.list({ ...params, limit: params.maxEntries ?? 20 });
    if (entries.length === 0) return '';
    const lines = entries.map((e) => `[${e.type}${e.tags.length ? ` | ${e.tags.join(', ')}` : ''}] ${e.content}`);
    return `Relevant memory:\n${lines.join('\n')}`;
  }
}
