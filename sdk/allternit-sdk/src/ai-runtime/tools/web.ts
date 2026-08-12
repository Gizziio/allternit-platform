import type { ToolDefinition } from './types.js';

export type WebSearchMode = 'cached' | 'indexed' | 'live';
export type WebSearchProvider = 'duckduckgo' | 'tavily' | 'perplexity' | 'bing';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebToolOptions {
  fetch?: typeof globalThis.fetch;
  provider?: WebSearchProvider;
  apiKeys?: Partial<Record<Exclude<WebSearchProvider, 'duckduckgo'>, string>>;
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
    const provider = this.resolveProvider();
    if (provider === 'tavily') return this.searchTavily(query, limit);
    if (provider === 'perplexity') return this.searchPerplexity(query, limit);
    if (provider === 'bing') return this.searchBing(query, limit);

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

  private resolveProvider(): WebSearchProvider {
    if (this.options.provider) return this.options.provider;
    if (this.apiKey('tavily')) return 'tavily';
    if (this.apiKey('perplexity')) return 'perplexity';
    if (this.apiKey('bing')) return 'bing';
    return 'duckduckgo';
  }

  private apiKey(provider: Exclude<WebSearchProvider, 'duckduckgo'>): string | undefined {
    const configured = this.options.apiKeys?.[provider];
    if (configured) return configured;
    const environmentNames = {
      tavily: 'TAVILY_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
      bing: 'BING_SEARCH_API_KEY',
    } as const;
    return process.env[environmentNames[provider]];
  }

  private requireApiKey(provider: Exclude<WebSearchProvider, 'duckduckgo'>): string {
    const key = this.apiKey(provider);
    if (!key) throw new Error(`${provider} web search requires an API key`);
    return key;
  }

  private async searchTavily(query: string, limit: number): Promise<WebSearchResult[]> {
    const response = await this.fetchImpl('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ api_key: this.requireApiKey('tavily'), query, max_results: limit }),
    });
    const data = await readSearchJson(response);
    return asArray(data.results).slice(0, limit).map(result => ({
      title: asString(result.title),
      url: asString(result.url),
      snippet: asString(result.content),
    }));
  }

  private async searchPerplexity(query: string, limit: number): Promise<WebSearchResult[]> {
    const response = await this.fetchImpl('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.requireApiKey('perplexity')}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }], max_tokens: 512 }),
    });
    const data = await readSearchJson(response);
    const searchResults = asArray(data.search_results);
    if (searchResults.length > 0) {
      return searchResults.slice(0, limit).map(result => ({
        title: asString(result.title),
        url: asString(result.url),
        snippet: asString(result.snippet ?? result.text),
      }));
    }
    const citations = Array.isArray(data.citations) ? data.citations : [];
    const answer = asString(asArray(data.choices)[0]?.message && (asArray(data.choices)[0].message as Record<string, unknown>).content);
    return citations.slice(0, limit).map((url, index) => ({ title: `Source ${index + 1}`, url: asString(url), snippet: answer }));
  }

  private async searchBing(query: string, limit: number): Promise<WebSearchResult[]> {
    const url = new URL('https://api.bing.microsoft.com/v7.0/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(limit));
    const response = await this.fetchImpl(url, {
      headers: { 'Ocp-Apim-Subscription-Key': this.requireApiKey('bing'), accept: 'application/json' },
    });
    const data = await readSearchJson(response);
    const webPages = isRecord(data.webPages) ? data.webPages : {};
    return asArray(webPages.value).slice(0, limit).map(result => ({
      title: asString(result.name),
      url: asString(result.url),
      snippet: asString(result.snippet),
    }));
  }
}

async function readSearchJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`web_search failed with HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new Error('web_search provider returned an invalid response');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
