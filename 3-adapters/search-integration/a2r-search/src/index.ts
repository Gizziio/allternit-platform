import fetch from 'node-fetch';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchManager {
  async search(query: string, provider: 'duckduckgo' | 'tavily' = 'duckduckgo'): Promise<SearchResult[]> {
    if (provider === 'tavily') {
      return this.searchTavily(query);
    }
    return this.searchDuckDuckGo(query);
  }

  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    // Basic implementation for DDG HTML
    return [
      { title: 'DuckDuckGo Result', url: 'https://duckduckgo.com/?q=' + encodeURIComponent(query), snippet: 'Search result for ' + query }
    ];
  }

  private async searchTavily(query: string): Promise<SearchResult[]> {
    // Placeholder for Tavily API
    return [
      { title: 'Tavily Result', url: 'https://tavily.com', snippet: 'Tavily insight for ' + query }
    ];
  }

  async fetchAndClean(url: string): Promise<string> {
    const response = await fetch(url);
    const html = await response.text();
    const { document } = parseHTML(html);
    const reader = new Readability(document as any);
    const article = reader.parse();
    return article?.textContent || '';
  }
}
export * from './replayer.js';
