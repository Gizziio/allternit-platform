/**
 * PluginManager
 * 
 * 3-pane layout:
 * - Left Pane: 7 tabs (Skills, Commands, CLI Tools, Plugins, MCPs, Webhooks, Connectors)
 * - Middle Pane: Search + item list with nested file tree
 * - Right Pane: Detail view with toggle, metadata, file preview
 * 
 * Features:
 * - Full-screen overlay with backdrop blur
 * - Toggle in 3rd pane
 * - Human/Code view toggle
 * - Browse plugins overlay for Plugins tab
 * - Real file loading and persistence
 * - Keyboard shortcuts (Cmd+W, arrow keys, Cmd+F)
 * - Right-click context menus
 * - Syntax highlighting
 * - Error boundaries and toast notifications
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import {
  X,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Eye,
  Code,
  Copy,
  MoreHorizontal,
  Terminal,
  Puzzle,
  Plug,
  Server,
  Webhook,
  Sparkles,
  Grid,
  Check,
  Command,
  BookOpen,
  Wrench,
  Cpu,
  Shield,
  Settings,
  Info,
  ExternalLink,
  Download,
  RefreshCw,
  Loader2,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit3,
  Upload,
  FileCode,
  GitBranch,
  Package,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { useFileSystem, type FileSystemAPI } from '../../plugins/fileSystem';
import type { SimpleCapability, FileNode, MarketplacePlugin } from '../../plugins/capability.types';
import { AddCapabilityForm, type CapabilityFormPayload } from './AddCapabilityForms';
import { useCliToolsApi } from '../../plugins/useCliToolsApi';
import { useKeyboardShortcuts, useDebouncedValue, useFocusManager } from './useKeyboardShortcuts';
import { useContextMenu, ContextMenu } from './useContextMenu.tsx';
import { SyntaxHighlighter, MarkdownRenderer } from './SyntaxHighlighter';
import { ErrorBoundary, useErrorToast, ErrorToastContainer } from './ErrorBoundary';
import {
  subscribeToUpdates,
  dismissUpdate,
  triggerUpdateCheck,
  type UpdateInfo,
} from '../../plugins/updateChecker';
import { UpdateBadge } from '../../components/UpdateBadge';
import { UpdateNotification } from '../../components/UpdateNotification';
import { UpdateModal } from '../../components/UpdateModal';
import {
  searchMarketplace,
  PLUGIN_CATEGORIES,
  fetchPluginFromGitHub,
  fetchConnectorMarketplaceCatalog,
  fetchExternalMarketplaceDirectories,
  CURATED_MARKETPLACE_SOURCES,
  type ConnectorMarketplaceCatalogItem,
  type ExternalMarketplaceDirectoryEntry,
} from '../../plugins/marketplaceApi';
import { enable as enableCapabilityState, disable as disableCapabilityState } from '../../plugins/capabilityEnabled.store';
import { PluginManifestValidator } from '../../components/PluginManifestValidator';
import { StarRating } from '../../components/StarRating';
import { PluginReviews } from '../../components/PluginReviews';
import { getRatingSummary } from '../../plugins/reviews';
import {
  resolveDependencies,
  checkDependencies,
  type DependencyResolutionResult,
  type DependencyConflict,
} from '../../plugins/dependencies';
import { DependencyTree } from '../../components/DependencyTree';
import { DependencyModal } from '../../components/DependencyModal';
import { DependencyConflictModal } from '../../components/DependencyConflictModal';

// ============================================================================
// Theme
// ============================================================================

const THEME = {
  bg: '#0c0a09',
  bgDeep: '#080706',
  bgElevated: '#1c1917',
  bgGlass: 'rgba(28, 25, 23, 0.85)',
  paneSurface: 'rgba(21, 18, 16, 0.82)',
  paneSurfaceStrong: 'rgba(16, 14, 12, 0.84)',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  accentGlow: 'rgba(212, 176, 140, 0.3)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

// ============================================================================
// Types
// ============================================================================

export type TabId = 'skills' | 'commands' | 'cli-tools' | 'plugins' | 'mcps' | 'webhooks' | 'connectors';

export type Capability = SimpleCapability;
export type { FileNode, MarketplacePlugin };

interface PluginManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'skills', label: 'Skills', icon: BookOpen },
  { id: 'commands', label: 'Commands', icon: Command },
  { id: 'cli-tools', label: 'CLI Tools', icon: Terminal },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'mcps', label: 'MCPs', icon: Cpu },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'connectors', label: 'Connectors', icon: Plug },
];

const TAB_ICON: Record<TabId, string> = {
  skills: 'book-open',
  commands: 'command',
  'cli-tools': 'terminal',
  plugins: 'puzzle',
  mcps: 'cpu',
  webhooks: 'webhook',
  connectors: 'plug',
};

// ============================================================================
// Storage Keys
// ============================================================================

const ENABLED_OVERRIDES_STORAGE_KEY = 'a2r:plugin-manager:enabled-overrides:v1';
const CUSTOM_CAPABILITIES_STORAGE_KEY = 'a2r:plugin-manager:custom-capabilities:v1';
const MARKETPLACE_INSTALLS_STORAGE_KEY = 'a2r:plugin-manager:marketplace-installs:v1';
const PERSONAL_MARKETPLACE_STORAGE_KEY = 'a2r:plugin-manager:personal-marketplaces:v1';
const CONNECTOR_CONNECTIONS_STORAGE_KEY = 'a2r:plugin-manager:connector-connections:v1';
const CURATED_SOURCE_SETTINGS_STORAGE_KEY = 'a2r:plugin-manager:curated-source-settings:v1';
const ALLOW_UNTRUSTED_MARKETPLACE_STORAGE_KEY = 'a2r:plugin-manager:allow-untrusted-marketplace:v1';
const PLUGIN_MANAGER_STATE_DIR = '.a2r/plugin-manager';
const PLUGIN_MANAGER_STATE_FILE = 'ui-state.json';
const PLUGIN_MANAGER_STATE_VERSION = 1;
const SKILL_IMPORT_DIR = '.a2r/skills';

const LEFT_PANE_TOP_OFFSET = 98;

type ConnectorGroupId = 'desktop' | 'connected' | 'not-connected';
type ConnectorMarketplaceTab = 'featured' | 'all';
type PluginMarketplaceTab = 'marketplace' | 'personal' | 'directories' | 'publish';
type PersonalMarketplaceType = 'github' | 'url' | 'upload' | 'local';
type ConnectorConnectionStatus = 'connected' | 'not-connected' | 'connecting';

type ConnectorMarketplaceItem = ConnectorMarketplaceCatalogItem;

interface PersonalMarketplaceSource {
  id: string;
  type: PersonalMarketplaceType;
  value: string;
  createdAt: string;
  label?: string;
  isDevMode?: boolean;
}

interface ConnectorConnectionState {
  status: ConnectorConnectionStatus;
  accountLabel?: string;
  connectedAt?: string;
  lastAttemptAt?: string;
}

interface PluginManagerPersistedState {
  version: number;
  updatedAt: string;
  enabledOverrides: Record<string, boolean>;
  marketplaceInstalledIds: string[];
  personalMarketplaceSources: PersonalMarketplaceSource[];
  connectorConnections: Record<string, ConnectorConnectionState>;
  curatedSourceEnabled: Record<string, boolean>;
  allowUntrustedMarketplaceSources: boolean;
}

interface CreateMenuAction {
  id: string;
  label: string;
  onClick: () => void;
}

const CONNECTOR_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Type' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'development', label: 'Development' },
  { value: 'data', label: 'Data' },
  { value: 'business', label: 'Business' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// Utility Functions
// ============================================================================

const safeJSONParse = <T,>(raw: string | null, defaultValue: T): T => {
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('[PluginManager] Failed to parse JSON from localStorage:', error);
    return defaultValue;
  }
};

function normalizeEnabledOverrides(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: Record<string, boolean> = {};
  for (const [key, entryValue] of entries) {
    if (typeof entryValue === 'boolean') {
      normalized[key] = entryValue;
    }
  }
  return normalized;
}

function loadEnabledOverrides(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(ENABLED_OVERRIDES_STORAGE_KEY);
  return normalizeEnabledOverrides(safeJSONParse(raw, {}));
}

function saveEnabledOverrides(overrides: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENABLED_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore quota/storage errors in UI.
  }
}

function createDefaultCuratedSourceEnabled(): Record<string, boolean> {
  return Object.fromEntries(
    CURATED_MARKETPLACE_SOURCES.map((source) => [source.id, source.trust !== 'community']),
  );
}

function normalizeCuratedSourceEnabled(value: unknown): Record<string, boolean> {
  const defaults = createDefaultCuratedSourceEnabled();
  if (!value || typeof value !== 'object') return defaults;
  const normalized = { ...defaults };
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawValue === 'boolean') {
      normalized[key] = rawValue;
    }
  }
  return normalized;
}

function loadCuratedSourceEnabled(): Record<string, boolean> {
  if (typeof window === 'undefined') return createDefaultCuratedSourceEnabled();
  const raw = window.localStorage.getItem(CURATED_SOURCE_SETTINGS_STORAGE_KEY);
  return normalizeCuratedSourceEnabled(safeJSONParse(raw, createDefaultCuratedSourceEnabled()));
}

function saveCuratedSourceEnabled(value: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CURATED_SOURCE_SETTINGS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore quota/storage errors in UI.
  }
}

function loadAllowUntrustedMarketplaceSources(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(ALLOW_UNTRUSTED_MARKETPLACE_STORAGE_KEY);
    if (raw === null) return false;
    return raw === '1';
  } catch {
    return false;
  }
}

function saveAllowUntrustedMarketplaceSources(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ALLOW_UNTRUSTED_MARKETPLACE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Ignore quota/storage errors in UI.
  }
}

function normalizePersonalMarketplaceSources(value: unknown): PersonalMarketplaceSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((source): source is PersonalMarketplaceSource => {
    return (
      typeof source === 'object' &&
      source !== null &&
      typeof source.id === 'string' &&
      (source.type === 'github' || source.type === 'url' || source.type === 'upload' || source.type === 'local') &&
      typeof source.value === 'string' &&
      typeof source.createdAt === 'string' &&
      (typeof source.label === 'undefined' || typeof source.label === 'string') &&
      (typeof source.isDevMode === 'undefined' || typeof source.isDevMode === 'boolean')
    );
  });
}

function loadPersonalMarketplaceSources(): PersonalMarketplaceSource[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(PERSONAL_MARKETPLACE_STORAGE_KEY);
  return normalizePersonalMarketplaceSources(safeJSONParse(raw, []));
}

function savePersonalMarketplaceSources(sources: PersonalMarketplaceSource[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERSONAL_MARKETPLACE_STORAGE_KEY, JSON.stringify(sources));
  } catch {
    // Ignore quota/storage errors in UI.
  }
}

function normalizeConnectorConnections(value: unknown): Record<string, ConnectorConnectionState> {
  if (typeof value !== 'object' || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: Record<string, ConnectorConnectionState> = {};
  for (const [key, entryValue] of entries) {
    if (typeof entryValue !== 'object' || entryValue === null) continue;
    const state = entryValue as Partial<ConnectorConnectionState>;
    if (state.status !== 'connected' && state.status !== 'not-connected' && state.status !== 'connecting') {
      continue;
    }
    normalized[key] = {
      status: state.status,
      accountLabel: typeof state.accountLabel === 'string' ? state.accountLabel : undefined,
      connectedAt: typeof state.connectedAt === 'string' ? state.connectedAt : undefined,
      lastAttemptAt: typeof state.lastAttemptAt === 'string' ? state.lastAttemptAt : undefined,
    };
  }
  return normalized;
}

function loadConnectorConnections(): Record<string, ConnectorConnectionState> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(CONNECTOR_CONNECTIONS_STORAGE_KEY);
  return normalizeConnectorConnections(safeJSONParse(raw, {}));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function resolvePluginManagerStatePaths(fs: FileSystemAPI): { dirPath: string; filePath: string } | null {
  if (typeof fs.join !== 'function' || typeof fs.getHomeDir !== 'function') return null;
  const homeDir = fs.getHomeDir();
  if (!homeDir || typeof homeDir !== 'string') return null;
  const dirPath = fs.join(homeDir, PLUGIN_MANAGER_STATE_DIR);
  const filePath = fs.join(dirPath, PLUGIN_MANAGER_STATE_FILE);
  return { dirPath, filePath };
}

function canPersistStateToFile(fs: FileSystemAPI): boolean {
  return (
    typeof fs.readFile === 'function' &&
    typeof fs.writeFile === 'function' &&
    typeof fs.mkdir === 'function'
  );
}

function saveConnectorConnections(connections: Record<string, ConnectorConnectionState>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONNECTOR_CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  } catch {
    // Ignore quota/storage errors in UI.
  }
}

function isDesktopConnector(item: Capability): boolean {
  const target = `${item.name} ${item.appName || ''}`.toLowerCase();
  return (
    target.includes('chrome') ||
    target.includes('desktop')
  );
}

function createPersonalSourceId(type: PersonalMarketplaceType): string {
  return `personal-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeMarketplacePluginPayload(
  payload: unknown,
  fallback: Partial<MarketplacePlugin>
): MarketplacePlugin | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallback.id;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : fallback.name;
  if (!id || !name) return null;

  let author = fallback.author || 'Personal source';
  if (typeof raw.author === 'string' && raw.author.trim()) {
    author = raw.author.trim();
  } else if (
    raw.author &&
    typeof raw.author === 'object' &&
    typeof (raw.author as Record<string, unknown>).name === 'string' &&
    ((raw.author as Record<string, unknown>).name as string).trim()
  ) {
    author = ((raw.author as Record<string, unknown>).name as string).trim();
  }

  return {
    id,
    name,
    description: typeof raw.description === 'string' ? raw.description : (fallback.description || ''),
    version: typeof raw.version === 'string' ? raw.version : (fallback.version || 'unknown'),
    author,
    icon: typeof raw.icon === 'string' ? raw.icon : (fallback.icon || 'puzzle'),
    category: typeof raw.category === 'string' ? raw.category : (fallback.category || 'personal'),
    installCount: typeof raw.installCount === 'number' ? raw.installCount : (fallback.installCount || 0),
    rating: typeof raw.rating === 'number' ? raw.rating : (fallback.rating || 0),
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((tag): tag is string => typeof tag === 'string')
      : fallback.tags,
    sourceLabel: typeof raw.sourceLabel === 'string' ? raw.sourceLabel : fallback.sourceLabel,
    sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : fallback.sourceId,
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : fallback.sourceUrl,
    sourceTrust:
      raw.sourceTrust === 'official' || raw.sourceTrust === 'verified' || raw.sourceTrust === 'community' || raw.sourceTrust === 'unknown'
        ? raw.sourceTrust
        : fallback.sourceTrust,
    sourceKind:
      raw.sourceKind === 'curated' || raw.sourceKind === 'api' || raw.sourceKind === 'github' || raw.sourceKind === 'personal'
        ? raw.sourceKind
        : fallback.sourceKind,
    sourceDescriptor:
      typeof raw.sourceDescriptor === 'string'
        ? raw.sourceDescriptor
        : (raw.sourceDescriptor && typeof raw.sourceDescriptor === 'object')
          ? (raw.sourceDescriptor as MarketplacePlugin['sourceDescriptor'])
          : fallback.sourceDescriptor,
    sourceRepo: typeof raw.sourceRepo === 'string' ? raw.sourceRepo : fallback.sourceRepo,
    sourceRef: typeof raw.sourceRef === 'string' ? raw.sourceRef : fallback.sourceRef,
    sourcePath: typeof raw.sourcePath === 'string' ? raw.sourcePath : fallback.sourcePath,
    installed: false,
  };
}

export function parseGitHubRepoRef(value: string): { owner: string; repo: string } | null {
  const match = value.trim().match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
}

function parseComparableVersion(value: string | undefined): number[] | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^v/i, '');
  if (!normalized) return null;
  const main = normalized.split('-')[0];
  const parts = main.split('.');
  if (parts.length === 0) return null;
  const parsed = parts.map((part) => Number.parseInt(part, 10));
  if (parsed.some((part) => Number.isNaN(part))) return null;
  return parsed;
}

export function isVersionNewer(remoteVersion: string | undefined, localVersion: string | undefined): boolean {
  const remoteParts = parseComparableVersion(remoteVersion);
  const localParts = parseComparableVersion(localVersion);
  if (!remoteParts || !localParts) return false;

  const maxLength = Math.max(remoteParts.length, localParts.length);
  for (let i = 0; i < maxLength; i += 1) {
    const remote = remoteParts[i] || 0;
    const local = localParts[i] || 0;
    if (remote > local) return true;
    if (remote < local) return false;
  }
  return false;
}

function isPluginBlockedByTrustPolicy(plugin: MarketplacePlugin, allowUntrusted: boolean): boolean {
  if (allowUntrusted) return false;
  const untrustedByKind = plugin.sourceKind === 'personal';
  const untrustedByTrust = plugin.sourceTrust === 'community' || plugin.sourceTrust === 'unknown';
  return untrustedByKind || untrustedByTrust;
}

function findFileNodeByName(nodes: FileNode[] | undefined, matcher: RegExp): FileNode | null {
  if (!nodes || nodes.length === 0) return null;
  for (const node of nodes) {
    if (node.type === 'file' && matcher.test(node.name)) {
      return node;
    }
    if (node.children?.length) {
      const found = findFileNodeByName(node.children, matcher);
      if (found) return found;
    }
  }
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';
}

export function detectLanguageFromName(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    md: 'markdown',
    json: 'json',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    html: 'html',
    htm: 'html',
    css: 'css',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    txt: 'text',
  };
  return map[ext || ''];
}

function normalizeArchivePath(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return null;
  const parts = normalized.split('/').filter((part) => part.length > 0 && part !== '.');
  if (parts.some((part) => part === '..')) return null;
  return parts.join('/');
}

function isTextArchiveFile(path: string): boolean {
  const lower = path.toLowerCase();
  const textExtensions = [
    '.md',
    '.txt',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.cfg',
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.css',
    '.html',
    '.htm',
    '.xml',
    '.sh',
    '.zsh',
    '.bash',
    '.py',
    '.rs',
    '.go',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.sql',
    '.env',
    '.gitignore',
  ];
  return textExtensions.some((ext) => lower.endsWith(ext));
}

function collectPluginRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const asRecord = payload as Record<string, unknown>;
    if (Array.isArray(asRecord.plugins)) return asRecord.plugins;
  }
  return [payload];
}

async function extractSkillFromZip(file: File): Promise<{
  name: string;
  description: string;
  skillContent: string;
  bundledFiles: Array<{ relativePath: string; content: string }>;
}> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({ entry, path: normalizeArchivePath(entry.name) }))
    .filter((entry): entry is { entry: JSZip.JSZipObject; path: string } => Boolean(entry.path));

  const skillEntry = entries.find(({ path }) => path.toLowerCase().endsWith('/skill.md') || path.toLowerCase() === 'skill.md');
  if (!skillEntry) {
    throw new Error('Archive must include a SKILL.md file.');
  }

  const skillContent = await skillEntry.entry.async('string');
  const skillDirPrefix = skillEntry.path.includes('/') ? skillEntry.path.slice(0, skillEntry.path.lastIndexOf('/') + 1) : '';
  const heading = skillContent.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const folderHint = skillDirPrefix.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ').trim();
  const fallbackName = file.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim();
  const name = heading || folderHint || fallbackName || 'Imported Skill';
  const firstBodyLine = skillContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'));
  const description = firstBodyLine || `Imported from ${file.name}`;

  const bundledFiles: Array<{ relativePath: string; content: string }> = [];
  for (const { entry, path } of entries) {
    if (path === skillEntry.path) continue;
    if (skillDirPrefix && !path.startsWith(skillDirPrefix)) continue;
    const relativePath = (skillDirPrefix ? path.slice(skillDirPrefix.length) : path).replace(/^\/+/, '');
    if (!relativePath || !isTextArchiveFile(relativePath)) continue;
    try {
      const content = await entry.async('string');
      bundledFiles.push({ relativePath, content });
    } catch {
      // Skip binary or unreadable payloads.
    }
  }

  return {
    name,
    description,
    skillContent,
    bundledFiles,
  };
}

async function extractPluginRecordsFromZip(file: File): Promise<unknown[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({ entry, path: normalizeArchivePath(entry.name) }))
    .filter((entry): entry is { entry: JSZip.JSZipObject; path: string } => Boolean(entry.path));

  const preferred = entries
    .filter(({ path }) => {
      const lower = path.toLowerCase();
      return (
        lower.endsWith('plugin.json') ||
        lower.endsWith('marketplace.json') ||
        lower.endsWith('manifest.json') ||
        lower.endsWith('.json')
      );
    })
    .sort((a, b) => {
      const score = (p: string) => {
        const lower = p.toLowerCase();
        if (lower.endsWith('plugin.json')) return 0;
        if (lower.endsWith('marketplace.json')) return 1;
        if (lower.endsWith('manifest.json')) return 2;
        return 3;
      };
      return score(a.path) - score(b.path);
    });

  const records: unknown[] = [];
  for (const { entry } of preferred) {
    try {
      const raw = await entry.async('string');
      const parsed = safeJSONParse<unknown>(raw, {});
      records.push(...collectPluginRecords(parsed));
    } catch {
      // Ignore malformed JSON files and continue scanning.
    }
  }

  if (records.length === 0) {
    throw new Error('No plugin manifest JSON files were found in this archive.');
  }

  return records;
}

function buildCapabilityFromForm(tab: TabId, payload: CapabilityFormPayload): Capability {
  const name = payload.name.trim() || 'Untitled';
  const now = new Date().toISOString();
  const base: Capability = {
    id: `custom-${tab}-${slugify(name)}-${Date.now()}`,
    name,
    description: payload.description?.trim() || `${name} (${tab})`,
    icon: TAB_ICON[tab],
    enabled: true,
    version: '1.0.0',
    author: 'User',
    updatedAt: now,
    content: payload.content,
  };

  if (tab === 'commands') {
    return {
      ...base,
      trigger: payload.trigger?.trim() || `/${slugify(name)}`,
      content: payload.content || payload.description || '',
    };
  }

  if (tab === 'connectors') {
    return {
      ...base,
      appName: payload.appName?.trim() || name,
      content: payload.description || '',
    };
  }

  if (tab === 'cli-tools') {
    return {
      ...base,
      command: payload.command?.trim() || slugify(name),
      content: payload.description || '',
    };
  }

  if (tab === 'mcps') {
    return {
      ...base,
      content: JSON.stringify(
        {
          name,
          description: payload.description || '',
          command: payload.command || '',
          args: payload.args || [],
        },
        null,
        2
      ),
      language: 'json',
    };
  }

  if (tab === 'webhooks') {
    return {
      ...base,
      content: JSON.stringify(
        {
          name,
          description: payload.description || '',
          path: payload.path || '',
          eventType: payload.eventType || '',
          connectedSkill: payload.connectedSkill || '',
        },
        null,
        2
      ),
      language: 'json',
    };
  }

  if (tab === 'plugins') {
    return {
      ...base,
      files: [
        {
          id: `custom-plugin-root-${Date.now()}`,
          name: slugify(name),
          type: 'directory',
          path: '/',
          expanded: true,
          children: [
            {
              id: `custom-plugin-json-${Date.now()}`,
              name: 'plugin.json',
              type: 'file',
              path: '/plugin.json',
              language: 'json',
              content: JSON.stringify(
                {
                  id: slugify(name),
                  name,
                  description: payload.description || '',
                  version: '1.0.0',
                  author: 'User',
                  enabled: true,
                },
                null,
                2
              ),
            },
          ],
        },
      ],
    };
  }

  return {
    ...base,
    content: payload.content || payload.description || '',
  };
}

function capabilityTypeFromTab(
  tab: TabId
): 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin' {
  switch (tab) {
    case 'skills':
      return 'skill';
    case 'commands':
      return 'command';
    case 'connectors':
      return 'connector';
    case 'mcps':
      return 'mcp';
    case 'cli-tools':
      return 'cli-tool';
    case 'webhooks':
      return 'webhook';
    case 'plugins':
      return 'plugin';
    default:
      return 'plugin';
  }
}

// ============================================================================
// Icon Mapping
// ============================================================================

const IconMap: Record<string, React.ElementType> = {
  'book-open': BookOpen,
  'command': Command,
  'terminal': Terminal,
  'puzzle': Puzzle,
  'cpu': Cpu,
  'webhook': Webhook,
  'plug': Plug,
  'file-text': FileText,
  'folder': Folder,
  'folder-open': FolderOpen,
  'settings': Settings,
  'shield': Shield,
  'wrench': Wrench,
};

function Icon({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const IconComponent = IconMap[name] || FileText;
  return <IconComponent size={size} color={color} />;
}

// ============================================================================
// Main Component
// ============================================================================

export function PluginManager({ isOpen, onClose, onOpenSettings }: PluginManagerProps) {
  return (
    <ErrorBoundary onClose={onClose}>
      <PluginManagerContent isOpen={isOpen} onClose={onClose} onOpenSettings={onOpenSettings} />
    </ErrorBoundary>
  );
}

function PluginManagerContent({ isOpen, onClose, onOpenSettings }: PluginManagerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('skills');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<'item' | 'file'>('item');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200);
  const [viewMode, setViewMode] = useState<'human' | 'code'>('human');
  const [showBrowseOverlay, setShowBrowseOverlay] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [enabledOverrides, setEnabledOverrides] = useState<Record<string, boolean>>(() => loadEnabledOverrides());
  const [marketplaceInstalledIds, setMarketplaceInstalledIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(MARKETPLACE_INSTALLS_STORAGE_KEY);
    return normalizeStringArray(safeJSONParse(raw, []));
  });
  const [personalMarketplaceSources, setPersonalMarketplaceSources] = useState<PersonalMarketplaceSource[]>(() => loadPersonalMarketplaceSources());
  const [connectorConnections, setConnectorConnections] = useState<Record<string, ConnectorConnectionState>>(() => loadConnectorConnections());
  const [curatedSourceEnabled, setCuratedSourceEnabled] = useState<Record<string, boolean>>(() => loadCuratedSourceEnabled());
  const [allowUntrustedMarketplaceSources, setAllowUntrustedMarketplaceSources] = useState<boolean>(() => loadAllowUntrustedMarketplaceSources());
  const [hasHydratedStateFile, setHasHydratedStateFile] = useState(false);
  const [createFormTab, setCreateFormTab] = useState<TabId | null>(null);
  const [showSkillUploadModal, setShowSkillUploadModal] = useState(false);
  const [isSkillUploadInProgress, setIsSkillUploadInProgress] = useState(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fileContentOverrides, setFileContentOverrides] = useState<Record<string, { content: string; language?: string }>>({});
  const [connectorActionInFlight, setConnectorActionInFlight] = useState<string | null>(null);
  const [connectorConnectDraft, setConnectorConnectDraft] = useState<{ id: string; name: string; accountLabel: string } | null>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const { searchInputRef, focusSearch } = useFocusManager();
  
  // Error toast system
  const { toasts, showError, showWarning, showInfo, dismissToast } = useErrorToast();

  // Update checking state
  const [availableUpdates, setAvailableUpdates] = useState<UpdateInfo[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateNotificationDismissed, setUpdateNotificationDismissed] = useState(false);

  // Dependency handling state
  const [pendingPluginInstall, setPendingPluginInstall] = useState<MarketplacePlugin | null>(null);
  const [dependencyResolution, setDependencyResolution] = useState<DependencyResolutionResult | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [showDependencyTree, setShowDependencyTree] = useState(false);
  const [activeConflict, setActiveConflict] = useState<DependencyConflict | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isInstallingDeps, setIsInstallingDeps] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installingDepName, setInstallingDepName] = useState<string>('');

  // Use file system integration with CRUD operations
  const {
    skills,
    commands,
    cliTools: scannedCliTools,
    plugins,
    mcps,
    webhooks,
    connectors,
    isLoading,
    error,
    refresh,
    installMarketplacePlugin,
    uninstallMarketplacePlugin,
    fs,
    createSkill,
    createCommand,
    createConnector,
    createMcp,
    createCliTool,
    createWebhook,
    createPlugin,
    updateCapabilityMetadata,
    updateFileContent,
    deleteCapability,
    createFileInTree,
    createDirectoryInTree,
    deleteFileInTree,
    renameFileInTree,
    toggleCapabilityEnabled,
  } = useFileSystem();

  // Subscribe to update notifications
  useEffect(() => {
    const unsubscribe = subscribeToUpdates((updates) => {
      setAvailableUpdates(updates);
    });
    return unsubscribe;
  }, []);

  // Check for updates on mount
  useEffect(() => {
    if (!isOpen) return;
    
    const checkUpdates = async () => {
      setIsCheckingForUpdates(true);
      try {
        const installedPluginsForUpdate = plugins
          .filter((p) => p.version && p.version !== 'unknown')
          .map((p) => ({
            id: p.id.startsWith('plugin-') ? p.id.slice('plugin-'.length) : p.id,
            name: p.name,
            version: p.version || '1.0.0',
          }));

        if (installedPluginsForUpdate.length > 0) {
          const result = await triggerUpdateCheck(installedPluginsForUpdate);
          if (result.updates.length > 0) {
            showInfo(`Found ${result.updates.length} plugin update${result.updates.length > 1 ? 's' : ''}`);
          }
        }
      } catch (error) {
        console.error('[PluginManager] Update check failed:', error);
      } finally {
        setIsCheckingForUpdates(false);
      }
    };

    void checkUpdates();
  }, [isOpen, plugins, showInfo]);

  // Handle update actions
  const handlePluginUpdateAction = async (update: UpdateInfo) => {
    try {
      // Find the plugin in marketplace
      const { searchMarketplace } = await import('../../plugins/marketplaceApi');
      const result = await searchMarketplace(update.pluginName, { perPage: 10 });
      const marketplacePlugin = result.plugins.find(
        (p) => p.name.toLowerCase() === update.pluginName.toLowerCase()
      );

      if (marketplacePlugin) {
        const installResult = await installMarketplacePlugin(marketplacePlugin);
        if (installResult.success) {
          showInfo(`Updated ${update.pluginName} to v${update.latestVersion}`);
          dismissUpdate(update.pluginId);
          await refresh();
        } else {
          showError(`Failed to update ${update.pluginName}: ${installResult.error}`);
        }
      } else {
        showError(`Plugin ${update.pluginName} not found in marketplace`);
      }
    } catch (error) {
      showError(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleUpdateAll = async (updates: UpdateInfo[]) => {
    for (const update of updates) {
      await handlePluginUpdateAction(update);
    }
  };

  const handleDismissUpdate = (update: UpdateInfo) => {
    dismissUpdate(update.pluginId);
    setAvailableUpdates((prev) => prev.filter((u) => u.pluginId !== update.pluginId));
  };

  const handleLaterUpdate = (update: UpdateInfo) => {
    // Just hide the notification, will show again on next check
    setAvailableUpdates((prev) => prev.filter((u) => u.pluginId !== update.pluginId));
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingForUpdates(true);
    try {
      const installedPluginsForUpdate = plugins
        .filter((p) => p.version && p.version !== 'unknown')
        .map((p) => ({
          id: p.id.startsWith('plugin-') ? p.id.slice('plugin-'.length) : p.id,
          name: p.name,
          version: p.version || '1.0.0',
        }));

      if (installedPluginsForUpdate.length === 0) {
        showInfo('No plugins with version information found');
        return;
      }

      const result = await triggerUpdateCheck(installedPluginsForUpdate);
      if (result.updates.length > 0) {
        showInfo(`Found ${result.updates.length} update${result.updates.length > 1 ? 's' : ''}`);
        setShowUpdateModal(true);
      } else {
        showInfo('All plugins are up to date');
      }
    } catch (error) {
      showError(`Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const {
    cliTools: apiCliTools,
    enabledIds: enabledCliToolIds,
    toggle: toggleCliToolApi,
  } = useCliToolsApi();

  const pluginManagerStatePaths = useMemo(() => {
    return resolvePluginManagerStatePaths(fs);
  }, [fs]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromStateFile = async () => {
      if (!pluginManagerStatePaths || !canPersistStateToFile(fs)) {
        if (!cancelled) setHasHydratedStateFile(true);
        return;
      }

      try {
        const raw = await fs.readFile(pluginManagerStatePaths.filePath);
        const parsed = safeJSONParse<Partial<PluginManagerPersistedState>>(raw, {});
        if (cancelled) return;
        setEnabledOverrides(normalizeEnabledOverrides(parsed.enabledOverrides));
        setMarketplaceInstalledIds(normalizeStringArray(parsed.marketplaceInstalledIds));
        setPersonalMarketplaceSources(normalizePersonalMarketplaceSources(parsed.personalMarketplaceSources));
        setConnectorConnections(normalizeConnectorConnections(parsed.connectorConnections));
        setCuratedSourceEnabled(normalizeCuratedSourceEnabled(parsed.curatedSourceEnabled));
        setAllowUntrustedMarketplaceSources(parsed.allowUntrustedMarketplaceSources === true);
      } catch {
        // Missing/invalid state file falls back to local storage defaults.
      } finally {
        if (!cancelled) setHasHydratedStateFile(true);
      }
    };

    void hydrateFromStateFile();

    return () => {
      cancelled = true;
    };
  }, [fs, pluginManagerStatePaths]);

  // Persist enabled overrides
  useEffect(() => {
    saveEnabledOverrides(enabledOverrides);
  }, [enabledOverrides]);

  // Persist marketplace installs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MARKETPLACE_INSTALLS_STORAGE_KEY, JSON.stringify(marketplaceInstalledIds));
    } catch {
      // Ignore
    }
  }, [marketplaceInstalledIds]);

  // Persist personal marketplace sources
  useEffect(() => {
    savePersonalMarketplaceSources(personalMarketplaceSources);
  }, [personalMarketplaceSources]);

  // Persist connector connection metadata
  useEffect(() => {
    saveConnectorConnections(connectorConnections);
  }, [connectorConnections]);

  useEffect(() => {
    saveCuratedSourceEnabled(curatedSourceEnabled);
  }, [curatedSourceEnabled]);

  useEffect(() => {
    saveAllowUntrustedMarketplaceSources(allowUntrustedMarketplaceSources);
  }, [allowUntrustedMarketplaceSources]);

  useEffect(() => {
    if (!hasHydratedStateFile) return;
    if (!pluginManagerStatePaths || !canPersistStateToFile(fs)) return;

    const payload: PluginManagerPersistedState = {
      version: PLUGIN_MANAGER_STATE_VERSION,
      updatedAt: new Date().toISOString(),
      enabledOverrides,
      marketplaceInstalledIds,
      personalMarketplaceSources,
      connectorConnections,
      curatedSourceEnabled,
      allowUntrustedMarketplaceSources,
    };

    const timeoutId = globalThis.setTimeout(() => {
      void (async () => {
        try {
          await fs.mkdir(pluginManagerStatePaths.dirPath);
          await fs.writeFile(pluginManagerStatePaths.filePath, JSON.stringify(payload, null, 2));
        } catch {
          // Keep local storage as fallback if filesystem persistence fails.
        }
      })();
    }, 180);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [
    connectorConnections,
    enabledOverrides,
    fs,
    hasHydratedStateFile,
    allowUntrustedMarketplaceSources,
    curatedSourceEnabled,
    marketplaceInstalledIds,
    personalMarketplaceSources,
    pluginManagerStatePaths,
  ]);

  useEffect(() => {
    setFileContentOverrides({});
  }, [activeTab, selectedItemId]);

  const withEnabledOverrides = (items: Capability[]): Capability[] =>
    items.map((item) => {
      const override = enabledOverrides[item.id];
      if (override === undefined) return item;
      return { ...item, enabled: override };
    });

  const apiCliToolsAsCapabilities = useMemo<Capability[]>(() => {
    return apiCliTools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      icon: 'terminal',
      enabled: enabledCliToolIds.has(tool.id),
      command: tool.command,
      version: tool.version,
      author: tool.author || 'System',
      updatedAt: tool.updatedAt || new Date().toISOString(),
      content: tool.description,
    }));
  }, [apiCliTools, enabledCliToolIds]);

  const mergedCliTools = useMemo<Capability[]>(() => {
    const mergedByName = new Map<string, Capability>();

    for (const tool of scannedCliTools) {
      mergedByName.set(tool.name.trim().toLowerCase(), tool);
    }

    for (const tool of apiCliToolsAsCapabilities) {
      const key = tool.name.trim().toLowerCase();
      const existing = mergedByName.get(key);
      if (!existing) {
        mergedByName.set(key, tool);
        continue;
      }

      mergedByName.set(key, {
        ...existing,
        ...tool,
        // Prefer richer scanner command path if API command is missing.
        command: tool.command || existing.command,
        description: tool.description || existing.description,
      });
    }

    return Array.from(mergedByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [apiCliToolsAsCapabilities, scannedCliTools]);

  const installedPluginVersions = useMemo<Record<string, string>>(() => {
    const versions: Record<string, string> = {};
    for (const pluginItem of plugins) {
      const rawId = pluginItem.id.startsWith('plugin-')
        ? pluginItem.id.slice('plugin-'.length)
        : pluginItem.id;
      if (!rawId) continue;
      if (pluginItem.version && pluginItem.version.trim()) {
        versions[rawId] = pluginItem.version.trim();
      }
    }
    return versions;
  }, [plugins]);

  // Get current tab data
  const getTabData = (): Capability[] => {
    switch (activeTab) {
      case 'skills': return withEnabledOverrides(skills);
      case 'commands': return withEnabledOverrides(commands);
      case 'cli-tools': return withEnabledOverrides(mergedCliTools);
      case 'plugins': return withEnabledOverrides(plugins);
      case 'mcps': return withEnabledOverrides(mcps);
      case 'webhooks': return withEnabledOverrides(webhooks);
      case 'connectors': return withEnabledOverrides(connectors);
    }
  };

  const tabData = getTabData();

  const connectorNameSet = useMemo(() => {
    return new Set(connectors.map((item) => item.name.toLowerCase()));
  }, [connectors]);

  const getConnectorGroupId = useCallback((item: Capability): ConnectorGroupId => {
    if (isDesktopConnector(item)) return 'desktop';
    const state = connectorConnections[item.id];
    if (state?.status === 'connected') return 'connected';
    if (state?.status === 'not-connected') return 'not-connected';
    return item.enabled ? 'connected' : 'not-connected';
  }, [connectorConnections]);

  const isConnectorConnected = useCallback((item: Capability): boolean => {
    const group = getConnectorGroupId(item);
    return group === 'desktop' || group === 'connected';
  }, [getConnectorGroupId]);
  
  // Fuzzy search
  const filteredData = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return tabData;
    const q = debouncedSearchQuery.toLowerCase();
    return tabData.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.content && item.content.toLowerCase().includes(q))
    );
  }, [tabData, debouncedSearchQuery]);

  const filteredItemIds = useMemo(() => filteredData.map((item) => item.id), [filteredData]);
  const filteredItemIdsKey = useMemo(() => filteredItemIds.join('|'), [filteredItemIds]);
  const filteredItemIdSet = useMemo(() => new Set(filteredItemIds), [filteredItemIdsKey]);
  const selectedItem = filteredData.find((item) => item.id === selectedItemId) || filteredData[0] || null;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isOpen,
    onClose,
    onFocusSearch: focusSearch,
    onNavigateUp: () => {
      const idx = filteredItemIds.indexOf(selectedItemId || '');
      if (idx > 0) {
        setSelectedItemId(filteredItemIds[idx - 1]);
        setSelectedFileId(null);
        setActiveSelection('item');
      }
    },
    onNavigateDown: () => {
      const idx = filteredItemIds.indexOf(selectedItemId || '');
      if (idx < filteredItemIds.length - 1) {
        setSelectedItemId(filteredItemIds[idx + 1]);
        setSelectedFileId(null);
        setActiveSelection('item');
      }
    },
    onNavigateLeft: () => {
      if (selectedFileId) {
        setSelectedFileId(null);
        setActiveSelection('item');
      }
    },
    onNavigateRight: () => {
      if (selectedItem?.files?.length && !selectedFileId) {
        const firstFile = selectedItem.files[0];
        if (firstFile) {
          setSelectedFileId(firstFile.id);
          setActiveSelection('file');
        }
      }
    },
    onEnter: () => {
      if (selectedItem) {
        handleToggle(selectedItem.id);
      }
    },
    onEscape: () => {
      if (showCreateMenu) setShowCreateMenu(false);
      if (showBrowseOverlay) setShowBrowseOverlay(false);
      if (createFormTab) setCreateFormTab(null);
      if (showSkillUploadModal) setShowSkillUploadModal(false);
      if (connectorConnectDraft) setConnectorConnectDraft(null);
      if (showDependencyTree) setShowDependencyTree(false);
      if (showDependencyModal) {
        setShowDependencyModal(false);
        setPendingPluginInstall(null);
        setDependencyResolution(null);
      }
      if (showConflictModal) {
        setShowConflictModal(false);
        setActiveConflict(null);
        setPendingPluginInstall(null);
        setDependencyResolution(null);
      }
      if (isEditing) {
        setIsEditing(false);
        setEditingContent(null);
      }
    },
    onCreateNew: () => setCreateFormTab(activeTab),
    onSave: () => {
      if (isEditing && editingContent !== null) {
        handleSaveEdit();
      }
    },
  });

  // Keep current selection if still valid
  useEffect(() => {
    if (filteredItemIds.length === 0) {
      if (selectedItemId !== null) setSelectedItemId(null);
      if (selectedFileId !== null) setSelectedFileId(null);
      if (activeSelection !== 'item') setActiveSelection('item');
      return;
    }

    if (selectedItemId && filteredItemIdSet.has(selectedItemId)) {
      return;
    }

    setSelectedItemId(filteredItemIds[0]);
    setSelectedFileId(null);
    setActiveSelection('item');
  }, [activeSelection, activeTab, filteredItemIdsKey, selectedItemId, selectedFileId, filteredItemIdSet]);

  // Auto-expand selected item's files
  useEffect(() => {
    if (!selectedItem?.files?.length) return;
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const node of selectedItem.files ?? []) {
        if (node.type === 'directory' && node.expanded && !next.has(node.id)) {
          next.add(node.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedItem]);

  const handleConnectorConnectFlow = useCallback(async (item: Capability, requestedAccountLabel?: string) => {
    if (isDesktopConnector(item)) {
      showInfo(`${item.appName || item.name} is included and always available.`);
      return;
    }

    const currentlyConnected = isConnectorConnected(item);
    let accountLabel: string | undefined = requestedAccountLabel?.trim() || undefined;

    if (!currentlyConnected && requestedAccountLabel === undefined) {
      setConnectorConnectDraft({
        id: item.id,
        name: item.appName || item.name,
        accountLabel: connectorConnections[item.id]?.accountLabel || '',
      });
      return;
    }

    if (currentlyConnected) {
      const proceed = window.confirm(`Disconnect ${item.appName || item.name}?`);
      if (!proceed) return;
    }

    const now = new Date().toISOString();
    const previous = connectorConnections[item.id];
    setConnectorActionInFlight(item.id);
    setConnectorConnections((prev) => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] || {}),
        status: 'connecting',
        lastAttemptAt: now,
      },
    }));

    const nextConnected = !currentlyConnected;
    const result = await toggleCapabilityEnabled('connector', item.id, nextConnected);
    if (!result.success) {
      showError(`Failed to update connector: ${result.error}`);
      setConnectorConnections((prev) => ({
        ...prev,
        [item.id]: {
          ...(previous || {}),
          status: currentlyConnected ? 'connected' : 'not-connected',
        },
      }));
      setConnectorActionInFlight(null);
      return;
    }

    setEnabledOverrides((prev) => ({
      ...prev,
      [item.id]: nextConnected,
    }));

    if (nextConnected) {
      enableCapabilityState('connector', item.id);
    } else {
      disableCapabilityState('connector', item.id);
    }

    setConnectorConnections((prev) => {
      if (!nextConnected) {
        return {
          ...prev,
          [item.id]: {
            status: 'not-connected',
            lastAttemptAt: now,
          },
        };
      }
      return {
        ...prev,
        [item.id]: {
          status: 'connected',
          accountLabel: accountLabel || prev[item.id]?.accountLabel,
          connectedAt: now,
          lastAttemptAt: now,
        },
      };
    });

    setConnectorActionInFlight(null);
    showInfo(nextConnected ? `Connected ${item.appName || item.name}` : `Disconnected ${item.appName || item.name}`);
  }, [connectorConnections, isConnectorConnected, showError, showInfo, toggleCapabilityEnabled]);

  const handleSubmitConnectorConnect = useCallback(async () => {
    if (!connectorConnectDraft) return;
    const item = connectors.find((connector) => connector.id === connectorConnectDraft.id);
    if (!item) {
      showWarning('Connector is no longer available.');
      setConnectorConnectDraft(null);
      return;
    }
    await handleConnectorConnectFlow(item, connectorConnectDraft.accountLabel);
    setConnectorConnectDraft(null);
  }, [connectorConnectDraft, connectors, handleConnectorConnectFlow, showWarning]);

  const handleToggle = async (itemId: string) => {
    if (activeTab === 'cli-tools' && apiCliToolsAsCapabilities.some((tool) => tool.id === itemId)) {
      toggleCliToolApi(itemId);
      return;
    }
    
    const item = tabData.find((entry) => entry.id === itemId);
    if (!item) return;

    if (activeTab === 'connectors') {
      await handleConnectorConnectFlow(item);
      return;
    }
    
    const newEnabled = !item.enabled;
    const capabilityType = capabilityTypeFromTab(activeTab);
    setEnabledOverrides((prev) => ({
      ...prev,
      [itemId]: newEnabled,
    }));

    if (newEnabled) {
      enableCapabilityState(capabilityType, itemId);
    } else {
      disableCapabilityState(capabilityType, itemId);
    }
    
    // Persist to file system
    const result = await toggleCapabilityEnabled(
      capabilityType,
      itemId,
      newEnabled
    );
    
    if (!result.success) {
      showError(`Failed to toggle: ${result.error}`);
      // Revert
      setEnabledOverrides((prev) => ({
        ...prev,
        [itemId]: item.enabled,
      }));
      if (item.enabled) {
        enableCapabilityState(capabilityType, itemId);
      } else {
        disableCapabilityState(capabilityType, itemId);
      }
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Find file content recursively
  const findFileContent = (files: FileNode[], fileId: string): FileNode | null => {
    for (const file of files) {
      if (file.id === fileId) return file;
      if (file.children) {
        const found = findFileContent(file.children, fileId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleCreateCapability = async (tab: TabId, payload: CapabilityFormPayload) => {
    let result;
    
    switch (tab) {
      case 'skills':
        result = await createSkill({
          name: payload.name,
          description: payload.description || '',
          content: payload.content || '',
          tags: payload.tags,
          category: payload.category,
        });
        break;
      case 'commands':
        result = await createCommand({
          name: payload.name,
          description: payload.description || '',
          trigger: payload.trigger || `/${slugify(payload.name)}`,
          triggerType: payload.triggerType,
          tags: payload.tags,
        });
        break;
      case 'connectors':
        result = await createConnector({
          name: payload.name,
          appName: payload.appName || payload.name,
          description: payload.description || '',
          authType: payload.authType,
          appUrl: payload.appUrl,
          tags: payload.tags,
        });
        break;
      case 'mcps':
        result = await createMcp({
          name: payload.name,
          description: payload.description || '',
          command: payload.command || '',
          args: payload.args,
          tags: payload.tags,
        });
        break;
      case 'cli-tools':
        result = await createCliTool({
          name: payload.name,
          description: payload.description || '',
          command: payload.command || slugify(payload.name),
          category: payload.category,
          tags: payload.tags,
        });
        break;
      case 'webhooks':
        result = await createWebhook({
          name: payload.name,
          description: payload.description || '',
          path: payload.path || '',
          eventType: payload.eventType,
          connectedSkill: payload.connectedSkill,
          tags: payload.tags,
        });
        break;
      case 'plugins':
        result = await createPlugin({
          name: payload.name,
          description: payload.description || '',
          content: payload.content,
          category: payload.category,
          tags: payload.tags,
          manifest: payload.pluginManifest,
          marketplaceManifest: payload.marketplaceManifest,
          files: payload.files,
        });
        break;
      default:
        showError(`Create is not supported for tab "${tab}".`);
        return;
    }
    
    if (result.success && result.capability) {
      showInfo(`${tab.slice(0, -1).replace('-', ' ')} created successfully`);
      setCreateFormTab(null);
      setSelectedItemId(result.capability.id);
      await refresh();
    } else {
      showError(`Failed to create: ${result.error}`);
    }
  };

  const handleImportFromText = (name: string, content: string) => {
    const payload: CapabilityFormPayload = {
      name,
      description: `Imported from ${name}`,
      content,
    };
    handleCreateCapability(activeTab, payload);
  };

  const handleImportFromFile = () => {
    setShowCreateMenu(false);
    fileImportRef.current?.click();
  };

  const handleImportFromUrl = () => {
    setShowCreateMenu(false);
    const url = window.prompt('Enter URL to import from');
    if (!url) return;
    void (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const text = await response.text();
        const fallbackName = url.split('/').pop() || `import-${activeTab}`;
        handleImportFromText(fallbackName, text);
      } catch (e) {
        showError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  };

  const handleCreateNew = () => {
    setShowCreateMenu(false);
    setCreateFormTab(activeTab);
  };

  const handleCreateSkillWithAssistant = () => {
    setShowCreateMenu(false);
    const nameInput = window.prompt('Skill name', 'New Skill');
    if (!nameInput || !nameInput.trim()) return;
    const name = nameInput.trim();

    const descriptionInput = window.prompt(`What should "${name}" do?`, '');
    if (descriptionInput === null) return;
    const description = descriptionInput.trim() || `Assist with ${name.toLowerCase()}.`;

    const content = [
      `# ${name}`,
      '',
      '## Purpose',
      description,
      '',
      '## Instructions',
      '- Clarify user intent before taking action.',
      '- Execute steps with deterministic output when possible.',
      '- Return concise results and include constraints or assumptions.',
    ].join('\n');

    void handleCreateCapability('skills', {
      name,
      description,
      content,
    });
  };

  const handleOpenSkillUploadModal = () => {
    setShowCreateMenu(false);
    setShowSkillUploadModal(true);
  };

  const handleUploadSkillFile = async (file: File) => {
    const extension = file.name.toLowerCase();
    if (!extension.endsWith('.md') && !extension.endsWith('.zip')) {
      showWarning('Upload a skill markdown file (.md) or skill bundle (.zip).');
      return;
    }

    setIsSkillUploadInProgress(true);
    try {
      if (extension.endsWith('.zip')) {
        const extracted = await extractSkillFromZip(file);
        await handleCreateCapability('skills', {
          name: extracted.name,
          description: extracted.description,
          content: extracted.skillContent,
        });

        if (extracted.bundledFiles.length > 0) {
          const homeDir = fs.getHomeDir();
          const skillDir = fs.join(homeDir, SKILL_IMPORT_DIR, slugify(extracted.name));
          for (const bundledFile of extracted.bundledFiles) {
            const normalizedRelative = bundledFile.relativePath.replace(/^\/+/, '');
            if (!normalizedRelative || normalizedRelative.includes('..')) continue;
            const targetPath = fs.join(skillDir, normalizedRelative);
            await fs.mkdir(fs.dirname(targetPath));
            await fs.writeFile(targetPath, bundledFile.content);
          }
          await refresh();
        }

        setShowSkillUploadModal(false);
        showInfo(
          extracted.bundledFiles.length > 0
            ? `Imported ${extracted.name} with ${extracted.bundledFiles.length} bundled file${extracted.bundledFiles.length === 1 ? '' : 's'}.`
            : `Imported ${extracted.name}`
        );
        return;
      }

      const content = await file.text();
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const fallbackName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
      const name = heading || fallbackName || 'Imported Skill';
      await handleCreateCapability('skills', {
        name,
        description: `Imported from ${file.name}`,
        content,
      });
      setShowSkillUploadModal(false);
      showInfo(`Imported ${name}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to import skill file.');
    } finally {
      setIsSkillUploadInProgress(false);
    }
  };

  const handleInstallPlugin = async (plugin: MarketplacePlugin) => {
    if (isPluginBlockedByTrustPolicy(plugin, allowUntrustedMarketplaceSources)) {
      showWarning('Installation blocked by source policy. Enable untrusted sources in marketplace settings to continue.');
      return;
    }

    // Check dependencies before installing
    const resolution = resolveDependencies(
      plugin.id,
      (id) => {
        // Check if this is the plugin being installed
        if (id === plugin.id) {
          return {
            id: plugin.id,
            version: plugin.version || '1.0.0',
            dependencies: plugin.dependencies,
          };
        }
        // Check if plugin exists in marketplace or is already installed
        const existingPlugin = plugins.find(p => p.id === `plugin-${id}` || p.id === id);
        if (existingPlugin) {
          return {
            id: existingPlugin.id.replace(/^plugin-/, ''),
            version: existingPlugin.version || '1.0.0',
            dependencies: undefined, // Would need to parse from manifest
          };
        }
        return undefined;
      },
      (id) => {
        // Get installed version (plugin being installed is not yet installed)
        if (id === plugin.id) return undefined;
        const existingPlugin = plugins.find(p => p.id === `plugin-${id}` || p.id === id);
        return existingPlugin?.version;
      }
    );

    // If there are missing dependencies or conflicts, show the dependency modal
    if (!resolution.satisfied || resolution.missing.length > 0 || resolution.conflicts.length > 0) {
      setPendingPluginInstall(plugin);
      setDependencyResolution(resolution);
      setShowDependencyModal(true);
      return;
    }

    // No dependency issues, proceed with installation
    await executePluginInstall(plugin);
  };

  const executePluginInstall = async (plugin: MarketplacePlugin) => {
    const result = await installMarketplacePlugin(plugin);
    if (!result.success) {
      showError(`Failed to install: ${result.error}`);
      return;
    }

    setMarketplaceInstalledIds((prev) => (prev.includes(plugin.id) ? prev : [...prev, plugin.id]));
    showInfo(`Installed ${plugin.name}`);
    await refresh();
    setSelectedItemId(`plugin-${plugin.id}`);
    setSelectedFileId(null);
    setShowBrowseOverlay(false);
  };

  const handleDependencyResolution = async (options: { 
    installOptional: boolean; 
    selectedDeps: string[];
  }) => {
    if (!pendingPluginInstall || !dependencyResolution) return;

    // Check for conflicts first
    if (dependencyResolution.conflicts.length > 0) {
      setActiveConflict(dependencyResolution.conflicts[0]);
      setShowConflictModal(true);
      setShowDependencyModal(false);
      return;
    }

    // Install dependencies if any
    if (options.selectedDeps.length > 0) {
      setIsInstallingDeps(true);
      setInstallProgress(0);
      
      for (let i = 0; i < options.selectedDeps.length; i++) {
        const depId = options.selectedDeps[i];
        setInstallingDepName(depId);
        setInstallProgress(Math.round((i / options.selectedDeps.length) * 100));
        
        // Note: In a real implementation, you would fetch the plugin info for the dependency
        // and install it. For now, we just simulate the progress.
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setIsInstallingDeps(false);
    }

    setShowDependencyModal(false);
    await executePluginInstall(pendingPluginInstall);
    setPendingPluginInstall(null);
    setDependencyResolution(null);
  };

  const handleConflictResolution = async (
    resolution: 'keep' | 'upgrade' | 'force' | 'cancel',
    options?: { upgradeAll?: boolean; forceVersion?: string }
  ) => {
    if (resolution === 'cancel') {
      setShowConflictModal(false);
      setActiveConflict(null);
      setPendingPluginInstall(null);
      setDependencyResolution(null);
      return;
    }

    setShowConflictModal(false);
    setActiveConflict(null);

    // Proceed with installation after conflict resolution
    if (pendingPluginInstall) {
      await executePluginInstall(pendingPluginInstall);
      setPendingPluginInstall(null);
      setDependencyResolution(null);
    }
  };

  const handleUpdatePlugin = async (plugin: MarketplacePlugin) => {
    if (isPluginBlockedByTrustPolicy(plugin, allowUntrustedMarketplaceSources)) {
      showWarning('Update blocked by source policy. Enable untrusted sources in marketplace settings to continue.');
      return;
    }

    const result = await installMarketplacePlugin(plugin);
    if (!result.success) {
      showError(`Failed to update: ${result.error}`);
      return;
    }

    setMarketplaceInstalledIds((prev) => (prev.includes(plugin.id) ? prev : [...prev, plugin.id]));
    showInfo(`Updated ${plugin.name}${plugin.version ? ` to v${plugin.version}` : ''}`);
    await refresh();
    if (selectedItemId === `plugin-${plugin.id}`) {
      setSelectedFileId(null);
    }
  };

  const handleUninstallPlugin = async (plugin: MarketplacePlugin) => {
    const result = await uninstallMarketplacePlugin(plugin.id);
    if (!result.success) {
      showError(`Failed to uninstall: ${result.error}`);
      return;
    }

    setMarketplaceInstalledIds((prev) => prev.filter((id) => id !== plugin.id));
    setEnabledOverrides((prev) => ({ ...prev, [`plugin-${plugin.id}`]: false }));
    if (selectedItemId === `plugin-${plugin.id}`) {
      setSelectedItemId(null);
      setSelectedFileId(null);
    }

    await refresh();
  };

  const handleInstallConnectorFromMarketplace = async (connector: ConnectorMarketplaceItem) => {
    const exists = connectors.some((item) => item.name.toLowerCase() === connector.name.toLowerCase());
    if (exists) {
      showWarning(`${connector.name} is already available in your connector list.`);
      setShowBrowseOverlay(false);
      return;
    }

    const result = await createConnector({
      name: connector.name,
      appName: connector.name,
      description: connector.description,
      authType: 'oauth',
      appUrl: `https://${connector.id.replace(/_/g, '-')}.com`,
      tags: [connector.category, connector.connectorType],
    });

    if (!result.success) {
      showError(`Failed to add connector: ${result.error}`);
      return;
    }

    await refresh();
    setShowBrowseOverlay(false);
    showInfo(`Added ${connector.name} connector`);
    setSelectedItemId(result.capability?.id || null);
    setSelectedFileId(null);
  };

  const handleOpenCreateConnector = () => {
    setShowBrowseOverlay(false);
    setCreateFormTab('connectors');
  };

  const handleAddPersonalMarketplaceSource = useCallback((source: Omit<PersonalMarketplaceSource, 'id' | 'createdAt'>) => {
    const normalizedValue = source.value.trim();
    if (!normalizedValue) return;
    const now = new Date().toISOString();
    setPersonalMarketplaceSources((prev) => {
      const duplicate = prev.find((entry) => entry.type === source.type && entry.value === normalizedValue);
      if (duplicate) return prev;
      return [
        ...prev,
        {
          id: createPersonalSourceId(source.type),
          type: source.type,
          value: normalizedValue,
          label: source.label?.trim() || undefined,
          createdAt: now,
        },
      ];
    });
  }, []);

  const handleRemovePersonalMarketplaceSource = useCallback((sourceId: string) => {
    setPersonalMarketplaceSources((prev) => prev.filter((source) => source.id !== sourceId));
  }, []);

  const createMenuActions = useMemo<CreateMenuAction[]>(() => {
    if (activeTab === 'skills') {
      return [
        { id: 'skills-create-assistant', label: 'Create with assistant', onClick: handleCreateSkillWithAssistant },
        { id: 'skills-write', label: 'Write skill instructions', onClick: handleCreateNew },
        { id: 'skills-upload', label: 'Upload skill', onClick: handleOpenSkillUploadModal },
      ];
    }

    return [
      { id: 'default-create', label: 'Create new', onClick: handleCreateNew },
      { id: 'default-import-file', label: 'Import from file', onClick: handleImportFromFile },
      { id: 'default-import-url', label: 'Import from URL', onClick: handleImportFromUrl },
    ];
  }, [
    activeTab,
    handleCreateNew,
    handleCreateSkillWithAssistant,
    handleImportFromFile,
    handleImportFromUrl,
    handleOpenSkillUploadModal,
  ]);

  const handleEditSelected = async () => {
    if (!selectedItem) return;

    if (selectedFile && selectedFile.content !== undefined) {
      setEditingContent(selectedFile.content);
      setIsEditing(true);
      return;
    }

    const nextDescription = window.prompt(`Edit description for ${selectedItem.name}`, selectedItem.description || '');
    if (nextDescription === null) return;

    const capabilityType = capabilityTypeFromTab(activeTab);

    const result = await updateCapabilityMetadata(capabilityType, selectedItem.id, {
      description: nextDescription,
    });
    if (!result.success) {
      showError(`Failed to update: ${result.error}`);
      return;
    }

    showInfo('Description updated');
  };

  const handleSaveEdit = async () => {
    if (!selectedFile || editingContent === null) return;
    
    const result = await updateFileContent(selectedFile.id, editingContent);
    if (result.success) {
      showInfo('File saved successfully');
      setIsEditing(false);
      setEditingContent(null);
      await refresh();
    } else {
      showError(`Failed to save: ${result.error}`);
    }
  };

  const handleCopySelected = async () => {
    const text = selectedFile?.content || selectedItem?.content || selectedItem?.description || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showInfo('Copied to clipboard');
    } catch (e) {
      showError('Failed to copy to clipboard');
    }
  };

  const handleOpenInVsCode = () => {
    const path = selectedFile?.id || selectedItem?.files?.[0]?.id;
    if (!path) return;
    window.open(`vscode://file${path}`);
  };

  const handleShowInFolder = () => {
    const path = selectedFile?.id || selectedItem?.files?.[0]?.id;
    if (!path) return;
    window.open(`file://${path}`);
  };

  const handleUninstallSelected = async () => {
    if (!selectedItem) return;
    
    if (!window.confirm(`Are you sure you want to delete "${selectedItem.name}"?`)) {
      return;
    }

    const result = await deleteCapability(
      capabilityTypeFromTab(activeTab),
      selectedItem.id
    );
    
    if (result.success) {
      showInfo('Deleted successfully');
      setSelectedItemId(null);
      setSelectedFileId(null);
      await refresh();
    } else {
      showError(`Failed to delete: ${result.error}`);
    }
  };

  // Context menu
  const { state: contextMenuState, menuRef: contextMenuRef, showContextMenu, hideContextMenu } = useContextMenu({});

  if (!isOpen) return null;

  const selectedFileRaw = selectedItem?.files && selectedFileId
    ? findFileContent(selectedItem.files, selectedFileId)
    : null;
  const selectedFileOverride = selectedFileId ? fileContentOverrides[selectedFileId] : undefined;
  const selectedFile = selectedFileRaw && selectedFileOverride
    ? {
        ...selectedFileRaw,
        content: selectedFileOverride.content,
        language: selectedFileRaw.language || selectedFileOverride.language,
      }
    : selectedFileRaw;
  const selectedConnectorGroup = selectedItem && activeTab === 'connectors'
    ? getConnectorGroupId(selectedItem)
    : null;
  const selectedConnectorConnection = selectedItem && activeTab === 'connectors'
    ? connectorConnections[selectedItem.id] || null
    : null;
  const selectedConnectorBusy = selectedItem && activeTab === 'connectors'
    ? connectorActionInFlight === selectedItem.id
    : false;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background:
          'radial-gradient(1200px 680px at 12% -10%, rgba(212, 176, 140, 0.17) 0%, rgba(212, 176, 140, 0) 62%), radial-gradient(900px 520px at 88% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 66%), linear-gradient(180deg, rgba(10, 9, 8, 0.96) 0%, rgba(7, 6, 5, 0.99) 100%)',
        backdropFilter: 'blur(20px)',
        zIndex: 100,
        display: 'block',
        overflow: 'hidden',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Plugin Manager"
    >
      <div style={{ display: 'flex', height: '100%', padding: 0, boxSizing: 'border-box' }}>
        {/* Left pane starts lower; middle/right stay top-aligned full height */}
        <LeftPane
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={onClose}
          onBrowsePlugins={() => setShowBrowseOverlay(true)}
          onCheckForUpdates={handleCheckForUpdates}
          updateCount={availableUpdates.length}
        />

        <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
          {/* Middle Pane - List with Search */}
          <MiddlePane
            activeTab={activeTab}
            items={filteredData}
            selectedItemId={selectedItemId}
            selectedFileId={selectedFileId}
            onSelectItem={(id) => {
              setSelectedItemId(id);
              setSelectedFileId(null);
              setActiveSelection('item');
            }}
            onSelectFile={(id) => {
              setSelectedFileId(id);
              setActiveSelection('file');
              void (async () => {
                const fileNode = selectedItem?.files ? findFileContent(selectedItem.files, id) : null;
                if (!fileNode || fileNode.type !== 'file') return;
                if (fileNode.content && fileNode.content.length > 0) return;
                try {
                  const content = await fs.readFile(fileNode.id);
                  setFileContentOverrides((prev) => ({
                    ...prev,
                    [id]: {
                      content,
                      language: fileNode.language || detectLanguageFromName(fileNode.name),
                    },
                  }));
                } catch {
                  // Keep empty-state rendering when file cannot be read.
                }
              })();
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchInputRef={searchInputRef}
            expandedNodes={expandedNodes}
            onToggleNode={toggleNode}
            onBrowsePlugins={() => setShowBrowseOverlay(true)}
            showCreateMenu={showCreateMenu}
            onToggleCreateMenu={() => setShowCreateMenu(!showCreateMenu)}
            onCloseCreateMenu={() => setShowCreateMenu(false)}
            createMenuActions={createMenuActions}
            isLoading={isLoading}
            error={error}
            onContextMenu={showContextMenu}
            onRefresh={refresh}
            onOpenSettings={onOpenSettings}
            getConnectorGroupId={getConnectorGroupId}
            activeSelection={activeSelection}
            updateCount={availableUpdates.length}
            onShowUpdateModal={() => setShowUpdateModal(true)}
          />

          {/* Right Pane - Detail */}
          {selectedItem ? (
            <RightPane
              item={selectedItem}
              selectedFile={selectedFile}
              itemType={activeTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onToggle={() => handleToggle(selectedItem.id)}
              onEdit={handleEditSelected}
              onCopy={handleCopySelected}
              onOpenInVsCode={handleOpenInVsCode}
              onShowInFolder={handleShowInFolder}
              onUninstall={handleUninstallSelected}
              isEditing={isEditing}
              editingContent={editingContent}
              onEditingContentChange={setEditingContent}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => {
                setIsEditing(false);
                setEditingContent(null);
              }}
              connectorGroupId={selectedConnectorGroup}
              connectorConnection={selectedConnectorConnection}
              connectorBusy={selectedConnectorBusy}
              onConnectorToggle={() => handleConnectorConnectFlow(selectedItem)}
            />
          ) : (
            <RightPaneEmptyState />
          )}
        </div>
      </div>

      {/* Browse Overlays */}
      {showBrowseOverlay && activeTab === 'plugins' && (
        <BrowsePluginsOverlay
          marketplaceInstalledIds={marketplaceInstalledIds}
          installedVersions={installedPluginVersions}
          curatedSourceEnabled={curatedSourceEnabled}
          allowUntrustedMarketplaceSources={allowUntrustedMarketplaceSources}
          onInstall={handleInstallPlugin}
          onUpdate={handleUpdatePlugin}
          onUninstall={handleUninstallPlugin}
          onSetCuratedSourceEnabled={setCuratedSourceEnabled}
          onSetAllowUntrustedMarketplaceSources={setAllowUntrustedMarketplaceSources}
          personalSources={personalMarketplaceSources}
          onAddPersonalSource={handleAddPersonalMarketplaceSource}
          onRemovePersonalSource={handleRemovePersonalMarketplaceSource}
          onClose={() => setShowBrowseOverlay(false)}
          fs={fs}
        />
      )}
      {showBrowseOverlay && activeTab === 'connectors' && (
        <BrowseConnectorsOverlay
          onClose={() => setShowBrowseOverlay(false)}
          onInstallConnector={handleInstallConnectorFromMarketplace}
          onCreateCustomConnector={handleOpenCreateConnector}
          existingConnectorNames={connectorNameSet}
        />
      )}

      {/* File Input */}
      <input
        ref={fileImportRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void (async () => {
            try {
              const text = await file.text();
              const name = file.name.replace(/\.[^/.]+$/, '') || file.name;
              handleImportFromText(name, text);
            } catch (e) {
              showError(`Failed to import: ${e instanceof Error ? e.message : String(e)}`);
            } finally {
              event.target.value = '';
            }
          })();
        }}
        aria-label="Import file"
      />

      {/* Create Form */}
      {createFormTab && (
        <AddCapabilityForm
          tab={createFormTab}
          label={TABS.find((tab) => tab.id === createFormTab)?.label || 'Capability'}
          onClose={() => setCreateFormTab(null)}
          onCreate={handleCreateCapability}
        />
      )}

      {showSkillUploadModal && (
        <SkillUploadModal
          onClose={() => setShowSkillUploadModal(false)}
          onUpload={handleUploadSkillFile}
          isUploading={isSkillUploadInProgress}
        />
      )}

      {connectorConnectDraft && (
        <ConnectorConnectModal
          connectorName={connectorConnectDraft.name}
          accountLabel={connectorConnectDraft.accountLabel}
          onAccountLabelChange={(next) =>
            setConnectorConnectDraft((prev) => (prev ? { ...prev, accountLabel: next } : prev))
          }
          onClose={() => setConnectorConnectDraft(null)}
          onConnect={() => void handleSubmitConnectorConnect()}
          isConnecting={connectorActionInFlight === connectorConnectDraft.id}
        />
      )}

      {/* Context Menu */}
      <ContextMenu
        state={contextMenuState}
        menuRef={contextMenuRef}
        actions={{
          onEdit: handleEditSelected,
          onDelete: handleUninstallSelected,
          onCopy: handleCopySelected,
          onToggleEnabled: () => selectedItem && handleToggle(selectedItem.id),
        }}
        onClose={hideContextMenu}
      />

      {/* Error Toasts */}
      <ErrorToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Update Notifications */}
      {!updateNotificationDismissed && (
        <UpdateNotification
          updates={availableUpdates}
          onUpdate={handlePluginUpdateAction}
          onDismiss={handleDismissUpdate}
          onLater={handleLaterUpdate}
          onShowAll={() => setShowUpdateModal(true)}
          maxVisible={3}
        />
      )}

      {/* Update Modal */}
      <UpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        updates={availableUpdates}
        onUpdate={handlePluginUpdateAction}
        onUpdateAll={handleUpdateAll}
        onSkip={handleDismissUpdate}
        onCheckForUpdates={handleCheckForUpdates}
        isChecking={isCheckingForUpdates}
      />

      {/* Dependency Modal */}
      {showDependencyModal && pendingPluginInstall && dependencyResolution && (
        <DependencyModal
          isOpen={showDependencyModal}
          plugin={{
            id: pendingPluginInstall.id,
            name: pendingPluginInstall.name,
            version: pendingPluginInstall.version,
            description: pendingPluginInstall.description,
            icon: pendingPluginInstall.icon,
          }}
          resolution={dependencyResolution}
          onConfirm={handleDependencyResolution}
          onCancel={() => {
            setShowDependencyModal(false);
            setPendingPluginInstall(null);
            setDependencyResolution(null);
          }}
          onViewTree={() => setShowDependencyTree(true)}
          isInstalling={isInstallingDeps}
          progress={installProgress}
          installingPluginName={installingDepName}
        />
      )}

      {/* Dependency Conflict Modal */}
      {showConflictModal && activeConflict && pendingPluginInstall && (
        <DependencyConflictModal
          isOpen={showConflictModal}
          conflict={activeConflict}
          installingPlugin={{
            id: pendingPluginInstall.id,
            name: pendingPluginInstall.name,
            version: pendingPluginInstall.version,
          }}
          onResolve={handleConflictResolution}
          onCancel={() => {
            setShowConflictModal(false);
            setActiveConflict(null);
            setPendingPluginInstall(null);
            setDependencyResolution(null);
          }}
        />
      )}

      {/* Dependency Tree View (when user clicks "View Tree") */}
      {showDependencyTree && dependencyResolution && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowDependencyTree(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              backgroundColor: THEME.bgGlass,
              border: `1px solid ${THEME.borderStrong}`,
              borderRadius: 12,
              padding: 20,
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>
                Dependency Tree
              </h3>
              <button
                onClick={() => setShowDependencyTree(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: THEME.textTertiary,
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <DependencyTree
              tree={dependencyResolution.tree}
              resolution={dependencyResolution}
              showOptional={true}
              defaultExpanded={true}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pm-list-row[data-selected="false"]:hover {
          background-color: rgba(255, 255, 255, 0.04) !important;
        }

        .pm-file-row[data-selected="false"]:hover {
          background-color: rgba(255, 255, 255, 0.035) !important;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Left Pane - 7 Tabs
// ============================================================================

function LeftPane({
  activeTab,
  onTabChange,
  onClose,
  onBrowsePlugins,
  onCheckForUpdates,
  updateCount,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onClose: () => void;
  onBrowsePlugins: () => void;
  onCheckForUpdates?: () => void;
  updateCount?: number;
}) {
  return (
    <nav
      style={{
        width: 224,
        marginLeft: 16,
        marginTop: LEFT_PANE_TOP_OFFSET,
        height: `calc(100% - ${LEFT_PANE_TOP_OFFSET}px)`,
        backgroundColor: 'transparent',
        backdropFilter: 'none',
        border: 'none',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 10px 14px',
        boxShadow: 'none',
        overflow: 'visible',
      }}
      aria-label="Capability categories"
    >
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'transparent',
            color: THEME.textSecondary,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Back"
        >
          <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: THEME.textPrimary }}>
          Plugin Manager
        </span>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: THEME.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 10,
          padding: '0 8px',
        }}
      >
        Categories
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 7,
                backgroundColor: isActive ? THEME.accentMuted : 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: 3,
                textAlign: 'left',
                transition: 'background-color 0.15s',
                width: '100%',
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <Icon
                size={16}
                color={isActive ? THEME.accent : THEME.textSecondary}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 450,
                  color: isActive ? THEME.textPrimary : THEME.textSecondary,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          borderTop: `1px solid ${THEME.border}`,
          paddingTop: 10,
          marginTop: 10,
        }}
      >
        <div style={{ fontSize: 11, color: THEME.textTertiary, lineHeight: 1.4, marginBottom: 8 }}>
          Discover installable capabilities and manage your active toolset.
        </div>
        <button
          onClick={onBrowsePlugins}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 7,
            border: `1px solid ${THEME.borderStrong}`,
            backgroundColor: THEME.accentMuted,
            color: THEME.textPrimary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: onCheckForUpdates ? 8 : 0,
          }}
        >
          Browse Marketplace
        </button>
        
        {onCheckForUpdates && (
          <button
            onClick={onCheckForUpdates}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 7,
              border: `1px solid ${updateCount && updateCount > 0 ? THEME.accent : THEME.border}`,
              backgroundColor: updateCount && updateCount > 0 ? 'rgba(212, 176, 140, 0.1)' : 'transparent',
              color: updateCount && updateCount > 0 ? THEME.accent : THEME.textSecondary,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={13} />
            Check for Updates
            {updateCount !== undefined && updateCount > 0 && (
              <span
                style={{
                  padding: '2px 6px',
                  backgroundColor: THEME.accent,
                  borderRadius: 10,
                  fontSize: 10,
                  color: '#0c0a09',
                  marginLeft: 4,
                }}
              >
                {updateCount}
              </span>
            )}
          </button>
        )}
      </div>
    </nav>
  );
}

// ============================================================================
// Middle Pane - Search + List + File Tree
// ============================================================================

function MiddlePane({
  activeTab,
  items,
  selectedItemId,
  selectedFileId,
  onSelectItem,
  onSelectFile,
  searchQuery,
  onSearchChange,
  searchInputRef,
  expandedNodes,
  onToggleNode,
  onBrowsePlugins,
  showCreateMenu,
  onToggleCreateMenu,
  onCloseCreateMenu,
  createMenuActions,
  isLoading,
  error,
  onContextMenu,
  onRefresh,
  onOpenSettings,
  getConnectorGroupId,
  activeSelection,
  updateCount,
  onShowUpdateModal,
}: {
  activeTab: TabId;
  items: Capability[];
  selectedItemId: string | null;
  selectedFileId: string | null;
  onSelectItem: (id: string) => void;
  onSelectFile: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  expandedNodes: Set<string>;
  onToggleNode: (id: string) => void;
  onBrowsePlugins: () => void;
  showCreateMenu: boolean;
  onToggleCreateMenu: () => void;
  onCloseCreateMenu: () => void;
  createMenuActions: CreateMenuAction[];
  isLoading: boolean;
  error: string | null;
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'directory' | 'capability', id: string, path?: string, name?: string) => void;
  onRefresh: () => Promise<void>;
  onOpenSettings?: () => void;
  getConnectorGroupId?: (item: Capability) => ConnectorGroupId;
  activeSelection: 'item' | 'file';
  updateCount: number;
  onShowUpdateModal: () => void;
}) {
  const groupedSections = useMemo(() => {
    if (activeTab === 'skills') {
      const isCoreSkill = (item: Capability) => {
        const author = (item.author || '').toLowerCase();
        if (author === 'system' || author === 'anthropic') return true;
        const name = item.name.toLowerCase();
        return name.startsWith('.') || name.includes('template');
      };
      const core = items.filter(isCoreSkill);
      const workspace = items.filter((item) => !isCoreSkill(item));
      return [
        { id: 'core', label: 'Examples', items: core },
        { id: 'workspace', label: 'Workspace', items: workspace },
      ].filter((group) => group.items.length > 0);
    }

    if (activeTab === 'connectors') {
      const resolveGroup = getConnectorGroupId || ((item: Capability): ConnectorGroupId => {
        if (isDesktopConnector(item)) return 'desktop';
        return item.enabled ? 'connected' : 'not-connected';
      });

      const desktop = items.filter((item) => resolveGroup(item) === 'desktop');
      const connected = items.filter((item) => resolveGroup(item) === 'connected');
      const notConnected = items.filter((item) => resolveGroup(item) === 'not-connected');
      return [
        { id: 'desktop', label: 'Desktop', items: desktop },
        { id: 'connected', label: 'Connected', items: connected },
        { id: 'not-connected', label: 'Not connected', items: notConnected },
      ].filter((group) => group.items.length > 0);
    }

    return [{ id: 'all', label: null, items }];
  }, [activeTab, getConnectorGroupId, items]);

  return (
    <div
      style={{
        width: 340,
        marginLeft: 34,
        minWidth: 340,
        flexShrink: 0,
        backgroundColor: 'transparent',
        backdropFilter: 'none',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      role="region"
      aria-label="Capability list"
    >
      {/* Header with Search and Add Button */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${THEME.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 650, color: THEME.textPrimary }}>
          {TABS.find(t => t.id === activeTab)?.label}
        </div>

        {/* Search */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 6,
            border: `1px solid ${THEME.border}`,
          }}
        >
          <Search size={14} color={THEME.textTertiary} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: THEME.textPrimary,
              fontSize: 13,
              width: 100,
            }}
            aria-label="Search capabilities"
          />
        </div>

        {/* Add Button with Dropdown */}
        <div style={{ position: 'relative' }}>
          {(activeTab === 'plugins' || activeTab === 'connectors') && (
            <button
              onClick={onBrowsePlugins}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 6,
                backgroundColor: THEME.accentMuted,
                border: 'none',
                color: THEME.accent,
                fontSize: 12,
                cursor: 'pointer',
                marginRight: 6,
              }}
              aria-label="Browse plugins"
            >
              <Grid size={14} />
              Browse
            </button>
          )}
          {activeTab !== 'connectors' && (
            <React.Fragment>
            <button
              onClick={onToggleCreateMenu}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: `1px solid ${THEME.border}`,
                color: THEME.textSecondary,
                cursor: 'pointer',
              }}
              aria-label="Create new"
              aria-expanded={showCreateMenu}
            >
              <Plus size={14} />
            </button>
              
              {showCreateMenu && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 50,
                    }}
                    onClick={onCloseCreateMenu}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 4,
                      backgroundColor: THEME.bgElevated,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 8,
                      padding: '4px',
                      minWidth: 160,
                      zIndex: 51,
                    }}
                    role="menu"
                  >
                    {createMenuActions.map((action) => (
                      <CreateMenuItem key={action.id} onClick={action.onClick}>{action.label}</CreateMenuItem>
                    ))}
                  </div>
                </>
              )}
            </React.Fragment>
          )}
        </div>

        {/* Update Badge */}
        <UpdateBadge
          count={updateCount}
          onClick={onShowUpdateModal}
          size="sm"
          pulse={true}
          variant="default"
        />

        <button
          onClick={() => void onRefresh()}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: `1px solid ${THEME.border}`,
            color: THEME.textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Refresh"
        >
          <RefreshCw size={13} />
        </button>

        {activeTab === 'connectors' && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: `1px solid ${THEME.border}`,
              color: THEME.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Connector settings"
          >
            <Settings size={13} />
          </button>
        )}
      </div>

      {/* Items List */}
      <div style={{ flex: 1, overflow: 'auto' }} role="list">
        {error && (
          <div
            style={{
              margin: 12,
              padding: 10,
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.35)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#fca5a5',
              fontSize: 12,
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {groupedSections.map((group) => (
          <div key={group.id}>
            {group.label && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: THEME.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '10px 16px 6px',
                }}
              >
                {group.label}
              </div>
            )}

            {group.items.map((item) => {
              const connectorGroup = activeTab === 'connectors'
                ? (getConnectorGroupId
                  ? getConnectorGroupId(item)
                  : (isDesktopConnector(item) ? 'desktop' : (item.enabled ? 'connected' : 'not-connected')))
                : null;
              const isSelected = item.id === selectedItemId;
              const isActiveItem = isSelected && activeSelection === 'item';
              const hasActiveFileInItem = Boolean(isSelected && selectedFileId && activeSelection === 'file');
              const rowBackground = isActiveItem
                ? 'rgba(255,255,255,0.08)'
                : hasActiveFileInItem
                  ? 'rgba(255,255,255,0.045)'
                  : 'transparent';
              const isConnected = connectorGroup === 'desktop' || connectorGroup === 'connected';
              const isEnabledVisual = activeTab === 'connectors' ? isConnected : item.enabled;

	              return (
	                <div key={item.id}>
	                  <button
	                    className="pm-list-row"
	                    onClick={() => onSelectItem(item.id)}
	                    onContextMenu={(e) => onContextMenu(e, 'capability', item.id)}
                    style={{
                      width: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      backgroundColor: rowBackground,
                      border: 'none',
                      borderRadius: 8,
                      margin: '1px 8px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      textAlign: 'left',
                    transition: 'background-color 0.15s',
                  }}
	                  role="listitem"
	                    data-selected={isActiveItem || hasActiveFileInItem ? 'true' : 'false'}
	                    aria-selected={isActiveItem}
	                  >
                    <Icon
                      name={item.icon}
                      size={16}
                      color={isEnabledVisual ? THEME.textPrimary : THEME.textTertiary}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: isEnabledVisual ? 500 : 400,
                        color: isEnabledVisual ? THEME.textPrimary : THEME.textTertiary,
                      }}
                    >
                      {item.name}
                    </span>
                    {activeTab === 'connectors' && connectorGroup === 'desktop' && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 999,
                          border: `1px solid ${THEME.borderStrong}`,
                          fontSize: 9,
                          letterSpacing: '0.05em',
                          color: THEME.textSecondary,
                          textTransform: 'uppercase',
                        }}
                      >
                        Included
                      </span>
                    )}
                    {isEnabledVisual && (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: THEME.success,
                        }}
                        aria-label="Enabled"
                      />
                    )}
                  </button>

	                  {/* File Tree for selected item */}
	                  {item.id === selectedItemId && item.files && item.files.length > 0 && (
	                    <div style={{ backgroundColor: 'transparent' }}>
	                      {item.files.map((node) => (
	                        <FileTreeNode
                          key={node.id}
                          node={node}
                          depth={0}
                          selectedFileId={selectedFileId}
                          activeSelection={activeSelection}
                          expandedNodes={expandedNodes}
                          onToggle={onToggleNode}
                          onSelectFile={onSelectFile}
                          onContextMenu={onContextMenu}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {items.length === 0 && !isLoading && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: THEME.textTertiary,
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              No {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} found
            </div>
            <div style={{ fontSize: 12, marginBottom: 16, opacity: 0.7 }}>
              Create your first {TABS.find(t => t.id === activeTab)?.label.toLowerCase().slice(0, -1)} to get started
            </div>
            <button
              onClick={activeTab === 'plugins' || activeTab === 'connectors'
                ? onBrowsePlugins
                : onToggleCreateMenu}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                backgroundColor: THEME.accentMuted,
                border: 'none',
                color: THEME.accent,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                margin: '0 auto',
              }}
            >
              <Plus size={14} />
              {activeTab === 'plugins' || activeTab === 'connectors' ? 'Browse' : (createMenuActions[0]?.label || 'Create')}
            </button>
          </div>
        )}
        
        {isLoading && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: THEME.textTertiary,
            }}
          >
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Scanning...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// File Tree Component
// ============================================================================

function FileTreeNode({
  node,
  depth,
  selectedFileId,
  activeSelection,
  expandedNodes,
  onToggle,
  onSelectFile,
  onContextMenu,
}: {
  node: FileNode;
  depth: number;
  selectedFileId: string | null;
  activeSelection: 'item' | 'file';
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelectFile: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'directory' | 'capability', id: string, path?: string, name?: string) => void;
}) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedFileId === node.id;
  const isActiveFile = isSelected && activeSelection === 'file';

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    } else if (node.type === 'file') {
      onSelectFile(node.id);
    }
  };

	  return (
	    <div>
		      <button
		        className="pm-file-row"
		        onClick={handleClick}
		        onContextMenu={(e) => onContextMenu(e, node.type, node.id, node.path, node.name)}
		        style={{
	          width: 'auto',
	          display: 'flex',
	          alignItems: 'center',
	          gap: 8,
	          padding: `8px 16px 8px ${16 + depth * 20}px`,
	          backgroundColor: isActiveFile
	            ? 'rgba(212,176,140,0.15)'
	            : isSelected
	              ? 'rgba(212,176,140,0.08)'
	              : 'transparent',
	          border: 'none',
	          borderRadius: 8,
	          margin: '1px 8px',
	          boxSizing: 'border-box',
	          cursor: hasChildren || node.type === 'file' ? 'pointer' : 'default',
	          textAlign: 'left',
	          transition: 'background-color 0.15s',
	        }}
	        role="treeitem"
	        data-selected={isSelected ? 'true' : 'false'}
	        aria-selected={isActiveFile}
	        aria-expanded={hasChildren ? isExpanded : undefined}
	      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown size={14} color={THEME.textTertiary} />
          ) : (
            <ChevronRight size={14} color={THEME.textTertiary} />
          )
        ) : (
          <div style={{ width: 14 }} />
        )}
        
        {node.type === 'directory' ? (
          isExpanded ? (
            <FolderOpen size={14} color={THEME.accent} />
          ) : (
            <Folder size={14} color={THEME.textTertiary} />
          )
        ) : (
          <FileText size={14} color={THEME.textSecondary} />
        )}
        
        <span
          style={{
            fontSize: 12,
            color: node.type === 'directory' ? THEME.textSecondary : THEME.textTertiary,
          }}
        >
          {node.name}
        </span>
      </button>

      {isExpanded && hasChildren && (
        <div role="group">
          {[...(node.children || [])]
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFileId={selectedFileId}
              activeSelection={activeSelection}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onContextMenu={onContextMenu}
            />
            ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Right Pane - Detail View
// ============================================================================

function RightPaneEmptyState() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        backdropFilter: 'none',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 14,
          border: `1px solid ${THEME.borderStrong}`,
          backgroundColor: 'rgba(255,255,255,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Wrench size={24} color={THEME.textSecondary} />
      </div>
      <div style={{ fontSize: 16, color: THEME.textPrimary, marginBottom: 6, fontWeight: 600 }}>
        Manage capabilities
      </div>
      <div style={{ fontSize: 13, color: THEME.textSecondary, textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
        Select any item from the middle pane to inspect files, toggle access, and manage capability details.
      </div>
    </main>
  );
}

function RightPane({
  item,
  selectedFile,
  itemType,
  viewMode,
  onViewModeChange,
  onToggle,
  onEdit,
  onCopy,
  onOpenInVsCode,
  onShowInFolder,
  onUninstall,
  isEditing,
  editingContent,
  onEditingContentChange,
  onSaveEdit,
  onCancelEdit,
  connectorGroupId,
  connectorConnection,
  connectorBusy,
  onConnectorToggle,
}: {
  item: Capability;
  selectedFile: FileNode | null;
  itemType: TabId;
  viewMode: 'human' | 'code';
  onViewModeChange: (mode: 'human' | 'code') => void;
  onToggle: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onOpenInVsCode: () => void;
  onShowInFolder: () => void;
  onUninstall: () => void;
  isEditing: boolean;
  editingContent: string | null;
  onEditingContentChange: (content: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  connectorGroupId: ConnectorGroupId | null;
  connectorConnection: ConnectorConnectionState | null;
  connectorBusy: boolean;
  onConnectorToggle: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  const displayItem = selectedFile || item;
  const isFileView = !!selectedFile;
  const language = selectedFile?.language || (selectedFile?.name.endsWith('.json') ? 'json' : 'text');
  const isConnectorItem = itemType === 'connectors' && !isFileView;
  const connectorEnabled = connectorGroupId === 'desktop' || connectorGroupId === 'connected';
  const toggleEnabled = isConnectorItem ? connectorEnabled : item.enabled;

  return (
    <main
      style={{
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent',
        backdropFilter: 'none',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        minWidth: 260,
      }}
    >
      {/* Header with Metadata */}
      <header
        style={{
          padding: '20px clamp(16px, 2.2vw, 32px) 14px',
        }}
      >
        {/* Top Row: Name, Edit, Toggle, Menu */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1
            style={{
              fontSize: isFileView ? 22 : 'clamp(24px, 2.2vw, 34px)',
              fontWeight: 600,
              color: THEME.textPrimary,
              margin: 0,
              lineHeight: 1.08,
              letterSpacing: '-0.015em',
            }}
          >
            {isFileView ? displayItem.name : (item.trigger || item.name)}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEditing ? (
              <>
                <button
                  onClick={onSaveEdit}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: THEME.accent,
                    color: '#0c0a09',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={onCancelEdit}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${THEME.border}`,
                    backgroundColor: 'transparent',
                    color: THEME.textSecondary,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : null}

            {/* Toggle Switch */}
            {!isFileView && (
              <button
                onClick={isConnectorItem ? onConnectorToggle : onToggle}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: toggleEnabled ? THEME.accent : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                  opacity: connectorBusy ? 0.7 : 1,
                }}
                aria-pressed={toggleEnabled}
                aria-label={toggleEnabled ? 'Disable' : 'Enable'}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: toggleEnabled ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            )}

            {/* Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                }}
                aria-label="More options"
                aria-expanded={showMenu}
              >
                <MoreHorizontal size={18} color={THEME.textTertiary} />
              </button>

              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    backgroundColor: THEME.bgElevated,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    padding: '4px',
                    minWidth: 160,
                    zIndex: 10,
                  }}
                  role="menu"
                >
                  {!isEditing && (
                    <MenuItem icon={Edit3} onClick={() => { onEdit(); setShowMenu(false); }}>
                      Edit
                    </MenuItem>
                  )}
                  {!isEditing && <div style={{ borderTop: `1px solid ${THEME.border}`, margin: '4px 0' }} />}
                  <MenuItem icon={ExternalLink} onClick={() => { onOpenInVsCode(); setShowMenu(false); }}>
                    Open in VS Code
                  </MenuItem>
                  <MenuItem icon={Folder} onClick={() => { onShowInFolder(); setShowMenu(false); }}>
                    Show in folder
                  </MenuItem>
                  <div style={{ borderTop: `1px solid ${THEME.border}`, margin: '4px 0' }} />
                  <MenuItem icon={X} danger onClick={() => { onUninstall(); setShowMenu(false); }}>
                    Uninstall
                  </MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isFileView ? (
          <div style={{ maxWidth: 960 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: THEME.textTertiary, marginBottom: 4 }}>Added by</div>
              <div style={{ fontSize: 'clamp(20px, 1.55vw, 30px)', color: THEME.textPrimary, lineHeight: 1.12, letterSpacing: '-0.01em' }}>
                {item.author || 'Unknown'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
              <span>Description</span>
              <Info size={12} />
            </div>
            <p style={{ fontSize: 'clamp(13px, 1vw, 17px)', color: THEME.textSecondary, margin: 0, lineHeight: 1.55, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {item.description || 'No description provided.'}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: THEME.textSecondary, margin: 0, lineHeight: 1.5 }}>
            {(selectedFile as FileNode).path}
          </p>
        )}

        <div
          style={{
            marginTop: 16,
            marginLeft: 8,
            width: 'calc(100% - 18px)',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        />
      </header>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '16px clamp(14px, 2.2vw, 32px) 20px' }}>
        {/* View Mode Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => onViewModeChange('human')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              backgroundColor: viewMode === 'human' ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              color: viewMode === 'human' ? THEME.textPrimary : THEME.textTertiary,
              fontSize: 13,
              cursor: 'pointer',
            }}
            aria-pressed={viewMode === 'human'}
          >
            <Eye size={14} />
            Human
          </button>
          <button
            onClick={() => onViewModeChange('code')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              backgroundColor: viewMode === 'code' ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              color: viewMode === 'code' ? THEME.textPrimary : THEME.textTertiary,
              fontSize: 13,
              cursor: 'pointer',
            }}
            aria-pressed={viewMode === 'code'}
          >
            <Code size={14} />
            Code
          </button>
          <button
            onClick={onCopy}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: THEME.textTertiary,
            }}
            aria-label="Copy to clipboard"
          >
            <Copy size={14} />
          </button>
        </div>

        {/* Content Display */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            backgroundColor: THEME.bgElevated,
            border: `1px solid ${THEME.border}`,
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          {isEditing && editingContent !== null ? (
            <textarea
              value={editingContent}
              onChange={(e) => onEditingContentChange(e.target.value)}
              style={{
                width: '100%',
                height: '100%',
                padding: 24,
                backgroundColor: 'transparent',
                border: 'none',
                color: THEME.textPrimary,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
              }}
            />
          ) : isFileView ? (
            <FileContent file={selectedFile!} viewMode={viewMode} />
          ) : (
            <>
              {itemType === 'commands' && (
                <CommandContent item={item} viewMode={viewMode} />
              )}
              {itemType === 'skills' && (
                <SkillContent item={item} viewMode={viewMode} />
              )}
              {itemType === 'connectors' && (
                <ConnectorContent
                  item={item}
                  connectionState={connectorConnection}
                  connectorGroupId={connectorGroupId}
                  isBusy={connectorBusy}
                  onConnectToggle={onConnectorToggle}
                />
              )}
              {(itemType === 'cli-tools' || itemType === 'mcps' || itemType === 'webhooks') && (
                <GenericContent item={item} viewMode={viewMode} />
              )}
              {itemType === 'plugins' && (
                <>
                  <GenericContent item={item} viewMode={viewMode} />
                  
                  {/* Dependencies Section */}
                  {(item as Capability & { dependencies?: Record<string, string> }).dependencies && (
                    <div style={{ padding: '0 24px 24px' }}>
                      <div
                        style={{
                          border: `1px solid ${THEME.border}`,
                          borderRadius: 10,
                          backgroundColor: 'rgba(0,0,0,0.22)',
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          <Package size={16} color={THEME.accent} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: THEME.textPrimary }}>
                            Dependencies
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(
                            (item as Capability & { dependencies?: Record<string, string> }).dependencies || {}
                          ).map(([depId, versionRange]) => (
                            <div
                              key={depId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                borderRadius: 6,
                              }}
                            >
                              <span style={{ fontSize: 13, color: THEME.textPrimary }}>
                                {depId}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  color: THEME.textSecondary,
                                  padding: '2px 8px',
                                  backgroundColor: 'rgba(212, 176, 140, 0.1)',
                                  borderRadius: 4,
                                }}
                              >
                                {versionRange}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ padding: '0 24px 24px' }}>
                    <PluginReviews pluginId={item.id} pluginName={item.name} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// Content Components
// ============================================================================

function CommandContent({ item, viewMode }: { item: Capability; viewMode: 'human' | 'code' }) {
  if (viewMode === 'code') {
    return (
      <SyntaxHighlighter
        code={JSON.stringify({
          name: item.name,
          trigger: item.trigger,
          description: item.description,
          version: item.version,
        }, null, 2)}
        language="json"
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <code
          style={{
            padding: '6px 12px',
            backgroundColor: THEME.accentMuted,
            borderRadius: 6,
            color: THEME.accent,
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {item.trigger}
        </code>
      </div>
      <p style={{ fontSize: 14, color: THEME.textSecondary, lineHeight: 1.6 }}>
        {item.content || item.description}
      </p>
    </div>
  );
}

function SkillContent({ item, viewMode }: { item: Capability; viewMode: 'human' | 'code' }) {
  const content = item.content || '# Skill Content\n\nNo content available.';
  const licenseFile = findFileNodeByName(item.files, /^license(\.[a-z0-9]+)?$/i);

  if (viewMode === 'code') {
    return (
      <SyntaxHighlighter
        code={content}
        language="markdown"
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <section
        style={{
          border: `1px solid ${THEME.border}`,
          borderRadius: 10,
          backgroundColor: 'rgba(0,0,0,0.22)',
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>Description</div>
        <div style={{ fontSize: 13, color: THEME.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
          {item.description || 'No description provided.'}
        </div>
        <div style={{ fontSize: 12, color: THEME.textTertiary, marginBottom: 4 }}>
          Added by <span style={{ color: THEME.textSecondary }}>{item.author || 'Unknown'}</span>
        </div>
        {licenseFile && (
          <div style={{ fontSize: 12, color: THEME.textTertiary }}>
            License: <span style={{ color: THEME.textSecondary }}>Complete terms in {licenseFile.name}</span>
          </div>
        )}
      </section>
      <MarkdownRenderer content={content} />
    </div>
  );
}

function ConnectorContent({
  item,
  connectorGroupId,
  connectionState,
  isBusy,
  onConnectToggle,
}: {
  item: Capability;
  connectorGroupId: ConnectorGroupId | null;
  connectionState: ConnectorConnectionState | null;
  isBusy: boolean;
  onConnectToggle: () => void;
}) {
  const isDesktopIncluded = connectorGroupId === 'desktop' || isDesktopConnector(item);
  const isConnected = connectorGroupId === 'desktop' || connectorGroupId === 'connected';
  const accountLabel = connectionState?.accountLabel || item.appName || item.name;
  const connectedAtLabel = connectionState?.connectedAt
    ? new Date(connectionState.connectedAt).toLocaleString()
    : null;
  const permissionRows = isDesktopIncluded
    ? [
        'Read and annotate active browser tabs.',
        'Execute approved web actions in connected surfaces.',
        'Respect site-level permissions and safety controls.',
      ]
    : [
        'Read scoped resources from the connected application.',
        'Create or update records only when explicitly requested.',
        'Use token/session credentials managed by connector settings.',
      ];

  return (
    <div style={{ padding: 24, maxWidth: 880 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            backgroundColor: THEME.accentMuted,
            border: `1px solid ${THEME.borderStrong}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plug size={28} color={THEME.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 20, color: THEME.textPrimary, margin: 0, marginBottom: 4 }}>
            {item.appName || item.name}
          </h3>
          <p style={{ fontSize: 13, color: THEME.textSecondary, margin: 0, lineHeight: 1.5 }}>
            {item.description}
          </p>
        </div>
        {isDesktopIncluded && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              border: `1px solid ${THEME.borderStrong}`,
              color: THEME.textSecondary,
              fontSize: 10,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Included
          </span>
        )}
      </div>

      <div
        style={{
          marginBottom: 14,
          borderRadius: 10,
          border: `1px solid ${THEME.border}`,
          backgroundColor: 'rgba(0,0,0,0.22)',
          padding: 14,
        }}
      >
        <div style={{ fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>Connection</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ color: THEME.textSecondary, fontSize: 13 }}>
            {isDesktopIncluded
              ? 'Included connector is ready in this workspace.'
              : isBusy
                ? 'Updating connection status...'
                : isConnected
                  ? `Connected as ${accountLabel}`
                  : 'Not connected yet. Connect to enable tools and context sync.'}
          </div>
          {!isDesktopIncluded && !isConnected ? (
            <button
              onClick={onConnectToggle}
              style={{
                padding: '8px 14px',
                borderRadius: 7,
                backgroundColor: THEME.textPrimary,
                color: THEME.bg,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: isBusy ? 0.7 : 1,
              }}
              disabled={isBusy}
            >
              {isBusy ? 'Connecting...' : 'Connect'}
            </button>
          ) : !isDesktopIncluded ? (
            <button
              onClick={onConnectToggle}
              style={{
                padding: '7px 12px',
                borderRadius: 7,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.04)',
                color: THEME.textPrimary,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: isBusy ? 0.7 : 1,
              }}
              disabled={isBusy}
            >
              {isBusy ? 'Updating...' : 'Disconnect'}
            </button>
          ) : (
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11,
                color: THEME.success,
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.32)',
                whiteSpace: 'nowrap',
              }}
            >
              Connected
            </div>
          )}
        </div>
        {!isDesktopIncluded && isConnected && (
          <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: THEME.textTertiary }}>
              Account: <span style={{ color: THEME.textSecondary }}>{accountLabel}</span>
            </div>
            {connectedAtLabel && (
              <div style={{ fontSize: 12, color: THEME.textTertiary }}>
                Connected: <span style={{ color: THEME.textSecondary }}>{connectedAtLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${THEME.border}`,
          backgroundColor: 'rgba(0,0,0,0.22)',
          padding: 14,
        }}
      >
        <div style={{ fontSize: 12, color: THEME.textTertiary, marginBottom: 8 }}>Tool permissions</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: THEME.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
          {permissionRows.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button
          onClick={() => window.open('https://docs.a2r.dev/connectors', '_blank')}
          style={{
            marginTop: 12,
            border: 'none',
            background: 'transparent',
            color: THEME.accent,
            padding: 0,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Manage connector settings
        </button>
      </div>
    </div>
  );
}

function GenericContent({ item, viewMode }: { item: Capability; viewMode: 'human' | 'code' }) {
  const content = item.content || 'No content available.';
  const language = item.language || 'text';

  if (viewMode === 'code' || language === 'json') {
    return (
      <SyntaxHighlighter
        code={content}
        language={language}
      />
    );
  }

  return (
    <div style={{ padding: 24, fontSize: 14, color: THEME.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      {content}
    </div>
  );
}

function FileContent({ file, viewMode }: { file: FileNode; viewMode: 'human' | 'code' }) {
  const content = file.content || `// ${file.name}\n// No content available`;
  const language = file.language || (file.name.endsWith('.json') ? 'json' : 
                    file.name.endsWith('.md') ? 'markdown' : 
                    file.name.endsWith('.ts') ? 'typescript' :
                    file.name.endsWith('.js') ? 'javascript' : 'text');
  const isHtml = language === 'html' || file.name.endsWith('.html') || file.name.endsWith('.htm');

  if (viewMode === 'code' || language === 'json') {
    return (
      <SyntaxHighlighter
        code={content}
        language={language}
      />
    );
  }

  if (language === 'markdown' || file.name.endsWith('.md')) {
    return (
      <div style={{ padding: 24 }}>
        <MarkdownRenderer content={content} />
      </div>
    );
  }

  if (viewMode === 'human' && isHtml) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 420, backgroundColor: '#fff' }}>
        <iframe
          title={`Preview ${file.name}`}
          srcDoc={content}
          sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#fff',
          }}
        />
      </div>
    );
  }

  return (
    <SyntaxHighlighter
      code={content}
      language={language}
    />
  );
}

function CreateMenuItem({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: 4,
        backgroundColor: 'transparent',
        border: 'none',
        color: THEME.textSecondary,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      role="menuitem"
    >
      {children}
    </button>
  );
}

function SkillUploadModal({
  onClose,
  onUpload,
  isUploading,
}: {
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file || isUploading) return;
    void onUpload(file);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      role="dialog"
      aria-label="Upload skill"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        handleFile(event.dataTransfer.files?.[0] || null);
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          borderRadius: 12,
          border: `1px solid ${THEME.borderStrong}`,
          backgroundColor: THEME.bgElevated,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: THEME.textPrimary }}>Upload skill</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: THEME.textTertiary, cursor: 'pointer' }}
            aria-label="Close upload skill"
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: THEME.textSecondary }}>
          Drop a `SKILL.md` file or choose one from disk.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            borderRadius: 10,
            border: `1px dashed ${isDragActive ? THEME.accent : THEME.borderStrong}`,
            backgroundColor: isDragActive ? THEME.accentMuted : 'rgba(255,255,255,0.02)',
            padding: '28px 14px',
            textAlign: 'center',
            color: THEME.textSecondary,
            cursor: 'pointer',
            fontSize: 13,
          }}
          disabled={isUploading}
        >
          {isUploading ? 'Importing skill...' : 'Drag and drop SKILL.md here or click to choose a file'}
        </button>

        <div style={{ marginTop: 12, fontSize: 12, color: THEME.textTertiary, lineHeight: 1.6 }}>
          Requirements: `.md` and `.zip` supported. Zip archives must include a `SKILL.md` file.
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: THEME.textTertiary }}>
          Include clear instructions and optional `LICENSE` file alongside your skill content.
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".md,.zip"
          style={{ display: 'none' }}
          onChange={(event) => {
            handleFile(event.target.files?.[0] || null);
            event.target.value = '';
          }}
          aria-label="Select skill file"
        />
      </div>
    </div>
  );
}

function ConnectorConnectModal({
  connectorName,
  accountLabel,
  onAccountLabelChange,
  onClose,
  onConnect,
  isConnecting,
}: {
  connectorName: string;
  accountLabel: string;
  onAccountLabelChange: (value: string) => void;
  onClose: () => void;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 230,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      role="dialog"
      aria-label={`Connect ${connectorName}`}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          borderRadius: 12,
          border: `1px solid ${THEME.borderStrong}`,
          backgroundColor: THEME.bgElevated,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: THEME.textPrimary }}>Connect {connectorName}</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: THEME.textTertiary, cursor: 'pointer' }}
            aria-label="Close connect dialog"
            disabled={isConnecting}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: THEME.textSecondary, lineHeight: 1.55 }}>
          Add an optional account label so this connector can be identified in connected workspace context.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Account label (optional)
        </label>
        <input
          value={accountLabel}
          onChange={(event) => onAccountLabelChange(event.target.value)}
          placeholder="team@company.com"
          style={{
            width: '100%',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 13,
            padding: '9px 11px',
            outline: 'none',
          }}
          disabled={isConnecting}
        />

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={isConnecting}
            style={{
              padding: '8px 12px',
              borderRadius: 7,
              border: `1px solid ${THEME.borderStrong}`,
              backgroundColor: 'transparent',
              color: THEME.textSecondary,
              fontSize: 12,
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConnect}
            disabled={isConnecting}
            style={{
              padding: '8px 14px',
              borderRadius: 7,
              border: 'none',
              backgroundColor: THEME.textPrimary,
              color: THEME.bg,
              fontSize: 12,
              fontWeight: 600,
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrowseConnectorsOverlay({
  onInstallConnector,
  onCreateCustomConnector,
  onClose,
  existingConnectorNames,
}: {
  onInstallConnector: (connector: ConnectorMarketplaceItem) => void;
  onCreateCustomConnector: () => void;
  onClose: () => void;
  existingConnectorNames: Set<string>;
}) {
  const [tab, setTab] = useState<ConnectorMarketplaceTab>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [connectorCatalog, setConnectorCatalog] = useState<ConnectorMarketplaceItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadConnectorCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    setCatalogError(null);

    try {
      const result = await fetchConnectorMarketplaceCatalog();
      setConnectorCatalog(result.connectors);
    } catch (error) {
      setConnectorCatalog([]);
      setCatalogError(
        error instanceof Error ? error.message : 'Unable to load connector catalog from runtime sources.',
      );
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnectorCatalog();
  }, [loadConnectorCatalog]);

  const categories = useMemo(() => {
    const set = new Set<string>(connectorCatalog.map((item) => item.category));
    return ['all', ...Array.from(set).sort()];
  }, [connectorCatalog]);

  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categories, selectedCategory]);

  const filteredConnectors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return connectorCatalog.filter((item) => {
      if (tab === 'featured' && !item.featured) return false;
      if (selectedType !== 'all' && item.connectorType !== selectedType) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [connectorCatalog, tab, selectedType, selectedCategory, searchQuery]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 210,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
      role="dialog"
      aria-label="Browse connectors"
    >
      <div
        style={{
          width: 'min(980px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          backgroundColor: '#1b1917',
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '18px 20px 12px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 28, color: THEME.textPrimary, fontWeight: 600 }}>
              Connectors
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: THEME.textSecondary }}>
              Connect apps, files, and services to expand execution context across your workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: THEME.textTertiary, cursor: 'pointer' }}
            aria-label="Close connectors browser"
          >
            <X size={18} />
          </button>
        </header>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 20px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <button
            onClick={() => setTab('featured')}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: tab === 'featured' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === 'featured' ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Featured
          </button>
          <button
            onClick={() => setTab('all')}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: tab === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === 'all' ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            All
          </button>

          <div style={{ flex: 1 }} />

          <div
            style={{
              width: 240,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              padding: '7px 10px',
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            <Search size={14} color={THEME.textTertiary} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: THEME.textPrimary,
                fontSize: 13,
              }}
              aria-label="Search connectors"
            />
          </div>

          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
            style={{
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: THEME.textSecondary,
              fontSize: 12,
              padding: '7px 9px',
            }}
          >
            {CONNECTOR_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            style={{
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: THEME.textSecondary,
              fontSize: 12,
              padding: '7px 9px',
            }}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'Categories' : category}
              </option>
            ))}
          </select>
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <button
            onClick={onCreateCustomConnector}
            style={{
              border: 'none',
              background: 'transparent',
              color: THEME.accent,
              padding: 0,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Create custom connector
          </button>
        </div>

        <div style={{ padding: 20, overflow: 'auto' }}>
          {isCatalogLoading && (
            <div
              style={{
                textAlign: 'center',
                color: THEME.textTertiary,
                fontSize: 13,
                padding: 30,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Loader2 size={16} />
              Loading connectors...
            </div>
          )}

          {!isCatalogLoading && catalogError && (
            <div
              style={{
                border: `1px solid ${THEME.borderStrong}`,
                borderRadius: 10,
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                padding: 14,
              }}
            >
              <div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Failed to load connector marketplace
              </div>
              <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                {catalogError}
              </div>
              <button
                onClick={() => void loadConnectorCatalog()}
                style={{
                  border: `1px solid ${THEME.borderStrong}`,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: THEME.textPrimary,
                  borderRadius: 8,
                  padding: '7px 11px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!isCatalogLoading && !catalogError && filteredConnectors.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 10 }}>
              {filteredConnectors.map((item) => {
                const alreadyAdded = existingConnectorNames.has(item.name.toLowerCase());
                return (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 10,
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: THEME.accentMuted,
                        border: `1px solid ${THEME.borderStrong}`,
                        color: THEME.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        {item.name}
                      </div>
                      <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </div>
                    <button
                      onClick={() => onInstallConnector(item)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: `1px solid ${THEME.borderStrong}`,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: THEME.textPrimary,
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        flexShrink: 0,
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                      aria-label={alreadyAdded ? `${item.name} already added` : `Add ${item.name}`}
                      disabled={alreadyAdded}
                    >
                      {alreadyAdded ? <Check size={14} /> : '+'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!isCatalogLoading && !catalogError && filteredConnectors.length === 0 && (
            <div style={{ textAlign: 'center', color: THEME.textTertiary, fontSize: 13, padding: 30 }}>
              {connectorCatalog.length === 0
                ? 'No connectors are currently available from configured marketplace sources.'
                : 'No connectors match the current filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Publish Tab Components
// ============================================================================

import { validatePluginManifestV1, validateMarketplaceManifestV1 } from '../../plugins/pluginStandards';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Publish Tab Main View
// ============================================================================

interface PublishTabViewProps {
  fs: FileSystemAPI;
  onOpenCreateModal: () => void;
  onOpenValidateModal: () => void;
  onOpenSubmitModal: () => void;
}

function PublishTabView({ fs, onOpenCreateModal, onOpenValidateModal, onOpenSubmitModal }: PublishTabViewProps) {
  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header Section */}
      <div
        style={{
          padding: 24,
          borderRadius: 12,
          border: `1px solid ${THEME.border}`,
          backgroundColor: 'rgba(255,255,255,0.02)',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: 22, color: THEME.textPrimary, fontWeight: 600 }}>
          Publish Your Plugin to A2R Marketplace
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: THEME.textSecondary, lineHeight: 1.6 }}>
          Share your plugins with the A2R community. The publishing process involves creating a plugin from a template,
          validating your manifest, and submitting to the marketplace for review.
        </p>
      </div>

      {/* Action Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Card 1: Create New Plugin */}
        <PublishActionCard
          icon={<FilePlus size={28} color={THEME.accent} />}
          title="Create New Plugin"
          description="Start with a template. Choose from Command, Skill, MCP, Webhook, or Full Plugin types. Generates plugin.json and starter files."
          buttonText="Create from Template"
          onClick={onOpenCreateModal}
          accentColor={THEME.accent}
        />

        {/* Card 2: Validate Plugin */}
        <PublishActionCard
          icon={<Shield size={28} color="#22c55e" />}
          title="Validate Plugin"
          description="Validate your plugin.json against the A2R schema. Check for required fields, proper formatting, and best practices before submitting."
          buttonText="Validate Now"
          onClick={onOpenValidateModal}
          accentColor="#22c55e"
        />

        {/* Card 3: Submit to Marketplace */}
        <PublishActionCard
          icon={<Upload size={28} color="#60a5fa" />}
          title="Submit to Marketplace"
          description="Submit your plugin for review. Provide your GitHub repo URL, select a category, and add a description. Your submission will be saved locally."
          buttonText="Submit Plugin"
          onClick={onOpenSubmitModal}
          accentColor="#60a5fa"
        />
      </div>

      {/* Publishing Workflow Guide */}
      <div
        style={{
          marginTop: 32,
          padding: 24,
          borderRadius: 12,
          border: `1px solid ${THEME.border}`,
          backgroundColor: THEME.bgElevated,
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, color: THEME.textPrimary, fontWeight: 600 }}>
          Publishing Workflow
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WorkflowStep
            number={1}
            title="Create Your Plugin"
            description="Use the 'Create from Template' wizard to generate starter files in your chosen directory."
            icon={<FileCode size={16} />}
          />
          <WorkflowStep
            number={2}
            title="Validate Your Manifest"
            description="Run the validator to ensure your plugin.json follows the correct A2R schema."
            icon={<Shield size={16} />}
          />
          <WorkflowStep
            number={3}
            title="Push to GitHub"
            description="Create a public GitHub repository with your plugin files and a README."
            icon={<GitBranch size={16} />}
          />
          <WorkflowStep
            number={4}
            title="Submit to Marketplace"
            description="Use the submit form to add your plugin to the marketplace index for review."
            icon={<Upload size={16} />}
          />
        </div>
      </div>
    </div>
  );
}

function PublishActionCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  accentColor: string;
}) {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        backgroundColor: THEME.bgElevated,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: `${accentColor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: THEME.textPrimary, fontWeight: 600 }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: THEME.textSecondary, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <button
          onClick={onClick}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: `1px solid ${accentColor}40`,
            backgroundColor: `${accentColor}15`,
            color: accentColor,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor}15`;
          }}
        >
          {buttonText}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: THEME.accentMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: THEME.accent,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: THEME.textPrimary, marginBottom: 2 }}>
          {number}. {title}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: THEME.textSecondary, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Browse Plugins Overlay
// ============================================================================

function BrowsePluginsOverlay({
  marketplaceInstalledIds,
  installedVersions,
  curatedSourceEnabled,
  allowUntrustedMarketplaceSources,
  onInstall,
  onUpdate,
  onUninstall,
  onSetCuratedSourceEnabled,
  onSetAllowUntrustedMarketplaceSources,
  personalSources,
  onAddPersonalSource,
  onRemovePersonalSource,
  onClose,
  fs,
}: {
  marketplaceInstalledIds: string[];
  installedVersions: Record<string, string>;
  curatedSourceEnabled: Record<string, boolean>;
  allowUntrustedMarketplaceSources: boolean;
  onInstall: (plugin: MarketplacePlugin) => void;
  onUpdate: (plugin: MarketplacePlugin) => Promise<void> | void;
  onUninstall: (plugin: MarketplacePlugin) => void;
  onSetCuratedSourceEnabled: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSetAllowUntrustedMarketplaceSources: React.Dispatch<React.SetStateAction<boolean>>;
  personalSources: PersonalMarketplaceSource[];
  onAddPersonalSource: (source: Omit<PersonalMarketplaceSource, 'id' | 'createdAt'>) => void;
  onRemovePersonalSource: (sourceId: string) => void;
  onClose: () => void;
  fs: FileSystemAPI;
}) {
  const [activeTab, setActiveTab] = useState<PluginMarketplaceTab>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);
  const [marketplaceSource, setMarketplaceSource] = useState<'api' | 'curated' | 'github' | 'none'>('none');
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [personalEntries, setPersonalEntries] = useState<Array<{ source: PersonalMarketplaceSource; plugin: MarketplacePlugin }>>([]);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(true);
  const [isPersonalLoading, setIsPersonalLoading] = useState(false);
  const [personalSourceWarnings, setPersonalSourceWarnings] = useState<Record<string, string>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [externalDirectories, setExternalDirectories] = useState<ExternalMarketplaceDirectoryEntry[]>([]);
  const [isExternalDirectoriesLoading, setIsExternalDirectoriesLoading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { showError, showInfo, showWarning } = useErrorToast();

  const enabledCuratedSourceIds = useMemo(() => {
    return CURATED_MARKETPLACE_SOURCES
      .filter((source) => curatedSourceEnabled[source.id] !== false)
      .map((source) => source.id);
  }, [curatedSourceEnabled]);

  useEffect(() => {
    void (async () => {
      setIsMarketplaceLoading(true);
      setMarketplaceError(null);
      try {
        const result = await searchMarketplace(searchQuery, {
          category: activeCategory === 'all' ? undefined : activeCategory,
          allowedCuratedSourceIds: enabledCuratedSourceIds,
        });
        setMarketplaceSource(result.source);
        setMarketplacePlugins(result.plugins.map((p) => ({
          ...p,
          installed: marketplaceInstalledIds.includes(p.id),
        })));
      } catch (e) {
        showError('Failed to load marketplace');
        setMarketplacePlugins([]);
        setMarketplaceError(e instanceof Error ? e.message : 'Unable to load marketplace data.');
      } finally {
        setIsMarketplaceLoading(false);
      }
    })();
  }, [searchQuery, activeCategory, enabledCuratedSourceIds, marketplaceInstalledIds, refreshNonce, showError]);

  const loadPersonalSources = useCallback(async () => {
    setIsPersonalLoading(true);
    const warnings: Record<string, string> = {};
    const loadedEntries: Array<{ source: PersonalMarketplaceSource; plugin: MarketplacePlugin }> = [];
    const seen = new Set<string>();

    for (const source of personalSources) {
      try {
        if (source.type === 'github') {
          const repo = parseGitHubRepoRef(source.value);
          if (!repo) {
            warnings[source.id] = 'Invalid GitHub format. Use owner/repository.';
            continue;
          }
          const plugin = await fetchPluginFromGitHub(repo.owner, repo.repo);
          if (!plugin) {
            warnings[source.id] = 'Unable to fetch repository metadata.';
            continue;
          }
          const candidate = {
            ...plugin,
            category: plugin.category || 'personal',
          };
          if (!seen.has(candidate.id)) {
            seen.add(candidate.id);
            loadedEntries.push({ source, plugin: candidate });
          }
          continue;
        }

        if (source.type === 'url') {
          const response = await fetch(source.value);
          if (!response.ok) {
            warnings[source.id] = `Source unavailable (${response.status}).`;
            continue;
          }

          const payload = await response.json();
          const records = Array.isArray(payload)
            ? payload
            : (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).plugins))
              ? ((payload as Record<string, unknown>).plugins as unknown[])
              : [payload];

          for (let i = 0; i < records.length; i += 1) {
            const plugin = normalizeMarketplacePluginPayload(records[i], {
              id: `${source.id}-${i}`,
              name: source.label || source.value,
              author: 'Custom source',
              category: 'personal',
            });
            if (!plugin || seen.has(plugin.id)) continue;
            seen.add(plugin.id);
            loadedEntries.push({ source, plugin });
          }
          continue;
        }

        if (source.type === 'upload') {
          const payload = JSON.parse(source.value) as unknown;
          const records = Array.isArray(payload)
            ? payload
            : (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).plugins))
              ? ((payload as Record<string, unknown>).plugins as unknown[])
              : [payload];

          for (let i = 0; i < records.length; i += 1) {
            const plugin = normalizeMarketplacePluginPayload(records[i], {
              id: `${source.id}-${i}`,
              name: source.label || `Uploaded plugin ${i + 1}`,
              author: 'Uploaded source',
              category: 'personal',
            });
            if (!plugin || seen.has(plugin.id)) continue;
            seen.add(plugin.id);
            loadedEntries.push({ source, plugin });
          }
          continue;
        }

        if (source.type === 'local') {
          // Load plugin from local directory
          try {
            const { loadLocalPlugin, localPluginToPackage } = await import('../../plugins/localPluginLoader');

            // Get file system API from context
            if (!fs || typeof fs.readFile !== 'function') {
              warnings[source.id] = 'File system API not available.';
              continue;
            }

            const localSource = {
              id: source.id,
              path: source.value,
              addedAt: source.createdAt,
              label: source.label,
              isDevMode: source.isDevMode ?? true,
            };

            // Adapter to bridge FileSystemAPI to LocalPluginLoader's FileSystemAPI
            const fsAdapter = {
              readFile: fs.readFile.bind(fs),
              exists: fs.exists?.bind(fs) || (async () => false),
              join: fs.join?.bind(fs) || ((...paths: string[]) => paths.join('/').replace(/\/+/g, '/')),
              dirname: fs.dirname?.bind(fs) || ((p: string) => p.split('/').slice(0, -1).join('/') || '/'),
              basename: fs.basename?.bind(fs) || ((p: string) => p.split('/').pop() || ''),
              realpath: async (p: string) => p, // No symlink resolution in base API
              isDirectory: async (p: string) => {
                try {
                  const entries = await fs.readDir(p);
                  return Array.isArray(entries);
                } catch {
                  return false;
                }
              },
              readDir: async (p: string) => {
                const entries = await fs.readDir(p);
                return entries.map((e) => ({
                  name: e.name,
                  isDirectory: e.type === 'directory',
                  isSymbolicLink: false, // Not tracked in base API
                }));
              },
            };

            const loaded = await loadLocalPlugin(localSource, fsAdapter);
            const pkg = localPluginToPackage(loaded);

            // Create a marketplace plugin from the loaded local plugin
            const plugin: MarketplacePlugin = {
              ...loaded.plugin,
              id: `local-${source.id}`,
              sourceLabel: source.label || 'Local Dev',
              sourceDescriptor: {
                source: 'local',
                path: source.value,
                isDevMode: source.isDevMode ?? true,
              },
            };

            if (!seen.has(plugin.id)) {
              seen.add(plugin.id);
              loadedEntries.push({ source, plugin });
            }
          } catch (error) {
            warnings[source.id] = error instanceof Error ? error.message : 'Failed to load local plugin.';
          }
          continue;
        }
      } catch (error) {
        warnings[source.id] = error instanceof Error ? error.message : 'Failed to resolve source.';
      }
    }

    setPersonalSourceWarnings(warnings);
    setPersonalEntries(loadedEntries);
    setIsPersonalLoading(false);
  }, [personalSources]);

  useEffect(() => {
    void loadPersonalSources();
  }, [loadPersonalSources]);

  // Load external marketplace directories
  useEffect(() => {
    if (activeTab !== 'directories') return;
    void (async () => {
      setIsExternalDirectoriesLoading(true);
      try {
        const entries = await fetchExternalMarketplaceDirectories();
        setExternalDirectories(entries);
      } catch (e) {
        showError('Failed to load external marketplace directories');
      } finally {
        setIsExternalDirectoriesLoading(false);
      }
    })();
  }, [activeTab, showError]);

  const filteredMarketplace = marketplacePlugins.filter((plugin) =>
    activeCategory === 'all' || plugin.category === activeCategory
  );

  const filteredExternalDirectories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return externalDirectories;
    return externalDirectories.filter((entry) =>
      entry.title.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.categories.some((c) => c.toLowerCase().includes(q))
    );
  }, [externalDirectories, searchQuery]);

  const updatableMarketplacePlugins = useMemo(() => {
    return filteredMarketplace.filter((plugin) => {
      if (!marketplaceInstalledIds.includes(plugin.id)) return false;
      if (isPluginBlockedByTrustPolicy(plugin, allowUntrustedMarketplaceSources)) return false;
      const localVersion = installedVersions[plugin.id];
      return isVersionNewer(plugin.version, localVersion);
    });
  }, [allowUntrustedMarketplaceSources, filteredMarketplace, installedVersions, marketplaceInstalledIds]);

  const handleUpdateAll = useCallback(async () => {
    if (updatableMarketplacePlugins.length === 0) return;
    setIsUpdatingAll(true);
    try {
      for (const plugin of updatableMarketplacePlugins) {
        await onUpdate(plugin);
      }
      showInfo(`Updated ${updatableMarketplacePlugins.length} plugin${updatableMarketplacePlugins.length === 1 ? '' : 's'}.`);
    } finally {
      setIsUpdatingAll(false);
      setRefreshNonce((prev) => prev + 1);
    }
  }, [onUpdate, showInfo, updatableMarketplacePlugins]);

  const filteredPersonalEntries = personalEntries.filter(({ plugin, source }) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      plugin.name.toLowerCase().includes(q) ||
      plugin.description.toLowerCase().includes(q) ||
      plugin.author.toLowerCase().includes(q) ||
      (source.label || source.value).toLowerCase().includes(q)
    );
  });

  const marketplaceSourceSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plugin of marketplacePlugins) {
      const key = plugin.sourceLabel || 'Unknown source';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return CURATED_MARKETPLACE_SOURCES
      .map((source) => ({
        id: source.id,
        label: source.label,
        trust: source.trust,
        count: counts.get(source.label) || 0,
      }))
      .filter((item) => item.count > 0);
  }, [marketplacePlugins]);

  // Add Source Modal State
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [addSourceType, setAddSourceType] = useState<'github' | 'url' | 'upload' | 'local' | null>(null);
  const [sourceInputValue, setSourceInputValue] = useState('');
  const [sourceAccepted, setSourceAccepted] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const addSourceFileInputRef = useRef<HTMLInputElement>(null);

  const TRUST_WARNING = `Make sure you trust a plugin before installing, updating, or using it. Plugins installed from marketplaces are not controlled by Anthropic, and Anthropic cannot verify that they will work as intended or that they won't change. See each plugin's homepage for more information.`;

  const openAddSource = (type: 'github' | 'url' | 'upload' | 'local') => {
    setAddSourceType(type);
    setSourceInputValue('');
    setSourceAccepted(false);
    setShowAddSourceModal(true);
  };

  const handleAddSourceSubmit = () => {
    if (!sourceAccepted) return;
    
    if (addSourceType === 'github') {
      const parsed = parseGitHubRepoRef(sourceInputValue);
      if (!parsed) {
        showWarning('Invalid format. Use owner/repository.');
        return;
      }
      onAddPersonalSource({
        type: 'github',
        value: `${parsed.owner}/${parsed.repo}`,
        label: `${parsed.owner}/${parsed.repo}`,
      });
      showInfo(`Added source ${parsed.owner}/${parsed.repo}`);
    } else if (addSourceType === 'url') {
      try {
        const url = new URL(sourceInputValue);
        if (!['http:', 'https:'].includes(url.protocol)) {
          showWarning('Only http/https URLs are supported.');
          return;
        }
        onAddPersonalSource({
          type: 'url',
          value: url.toString(),
          label: url.hostname,
        });
        showInfo(`Added source ${url.hostname}`);
      } catch {
        showWarning('Invalid URL.');
        return;
      }
    } else if (addSourceType === 'local') {
      const path = sourceInputValue.trim();
      if (!path) {
        showWarning('Please enter a directory path.');
        return;
      }
      onAddPersonalSource({
        type: 'local',
        value: path,
        label: path.split('/').pop() || path,
        isDevMode: true,
      });
      showInfo(`Added local directory: ${path}`);
    }
    setShowAddSourceModal(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSourceFile(file);
  };

  const handleSourceFile = async (file: File) => {
    if (!sourceAccepted) {
      showWarning('Please accept the trust warning first.');
      return;
    }
    try {
      if (file.size > 256_000) {
        showWarning('Upload exceeds 256KB metadata limit.');
        return;
      }
      let payload: unknown;
      if (file.name.toLowerCase().endsWith('.zip')) {
        const records = await extractPluginRecordsFromZip(file);
        payload = records;
      } else {
        const text = await file.text();
        payload = JSON.parse(text);
      }
      onAddPersonalSource({
        type: 'upload',
        value: JSON.stringify(payload),
        label: file.name,
      });
      showInfo(`Added upload source ${file.name}`);
      setShowAddSourceModal(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to parse upload.');
    }
  };

  const toggleCuratedSource = (sourceId: string) => {
    onSetCuratedSourceEnabled((prev) => ({
      ...prev,
      [sourceId]: !(prev[sourceId] !== false),
    }));
  };

  const handleAddExternalDirectorySource = (entry: ExternalMarketplaceDirectoryEntry) => {
    if (!entry.sourceSuggestion) {
      showWarning('This marketplace does not have an importable source URL');
      return;
    }
    if (entry.sourceSuggestion.type === 'github') {
      onAddPersonalSource({
        type: 'github',
        value: entry.sourceSuggestion.value,
        label: entry.title,
      });
      showInfo(`Added ${entry.title} as a personal source`);
      setActiveTab('personal');
    } else if (entry.sourceSuggestion.type === 'url') {
      onAddPersonalSource({
        type: 'url',
        value: entry.sourceSuggestion.value,
        label: entry.title,
      });
      showInfo(`Added ${entry.title} as a personal source`);
      setActiveTab('personal');
    }
  };

  const handleOpenA2RPublish = () => {
    window.open('https://docs.a2r.dev/plugins/publish', '_blank');
  };

  // Publish Tab State
  const [showCreatePluginModal, setShowCreatePluginModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [pluginSubmissions, setPluginSubmissions] = useState<Array<{
    id: string;
    repoUrl: string;
    description: string;
    category: string;
    submittedAt: string;
    status: 'pending' | 'approved' | 'rejected';
  }>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('a2r:plugin-manager:submissions:v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist submissions to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('a2r:plugin-manager:submissions:v1', JSON.stringify(pluginSubmissions));
    } catch {
      // Ignore storage errors
    }
  }, [pluginSubmissions]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
      }}
      role="dialog"
      aria-label="Browse plugins"
    >
      {/* Centered Header */}
      <header 
        style={{ 
          position: 'relative',
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '24px 40px 16px',
          borderBottom: `1px solid ${THEME.border}`,
          backgroundColor: 'rgba(12, 10, 9, 0.8)',
        }}
      >
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute',
            right: 24,
            top: 24,
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer',
            padding: 8,
            borderRadius: 6,
          }}
          aria-label="Close"
        >
          <X size={24} color={THEME.textTertiary} />
        </button>
        <h2 style={{ fontSize: 28, fontWeight: 600, color: THEME.textPrimary, margin: 0, marginBottom: 8 }}>
          Browse plugins
        </h2>
        <p style={{ fontSize: 14, color: THEME.textSecondary, margin: 0, textAlign: 'center' }}>
          Extend execution with installable capability packs and personal sources.
        </p>
      </header>

      {/* Tab Navigation */}
      <div 
        style={{ 
          display: 'flex', 
          gap: 8, 
          padding: '16px 40px',
          borderBottom: `1px solid ${THEME.border}`,
          backgroundColor: 'rgba(12, 10, 9, 0.6)',
        }}
      >
        <button
          onClick={() => setActiveTab('marketplace')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'marketplace' ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: activeTab === 'marketplace' ? THEME.textPrimary : THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: activeTab === 'marketplace' ? 600 : 400,
          }}
          aria-pressed={activeTab === 'marketplace'}
        >
          Marketplace
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'personal' ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: activeTab === 'personal' ? THEME.textPrimary : THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: activeTab === 'personal' ? 600 : 400,
          }}
          aria-pressed={activeTab === 'personal'}
        >
          Personal
        </button>
        <button
          onClick={() => setActiveTab('directories')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'directories' ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: activeTab === 'directories' ? THEME.textPrimary : THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: activeTab === 'directories' ? 600 : 400,
          }}
          aria-pressed={activeTab === 'directories'}
        >
          Discover
        </button>
        <button
          onClick={() => setActiveTab('publish')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'publish' ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: activeTab === 'publish' ? THEME.textPrimary : THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: activeTab === 'publish' ? 600 : 400,
          }}
          aria-pressed={activeTab === 'publish'}
        >
          Publish
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 40px' }}>

      {/* Filters and Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {activeTab === 'marketplace' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setRefreshNonce((prev) => prev + 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: THEME.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Sync marketplace"
              title="Sync marketplace"
            >
              <RefreshCw size={14} />
            </button>
            {updatableMarketplacePlugins.length > 0 && (
              <button
                onClick={() => void handleUpdateAll()}
                disabled={isUpdatingAll}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: `1px solid ${THEME.accentGlow}`,
                  backgroundColor: 'rgba(212,176,140,0.16)',
                  color: THEME.textPrimary,
                  fontSize: 12,
                  cursor: isUpdatingAll ? 'wait' : 'pointer',
                  opacity: isUpdatingAll ? 0.7 : 1,
                }}
              >
                {isUpdatingAll ? 'Updating...' : `Update all (${updatableMarketplacePlugins.length})`}
              </button>
            )}
          </div>
        ) : activeTab === 'personal' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => openAddSource('github')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: THEME.textPrimary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Add from GitHub
            </button>
            <button
              onClick={() => openAddSource('url')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: THEME.textPrimary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Add by URL
            </button>
            <button
              onClick={() => openAddSource('upload')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: THEME.textPrimary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Upload plugin
            </button>
            <button
              onClick={() => openAddSource('local')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: `1px solid ${THEME.accentGlow}`,
                backgroundColor: 'rgba(212,176,140,0.08)',
                color: THEME.accent,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Load plugin from local directory for development"
            >
              <Folder size={14} />
              Add Local Dir
            </button>
            <button
              onClick={() => void loadPersonalSources()}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: THEME.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Sync personal sources"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : activeTab === 'directories' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>
              Browse third-party marketplace directories
            </span>
            <button
              onClick={() => {
                void (async () => {
                  setIsExternalDirectoriesLoading(true);
                  try {
                    const entries = await fetchExternalMarketplaceDirectories();
                    setExternalDirectories(entries);
                  } catch (e) {
                    showError('Failed to refresh external directories');
                  } finally {
                    setIsExternalDirectoriesLoading(false);
                  }
                })();
              }}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: `1px solid ${THEME.borderStrong}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: THEME.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Refresh external directories"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>
              Share your plugin with the A2R community
            </span>
            <button
              onClick={handleOpenA2RPublish}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: `1px solid ${THEME.accentGlow}`,
                backgroundColor: 'rgba(212,176,140,0.16)',
                color: THEME.textPrimary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Open Publishing Docs
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            width: 300,
          }}
        >
          <Search size={16} color={THEME.textTertiary} />
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: THEME.textPrimary,
              fontSize: 14,
              flex: 1,
            }}
            aria-label="Search plugins"
          />
        </div>
      </div>

      {activeTab === 'marketplace' && marketplaceSourceSummary.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {marketplaceSourceSummary.map((source) => (
            <div
              key={source.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 9px',
                borderRadius: 999,
                border: `1px solid ${THEME.border}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                fontSize: 11,
                color: THEME.textSecondary,
              }}
              title={`${source.label} (${source.trust})`}
            >
              <span style={{ color: THEME.textPrimary }}>{source.label}</span>
              <span style={{ color: THEME.textTertiary }}>{source.count}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'marketplace' && (
        <div
          style={{
            marginBottom: 14,
            border: `1px solid ${THEME.border}`,
            borderRadius: 10,
            padding: 10,
            backgroundColor: 'rgba(255,255,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ color: THEME.textPrimary, fontSize: 12, fontWeight: 600 }}>Source Policy</div>
              <div style={{ color: THEME.textTertiary, fontSize: 11 }}>
                Enable curated registries and control community/unverified installation policy.
              </div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: THEME.textSecondary }}>
              <input
                type="checkbox"
                checked={allowUntrustedMarketplaceSources}
                onChange={(event) => onSetAllowUntrustedMarketplaceSources(event.target.checked)}
              />
              Allow untrusted/community
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {CURATED_MARKETPLACE_SOURCES.map((source) => {
              const enabled = curatedSourceEnabled[source.id] !== false;
              return (
                <label
                  key={source.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 8px',
                    borderRadius: 8,
                    border: `1px solid ${enabled ? THEME.borderStrong : THEME.border}`,
                    backgroundColor: enabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                    fontSize: 11,
                    color: THEME.textSecondary,
                  }}
                  title={source.description}
                >
                  <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ color: THEME.textPrimary, fontWeight: 600 }}>{source.label}</span>
                    <span style={{ color: THEME.textTertiary }}>{source.trust}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleCuratedSource(source.id)}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'marketplace' && marketplaceSource === 'none' && !marketplaceError && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid rgba(245, 158, 11, 0.35)`,
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: '#fcd34d',
            fontSize: 12,
          }}
        >
          Marketplace API, curated registries, and GitHub fallback are unavailable. Retry after connectivity is restored.
        </div>
      )}

      {activeTab === 'marketplace' && marketplaceError && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.35)',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: '#fca5a5',
            fontSize: 12,
          }}
        >
          Marketplace load error: {marketplaceError}
        </div>
      )}

      {activeTab === 'personal' && (
        <div
          style={{
            marginBottom: 16,
            maxHeight: 150,
            overflow: 'auto',
            border: `1px solid ${THEME.border}`,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.02)',
            padding: 10,
          }}
        >
          {personalSources.length === 0 ? (
            <div style={{ color: THEME.textTertiary, fontSize: 13 }}>
              No personal sources added yet.
            </div>
          ) : (
            personalSources.map((source) => (
              <div
                key={source.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '6px 4px',
                  borderBottom: `1px solid ${THEME.border}`,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: THEME.textPrimary, fontSize: 12, fontWeight: 600 }}>
                      {(source.label || source.value).slice(0, 80)}
                    </div>
                    {source.type === 'local' && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: 'rgba(212,176,140,0.2)',
                          color: THEME.accent,
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Local Dev
                      </span>
                    )}
                  </div>
                  <div style={{ color: THEME.textTertiary, fontSize: 11 }}>
                    {source.type === 'local' ? (
                      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                        {source.value}
                      </span>
                    ) : (
                      `${source.type.toUpperCase()} source`
                    )}
                  </div>
                  {personalSourceWarnings[source.id] && (
                    <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 2 }}>
                      {personalSourceWarnings[source.id]}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemovePersonalSource(source.id)}
                  style={{
                    border: `1px solid ${THEME.borderStrong}`,
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    color: '#fca5a5',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* External Directories Info */}
      {activeTab === 'directories' && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 10,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 13, color: THEME.textSecondary, lineHeight: 1.6 }}>
            <strong style={{ color: THEME.textPrimary }}>Discover More Plugins</strong>
            <p style={{ margin: '8px 0 0 0' }}>
              Browse curated lists of plugins from third-party directories like ClaudeMarketplaces.com and ClaudePluginHub.com. 
              When you find a marketplace you like, click "Import" to add it as a personal source.
            </p>
          </div>
        </div>
      )}

      {/* Publish Tab - Main View */}
      {activeTab === 'publish' && (
        <PublishTabView
          fs={fs}
          onOpenCreateModal={() => setShowCreatePluginModal(true)}
          onOpenValidateModal={() => setShowValidateModal(true)}
          onOpenSubmitModal={() => setShowSubmitModal(true)}
        />
      )}

      {/* Plugin Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {(activeTab === 'marketplace' ? isMarketplaceLoading : activeTab === 'personal' ? isPersonalLoading : isExternalDirectoriesLoading) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: THEME.accent }} />
            <div style={{ color: THEME.textTertiary, fontSize: 12 }}>
              {activeTab === 'marketplace' ? 'Loading marketplace plugins...' : activeTab === 'personal' ? 'Loading personal sources...' : 'Loading external directories...'}
            </div>
          </div>
        ) : activeTab === 'directories' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filteredExternalDirectories.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: 20,
                  backgroundColor: THEME.bgElevated,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: entry.provider === 'claudemarketplaces' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ExternalLink size={20} color={entry.provider === 'claudemarketplaces' ? '#818cf8' : '#4ade80'} />
                  </div>
                  <button
                    onClick={() => handleAddExternalDirectorySource(entry)}
                    disabled={!entry.sourceSuggestion}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      backgroundColor: entry.sourceSuggestion ? THEME.textPrimary : 'rgba(120,113,108,0.18)',
                      color: entry.sourceSuggestion ? THEME.bg : THEME.textTertiary,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: entry.sourceSuggestion ? 'pointer' : 'not-allowed',
                    }}
                    title={entry.sourceSuggestion ? 'Add to personal sources' : 'No importable source available'}
                  >
                    Import
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: THEME.textPrimary, margin: 0 }}>
                    {entry.title}
                  </h3>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor:
                        entry.trust === 'official'
                          ? 'rgba(34,197,94,0.15)'
                          : entry.trust === 'verified'
                          ? 'rgba(59,130,246,0.15)'
                          : 'rgba(120,113,108,0.15)',
                      color:
                        entry.trust === 'official'
                          ? '#4ade80'
                          : entry.trust === 'verified'
                          ? '#60a5fa'
                          : '#a8a29e',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {entry.trust}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: THEME.textSecondary, margin: '0 0 12px 0', lineHeight: 1.5, flex: 1 }}>
                  {entry.description.slice(0, 120)}{entry.description.length > 120 ? '...' : ''}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {entry.categories.slice(0, 4).map((cat) => (
                    <span
                      key={cat}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: THEME.textTertiary,
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: THEME.textTertiary }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {entry.pluginCount > 0 && <span>{entry.pluginCount} plugins</span>}
                    {entry.stars > 0 && <span>⭐ {entry.stars.toLocaleString()}</span>}
                  </div>
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: THEME.accent, textDecoration: 'none' }}
                  >
                    Visit →
                  </a>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${THEME.border}`, fontSize: 11, color: THEME.textTertiary }}>
                  Source: {entry.provider === 'claudemarketplaces' ? 'ClaudeMarketplaces.com' : 'ClaudePluginHub.com'}
                </div>
              </div>
            ))}
            {filteredExternalDirectories.length === 0 && (
              <div style={{ color: THEME.textTertiary, fontSize: 13, padding: 10, gridColumn: '1 / -1' }}>
                {externalDirectories.length === 0
                  ? 'No external directories available. Check your network connection.'
                  : 'No directories match your search.'}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {(activeTab === 'marketplace'
              ? filteredMarketplace.map((plugin) => ({ plugin, sourceLabel: plugin.sourceLabel || null }))
              : filteredPersonalEntries.map(({ plugin, source }) => ({ plugin, sourceLabel: source.label || source.value }))
            ).map(({ plugin, sourceLabel }) => {
              const isInstalled = marketplaceInstalledIds.includes(plugin.id);
              const localVersion = installedVersions[plugin.id];
              const hasUpdate = isInstalled && isVersionNewer(plugin.version, localVersion);
              const pluginWithInstall = { ...plugin, installed: isInstalled };
              const blockedByPolicy = isPluginBlockedByTrustPolicy(pluginWithInstall, allowUntrustedMarketplaceSources);
              return (
                <div
                  key={`${plugin.id}-${sourceLabel || 'marketplace'}`}
                  style={{
                    padding: 20,
                    backgroundColor: THEME.bgElevated,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: THEME.accentMuted,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Puzzle size={20} color={THEME.accent} />
                    </div>
                    {isInstalled ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasUpdate && (
                          <button
                            onClick={() => void onUpdate(pluginWithInstall)}
                            disabled={blockedByPolicy}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              backgroundColor: blockedByPolicy ? 'rgba(120,113,108,0.2)' : 'rgba(34, 197, 94, 0.14)',
                              color: blockedByPolicy ? THEME.textTertiary : '#86efac',
                              border: blockedByPolicy ? `1px solid ${THEME.border}` : '1px solid rgba(34, 197, 94, 0.35)',
                              fontSize: 12,
                              cursor: blockedByPolicy ? 'not-allowed' : 'pointer',
                            }}
                            title={
                              blockedByPolicy
                                ? 'Blocked by trust policy'
                                : localVersion
                                  ? `Installed: v${localVersion} · Available: v${plugin.version}`
                                  : `Available: v${plugin.version}`
                            }
                          >
                            {blockedByPolicy ? 'Blocked' : 'Update'}
                          </button>
                        )}
                        <button
                          onClick={() => onUninstall(pluginWithInstall)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 12px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#fca5a5',
                            border: `1px solid rgba(239, 68, 68, 0.35)`,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <Check size={13} />
                          Uninstall
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onInstall(pluginWithInstall)}
                        disabled={blockedByPolicy}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          backgroundColor: blockedByPolicy ? 'rgba(120,113,108,0.18)' : THEME.textPrimary,
                          color: blockedByPolicy ? THEME.textTertiary : THEME.bg,
                          border: 'none',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: blockedByPolicy ? 'not-allowed' : 'pointer',
                        }}
                        title={blockedByPolicy ? 'Blocked by source policy' : undefined}
                      >
                        {blockedByPolicy ? 'Blocked' : 'Install'}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: THEME.textPrimary, margin: 0 }}>
                      {plugin.name}
                    </h3>
                    <span style={{ fontSize: 12, color: THEME.textTertiary }}>v{plugin.version}</span>
                    {isInstalled && localVersion && (
                      <span style={{ fontSize: 11, color: THEME.textTertiary }}>
                        installed v{localVersion}
                      </span>
                    )}
                    {isInstalled && hasUpdate && (
                      <span style={{ fontSize: 11, color: '#86efac' }}>
                        update available
                      </span>
                    )}
                    {blockedByPolicy && (
                      <span style={{ fontSize: 11, color: '#fbbf24' }}>
                        restricted source
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: 13, color: THEME.textSecondary, margin: 0, lineHeight: 1.5, flex: 1 }}>
                    {plugin.description.slice(0, 120)}{plugin.description.length > 120 ? '...' : ''}
                  </p>

                  {sourceLabel && (
                    <div style={{ marginTop: 8, fontSize: 11, color: THEME.textTertiary }}>
                      Source: {sourceLabel}
                      {plugin.sourceTrust && ` · ${plugin.sourceTrust}`}
                      {plugin.sourceUrl && (
                        <>
                          {' · '}
                          <a
                            href={plugin.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: THEME.accent, textDecoration: 'none' }}
                          >
                            link
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <StarRating rating={plugin.rating} size={14} />
                    <span style={{ fontSize: 12, color: THEME.textTertiary }}>
                      {plugin.installCount > 0 && `${plugin.installCount.toLocaleString()} installs`}
                    </span>
                  </div>
                </div>
              );
            })}
            {activeTab === 'personal' && filteredPersonalEntries.length === 0 && (
              <div style={{ color: THEME.textTertiary, fontSize: 13, padding: 10 }}>
                No plugins resolved from personal sources.
              </div>
            )}
            {activeTab === 'marketplace' && filteredMarketplace.length === 0 && (
              <div style={{ color: THEME.textTertiary, fontSize: 13, padding: 10 }}>
                No marketplace plugins matched your current search and filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAddSourceModal && addSourceType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAddSourceModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              backgroundColor: THEME.bgElevated,
              border: `1px solid ${THEME.borderStrong}`,
              borderRadius: 12,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>
                {addSourceType === 'github' && 'Add from GitHub'}
                {addSourceType === 'url' && 'Add by URL'}
                {addSourceType === 'upload' && 'Upload Plugin'}
                {addSourceType === 'local' && 'Add Local Directory'}
              </h3>
              <button
                onClick={() => setShowAddSourceModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Trust Warning */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid rgba(245, 158, 11, 0.35)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Shield size={16} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#fcd34d', lineHeight: 1.5 }}>
                  {TRUST_WARNING}
                </p>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  fontSize: 12,
                  color: THEME.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={sourceAccepted}
                  onChange={(e) => setSourceAccepted(e.target.checked)}
                />
                I understand and accept the risks
              </label>
            </div>

            {/* Input Area */}
            {addSourceType === 'github' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
                  GitHub Repository
                </label>
                <input
                  type="text"
                  value={sourceInputValue}
                  onChange={(e) => setSourceInputValue(e.target.value)}
                  placeholder="owner/repository"
                  disabled={!sourceAccepted}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${THEME.border}`,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: THEME.textPrimary,
                    fontSize: 14,
                    outline: 'none',
                    opacity: sourceAccepted ? 1 : 0.5,
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: THEME.textTertiary }}>
                  Enter as owner/repo (e.g., anthropic/skills)
                </p>
              </div>
            )}

            {addSourceType === 'url' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
                  Marketplace URL
                </label>
                <input
                  type="text"
                  value={sourceInputValue}
                  onChange={(e) => setSourceInputValue(e.target.value)}
                  placeholder="https://..."
                  disabled={!sourceAccepted}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${THEME.border}`,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: THEME.textPrimary,
                    fontSize: 14,
                    outline: 'none',
                    opacity: sourceAccepted ? 1 : 0.5,
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: THEME.textTertiary }}>
                  URL to a git repository (.git) or marketplace.json file
                </p>
              </div>
            )}

            {addSourceType === 'upload' && (
              <div style={{ marginBottom: 16 }}>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => sourceAccepted && addSourceFileInputRef.current?.click()}
                  style={{
                    padding: '32px 24px',
                    borderRadius: 10,
                    border: `2px dashed ${isDragActive ? THEME.accent : THEME.borderStrong}`,
                    backgroundColor: isDragActive ? 'rgba(212,176,140,0.1)' : 'rgba(255,255,255,0.02)',
                    textAlign: 'center',
                    cursor: sourceAccepted ? 'pointer' : 'not-allowed',
                    opacity: sourceAccepted ? 1 : 0.5,
                  }}
                >
                  <Download size={32} color={THEME.textTertiary} style={{ marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: 14, color: THEME.textSecondary }}>
                    Drag and drop plugin file here
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: THEME.textTertiary }}>
                    or click to browse (.json, .zip)
                  </p>
                </div>
                <input
                  ref={addSourceFileInputRef}
                  type="file"
                  accept=".json,.zip"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSourceFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {addSourceType === 'local' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
                  Local Directory Path
                </label>
                <input
                  type="text"
                  value={sourceInputValue}
                  onChange={(e) => setSourceInputValue(e.target.value)}
                  placeholder="/path/to/your/plugin-directory"
                  disabled={!sourceAccepted}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${THEME.border}`,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: THEME.textPrimary,
                    fontSize: 14,
                    outline: 'none',
                    opacity: sourceAccepted ? 1 : 0.5,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: THEME.textTertiary }}>
                  Absolute path to a directory containing plugin.json or marketplace.json
                </p>
                {sourceInputValue.trim() && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <span style={{ fontSize: 11, color: '#4ade80' }}>
                      <Check size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Directory will be validated on add (plugin.json required)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowAddSourceModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${THEME.border}`,
                  backgroundColor: 'transparent',
                  color: THEME.textSecondary,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              {addSourceType !== 'upload' && (
                <button
                  onClick={handleAddSourceSubmit}
                  disabled={!sourceAccepted || !sourceInputValue.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: sourceAccepted && sourceInputValue.trim() ? THEME.accent : 'rgba(120,113,108,0.3)',
                    color: sourceAccepted && sourceInputValue.trim() ? THEME.bg : THEME.textTertiary,
                    fontSize: 13,
                    cursor: sourceAccepted && sourceInputValue.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500,
                  }}
                >
                  Add Source
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Plugin Modal */}
      {showCreatePluginModal && (
        <CreatePluginModal
          fs={fs}
          onClose={() => setShowCreatePluginModal(false)}
          showInfo={showInfo}
          showError={showError}
        />
      )}

      {/* Validate Plugin Modal */}
      {showValidateModal && (
        <ValidatePluginModal
          onClose={() => setShowValidateModal(false)}
          showInfo={showInfo}
          showError={showError}
        />
      )}

      {/* Submit to Marketplace Modal */}
      {showSubmitModal && (
        <SubmitToMarketplaceModal
          onClose={() => setShowSubmitModal(false)}
          onSubmit={(submission) => {
            setPluginSubmissions((prev) => [submission, ...prev]);
          }}
          showInfo={showInfo}
        />
      )}
    </div>
    </div>
  );
}

// ============================================================================
// Publish Tab Modals
// ============================================================================

const PLUGIN_CATEGORIES_PUBLISH = [
  { id: 'productivity', label: 'Productivity' },
  { id: 'development', label: 'Development' },
  { id: 'data', label: 'Data' },
  { id: 'integration', label: 'Integration' },
  { id: 'utility', label: 'Utility' },
  { id: 'other', label: 'Other' },
];

interface CreatePluginModalProps {
  fs: FileSystemAPI;
  onClose: () => void;
  showInfo: (message: string) => void;
  showError: (message: string) => void;
}

type PluginType = 'command' | 'skill' | 'mcp' | 'webhook' | 'full';

const PLUGIN_TYPE_OPTIONS: { value: PluginType; label: string; description: string }[] = [
  { value: 'command', label: 'Command', description: 'Slash command that can be triggered in chat' },
  { value: 'skill', label: 'Skill', description: 'AI skill with instructions and capabilities' },
  { value: 'mcp', label: 'MCP', description: 'Model Context Protocol server' },
  { value: 'webhook', label: 'Webhook', description: 'HTTP webhook handler' },
  { value: 'full', label: 'Full Plugin', description: 'Complete plugin with all capabilities' },
];

function CreatePluginModal({ fs, onClose, showInfo, showError }: CreatePluginModalProps) {
  const [pluginName, setPluginName] = useState('');
  const [pluginType, setPluginType] = useState<PluginType>('command');
  const [description, setDescription] = useState('');
  const [saveLocation, setSaveLocation] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);

  // Set default save location on mount
  useEffect(() => {
    const homeDir = fs.getHomeDir?.() || '/home/user';
    setSaveLocation(fs.join?.(homeDir, 'plugins') || '/home/user/plugins');
  }, [fs]);

  const handleSelectDirectory = async () => {
    // Use prompt for directory selection since File System Access API doesn't support directory pickers well
    const defaultDir = saveLocation || (fs.getHomeDir?.() || '/home/user');
    const input = window.prompt('Enter directory path for your plugin:', defaultDir);
    if (input) {
      setSaveLocation(input.trim());
    }
  };

  const handleCreate = async () => {
    if (!pluginName.trim()) {
      showError('Plugin name is required');
      return;
    }

    if (!saveLocation.trim()) {
      showError('Save location is required');
      return;
    }

    setIsCreating(true);
    try {
      const slug = slugify(pluginName);
      const pluginDir = fs.join?.(saveLocation, slug) || `${saveLocation}/${slug}`;

      // Create directory structure
      if (fs.mkdir) {
        await fs.mkdir(pluginDir);
      }

      const now = new Date().toISOString();

      // Create plugin.json based on type
      const pluginJson = buildPluginJson(pluginType, slug, pluginName.trim(), description.trim(), now);

      const pluginJsonPath = fs.join?.(pluginDir, 'plugin.json') || `${pluginDir}/plugin.json`;
      if (fs.writeFile) {
        await fs.writeFile(pluginJsonPath, JSON.stringify(pluginJson, null, 2));
      }

      // Create src directory
      const srcDir = fs.join?.(pluginDir, 'src') || `${pluginDir}/src`;
      if (fs.mkdir && pluginType !== 'skill') {
        await fs.mkdir(srcDir);
      }

      // Create appropriate starter files based on type
      const files = generateStarterFiles(pluginType, slug, pluginName.trim(), description.trim());

      for (const { path, content } of files) {
        const fullPath = fs.join?.(pluginDir, path) || `${pluginDir}/${path}`;
        if (fs.writeFile) {
          await fs.writeFile(fullPath, content);
        }
      }

      // Create README.md
      const readmeContent = generateReadme(pluginType, slug, pluginName.trim(), description.trim());
      const readmePath = fs.join?.(pluginDir, 'README.md') || `${pluginDir}/README.md`;
      if (fs.writeFile) {
        await fs.writeFile(readmePath, readmeContent);
      }

      setCreatedPath(pluginDir);
      showInfo(`Plugin created at ${pluginDir}`);
    } catch (error) {
      showError(`Failed to create plugin: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreating(false);
    }
  };

  function buildPluginJson(
    type: PluginType,
    slug: string,
    name: string,
    description: string,
    createdAt: string
  ): Record<string, unknown> {
    const base = {
      $schema: 'https://anthropic.com/claude-code/plugin.schema.json',
      id: slug,
      name: name,
      description: description || `${name} - A2R Plugin`,
      version: '1.0.0',
      author: 'User',
      createdAt,
      updatedAt: createdAt,
    };

    switch (type) {
      case 'command':
        return {
          ...base,
          type: 'command',
          trigger: `/${slug}`,
          entry: 'src/index.ts',
        };
      case 'skill':
        return {
          ...base,
          type: 'skill',
          entry: 'SKILL.md',
        };
      case 'mcp':
        return {
          ...base,
          type: 'mcp',
          entry: 'src/main.ts',
        };
      case 'webhook':
        return {
          ...base,
          type: 'webhook',
          path: `/webhooks/${slug}`,
          entry: 'src/main.ts',
        };
      case 'full':
        return {
          ...base,
          type: 'plugin',
          commands: ['./commands'],
          skills: ['./skills'],
          connectors: [],
          mcpServers: {},
        };
      default:
        return base;
    }
  }

  function generateStarterFiles(
    type: PluginType,
    slug: string,
    name: string,
    desc: string
  ): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    switch (type) {
      case 'command':
        files.push({
          path: 'src/index.ts',
          content: `/**
 * ${name}
 * ${desc || `${name} command plugin`}
 */

export const config = {
  name: '${name}',
  description: '${desc || `${name} command`}',
  trigger: '/${slug}',
};

export async function execute(args: string[]): Promise<string> {
  // TODO: Implement your command logic
  console.log('Arguments:', args);
  return \`Executed ${name} with args: \${args.join(' ')}\`;
}
`,
        });
        break;

      case 'skill':
        files.push({
          path: 'SKILL.md',
          content: `# ${name}

## Purpose
${desc || `${name} skill for A2R`}

## Instructions
- Step 1: Describe what this skill does
- Step 2: Add detailed implementation steps
- Step 3: Define expected inputs and outputs

## Example Usage
\`\`\`
User: "Run ${name}"
Assistant: "Result from ${name}"
\`\`\`

## Constraints
- List any limitations or requirements
- Define error handling behavior
`,
        });
        files.push({
          path: '.gitignore',
          content: `node_modules/
.DS_Store
*.log
.env
`,
        });
        break;

      case 'mcp':
        files.push({
          path: 'src/main.ts',
          content: `/**
 * ${name} MCP Server
 * ${desc || `${name} MCP plugin`}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: '${slug}',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// TODO: Add your MCP tools implementation

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`,
        });
        files.push({
          path: 'package.json',
          content: JSON.stringify({
            name: slug,
            version: '1.0.0',
            description: desc || `${name} MCP server`,
            type: 'module',
            main: 'src/main.ts',
            scripts: {
              build: 'tsc',
              start: 'node dist/main.js',
            },
            dependencies: {
              '@modelcontextprotocol/sdk': '^0.4.0',
            },
          }, null, 2),
        });
        break;

      case 'webhook':
        files.push({
          path: 'src/main.ts',
          content: `/**
 * ${name} Webhook Handler
 * ${desc || `${name} webhook plugin`}
 */

export const config = {
  name: '${name}',
  description: '${desc || `${name} webhook`}',
  path: '/webhooks/${slug}',
};

export async function handleWebhook(payload: unknown): Promise<{ status: number; body: unknown }> {
  // TODO: Implement your webhook handler
  console.log('Received webhook:', payload);
  
  return {
    status: 200,
    body: { message: 'Webhook processed successfully', received: new Date().toISOString() },
  };
}
`,
        });
        break;

      case 'full':
        // Create full plugin structure
        files.push({
          path: 'commands/hello.ts',
          content: `export const config = {
  name: 'hello',
  description: 'Say hello from ${name}',
  trigger: '/${slug}-hello',
};

export async function execute(args: string[]): Promise<string> {
  return \`Hello from ${name}! Args: \${args.join(' ')}\`;
}
`,
        });
        files.push({
          path: 'skills/main.skill.md',
          content: `# ${name}

## Purpose
${desc || `${name} is a full-featured A2R plugin`}

## Instructions
This plugin provides multiple capabilities including commands, skills, and more.

## Capabilities
- Commands: Use /${slug}-hello to interact
- Skills: Available in the skills library
`,
        });
        files.push({
          path: '.gitignore',
          content: `node_modules/
.DS_Store
*.log
.env
dist/
`,
        });
        files.push({
          path: 'package.json',
          content: JSON.stringify({
            name: slug,
            version: '1.0.0',
            description: desc || `${name} plugin`,
            type: 'module',
            scripts: {
              build: 'tsc',
              dev: 'tsx watch src/main.ts',
            },
            devDependencies: {
              typescript: '^5.0.0',
              tsx: '^4.0.0',
            },
          }, null, 2),
        });
        break;
    }

    return files;
  }

  function generateReadme(type: PluginType, slug: string, name: string, desc: string): string {
    const usageInstructions = {
      command: `Trigger with: \`/${slug}\``,
      skill: 'This skill will be available in the skills library.',
      mcp: 'Configure the MCP server in your A2R settings.',
      webhook: `Webhook endpoint: POST /webhooks/${slug}`,
      full: 'This plugin provides commands, skills, and more. See individual files for details.',
    };

    return `# ${name}

${desc || `${name} - A2R Plugin`}

## Installation

1. Copy this directory to your A2R plugins folder
2. Run \`a2r plugin enable ${slug}\`

## Usage

${usageInstructions[type]}

## Files

- \`plugin.json\` - Plugin manifest
- \`README.md\` - This file
${type === 'command' ? '- \`src/index.ts\` - Command implementation' : ''}${type === 'skill' ? '- \`SKILL.md\` - Skill definition' : ''}${type === 'mcp' ? '- \`src/main.ts\` - MCP server entry' : ''}${type === 'webhook' ? '- \`src/main.ts\` - Webhook handler' : ''}${type === 'full' ? '- \`commands/\` - Command implementations\n- \`skills/\` - Skill definitions' : ''}

## Development

- Edit the source files to customize the plugin
- Run \`a2r plugin validate\` to check your changes

## License

MIT
`;
  }

  if (createdPath) {
    return (
      <ModalOverlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Check size={28} color="#22c55e" />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: THEME.textPrimary }}>
            Plugin Created Successfully!
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: THEME.textSecondary }}>
            Your plugin has been created at:
          </p>
          <code
            style={{
              display: 'block',
              padding: 12,
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: `1px solid ${THEME.border}`,
              fontSize: 12,
              color: THEME.accent,
              marginBottom: 20,
              wordBreak: 'break-all',
            }}
          >
            {createdPath}
          </code>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: THEME.accent,
              color: THEME.bg,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>
          Create Plugin from Template
        </h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Plugin Name *
        </label>
        <input
          type="text"
          value={pluginName}
          onChange={(e) => setPluginName(e.target.value)}
          placeholder="My Awesome Plugin"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Plugin Type
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {PLUGIN_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPluginType(option.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${pluginType === option.value ? THEME.accentGlow : THEME.border}`,
                backgroundColor: pluginType === option.value ? THEME.accentMuted : 'rgba(255,255,255,0.03)',
                color: pluginType === option.value ? THEME.textPrimary : THEME.textSecondary,
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{option.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this plugin do?"
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            minHeight: 80,
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Save Location *
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={saveLocation}
            onChange={(e) => setSaveLocation(e.target.value)}
            placeholder="/path/to/plugins"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: THEME.textPrimary,
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSelectDirectory}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${THEME.borderStrong}`,
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Folder size={14} />
            Browse
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: THEME.textTertiary }}>
          A subdirectory will be created for your plugin
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'transparent',
            color: THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!pluginName.trim() || !saveLocation.trim() || isCreating}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: pluginName.trim() && saveLocation.trim() && !isCreating ? THEME.accent : 'rgba(120,113,108,0.3)',
            color: pluginName.trim() && saveLocation.trim() && !isCreating ? THEME.bg : THEME.textTertiary,
            fontSize: 13,
            cursor: pluginName.trim() && saveLocation.trim() && !isCreating ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isCreating && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {isCreating ? 'Creating...' : 'Create Plugin'}
        </button>
      </div>
    </ModalOverlay>
  );
}

interface ValidatePluginModalProps {
  onClose: () => void;
  showInfo: (message: string) => void;
  showError: (message: string) => void;
}

function ValidatePluginModal({ onClose, showInfo, showError }: ValidatePluginModalProps) {
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    manifest?: unknown;
  } | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateManifest = (content: string, filename: string): { valid: boolean; errors: string[]; warnings: string[]; manifest?: unknown } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    let manifest: unknown;
    try {
      manifest = JSON.parse(content);
    } catch {
      return { valid: false, errors: ['Invalid JSON format'], warnings: [] };
    }

    if (typeof manifest !== 'object' || manifest === null) {
      return { valid: false, errors: ['Manifest must be an object'], warnings: [] };
    }

    const m = manifest as Record<string, unknown>;

    // Required fields
    if (!m.id || typeof m.id !== 'string') {
      errors.push('Missing required field: id (string)');
    }
    if (!m.name || typeof m.name !== 'string') {
      errors.push('Missing required field: name (string)');
    }
    if (!m.version || typeof m.version !== 'string') {
      errors.push('Missing required field: version (string)');
    }
    if (!m.description || typeof m.description !== 'string') {
      warnings.push('Missing recommended field: description');
    }
    if (!m.author || typeof m.author !== 'string') {
      warnings.push('Missing recommended field: author');
    }

    // Version format check
    if (m.version && typeof m.version === 'string') {
      const versionRegex = /^\d+\.\d+\.\d+/;
      if (!versionRegex.test(m.version)) {
        warnings.push('Version should follow semantic versioning (e.g., 1.0.0)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      manifest,
    };
  };

  const handleFileContent = async (file: File) => {
    setIsValidating(true);
    try {
      const content = await file.text();
      const result = validateManifest(content, file.name);
      setValidationResult(result);
      if (result.valid) {
        showInfo('Manifest is valid!');
      }
    } catch (error) {
      showError(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileContent(file);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>
          Validate Plugin Manifest
        </h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}>
          <X size={20} />
        </button>
      </div>

      {!validationResult && (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '40px 24px',
              borderRadius: 10,
              border: `2px dashed ${isDragActive ? THEME.accent : THEME.borderStrong}`,
              backgroundColor: isDragActive ? 'rgba(212,176,140,0.1)' : 'rgba(255,255,255,0.02)',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            <Shield size={40} color={THEME.textTertiary} style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 14, color: THEME.textSecondary }}>
              Drag and drop plugin.json here
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: THEME.textTertiary }}>
              or click to browse
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileContent(file);
              e.target.value = '';
            }}
          />

          <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${THEME.border}` }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: THEME.textSecondary, fontWeight: 600 }}>
              Required Fields:
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: THEME.textTertiary }}>
              <li>id - Unique identifier for your plugin</li>
              <li>name - Display name</li>
              <li>version - Semantic version (e.g., 1.0.0)</li>
            </ul>
          </div>
        </>
      )}

      {isValidating && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: THEME.accent }} />
          <p style={{ margin: '12px 0 0', fontSize: 13, color: THEME.textSecondary }}>Validating...</p>
        </div>
      )}

      {validationResult && !isValidating && (
        <div>
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: `1px solid ${validationResult.valid ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
              backgroundColor: validationResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {validationResult.valid ? (
              <Check size={24} color="#22c55e" />
            ) : (
              <AlertCircle size={24} color="#ef4444" />
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: validationResult.valid ? '#4ade80' : '#fca5a5' }}>
                {validationResult.valid ? 'Valid Manifest' : 'Validation Failed'}
              </div>
              <div style={{ fontSize: 12, color: THEME.textSecondary }}>
                {validationResult.errors.length} errors, {validationResult.warnings.length} warnings
              </div>
            </div>
          </div>

          {validationResult.errors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#fca5a5' }}>Errors:</h4>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {validationResult.errors.map((err, i) => (
                  <li key={i} style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 4 }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#fcd34d' }}>Warnings:</h4>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {validationResult.warnings.map((warn, i) => (
                  <li key={i} style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 4 }}>
                    {warn}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={() => setValidationResult(null)}
              style={{
                padding: '10px 16px',
                borderRadius: 6,
                border: `1px solid ${THEME.border}`,
                backgroundColor: 'transparent',
                color: THEME.textSecondary,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Validate Another
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: THEME.accent,
                color: THEME.bg,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </ModalOverlay>
  );
}

interface SubmitToMarketplaceModalProps {
  onClose: () => void;
  onSubmit: (submission: {
    id: string;
    repoUrl: string;
    description: string;
    category: string;
    submittedAt: string;
    status: 'pending' | 'approved' | 'rejected';
  }) => void;
  showInfo: (message: string) => void;
}

function SubmitToMarketplaceModal({ onClose, onSubmit, showInfo }: SubmitToMarketplaceModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('productivity');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = () => {
    if (!repoUrl.trim()) return;

    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      const submission = {
        id: `submission-${Date.now()}`,
        repoUrl: repoUrl.trim(),
        description: shortDescription.trim(),
        category,
        submittedAt: new Date().toISOString(),
        status: 'pending' as const,
      };
      onSubmit(submission);
      setIsSubmitting(false);
      setShowConfirmation(true);
      showInfo('Plugin submitted for review');
    }, 800);
  };

  if (showConfirmation) {
    return (
      <ModalOverlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Check size={28} color="#22c55e" />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: THEME.textPrimary }}>
            Submission Received!
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: THEME.textSecondary }}>
            Your plugin has been submitted for review. You&apos;ll receive an update within 2-3 business days.
          </p>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: `1px solid ${THEME.border}`,
              marginBottom: 20,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: THEME.textTertiary }}>
              While you wait, you can track your submission status in the Publish tab.
            </p>
            <a
              href="https://github.com/a2rchitect/plugin-marketplace/issues"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: THEME.accent, textDecoration: 'none' }}
            >
              View review queue on GitHub →
            </a>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: THEME.accent,
              color: THEME.bg,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </ModalOverlay>
    );
  }

  const isValidGitHubUrl = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/.test(repoUrl.trim());

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>
          Submit to Marketplace
        </h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          GitHub Repository URL *
        </label>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/username/my-plugin"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${isValidGitHubUrl || !repoUrl ? THEME.border : 'rgba(239,68,68,0.5)'}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 14,
            outline: 'none',
          }}
        />
        {repoUrl && !isValidGitHubUrl && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#fca5a5' }}>
            Please enter a valid GitHub repository URL
          </p>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Short Description
        </label>
        <input
          type="text"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Briefly describe what your plugin does"
          maxLength={120}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <p style={{ margin: '6px 0 0', fontSize: 11, color: THEME.textTertiary }}>
          {shortDescription.length}/120 characters
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 14,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {PLUGIN_CATEGORIES_PUBLISH.map((cat) => (
            <option key={cat.id} value={cat.id} style={{ backgroundColor: THEME.bgElevated }}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: 'rgba(245,158,11,0.1)',
          border: `1px solid rgba(245,158,11,0.35)`,
          marginBottom: 20,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: '#fcd34d', lineHeight: 1.5 }}>
          <strong>Note:</strong> All submissions are reviewed manually. Please ensure your plugin has:
        </p>
        <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: THEME.textTertiary }}>
          <li>A valid plugin.json manifest</li>
          <li>A README with installation instructions</li>
          <li>An open source license</li>
        </ul>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'transparent',
            color: THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValidGitHubUrl || isSubmitting}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: isValidGitHubUrl && !isSubmitting ? THEME.accent : 'rgba(120,113,108,0.3)',
            color: isValidGitHubUrl && !isSubmitting ? THEME.bg : THEME.textTertiary,
            fontSize: 13,
            cursor: isValidGitHubUrl && !isSubmitting ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isSubmitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ============================================================================
// Reusable Modal Overlay
// ============================================================================

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          backgroundColor: THEME.bgElevated,
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 12,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function MenuItem({
  icon: Icon,
  children,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 4,
        backgroundColor: 'transparent',
        border: 'none',
        color: danger ? THEME.danger : THEME.textSecondary,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      role="menuitem"
    >
      <Icon size={14} color={danger ? THEME.danger : THEME.textTertiary} />
      {children}
    </button>
  );
}

export default PluginManager;
