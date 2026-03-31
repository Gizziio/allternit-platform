import JSZip from 'jszip';
import type { MarketplacePlugin } from './capability.types';
import {
  CLAUDE_PLUGIN_SCHEMA_URL,
  sanitizeRelativePath,
  slugifyPluginName,
} from './pluginStandards';

const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FILE_COUNT = 500;
const MAX_TOTAL_TEXT_BYTES = 6 * 1024 * 1024;

type ResolvedSource =
  | { kind: 'github'; repo: string; ref: string; path?: string; sourceUrl?: string }
  | { kind: 'url'; url: string; sourceUrl?: string }
  | { kind: 'local'; path: string; sourceUrl?: string; isDevMode?: boolean };

interface GitHubContentItem {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  path: string;
  name: string;
  size: number;
  url: string;
  download_url: string | null;
}

interface InstallableFile {
  relativePath: string;
  content: string;
}

export interface ResolvedMarketplacePluginPackage {
  files: InstallableFile[];
  pluginManifest: Record<string, unknown>;
  readme: string;
  source: {
    kind: 'github' | 'url' | 'generated' | 'local';
    repo?: string;
    ref?: string;
    path?: string;
    sourceUrl?: string;
    isDevMode?: boolean;
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRelativePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '').replace(/\/+$/g, '');
  return normalized || undefined;
}

function parseGitHubTreeUrl(value: string): { repo: string; ref: string; path?: string } | null {
  try {
    const url = new URL(value);
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const repo = `${parts[0]}/${parts[1]}`;
    if (parts.length >= 4 && parts[2] === 'tree') {
      const ref = parts[3];
      const path = normalizeRelativePath(parts.slice(4).join('/'));
      return {
        repo,
        ref,
        ...(path ? { path } : {}),
      };
    }
    return {
      repo,
      ref: 'main',
    };
  } catch {
    return null;
  }
}

function resolveSource(plugin: MarketplacePlugin): ResolvedSource {
  const descriptor = plugin.sourceDescriptor;

  if (descriptor && typeof descriptor === 'object') {
    if (descriptor.source === 'github' && descriptor.repo) {
      return {
        kind: 'github',
        repo: descriptor.repo,
        ref: descriptor.ref || plugin.sourceRef || 'main',
        path: normalizeRelativePath(descriptor.path || plugin.sourcePath),
        sourceUrl: plugin.sourceUrl,
      };
    }
    if (descriptor.source === 'url' && descriptor.url) {
      return {
        kind: 'url',
        url: descriptor.url,
        sourceUrl: plugin.sourceUrl || descriptor.url,
      };
    }
    if (descriptor.source === 'local') {
      // Check if local source has a path for filesystem loading
      const localPath = descriptor.path || plugin.sourcePath;
      if (localPath) {
        return {
          kind: 'local',
          path: localPath,
          sourceUrl: plugin.sourceUrl || `file://${localPath}`,
          isDevMode: descriptor.isDevMode ?? true,
        };
      }
      // Fall back to github if sourceRepo is provided (legacy behavior)
      if (plugin.sourceRepo) {
        return {
          kind: 'github',
          repo: plugin.sourceRepo,
          ref: plugin.sourceRef || descriptor.ref || 'main',
          path: normalizeRelativePath(descriptor.path || plugin.sourcePath),
          sourceUrl: plugin.sourceUrl,
        };
      }
    }
  }

  if (typeof descriptor === 'string' && descriptor.trim()) {
    const value = descriptor.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const maybeGitHub = parseGitHubTreeUrl(value);
      if (maybeGitHub) {
        return {
          kind: 'github',
          repo: maybeGitHub.repo,
          ref: maybeGitHub.ref,
          path: maybeGitHub.path,
          sourceUrl: value,
        };
      }
      return {
        kind: 'url',
        url: value,
        sourceUrl: value,
      };
    }

    if (plugin.sourceRepo) {
      return {
        kind: 'github',
        repo: plugin.sourceRepo,
        ref: plugin.sourceRef || 'main',
        path: normalizeRelativePath(value),
        sourceUrl: plugin.sourceUrl,
      };
    }
  }

  if (plugin.sourceRepo) {
    return {
      kind: 'github',
      repo: plugin.sourceRepo,
      ref: plugin.sourceRef || 'main',
      path: normalizeRelativePath(plugin.sourcePath),
      sourceUrl: plugin.sourceUrl,
    };
  }

  if (plugin.sourceUrl) {
    const maybeGitHub = parseGitHubTreeUrl(plugin.sourceUrl);
    if (maybeGitHub) {
      return {
        kind: 'github',
        repo: maybeGitHub.repo,
        ref: maybeGitHub.ref,
        path: maybeGitHub.path,
        sourceUrl: plugin.sourceUrl,
      };
    }
    return {
      kind: 'url',
      url: plugin.sourceUrl,
      sourceUrl: plugin.sourceUrl,
    };
  }

  throw new Error(`Plugin "${plugin.name}" has no installable source descriptor.`);
}

function decodeBase64Utf8(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(compact);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }
  throw new Error('Base64 decoder is not available in this runtime.');
}

function looksLikeText(path: string, content: string): boolean {
  const lower = path.toLowerCase();
  const textExtensions = [
    '.md', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.conf', '.env', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rs',
    '.go', '.sh', '.zsh', '.bash', '.sql', '.html', '.css', '.xml',
  ];
  if (textExtensions.some((ext) => lower.endsWith(ext))) return true;
  if (content.includes('\u0000')) return false;
  return true;
}

function githubContentsUrl(repo: string, ref: string, path?: string): string {
  const encodedPath = path
    ? `/${path.split('/').filter(Boolean).map((part) => encodeURIComponent(part)).join('/')}`
    : '';
  return `${GITHUB_API}/repos/${repo}/contents${encodedPath}?ref=${encodeURIComponent(ref)}`;
}

async function fetchGitHubFileText(item: GitHubContentItem): Promise<string | null> {
  if (item.download_url) {
    const response = await fetchWithTimeout(item.download_url, {
      headers: {
        Accept: 'text/plain, */*',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  }

  const response = await fetchWithTimeout(item.url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) return null;
  const payload = await response.json() as {
    content?: string;
    encoding?: string;
    download_url?: string | null;
  };
  if (typeof payload.content === 'string' && payload.encoding === 'base64') {
    return decodeBase64Utf8(payload.content);
  }
  if (payload.download_url) {
    const raw = await fetchWithTimeout(payload.download_url, {
      headers: {
        Accept: 'text/plain, */*',
      },
    });
    if (!raw.ok) return null;
    return await raw.text();
  }
  return null;
}

async function collectGitHubFilesRecursive(
  repo: string,
  ref: string,
  rootPath: string | undefined,
  currentPath: string | undefined,
  files: InstallableFile[],
  stats: { totalBytes: number },
): Promise<void> {
  const response = await fetchWithTimeout(githubContentsUrl(repo, ref, currentPath), {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to read source directory (${response.status}) for ${repo}.`);
  }

  const payload = await response.json() as GitHubContentItem[] | GitHubContentItem;
  const entries = Array.isArray(payload) ? payload : [payload];

  for (const entry of entries) {
    if (entry.type === 'dir') {
      await collectGitHubFilesRecursive(repo, ref, rootPath, entry.path, files, stats);
      continue;
    }
    if (entry.type !== 'file') continue;

    const relativePath = (() => {
      if (!rootPath) return entry.path;
      if (entry.path === rootPath) return entry.name;
      if (entry.path.startsWith(`${rootPath}/`)) {
        return entry.path.slice(rootPath.length + 1);
      }
      return entry.path;
    })();
    const safePath = sanitizeRelativePath(relativePath);
    if (!safePath) continue;

    const content = await fetchGitHubFileText(entry);
    if (typeof content !== 'string') continue;
    if (!looksLikeText(safePath, content)) continue;

    stats.totalBytes += content.length;
    if (stats.totalBytes > MAX_TOTAL_TEXT_BYTES) {
      throw new Error('Plugin package exceeds text size limit.');
    }
    files.push({
      relativePath: safePath,
      content,
    });
    if (files.length > MAX_FILE_COUNT) {
      throw new Error('Plugin package has too many files.');
    }
  }
}

function buildFallbackManifest(plugin: MarketplacePlugin): Record<string, unknown> {
  return {
    $schema: CLAUDE_PLUGIN_SCHEMA_URL,
    name: slugifyPluginName(plugin.name),
    description: plugin.description,
    version: plugin.version || '1.0.0',
    author: plugin.author || 'Unknown',
    category: plugin.category || 'general',
    ...(plugin.tags && plugin.tags.length > 0 ? { tags: plugin.tags } : {}),
  };
}

function parseManifest(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function finalizePackage(
  plugin: MarketplacePlugin,
  source: ResolvedMarketplacePluginPackage['source'],
  files: InstallableFile[],
): ResolvedMarketplacePluginPackage {
  const fileMap = new Map<string, string>();
  for (const file of files) {
    const safePath = sanitizeRelativePath(file.relativePath);
    if (!safePath) continue;
    if (!fileMap.has(safePath)) {
      fileMap.set(safePath, file.content);
    }
  }

  const pluginJsonPath = fileMap.has('.claude-plugin/plugin.json')
    ? '.claude-plugin/plugin.json'
    : fileMap.has('plugin.json')
      ? 'plugin.json'
      : null;

  const pluginManifest = pluginJsonPath
    ? parseManifest(fileMap.get(pluginJsonPath) || '') || buildFallbackManifest(plugin)
    : buildFallbackManifest(plugin);

  if (!pluginJsonPath) {
    fileMap.set('.claude-plugin/plugin.json', JSON.stringify(pluginManifest, null, 2));
  }

  const readmePath = fileMap.has('README.md')
    ? 'README.md'
    : fileMap.has('readme.md')
      ? 'readme.md'
      : null;
  const readme = readmePath
    ? (fileMap.get(readmePath) || '')
    : `# ${plugin.name}\n\n${plugin.description}\n`;

  if (!readmePath) {
    fileMap.set('README.md', readme);
  }

  return {
    files: Array.from(fileMap.entries()).map(([relativePath, content]) => ({ relativePath, content })),
    pluginManifest,
    readme,
    source,
  };
}

async function resolveFromGitHub(plugin: MarketplacePlugin, source: Extract<ResolvedSource, { kind: 'github' }>) {
  const files: InstallableFile[] = [];
  const stats = { totalBytes: 0 };
  await collectGitHubFilesRecursive(
    source.repo,
    source.ref,
    normalizeRelativePath(source.path),
    normalizeRelativePath(source.path),
    files,
    stats,
  );

  if (files.length === 0) {
    throw new Error(`No installable files were found in ${source.repo}.`);
  }

  return finalizePackage(plugin, {
    kind: 'github',
    repo: source.repo,
    ref: source.ref,
    path: normalizeRelativePath(source.path),
    sourceUrl: source.sourceUrl,
  }, files);
}

async function resolveFromZip(plugin: MarketplacePlugin, sourceUrl: string, buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files: InstallableFile[] = [];
  let totalBytes = 0;

  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const safePath = sanitizeRelativePath(entry.name);
    if (!safePath) continue;
    const content = await entry.async('string');
    if (!looksLikeText(safePath, content)) continue;
    totalBytes += content.length;
    if (totalBytes > MAX_TOTAL_TEXT_BYTES) {
      throw new Error('Plugin package exceeds text size limit.');
    }
    files.push({
      relativePath: safePath,
      content,
    });
    if (files.length > MAX_FILE_COUNT) {
      throw new Error('Plugin package has too many files.');
    }
  }

  if (files.length === 0) {
    throw new Error('ZIP source does not contain any installable text files.');
  }

  return finalizePackage(plugin, {
    kind: 'url',
    sourceUrl,
  }, files);
}

async function resolveFromUrl(plugin: MarketplacePlugin, source: Extract<ResolvedSource, { kind: 'url' }>) {
  const response = await fetchWithTimeout(source.url, {
    headers: {
      Accept: 'application/json, application/zip, text/plain, */*',
    },
  });
  if (!response.ok) {
    throw new Error(`Source URL returned ${response.status}.`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const lowerUrl = source.url.toLowerCase();

  if (contentType.includes('application/zip') || lowerUrl.endsWith('.zip')) {
    const buffer = await response.arrayBuffer();
    return await resolveFromZip(plugin, source.url, buffer);
  }

  if (contentType.includes('application/json') || lowerUrl.endsWith('.json')) {
    const raw = await response.text();
    const parsed = parseManifest(raw);
    if (!parsed) {
      throw new Error('Source URL returned invalid JSON.');
    }

    const files: InstallableFile[] = [
      {
        relativePath: '.claude-plugin/plugin.json',
        content: JSON.stringify(parsed, null, 2),
      },
      {
        relativePath: 'README.md',
        content: `# ${plugin.name}\n\n${plugin.description}\n`,
      },
    ];
    return finalizePackage(plugin, {
      kind: 'url',
      sourceUrl: source.url,
    }, files);
  }

  const text = await response.text();
  return finalizePackage(plugin, {
    kind: 'url',
    sourceUrl: source.url,
  }, [
    {
      relativePath: 'README.md',
      content: text,
    },
  ]);
}

async function resolveFromLocal(
  plugin: MarketplacePlugin,
  source: Extract<ResolvedSource, { kind: 'local' }>
): Promise<ResolvedMarketplacePluginPackage> {
  // Lazy import to avoid circular dependencies
  const { loadLocalPlugin, localPluginToPackage } = await import('./localPluginLoader');

  // Create a local source object
  const localSource = {
    id: `source-${Date.now()}`,
    path: source.path,
    addedAt: new Date().toISOString(),
    isDevMode: source.isDevMode ?? true,
  };

  // Dynamically get the file system API from the plugin's context
  // This assumes the plugin has access to the fs API through the runtime
  const fs = await getFileSystemAPI();
  if (!fs) {
    throw new Error('File system API not available for loading local plugin');
  }

  const loaded = await loadLocalPlugin(localSource, fs);
  const pkg = localPluginToPackage(loaded);

  return {
    files: pkg.files,
    pluginManifest: pkg.pluginManifest,
    readme: pkg.readme,
    source: {
      kind: 'local',
      path: source.path,
      sourceUrl: source.sourceUrl,
      isDevMode: source.isDevMode ?? true,
    },
  };
}

async function getFileSystemAPI() {
  // Try to get the file system API from the global runtime
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__ALLTERNIT_FS__) {
    return (window as unknown as Record<string, unknown>).__ALLTERNIT_FS__ as {
      readFile: (path: string) => Promise<string>;
      readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isSymbolicLink: boolean }>>;
      exists: (path: string) => Promise<boolean>;
      isDirectory: (path: string) => Promise<boolean>;
      join: (...paths: string[]) => string;
      dirname: (path: string) => string;
      basename: (path: string) => string;
      realpath: (path: string) => Promise<string>;
    };
  }

  // Try to get from electron runtime
  const electronRuntime = (window as unknown as Record<string, unknown>).electron as Record<string, unknown> | undefined;
  if (typeof window !== 'undefined' && electronRuntime?.fs) {
    return electronRuntime.fs as {
      readFile: (path: string) => Promise<string>;
      readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isSymbolicLink: boolean }>>;
      exists: (path: string) => Promise<boolean>;
      isDirectory: (path: string) => Promise<boolean>;
      join: (...paths: string[]) => string;
      dirname: (path: string) => string;
      basename: (path: string) => string;
      realpath: (path: string) => Promise<string>;
    };
  }

  return null;
}

export async function resolveMarketplacePluginPackage(
  plugin: MarketplacePlugin,
): Promise<ResolvedMarketplacePluginPackage> {
  const source = resolveSource(plugin);
  if (source.kind === 'github') {
    return await resolveFromGitHub(plugin, source);
  }
  if (source.kind === 'url') {
    return await resolveFromUrl(plugin, source);
  }
  if (source.kind === 'local') {
    return await resolveFromLocal(plugin, source);
  }
  return {
    files: [
      {
        relativePath: '.claude-plugin/plugin.json',
        content: JSON.stringify(buildFallbackManifest(plugin), null, 2),
      },
      {
        relativePath: 'README.md',
        content: `# ${plugin.name}\n\n${plugin.description}\n`,
      },
    ],
    pluginManifest: buildFallbackManifest(plugin),
    readme: `# ${plugin.name}\n\n${plugin.description}\n`,
    source: {
      kind: 'generated',
      sourceUrl: plugin.sourceUrl,
    },
  };
}
