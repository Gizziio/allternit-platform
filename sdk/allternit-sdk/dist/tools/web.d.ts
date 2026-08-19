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
export declare class NativeWebTools {
    private readonly options;
    private readonly fetchImpl;
    private readonly cache;
    constructor(options?: WebToolOptions);
    definitions(): ToolDefinition[];
    private searchDefinition;
    private fetchDefinition;
    private defaultLiveSearch;
    private resolveProvider;
    private apiKey;
    private requireApiKey;
    private searchTavily;
    private searchPerplexity;
    private searchBing;
}
