/**
 * Local Plugin Loader
 *
 * Loads plugins from local directories for development and testing.
 * Supports hot-reload, symlink resolution, and file watching.
 */

import type { MarketplacePlugin } from './capability.types';
import {
  CLAUDE_PLUGIN_SCHEMA_URL,
  sanitizeRelativePath,
  slugifyPluginName,
} from './pluginStandards';

// ============================================================================
// Types
// ============================================================================

export interface LocalPluginSource {
  id: string;
  path: string;
  addedAt: string;
  label?: string;
  isDevMode?: boolean;
}

export interface LocalPluginManifest {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface LoadedLocalPlugin {
  plugin: MarketplacePlugin;
  manifest: LocalPluginManifest;
  files: Array<{ relativePath: string; content: string }>;
  readme: string;
  sourcePath: string;
  isDevMode: boolean;
}

export interface LocalDirectoryValidation {
  valid: boolean;
  error?: string;
  manifestPath?: string;
  manifest?: LocalPluginManifest;
}

// ============================================================================
// File System Interface (uses Electron's file system API)
// ============================================================================

interface FileSystemAPI {
  readFile: (path: string) => Promise<string>;
  readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isSymbolicLink: boolean }>>;
  exists: (path: string) => Promise<boolean>;
  isDirectory: (path: string) => Promise<boolean>;
  join: (...paths: string[]) => string;
  dirname: (path: string) => string;
  basename: (path: string) => string;
  realpath: (path: string) => Promise<string>;
}

// ============================================================================
// Constants
// ============================================================================

const MANIFEST_FILES = ['marketplace.json', 'plugin.json', 'manifest.json'];
const README_FILES = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.conf', '.env', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rs',
  '.go', '.sh', '.zsh', '.bash', '.sql', '.html', '.css', '.xml', '.svg',
  '.gitignore', '.dockerignore', '.eslintrc', '.prettierrc',
]);

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a local directory for plugin loading.
 * Checks if directory exists and contains a valid manifest file.
 */
export async function validateLocalPluginDirectory(
  dirPath: string,
  fs: FileSystemAPI
): Promise<LocalDirectoryValidation> {
  try {
    // Check if path exists and is a directory
    const exists = await fs.exists(dirPath);
    if (!exists) {
      return { valid: false, error: 'Directory does not exist' };
    }

    const isDir = await fs.isDirectory(dirPath);
    if (!isDir) {
      return { valid: false, error: 'Path is not a directory' };
    }

    // Resolve symlinks
    let resolvedPath = dirPath;
    try {
      resolvedPath = await fs.realpath(dirPath);
    } catch {
      // If realpath fails, use original path
    }

    // Look for manifest files
    for (const manifestFile of MANIFEST_FILES) {
      const manifestPath = fs.join(resolvedPath, manifestFile);
      try {
        const exists = await fs.exists(manifestPath);
        if (exists) {
          const content = await fs.readFile(manifestPath);
          const manifest = parseManifest(content);
          if (manifest) {
            return { valid: true, manifestPath, manifest };
          }
        }
      } catch {
        // Continue to next manifest file
      }
    }

    // Check subdirectory .claude-plugin/
    const claudePluginDir = fs.join(resolvedPath, '.claude-plugin');
    try {
      const claudeDirExists = await fs.exists(claudePluginDir);
      if (claudeDirExists) {
        for (const manifestFile of MANIFEST_FILES) {
          const manifestPath = fs.join(claudePluginDir, manifestFile);
          try {
            const exists = await fs.exists(manifestPath);
            if (exists) {
              const content = await fs.readFile(manifestPath);
              const manifest = parseManifest(content);
              if (manifest) {
                return { valid: true, manifestPath, manifest };
              }
            }
          } catch {
            // Continue to next manifest file
          }
        }
      }
    } catch {
      // Ignore errors checking .claude-plugin directory
    }

    return { valid: false, error: 'No valid manifest file found (looking for marketplace.json, plugin.json, or manifest.json)' };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error validating directory' };
  }
}

// ============================================================================
// Manifest Parsing
// ============================================================================

function parseManifest(content: string): LocalPluginManifest | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;

    // Handle both single plugin and marketplace with plugins array
    if (Array.isArray(record.plugins) && record.plugins.length > 0) {
      // Return first plugin from marketplace manifest
      const firstPlugin = record.plugins[0] as Record<string, unknown>;
      return normalizeManifest(firstPlugin);
    }

    // Single plugin manifest
    if (typeof record.name === 'string') {
      return normalizeManifest(record);
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeManifest(record: Record<string, unknown>): LocalPluginManifest {
  return {
    name: String(record.name || 'Unnamed Plugin'),
    description: typeof record.description === 'string' ? record.description : undefined,
    version: typeof record.version === 'string' ? record.version : '1.0.0',
    author: typeof record.author === 'string' ? record.author : undefined,
    category: typeof record.category === 'string' ? record.category : 'development',
    tags: Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === 'string') : [],
    ...record,
  };
}

// ============================================================================
// Plugin Loading
// ============================================================================

/**
 * Load a plugin from a local directory.
 */
export async function loadLocalPlugin(
  source: LocalPluginSource,
  fs: FileSystemAPI
): Promise<LoadedLocalPlugin> {
  const validation = await validateLocalPluginDirectory(source.path, fs);
  if (!validation.valid || !validation.manifest) {
    throw new Error(validation.error || 'Invalid plugin directory');
  }

  const resolvedPath = await fs.realpath(source.path).catch(() => source.path);
  const manifest = validation.manifest;

  // Collect all text files
  const files = await collectLocalFiles(resolvedPath, fs);

  // Find and load README
  const readme = await findReadme(resolvedPath, fs);

  // Build MarketplacePlugin
  const plugin: MarketplacePlugin = {
    id: `local-${source.id}`,
    name: manifest.name,
    description: manifest.description || `${manifest.name} (local development)`,
    version: manifest.version || '1.0.0',
    author: manifest.author || 'Local Developer',
    icon: 'puzzle',
    category: manifest.category || 'development',
    installCount: 0,
    rating: 0,
    installed: false,
    tags: manifest.tags || [],
    sourceLabel: source.label || 'Local Dev',
    sourceId: 'local-development',
    sourceKind: 'personal',
    sourceTrust: 'community',
    sourceUrl: `file://${resolvedPath}`,
    sourceDescriptor: {
      source: 'local',
      path: resolvedPath,
    },
    sourcePath: resolvedPath,
  };

  return {
    plugin,
    manifest,
    files,
    readme,
    sourcePath: resolvedPath,
    isDevMode: source.isDevMode ?? true,
  };
}

/**
 * Collect all text files from a local directory recursively.
 */
async function collectLocalFiles(
  dirPath: string,
  fs: FileSystemAPI,
  relativePath = ''
): Promise<Array<{ relativePath: string; content: string }>> {
  const files: Array<{ relativePath: string; content: string }> = [];
  let totalSize = 0;

  const entries = await fs.readDir(dirPath);

  // Sort entries for consistent ordering
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const fullPath = fs.join(dirPath, entry.name);

    if (entry.isSymbolicLink) {
      // Follow symlinks for development convenience
      try {
        const realPath = await fs.realpath(fullPath);
        const isDir = await fs.isDirectory(realPath);
        if (isDir) {
          const nestedFiles = await collectLocalFiles(realPath, fs, entryRelativePath);
          files.push(...nestedFiles);
        } else if (isTextFile(entry.name)) {
          const content = await fs.readFile(realPath);
          if (content.length <= MAX_FILE_SIZE) {
            totalSize += content.length;
            if (totalSize <= MAX_TOTAL_SIZE) {
              const safePath = sanitizeRelativePath(entryRelativePath);
              if (safePath) {
                files.push({ relativePath: safePath, content });
              }
            }
          }
        }
      } catch {
        // Skip broken symlinks
      }
      continue;
    }

    if (entry.isDirectory) {
      // Skip common non-source directories
      if (shouldSkipDirectory(entry.name)) continue;

      const nestedFiles = await collectLocalFiles(fullPath, fs, entryRelativePath);
      files.push(...nestedFiles);
    } else {
      if (!isTextFile(entry.name)) continue;

      try {
        const content = await fs.readFile(fullPath);
        if (content.length > MAX_FILE_SIZE) continue;

        totalSize += content.length;
        if (totalSize > MAX_TOTAL_SIZE) {
          throw new Error('Plugin directory exceeds maximum total size (10MB)');
        }

        const safePath = sanitizeRelativePath(entryRelativePath);
        if (safePath) {
          files.push({ relativePath: safePath, content });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return files;
}

function isTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.'));
  return TEXT_EXTENSIONS.has(ext) || !lower.includes('.');
}

function shouldSkipDirectory(name: string): boolean {
  const skipDirs = new Set([
    'node_modules', '.git', '.svn', '.hg', '.bzr',
    'dist', 'build', 'out', 'target', '.next', '.nuxt',
    'coverage', '.nyc_output', '.cache', '.parcel-cache',
    '.turbo', '.serverless', '.webpack', '.gradle',
    '__pycache__', '.pytest_cache', '.mypy_cache',
    'venv', '.venv', 'env', '.env', 'virtualenv',
    '.idea', '.vscode', '.vs', '.history',
  ]);
  return skipDirs.has(name.toLowerCase());
}

async function findReadme(dirPath: string, fs: FileSystemAPI): Promise<string> {
  for (const readmeFile of README_FILES) {
    try {
      const readmePath = fs.join(dirPath, readmeFile);
      const exists = await fs.exists(readmePath);
      if (exists) {
        return await fs.readFile(readmePath);
      }
    } catch {
      // Continue to next README file
    }
  }

  // Return default README content
  return `# Local Plugin\\n\\nThis plugin is loaded from a local directory for development.\\n`;
}

// ============================================================================
// Storage
// ============================================================================

const LOCAL_SOURCES_STORAGE_KEY = 'a2r:plugin-manager:local-sources:v1';

export function loadLocalSources(): LocalPluginSource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_SOURCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidLocalSource);
  } catch {
    return [];
  }
}

export function saveLocalSources(sources: LocalPluginSource[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_SOURCES_STORAGE_KEY, JSON.stringify(sources));
  } catch {
    // Ignore storage errors
  }
}

function isValidLocalSource(value: unknown): value is LocalPluginSource {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.path === 'string' &&
    typeof record.addedAt === 'string' &&
    (record.label === undefined || typeof record.label === 'string') &&
    (record.isDevMode === undefined || typeof record.isDevMode === 'boolean')
  );
}

// ============================================================================
// File Watching (Dev Mode)
// ============================================================================

export interface FileWatcher {
  stop: () => void;
}

export type FileChangeCallback = (event: { type: 'change' | 'add' | 'delete'; path: string }) => void;

/**
 * Watch a local plugin directory for changes.
 * Uses polling fallback for compatibility.
 */
export function watchLocalPlugin(
  sourcePath: string,
  fs: FileSystemAPI,
  callback: FileChangeCallback,
  options: { pollInterval?: number } = {}
): FileWatcher {
  const { pollInterval = 1000 } = options;

  // Simple polling-based watching
  const fileHashes = new Map<string, number>();
  let running = true;

  async function poll(): Promise<void> {
    if (!running) return;

    try {
      const currentFiles = await collectFileHashes(sourcePath, fs);

      // Check for changes and new files
      for (const [path, hash] of currentFiles) {
        const oldHash = fileHashes.get(path);
        if (oldHash === undefined) {
          callback({ type: 'add', path });
        } else if (oldHash !== hash) {
          callback({ type: 'change', path });
        }
      }

      // Check for deleted files
      for (const path of fileHashes.keys()) {
        if (!currentFiles.has(path)) {
          callback({ type: 'delete', path });
        }
      }

      // Update stored hashes
      fileHashes.clear();
      for (const [path, hash] of currentFiles) {
        fileHashes.set(path, hash);
      }
    } catch {
      // Ignore errors during polling
    }

    if (running) {
      setTimeout(poll, pollInterval);
    }
  }

  // Start polling
  void poll();

  return {
    stop: () => {
      running = false;
    },
  };
}

async function collectFileHashes(
  dirPath: string,
  fs: FileSystemAPI,
  relativePath = ''
): Promise<Map<string, number>> {
  const hashes = new Map<string, number>();

  try {
    const entries = await fs.readDir(dirPath);

    for (const entry of entries) {
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const fullPath = fs.join(dirPath, entry.name);

      if (entry.isDirectory && !shouldSkipDirectory(entry.name)) {
        const nested = await collectFileHashes(fullPath, fs, entryRelativePath);
        for (const [path, hash] of nested) {
          hashes.set(path, hash);
        }
      } else if (isTextFile(entry.name)) {
        try {
          const content = await fs.readFile(fullPath);
          // Simple hash: content length + first char code + last char code
          const hash = content.length * 31 +
            (content.charCodeAt(0) || 0) +
            (content.charCodeAt(content.length - 1) || 0);
          hashes.set(entryRelativePath, hash);
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Return empty map on error
  }

  return hashes;
}

// ============================================================================
// Plugin Package Generation
// ============================================================================

/**
 * Convert a loaded local plugin to a resolved package format
 * compatible with the marketplace installer.
 */
export function localPluginToPackage(
  loaded: LoadedLocalPlugin
): {
  files: Array<{ relativePath: string; content: string }>;
  pluginManifest: Record<string, unknown>;
  readme: string;
  source: {
    kind: 'local';
    path: string;
    isDevMode: boolean;
  };
} {
  const fileMap = new Map<string, string>();

  // Add all collected files
  for (const file of loaded.files) {
    const safePath = sanitizeRelativePath(file.relativePath);
    if (safePath) {
      fileMap.set(safePath, file.content);
    }
  }

  // Ensure plugin.json exists
  const pluginJsonPath = fileMap.has('.claude-plugin/plugin.json')
    ? '.claude-plugin/plugin.json'
    : fileMap.has('plugin.json')
      ? 'plugin.json'
      : null;

  const pluginManifest: Record<string, unknown> = pluginJsonPath
    ? (JSON.parse(fileMap.get(pluginJsonPath) || '{}') as Record<string, unknown>)
    : buildFallbackManifest(loaded.manifest);

  if (!pluginJsonPath) {
    fileMap.set('.claude-plugin/plugin.json', JSON.stringify(pluginManifest, null, 2));
  }

  // Ensure README exists
  const readmePath = fileMap.has('README.md')
    ? 'README.md'
    : fileMap.has('readme.md')
      ? 'readme.md'
      : null;

  const readme = readmePath
    ? (fileMap.get(readmePath) || loaded.readme)
    : loaded.readme;

  if (!readmePath) {
    fileMap.set('README.md', readme);
  }

  return {
    files: Array.from(fileMap.entries()).map(([relativePath, content]) => ({
      relativePath,
      content,
    })),
    pluginManifest,
    readme,
    source: {
      kind: 'local' as const,
      path: loaded.sourcePath,
      isDevMode: loaded.isDevMode,
    },
  };
}

function buildFallbackManifest(manifest: LocalPluginManifest): Record<string, unknown> {
  return {
    $schema: CLAUDE_PLUGIN_SCHEMA_URL,
    name: slugifyPluginName(manifest.name),
    description: manifest.description || 'Local development plugin',
    version: manifest.version || '1.0.0',
    author: manifest.author || 'Local Developer',
    category: manifest.category || 'development',
    ...(manifest.tags && manifest.tags.length > 0 ? { tags: manifest.tags } : {}),
  };
}
