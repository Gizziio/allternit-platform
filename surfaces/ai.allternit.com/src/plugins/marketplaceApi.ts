/**
 * Marketplace API
 *
 * Fetches plugins from Allternit API, curated marketplace manifests, and GitHub fallback.
 */

import type { MarketplacePlugin } from './capability.types';
import { authorToDisplayName } from './pluginStandards';

// ============================================================================
// Types
// ============================================================================

export interface MarketplaceSearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  perPage: number;
  source: 'api' | 'curated' | 'github' | 'none';
}

export type ExternalMarketplaceDirectoryProvider = 'claudemarketplaces' | 'claudepluginhub';

export type PersonalMarketplaceType = 'github' | 'url' | 'upload' | 'local';

export interface ExternalMarketplaceDirectorySourceSuggestion {
  type: 'github' | 'url';
  value: string;
  label: string;
}

export interface ExternalMarketplaceDirectoryEntry {
  id: string;
  provider: ExternalMarketplaceDirectoryProvider;
  title: string;
  description: string;
  categories: string[];
  pluginCount: number;
  stars: number;
  sourceUrl: string;
  trust: 'official' | 'verified' | 'community' | 'unknown';
  sourceSuggestion?: ExternalMarketplaceDirectorySourceSuggestion;
}

export type ConnectorMarketplaceType =
  | 'productivity'
  | 'development'
  | 'data'
  | 'business'
  | 'design'
  | 'other';

export interface ConnectorMarketplaceCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  connectorType: ConnectorMarketplaceType;
  featured?: boolean;
  icon: string;
}

export interface ConnectorMarketplaceSearchResult {
  connectors: ConnectorMarketplaceCatalogItem[];
  source: 'api' | 'none';
}

export interface GitHubRepoInfo {
  id: number;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  updated_at: string;
  html_url: string;
}

export interface CuratedMarketplaceSource {
  id: string;
  label: string;
  owner: string;
  trust: 'official' | 'verified' | 'community';
  manifestUrl: string;
  repo?: string;
  description: string;
}

// ============================================================================
// Configuration
// ============================================================================

const ALLTERNIT_MARKETPLACE_API = 'https://api.allternit.dev/v1/marketplace';
const GITHUB_API = 'https://api.github.com';

// Search queries for finding Allternit plugins on GitHub
const GITHUB_SEARCH_QUERIES = [
  'topic:allternit-plugin',
  'topic:allternit-skill',
  'allternit-plugin in:name',
  'allternit-skill in:name',
];

const MARKETPLACE_API_TIMEOUT_MS = 3500;
const GITHUB_API_TIMEOUT_MS = 2500;
const CURATED_MARKETPLACE_TIMEOUT_MS = 4500;
const CURATED_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const EXTERNAL_DIRECTORY_TIMEOUT_MS = 3500;
const EXTERNAL_DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;
const CONNECTOR_MARKETPLACE_TIMEOUT_MS = 3500;
const CONNECTOR_MARKETPLACE_ENDPOINTS = [
  '/api/v1/marketplace/connectors',
  '/api/v1/connectors/marketplace',
  '/api/v1/marketplace/skills',
];
const CLAUDE_MARKETPLACES_MARKETPLACES_API = 'https://claudemarketplaces.com/api/marketplaces';
const CLAUDE_MARKETPLACES_SKILLS_API = 'https://claudemarketplaces.com/api/skills';
const CLAUDE_PLUGIN_HUB_MARKETPLACES_API = 'https://www.claudepluginhub.com/api/marketplaces';

const API_SOURCE_CONTEXT: CuratedMarketplaceSource = {
  id: 'allternit-api',
  label: 'Allternit Marketplace',
  owner: 'Allternit',
  trust: 'verified',
  manifestUrl: '',
  description: 'Allternit marketplace API source context.',
};

export const CURATED_MARKETPLACE_SOURCES: CuratedMarketplaceSource[] = [
  {
    id: 'anthropic-official',
    label: 'Anthropic Official',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/claude-plugins-official',
    description: 'Official Anthropic plugin marketplace.',
  },
  {
    id: 'anthropic-claude-code',
    label: 'Anthropic Claude Code',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/claude-code/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/claude-code',
    description: 'Bundled Claude Code plugins from Anthropic.',
  },
  {
    id: 'anthropic-skills',
    label: 'Anthropic Skills',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/skills',
    description: 'Anthropic skills converted into plugin marketplace format.',
  },
  {
    id: 'anthropic-life-sciences',
    label: 'Anthropic Life Sciences',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/life-sciences/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/life-sciences',
    description: 'Life sciences plugin collection maintained by Anthropic.',
  },
  {
    id: 'docker-marketplace',
    label: 'Docker Plugins',
    owner: 'Docker',
    trust: 'verified',
    manifestUrl: 'https://raw.githubusercontent.com/docker/claude-plugins/main/.claude-plugin/marketplace.json',
    repo: 'docker/claude-plugins',
    description: 'Docker-maintained plugin marketplace.',
  },
  {
    id: 'pleaseai-marketplace',
    label: 'PleaseAI',
    owner: 'Passion Factory',
    trust: 'community',
    manifestUrl: 'https://raw.githubusercontent.com/pleaseai/claude-code-plugins/main/.claude-plugin/marketplace.json',
    repo: 'pleaseai/claude-code-plugins',
    description: 'Large community marketplace with connectors and MCP plugins.',
  },
  {
    id: 'jeremylongshore-marketplace',
    label: 'Jeremy Longshore',
    owner: 'Community',
    trust: 'community',
    manifestUrl: 'https://raw.githubusercontent.com/jeremylongshore/claude-code-plugins/main/.claude-plugin/marketplace.json',
    repo: 'jeremylongshore/claude-code-plugins',
    description: 'Community-maintained plugin marketplace.',
  },
];

let curatedCatalogCache:
  | {
      fetchedAt: number;
      plugins: MarketplacePlugin[];
    }
  | null = null;

let externalDirectoryCache:
  | {
      fetchedAt: number;
      entries: ExternalMarketplaceDirectoryEntry[];
    }
  | null = null;

// ============================================================================
// External Marketplace Directory Functions
// ============================================================================

/**
 * Fetch external marketplace directory entries from third-party directories
 * (claudemarketplaces.com and claudepluginhub.com).
 */
export async function fetchExternalMarketplaceDirectories(): Promise<ExternalMarketplaceDirectoryEntry[]> {
  const now = Date.now();
  if (externalDirectoryCache && now - externalDirectoryCache.fetchedAt < EXTERNAL_DIRECTORY_CACHE_TTL_MS) {
    return externalDirectoryCache.entries;
  }

  const [claudeMarketplacesEntries, claudePluginHubEntries] = await Promise.all([
    fetchClaudeMarketplacesDirectory(),
    fetchClaudePluginHubDirectory(),
  ]);

  const entries = [...claudeMarketplacesEntries, ...claudePluginHubEntries];
  externalDirectoryCache = { fetchedAt: now, entries };
  return entries;
}

async function fetchClaudeMarketplacesDirectory(): Promise<ExternalMarketplaceDirectoryEntry[]> {
  try {
    const response = await fetchWithTimeout(
      CLAUDE_MARKETPLACES_MARKETPLACES_API,
      { headers: { Accept: 'application/json' } },
      EXTERNAL_DIRECTORY_TIMEOUT_MS
    );

    if (!response.ok) return [];
    const payload = await response.json();
    const records = Array.isArray(payload) ? payload : [];

    return records
      .map((record: unknown, index: number): ExternalMarketplaceDirectoryEntry | null => {
        if (!record || typeof record !== 'object') return null;
        const r = record as Record<string, unknown>;
        const repo = firstNonEmptyString([r.repo, r.slug]);
        if (!repo) return null;

        const categories = collectStringList(r.categories).concat(collectStringList(r.tags));
        const stars = toNumber(r.stars);
        const description = firstNonEmptyString([r.description, r.summary]) || `${repo} marketplace`;

        return {
          id: `clm-${repo}-${index}`,
          provider: 'claudemarketplaces',
          title: firstNonEmptyString([r.title, r.name, repo]) || repo,
          description,
          categories: categories.length > 0 ? categories : ['community'],
          pluginCount: toNumber(r.pluginCount) || toNumber(r.plugins) || 0,
          stars,
          sourceUrl: `https://github.com/${repo}`,
          trust: normalizeTrustLevel(r.trust, stars),
          sourceSuggestion: {
            type: 'github',
            value: repo,
            label: `GitHub: ${repo}`,
          },
        };
      })
      .filter((entry): entry is ExternalMarketplaceDirectoryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

async function fetchClaudePluginHubDirectory(): Promise<ExternalMarketplaceDirectoryEntry[]> {
  try {
    const response = await fetchWithTimeout(
      CLAUDE_PLUGIN_HUB_MARKETPLACES_API,
      { headers: { Accept: 'application/json' } },
      EXTERNAL_DIRECTORY_TIMEOUT_MS
    );

    if (!response.ok) return [];
    const payload = await response.json();
    const records = payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).items)
      ? (payload as Record<string, unknown>).items as unknown[]
      : Array.isArray(payload) ? payload : [];

    return records
      .map((record: unknown, index: number): ExternalMarketplaceDirectoryEntry | null => {
        if (!record || typeof record !== 'object') return null;
        const r = record as Record<string, unknown>;
        const slug = firstNonEmptyString([r.slug, r.id]);
        if (!slug) return null;

        const title = firstNonEmptyString([r.title, r.name, slug]) || slug;
        const description = firstNonEmptyString([r.description, r.summary]) || `${title} marketplace`;
        const totalPlugins = toNumber(r.totalPlugins) || toNumber(r.totalCommand) || toNumber(r.totalAgents) || toNumber(r.totalSkills) || 0;
        const stars = toNumber(r.stars);

        // Try to extract GitHub repo from various fields
        const repo = firstNonEmptyString([r.repo, r.repository, r.github]);

        return {
          id: `cph-${slug}-${index}`,
          provider: 'claudepluginhub',
          title,
          description,
          categories: collectStringList(r.categories).concat(collectStringList(r.tags)),
          pluginCount: totalPlugins,
          stars,
          sourceUrl: repo ? `https://github.com/${repo}` : `https://www.claudepluginhub.com/marketplaces/${slug}`,
          trust: normalizeTrustLevel(r.trust, stars),
          sourceSuggestion: repo
            ? { type: 'github', value: repo, label: `GitHub: ${repo}` }
            : undefined,
        };
      })
      .filter((entry): entry is ExternalMarketplaceDirectoryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function normalizeTrustLevel(
  raw: unknown,
  stars: number
): ExternalMarketplaceDirectoryEntry['trust'] {
  if (raw === 'official') return 'official';
  if (raw === 'verified') return 'verified';
  if (raw === 'community') return 'community';
  if (raw === 'unknown') return 'unknown';
  // Infer from stars if not explicitly set
  if (stars > 1000) return 'verified';
  if (stars > 100) return 'community';
  return 'unknown';
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search the marketplace for plugins.
 */
export async function searchMarketplace(
  query: string = '',
  options: {
    category?: string;
    page?: number;
    perPage?: number;
    sortBy?: 'relevance' | 'downloads' | 'rating' | 'recent';
    allowedCuratedSourceIds?: string[];
  } = {}
): Promise<MarketplaceSearchResult> {
  const {
    category,
    page = 1,
    perPage = 20,
    sortBy = 'relevance',
    allowedCuratedSourceIds,
  } = options;

  const merged = new Map<string, MarketplacePlugin>();
  let hasApiData = false;
  let hasCuratedData = false;

  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    params.set('sort', sortBy);

    const response = await fetchWithTimeout(`${ALLTERNIT_MARKETPLACE_API}/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    }, MARKETPLACE_API_TIMEOUT_MS);

    if (response.ok) {
      const data = await response.json();
      const apiPlugins = Array.isArray(data?.plugins)
        ? data.plugins
            .map((entry: unknown) => normalizeMarketplacePluginFromApi(entry))
            .filter((plugin: MarketplacePlugin | null): plugin is MarketplacePlugin => Boolean(plugin))
        : [];

      if (apiPlugins.length > 0) {
        hasApiData = true;
        for (const plugin of apiPlugins) {
          mergeMarketplacePlugin(merged, plugin);
        }
      }
    }
  } catch {
    // API unavailable: continue with curated/community feeds.
  }

  try {
    const curatedPlugins = await searchCuratedMarketplacePlugins(query, {
      category,
      sortBy,
      allowedCuratedSourceIds,
    });
    if (curatedPlugins.length > 0) {
      hasCuratedData = true;
      for (const plugin of curatedPlugins) {
        mergeMarketplacePlugin(merged, plugin);
      }
    }
  } catch {
    // Curated sources unavailable: continue with fallback.
  }

  if (merged.size > 0) {
    const allPlugins = sortMarketplacePlugins(Array.from(merged.values()), sortBy);
    const start = Math.max(0, (page - 1) * perPage);
    const paginated = allPlugins.slice(start, start + perPage);
    return {
      plugins: paginated,
      total: allPlugins.length,
      page,
      perPage,
      source: hasApiData ? 'api' : hasCuratedData ? 'curated' : 'none',
    };
  }

  // Final fallback to generic GitHub search.
  try {
    const githubResults = await searchGitHubForPlugins(query);
    if (githubResults.length > 0) {
      return {
        plugins: githubResults,
        total: githubResults.length,
        page,
        perPage,
        source: 'github',
      };
    }
  } catch {
    // Ignore fallback failures.
  }

  return {
    plugins: [],
    total: 0,
    page,
    perPage,
    source: 'none',
  };
}

async function searchCuratedMarketplacePlugins(
  query: string,
  options: {
    category?: string;
    sortBy?: 'relevance' | 'downloads' | 'rating' | 'recent';
    allowedCuratedSourceIds?: string[];
  }
): Promise<MarketplacePlugin[]> {
  const catalog = await fetchCuratedCatalog();
  const q = query.trim().toLowerCase();
  const category = options.category?.trim().toLowerCase();
  const allowedSourceIds = options.allowedCuratedSourceIds && options.allowedCuratedSourceIds.length > 0
    ? new Set(options.allowedCuratedSourceIds)
    : null;

  const filtered = catalog.filter((plugin) => {
    if (
      allowedSourceIds &&
      plugin.sourceKind === 'curated' &&
      (!plugin.sourceId || !allowedSourceIds.has(plugin.sourceId))
    ) {
      return false;
    }

    if (category && category !== 'all' && plugin.category.toLowerCase() !== category) {
      return false;
    }
    if (!q) return true;

    const haystack = [
      plugin.name,
      plugin.description,
      plugin.author,
      plugin.category,
      plugin.sourceLabel || '',
      ...(plugin.tags || []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  return sortMarketplacePlugins(filtered, options.sortBy || 'relevance');
}

async function fetchCuratedCatalog(): Promise<MarketplacePlugin[]> {
  const now = Date.now();
  if (curatedCatalogCache && now - curatedCatalogCache.fetchedAt < CURATED_CATALOG_CACHE_TTL_MS) {
    return curatedCatalogCache.plugins;
  }

  const tasks = CURATED_MARKETPLACE_SOURCES.map(async (source) => {
    try {
      const response = await fetchWithTimeout(
        source.manifestUrl,
        {
          headers: {
            Accept: 'application/json',
          },
        },
        CURATED_MARKETPLACE_TIMEOUT_MS,
      );

      if (!response.ok) return [] as MarketplacePlugin[];
      const payload = await response.json();
      return parseMarketplaceManifest(payload, source);
    } catch {
      return [] as MarketplacePlugin[];
    }
  });

  const pluginLists = await Promise.all(tasks);
  const deduped = new Map<string, MarketplacePlugin>();

  for (const list of pluginLists) {
    for (const plugin of list) {
      mergeMarketplacePlugin(deduped, plugin);
    }
  }

  const plugins = Array.from(deduped.values());
  curatedCatalogCache = {
    fetchedAt: now,
    plugins,
  };
  return plugins;
}

function parseMarketplaceManifest(payload: unknown, source: CuratedMarketplaceSource): MarketplacePlugin[] {
  const records = collectMarketplacePluginRecords(payload);
  const plugins: MarketplacePlugin[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const plugin = normalizeMarketplacePluginFromManifest(records[index], source, index);
    if (!plugin) continue;
    plugins.push(plugin);
  }

  return plugins;
}

/**
 * Search GitHub for Allternit plugins.
 */
export async function searchGitHubForPlugins(query: string = ''): Promise<MarketplacePlugin[]> {
  const plugins: MarketplacePlugin[] = [];
  const seen = new Set<string>();

  const queryTasks = GITHUB_SEARCH_QUERIES.map(async (searchQuery) => {
    try {
      const fullQuery = query ? `${searchQuery} ${query} in:name,description` : searchQuery;
      const params = new URLSearchParams({
        q: fullQuery,
        sort: 'updated',
        order: 'desc',
        per_page: '10',
      });

      const response = await fetchWithTimeout(`${GITHUB_API}/search/repositories?${params.toString()}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }, GITHUB_API_TIMEOUT_MS);

      if (!response.ok) {
        if (response.status === 403) {
          console.warn('[marketplaceApi] GitHub rate limit exceeded');
        }
        return [];
      }

      const data = await response.json();
      return Array.isArray(data.items) ? (data.items as GitHubRepoInfo[]) : [];
    } catch (e) {
      console.warn('[marketplaceApi] GitHub search failed:', e);
      return [];
    }
  });

  const githubResults = await Promise.all(queryTasks);
  for (const repos of githubResults) {
    for (const repo of repos) {
      if (seen.has(repo.full_name)) continue;
      seen.add(repo.full_name);

      plugins.push({
        id: `github-${repo.full_name.replace('/', '-')}`,
        name: repo.full_name.split('/')[1]
          .replace(/-/g, ' ')
          .replace(/allternit\s*/i, '')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: repo.description || `Allternit plugin from ${repo.full_name}`,
        version: 'unknown',
        author: repo.full_name.split('/')[0],
        icon: 'puzzle',
        category: 'community',
        installCount: repo.stargazers_count,
        rating: 0,
        installed: false,
        sourceLabel: 'GitHub Search',
        sourceId: 'github-search',
        sourceKind: 'github',
        sourceTrust: 'community',
        sourceUrl: repo.html_url,
        sourceDescriptor: {
          source: 'github',
          repo: repo.full_name,
          ref: 'main',
        },
        sourceRepo: repo.full_name,
        sourceRef: 'main',
      });
    }
  }

  return plugins;
}

/**
 * Fetch plugin details from GitHub.
 */
export async function fetchPluginFromGitHub(
  owner: string,
  repo: string
): Promise<MarketplacePlugin | null> {
  try {
    const response = await fetchWithTimeout(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    }, GITHUB_API_TIMEOUT_MS);

    if (!response.ok) return null;

    const data = await response.json() as GitHubRepoInfo;

    let version = 'unknown';
    try {
      const releaseResponse = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (releaseResponse.ok) {
        const release = await releaseResponse.json();
        if (typeof release.tag_name === 'string' && release.tag_name.trim()) {
          version = release.tag_name.replace(/^v/, '');
        }
      }
    } catch {
      // release not available
    }

    return {
      id: `github-${owner}-${repo}`,
      name: repo.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: data.description || '',
      version,
      author: owner,
      icon: 'puzzle',
      category: 'community',
      installCount: data.stargazers_count,
      rating: 0,
      installed: false,
      sourceLabel: 'GitHub',
      sourceId: 'github',
      sourceKind: 'github',
      sourceTrust: 'community',
      sourceUrl: data.html_url,
      sourceDescriptor: {
        source: 'github',
        repo: `${owner}/${repo}`,
        ref: 'main',
      },
      sourceRepo: `${owner}/${repo}`,
      sourceRef: 'main',
    };
  } catch {
    return null;
  }
}

/**
 * Get the download URL for a GitHub repository.
 */
export function getGitHubDownloadUrl(owner: string, repo: string, ref: string = 'main'): string {
  return `${GITHUB_API}/repos/${owner}/${repo}/zipball/${ref}`;
}

/**
 * Fetch connector catalog from runtime marketplace endpoints.
 *
 * This intentionally avoids hardcoded connector catalogs in UI code.
 */
export async function fetchConnectorMarketplaceCatalog(): Promise<ConnectorMarketplaceSearchResult> {
  let lastError: Error | null = null;

  for (const endpoint of CONNECTOR_MARKETPLACE_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          headers: {
            Accept: 'application/json',
          },
        },
        CONNECTOR_MARKETPLACE_TIMEOUT_MS,
      );

      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          continue;
        }
        throw new Error(`Connector marketplace request failed (${response.status})`);
      }

      const payload = await response.json();
      const records = collectConnectorRecords(payload);
      const dedicatedConnectorEndpoint = endpoint.includes('/connectors');
      const connectors = dedupeConnectorCatalog(
        records
          .map((record) =>
            normalizeConnectorMarketplaceItem(record, { acceptAny: dedicatedConnectorEndpoint }),
          )
          .filter((item): item is ConnectorMarketplaceCatalogItem => Boolean(item)),
      );

      if (connectors.length > 0) {
        return { connectors, source: 'api' };
      }

      if (endpoint.endsWith('/marketplace/connectors') || endpoint.endsWith('/marketplace/skills')) {
        return { connectors: [], source: 'api' };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to load connector marketplace.');
    }
  }

  if (lastError) throw lastError;
  return { connectors: [], source: 'none' };
}

/**
 * Get plugin README content from GitHub.
 */
export async function fetchPluginReadme(
  owner: string,
  repo: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.raw',
        },
      }
    );

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeMarketplacePlugin(data: Partial<MarketplacePlugin> & { id: string }): MarketplacePlugin {
  return {
    name: data.name || data.id,
    description: data.description || '',
    version: data.version || 'unknown',
    author: data.author || 'Unknown',
    icon: data.icon || 'puzzle',
    category: data.category || 'general',
    installCount: data.installCount || 0,
    rating: data.rating || 0,
    installed: data.installed || false,
    sourceKind: data.sourceKind || 'curated',
    sourceTrust: data.sourceTrust || 'unknown',
    ...data,
  };
}

function normalizeMarketplacePluginFromApi(value: unknown): MarketplacePlugin | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = firstNonEmptyString([record.id, record.slug, record.key]);
  const name = firstNonEmptyString([record.name, record.title, id]);
  if (!id || !name) return null;
  const sourceDetails = parseSourceDetails(record.source, API_SOURCE_CONTEXT);

  return normalizeMarketplacePlugin({
    id,
    name,
    description: firstNonEmptyString([record.description, record.summary]) || '',
    version: firstNonEmptyString([record.version]) || '1.0.0',
    author: authorToDisplayName(record.author, 'Allternit Marketplace'),
    icon: firstNonEmptyString([record.icon]) || 'puzzle',
    category: normalizeCategory(firstNonEmptyString([record.category, record.type])),
    installCount: toNumber(record.installCount) || toNumber(record.downloads) || 0,
    rating: toNumber(record.rating) || 0,
    installed: false,
    tags: collectStringList(record.tags),
    sourceLabel: 'Allternit Marketplace',
    sourceId: API_SOURCE_CONTEXT.id,
    sourceKind: 'api',
    sourceTrust: 'verified',
    sourceUrl: sourceDetails.sourceUrl,
    sourceDescriptor: sourceDetails.sourceDescriptor,
    sourceRepo: sourceDetails.sourceRepo,
    sourceRef: sourceDetails.sourceRef,
    sourcePath: sourceDetails.sourcePath,
  });
}

function collectMarketplacePluginRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const asRecord = payload as Record<string, unknown>;
    if (Array.isArray(asRecord.plugins)) return asRecord.plugins;
    if (asRecord.data && typeof asRecord.data === 'object') {
      const nested = asRecord.data as Record<string, unknown>;
      if (Array.isArray(nested.plugins)) return nested.plugins;
    }
  }
  return [];
}

function normalizeMarketplacePluginFromManifest(
  value: unknown,
  source: CuratedMarketplaceSource,
  index: number
): MarketplacePlugin | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  const name = firstNonEmptyString([record.name, record.title]);
  if (!name) return null;

  const sourceDetails = parseSourceDetails(record.source, source);
  const tags = collectStringList(record.tags).concat(collectStringList(record.keywords));
  const category = normalizeCategory(
    firstNonEmptyString([record.category, record.type]) || inferCategoryFromTags(tags),
  );

  const id = firstNonEmptyString([record.id, record.slug]) || `${source.id}-${slugify(name)}-${index + 1}`;
  const description = firstNonEmptyString([record.description, record.summary]) || `${name} plugin`;

  return normalizeMarketplacePlugin({
    id: slugify(id),
    name,
    description,
    version: firstNonEmptyString([record.version]) || '1.0.0',
    author: authorToDisplayName(record.author, source.owner),
    icon: 'puzzle',
    category,
    installCount: toNumber(record.installCount) || toNumber(record.downloads) || 0,
    rating: toNumber(record.rating) || 0,
    installed: false,
    tags: uniqueLowerCaseStrings(tags),
    sourceLabel: source.label,
    sourceId: source.id,
    sourceKind: 'curated',
    sourceTrust: source.trust,
    sourceUrl: sourceDetails.sourceUrl,
    sourceDescriptor: sourceDetails.sourceDescriptor,
    sourceRepo: sourceDetails.sourceRepo,
    sourceRef: sourceDetails.sourceRef,
    sourcePath: sourceDetails.sourcePath,
  });
}

interface ParsedSourceDetails {
  sourceUrl?: string;
  sourceDescriptor?: MarketplacePlugin['sourceDescriptor'];
  sourceRepo?: string;
  sourceRef?: string;
  sourcePath?: string;
}

function normalizeRelativeSourcePath(value: string): string | undefined {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
  if (!normalized) return undefined;
  return normalized.replace(/\/+$/g, '');
}

/**
 * Load plugins from a local directory.
 * Validates the directory contains plugin.json or marketplace.json
 */
export async function loadPluginsFromLocalDirectory(
  dirPath: string,
  fs: {
    readFile: (path: string) => Promise<string>;
    readDir?: (path: string) => Promise<Array<{ name: string; type: string }>>;
    exists?: (path: string) => Promise<boolean>;
  }
): Promise<MarketplacePlugin[]> {
  const plugins: MarketplacePlugin[] = [];
  
  try {
    // Check for plugin.json or marketplace.json
    const manifestPaths = [
      `${dirPath}/plugin.json`,
      `${dirPath}/marketplace.json`,
      `${dirPath}/.claude-plugin/plugin.json`,
      `${dirPath}/.claude-plugin/marketplace.json`,
    ];
    
    let manifestContent: string | null = null;
    let manifestPath: string | null = null;
    
    for (const path of manifestPaths) {
      try {
        const exists = fs.exists ? await fs.exists(path) : true;
        if (exists) {
          manifestContent = await fs.readFile(path);
          manifestPath = path;
          break;
        }
      } catch {
        // Continue to next candidate
      }
    }
    
    if (!manifestContent) {
      throw new Error('No plugin.json or marketplace.json found in directory');
    }
    
    const manifest = JSON.parse(manifestContent);
    
    // Handle array of plugins (marketplace.json)
    if (Array.isArray(manifest.plugins)) {
      for (let i = 0; i < manifest.plugins.length; i++) {
        const plugin = normalizeMarketplacePluginFromLocal(manifest.plugins[i], dirPath, i);
        if (plugin) plugins.push(plugin);
      }
    } else if (Array.isArray(manifest)) {
      // Direct array of plugins
      for (let i = 0; i < manifest.length; i++) {
        const plugin = normalizeMarketplacePluginFromLocal(manifest[i], dirPath, i);
        if (plugin) plugins.push(plugin);
      }
    } else {
      // Single plugin
      const plugin = normalizeMarketplacePluginFromLocal(manifest, dirPath, 0);
      if (plugin) plugins.push(plugin);
    }
    
    return plugins;
  } catch (error) {
    console.error('[marketplaceApi] Failed to load local plugins:', error);
    throw error;
  }
}

function normalizeMarketplacePluginFromLocal(
  value: unknown,
  dirPath: string,
  index: number
): MarketplacePlugin | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  
  const name = firstNonEmptyString([record.name, record.title]);
  if (!name) return null;
  
  const id = firstNonEmptyString([record.id, record.slug]) || `local-${slugify(name)}-${index}`;
  const description = firstNonEmptyString([record.description, record.summary]) || `${name} plugin`;
  
  return normalizeMarketplacePlugin({
    id: slugify(id),
    name,
    description,
    version: firstNonEmptyString([record.version]) || '1.0.0',
    author: authorToDisplayName(record.author, 'Local Dev'),
    icon: 'puzzle',
    category: normalizeCategory(firstNonEmptyString([record.category, record.type])),
    installCount: 0,
    rating: 0,
    installed: false,
    tags: uniqueLowerCaseStrings(collectStringList(record.tags)),
    sourceLabel: 'Local Dev',
    sourceId: 'local',
    sourceKind: 'personal',
    sourceTrust: 'community',
    sourceUrl: `file://${dirPath}`,
    sourceDescriptor: {
      source: 'local',
      path: dirPath,
      isDevMode: true,
    },
    sourcePath: dirPath,
  });
}

function parseSourceDetails(rawSource: unknown, source: CuratedMarketplaceSource): ParsedSourceDetails {
  if (typeof rawSource === 'string' && rawSource.trim()) {
    const value = rawSource.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return {
        sourceUrl: value,
        sourceDescriptor: {
          source: 'url',
          url: value,
        },
      };
    }
    // Handle file:// protocol for local sources
    if (value.startsWith('file://')) {
      const path = value.slice(7); // Remove file:// prefix
      return {
        sourceUrl: value,
        sourceDescriptor: {
          source: 'local',
          path,
          isDevMode: true,
        },
        sourcePath: path,
      };
    }
    const path = normalizeRelativeSourcePath(value);
    if (source.repo) {
      const normalizedPath = path;
      const ref = 'main';
      return {
        sourceUrl: normalizedPath
          ? `https://github.com/${source.repo}/tree/${ref}/${normalizedPath}`
          : `https://github.com/${source.repo}/tree/${ref}`,
        sourceDescriptor: {
          source: 'github',
          repo: source.repo,
          ref,
          ...(normalizedPath ? { path: normalizedPath } : {}),
        },
        sourceRepo: source.repo,
        sourceRef: ref,
        sourcePath: normalizedPath,
      };
    }
    return {
      sourceDescriptor: value,
    };
  }

  if (rawSource && typeof rawSource === 'object') {
    const sourceObj = rawSource as Record<string, unknown>;
    const sourceType = firstNonEmptyString([sourceObj.source]);
    if (sourceType === 'github') {
      const repo = firstNonEmptyString([sourceObj.repo, source.repo]);
      if (repo) {
        const ref = firstNonEmptyString([sourceObj.ref]);
        const path = normalizeRelativeSourcePath(firstNonEmptyString([sourceObj.path, sourceObj.sourcePath]) || '');
        return {
          sourceUrl: ref
            ? path
              ? `https://github.com/${repo}/tree/${ref}/${path}`
              : `https://github.com/${repo}/tree/${ref}`
            : path
              ? `https://github.com/${repo}/tree/main/${path}`
              : `https://github.com/${repo}`,
          sourceDescriptor: {
            source: 'github',
            repo,
            ...(ref ? { ref } : {}),
            ...(path ? { path } : {}),
          },
          sourceRepo: repo,
          sourceRef: ref || 'main',
          sourcePath: path,
        };
      }
    }
    if (sourceType === 'local') {
      const path = normalizeRelativeSourcePath(firstNonEmptyString([sourceObj.path]) || '');
      const isDevMode = sourceObj.isDevMode !== false; // Default to true

      // If there's a repo, create a file:// URL that points to local path
      // but still use local source type
      if (path) {
        return {
          sourceUrl: `file://${path}`,
          sourceDescriptor: {
            source: 'local',
            path,
            isDevMode,
          },
          sourcePath: path,
        };
      }

      // Fallback to github if only repo is provided (legacy behavior)
      if (source.repo) {
        const ref = firstNonEmptyString([sourceObj.ref]) || 'main';
        return {
          sourceUrl: `https://github.com/${source.repo}/tree/${ref}`,
          sourceDescriptor: {
            source: 'github',
            repo: source.repo,
            ref,
          },
          sourceRepo: source.repo,
          sourceRef: ref,
        };
      }

      return {
        sourceDescriptor: {
          source: 'local',
          isDevMode,
        },
      };
    }
    const url = firstNonEmptyString([sourceObj.url]);
    if (url) {
      return {
        sourceUrl: url,
        sourceDescriptor: {
          source: 'url',
          url,
        },
      };
    }
  }

  if (source.repo) {
    return {
      sourceUrl: `https://github.com/${source.repo}`,
      sourceDescriptor: {
        source: 'github',
        repo: source.repo,
        ref: 'main',
      },
      sourceRepo: source.repo,
      sourceRef: 'main',
    };
  }
  return {};
}

function mergeMarketplacePlugin(target: Map<string, MarketplacePlugin>, plugin: MarketplacePlugin) {
  const existing = target.get(plugin.id);
  if (!existing) {
    target.set(plugin.id, plugin);
    return;
  }

  const existingScore = trustScore(existing.sourceTrust);
  const incomingScore = trustScore(plugin.sourceTrust);
  if (incomingScore < existingScore) {
    target.set(plugin.id, plugin);
    return;
  }

  if (incomingScore === existingScore && (plugin.installCount || 0) > (existing.installCount || 0)) {
    target.set(plugin.id, plugin);
  }
}

function trustScore(value: MarketplacePlugin['sourceTrust']): number {
  switch (value) {
    case 'official':
      return 0;
    case 'verified':
      return 1;
    case 'community':
      return 2;
    default:
      return 3;
  }
}

function sortMarketplacePlugins(
  plugins: MarketplacePlugin[],
  sortBy: 'relevance' | 'downloads' | 'rating' | 'recent'
): MarketplacePlugin[] {
  const sorted = [...plugins];

  if (sortBy === 'downloads') {
    sorted.sort((a, b) => (b.installCount || 0) - (a.installCount || 0));
    return sorted;
  }
  if (sortBy === 'rating') {
    sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return sorted;
  }

  // relevance/recent fallback: trust first, then installs, then name.
  sorted.sort((a, b) => {
    const trustDelta = trustScore(a.sourceTrust) - trustScore(b.sourceTrust);
    if (trustDelta !== 0) return trustDelta;

    const installDelta = (b.installCount || 0) - (a.installCount || 0);
    if (installDelta !== 0) return installDelta;

    return a.name.localeCompare(b.name);
  });
  return sorted;
}

function collectConnectorRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const asRecord = payload as Record<string, unknown>;
    if (Array.isArray(asRecord.connectors)) return asRecord.connectors;
    if (Array.isArray(asRecord.items)) return asRecord.items;
    if (Array.isArray(asRecord.skills)) return asRecord.skills;
    if (Array.isArray(asRecord.plugins)) return asRecord.plugins;
    if (asRecord.data && typeof asRecord.data === 'object') {
      const nested = asRecord.data as Record<string, unknown>;
      if (Array.isArray(nested.connectors)) return nested.connectors;
      if (Array.isArray(nested.items)) return nested.items;
      if (Array.isArray(nested.skills)) return nested.skills;
      if (Array.isArray(nested.plugins)) return nested.plugins;
    }
  }
  return [];
}

function normalizeConnectorMarketplaceItem(
  raw: unknown,
  options: { acceptAny: boolean },
): ConnectorMarketplaceCatalogItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const name = firstNonEmptyString([
    record.name,
    record.title,
    record.display_name,
    record.appName,
    record.app_name,
  ]);
  if (!name) return null;

  const tags = readTags(record.tags);
  const category = (
    firstNonEmptyString([record.category, record.group, record.domain]) ||
    tags.find((tag) => tag !== 'connector' && tag !== 'integration') ||
    'general'
  ).toLowerCase();

  const isConnectorLike =
    options.acceptAny ||
    includesToken(record.type, 'connector') ||
    includesToken(record.kind, 'connector') ||
    includesToken(record.entry_type, 'connector') ||
    tags.includes('connector') ||
    tags.includes('integration') ||
    typeof record.authType === 'string' ||
    typeof record.appUrl === 'string' ||
    typeof record.oauth === 'object';

  if (!isConnectorLike) return null;

  const id =
    firstNonEmptyString([record.id, record.slug, record.key]) ||
    slugify(name);
  const description =
    firstNonEmptyString([record.description, record.summary, record.short_description]) || '';
  const connectorType = normalizeConnectorType(
    firstNonEmptyString([record.connectorType, record.type, record.vertical]),
    category,
    tags,
  );
  const icon =
    firstNonEmptyString([record.icon, record.badge]) ||
    initials(name);
  const featured = toBoolean(record.featured) || tags.includes('featured');

  return {
    id,
    name,
    description,
    category,
    connectorType,
    featured,
    icon: icon.slice(0, 4).toUpperCase(),
  };
}

function dedupeConnectorCatalog(items: ConnectorMarketplaceCatalogItem[]): ConnectorMarketplaceCatalogItem[] {
  const seen = new Set<string>();
  const deduped: ConnectorMarketplaceCatalogItem[] = [];
  for (const item of items) {
    const key = item.id.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function collectStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function uniqueLowerCaseStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function inferCategoryFromTags(tags: string[]): string {
  const normalized = tags.map((tag) => tag.toLowerCase());
  if (normalized.some((tag) => ['security', 'auth', 'sast'].includes(tag))) return 'security';
  if (normalized.some((tag) => ['finance', 'billing', 'payments'].includes(tag))) return 'finance';
  if (normalized.some((tag) => ['data', 'analytics', 'database'].includes(tag))) return 'data';
  if (normalized.some((tag) => ['sales', 'crm'].includes(tag))) return 'sales';
  if (normalized.some((tag) => ['productivity', 'workflow'].includes(tag))) return 'productivity';
  if (normalized.some((tag) => ['development', 'devtools', 'engineering'].includes(tag))) return 'development';
  return 'community';
}

function normalizeCategory(value: string | null): string {
  if (!value) return 'community';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'community';
  return normalized;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function includesToken(value: unknown, token: string): boolean {
  if (typeof value !== 'string') return false;
  return value.toLowerCase().includes(token.toLowerCase());
}

function normalizeConnectorType(
  value: string | null,
  category: string,
  tags: string[],
): ConnectorMarketplaceType {
  const candidates = [value || '', category, ...tags].map((entry) => entry.toLowerCase());

  if (candidates.some((entry) => entry.includes('design'))) return 'design';
  if (candidates.some((entry) => entry.includes('data') || entry.includes('analytics'))) return 'data';
  if (candidates.some((entry) => entry.includes('business') || entry.includes('sales') || entry.includes('crm') || entry.includes('finance'))) {
    return 'business';
  }
  if (candidates.some((entry) => entry.includes('dev') || entry.includes('engineering') || entry.includes('infra') || entry.includes('cloud'))) {
    return 'development';
  }
  if (candidates.some((entry) => entry.includes('productivity') || entry.includes('calendar') || entry.includes('docs') || entry.includes('communication') || entry.includes('storage'))) {
    return 'productivity';
  }
  return 'other';
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}

function initials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'CN';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}

// ============================================================================
// Categories
// ============================================================================

export const PLUGIN_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'productivity', label: 'Productivity', icon: 'zap' },
  { id: 'development', label: 'Development', icon: 'code' },
  { id: 'data', label: 'Data', icon: 'database' },
  { id: 'legal', label: 'Legal', icon: 'scale' },
  { id: 'finance', label: 'Finance', icon: 'dollar-sign' },
  { id: 'sales', label: 'Sales', icon: 'trending-up' },
  { id: 'security', label: 'Security', icon: 'shield' },
  { id: 'enterprise', label: 'Enterprise', icon: 'building' },
  { id: 'community', label: 'Community', icon: 'users' },
] as const;
