import type { ToolDefinition } from './types.js';

export type WebSearchMode = 'cached' | 'indexed' | 'live';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebToolOptions {
  fetch?: typeof globalThis.fetch;
  searchIndex?: (query: string, limit: number) => Promise<WebSearchResult[]>;
  liveSearch?: (query: string, limit: number) => Promise<WebSearchResult[]>;
  cache?: Map<string, WebSearchResult[]>;
  maxFetchCharacters?: number;
}

export class NativeWebTools {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly cache: Map<string, WebSearchResult[]>;

  constructor(private readonly options: WebToolOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.cache = options.cache ?? new Map();
  }

  definitions(): ToolDefinition[] {
    return [this.searchDefinition(), this.fetchDefinition()];
  }

  private searchDefinition(): ToolDefinition {
    return {
      name: 'web_search',
      description: 'Search the web using cached, indexed, or live results.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          mode: { type: 'string', enum: ['cached', 'indexed', 'live'], description: 'Search source' },
          limit: { type: 'integer', description: 'Maximum results (1-10)' },
        },
        required: ['query'],
      },
      metadata: { category: 'web' },
      execute: async (args: { query: string; mode?: WebSearchMode; limit?: number }) => {
        const query = args.query?.trim();
        if (!query) throw new Error('web_search query must be non-empty');
        const mode = args.mode ?? 'live';
        const limit = Math.max(1, Math.min(args.limit ?? 5, 10));
        const key = query.toLocaleLowerCase();
        if (mode === 'cached') return (this.cache.get(key) ?? []).slice(0, limit);

        let results: WebSearchResult[];
        if (mode === 'indexed') {
          if (!this.options.searchIndex) throw new Error('Indexed web search is not configured');
          results = await this.options.searchIndex(query, limit);
        } else {
          results = this.options.liveSearch
            ? await this.options.liveSearch(query, limit)
            : await this.defaultLiveSearch(query, limit);
        }
        this.cache.set(key, results);
        return results.slice(0, limit);
      },
    };
  }

  private fetchDefinition(): ToolDefinition {
    return {
      name: 'web_fetch',
      description: 'Fetch an HTTP(S) URL and extract readable text content.',
      input_schema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'HTTP(S) URL to fetch' } },
        required: ['url'],
      },
      metadata: { category: 'web' },
      execute: async (args: { url: string }) => {
        const url = parseWebUrl(args.url);
        const response = await this.fetchImpl(url, { headers: { accept: 'text/html, text/plain, application/json' } });
        if (!response.ok) throw new Error(`web_fetch failed with HTTP ${response.status}`);
        const raw = await response.text();
        const contentType = response.headers.get('content-type') ?? '';
        const text = contentType.includes('html') ? extractHtmlText(raw) : raw.trim();
        return {
          url: response.url || url.toString(),
          contentType,
          title: contentType.includes('html') ? extractTitle(raw) : undefined,
          text: text.slice(0, this.options.maxFetchCharacters ?? 50_000),
          truncated: text.length > (this.options.maxFetchCharacters ?? 50_000),
        };
      },
    };
  }

  private async defaultLiveSearch(query: string, limit: number): Promise<WebSearchResult[]> {
    const url = new URL('https://html.duckduckgo.com/html/');
    url.searchParams.set('q', query);
    const response = await this.fetchImpl(url, { headers: { accept: 'text/html' } });
    if (!response.ok) throw new Error(`web_search failed with HTTP ${response.status}`);
    const html = await response.text();
    const results: WebSearchResult[] = [];
    const pattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(pattern)) {
      results.push({ url: decodeHtml(match[1]), title: extractHtmlText(match[2]), snippet: extractHtmlText(match[3]) });
      if (results.length >= limit) break;
    }
    return results;
  }
}

function parseWebUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('web_fetch requires a valid URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('web_fetch only supports HTTP(S) URLs');
  return url;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? extractHtmlText(match[1]) : undefined;
}

function extractHtmlText(html: string): string {
  return decodeHtml(html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}
