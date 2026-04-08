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
  MagnifyingGlass,
  Plus,
  CaretRight,
  CaretDown,
  FileText,
  Folder,
  FolderOpen,
  Eye,
  Code,
  Copy,
  DotsThreeOutline,
  Terminal,
  PuzzlePiece as Puzzle,
  PlugsConnected,
  HardDrives,
  WebhooksLogo,
  Sparkle,
  SquaresFour,
  Check,
  Command,
  BookOpen,
  Wrench,
  Cpu,
  Shield,
  GearSix,
  Info,
  ArrowSquareOut,
  DownloadSimple,
  ArrowsClockwise,
  CircleNotch,
  FilePlus,
  FolderPlus,
  Trash,
  PencilSimple,
  UploadSimple,
  FileCode,
  GitBranch,
  Package,
  Warning,
  EnvelopeSimple,
} from '@phosphor-icons/react';
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

import { THEME, CONNECTOR_TYPE_OPTIONS } from './PluginManager/constants';
import { 
  TabId, 
  Capability, 
  ConnectorMarketplaceItem, 
  PersonalMarketplaceSource, 
  PersonalMarketplaceType,
  ConnectorConnectionState,
  ConnectorGroupId,
  PluginManagerPersistedState,
  CreateMenuAction
} from './PluginManager/types';
import { 
  normalizeMarketplacePluginPayload, 
  parseGitHubRepoRef, 
  isVersionNewer, 
  isPluginBlockedByTrustPolicy,
  slugify,
  extractPluginRecordsFromZip
} from './PluginManager/utils';
import { GenericContent, FileContent } from './PluginManager/components/ContentPreview';
import { SkillUploadModal } from './PluginManager/components/SkillUploadModal';
import { ConnectorConnectModal } from './PluginManager/components/ConnectorConnectModal';
import { BrowseConnectorsOverlay } from './PluginManager/components/BrowseConnectorsOverlay';
import { BrowsePluginsOverlay } from './PluginManager/components/BrowsePluginsOverlay';

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
  { id: 'webhooks', label: 'Webhooks', icon: WebhooksLogo },
  { id: 'connectors', label: 'Connectors', icon: PlugsConnected },
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

const ENABLED_OVERRIDES_STORAGE_KEY = 'allternit:plugin-manager:enabled-overrides:v1';
const CUSTOM_CAPABILITIES_STORAGE_KEY = 'allternit:plugin-manager:custom-capabilities:v1';
const MARKETPLACE_INSTALLS_STORAGE_KEY = 'allternit:plugin-manager:marketplace-installs:v1';
const PERSONAL_MARKETPLACE_STORAGE_KEY = 'allternit:plugin-manager:personal-marketplaces:v1';
const CONNECTOR_CONNECTIONS_STORAGE_KEY = 'allternit:plugin-manager:connector-connections:v1';
const CURATED_SOURCE_SETTINGS_STORAGE_KEY = 'allternit:plugin-manager:curated-source-settings:v1';
const ALLOW_UNTRUSTED_MARKETPLACE_STORAGE_KEY = 'allternit:plugin-manager:allow-untrusted-marketplace:v1';
const PLUGIN_MANAGER_STATE_DIR = '.allternit/plugin-manager';
const PLUGIN_MANAGER_STATE_FILE = 'ui-state.json';
const PLUGIN_MANAGER_STATE_VERSION = 1;
const SKILL_IMPORT_DIR = '.allternit/skills';

const LEFT_PANE_TOP_OFFSET = 98;

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
  'webhook': WebhooksLogo,
  'plug': PlugsConnected,
  'file-text': FileText,
  'folder': Folder,
  'folder-open': FolderOpen,
  'settings': GearSix,
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
          <CaretRight size={15} style={{ transform: 'rotate(180deg)' }} />
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
            <ArrowsClockwise size={13} />
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
          <MagnifyingGlass size={14} color={THEME.textTertiary} />
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
              <SquaresFour size={14} />
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
          <ArrowsClockwise size={13} />
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
            <GearSix size={13} />
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
            <CircleNotch size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
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
            <CaretDown size={14} color={THEME.textTertiary} />
          ) : (
            <CaretRight size={14} color={THEME.textTertiary} />
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
                <DotsThreeOutline size={18} color={THEME.textTertiary} />
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
                    <MenuItem icon={PencilSimple} onClick={() => { onEdit(); setShowMenu(false); }}>
                      Edit
                    </MenuItem>
                  )}
                  {!isEditing && <div style={{ borderTop: `1px solid ${THEME.border}`, margin: '4px 0' }} />}
                  <MenuItem icon={ArrowSquareOut} onClick={() => { onOpenInVsCode(); setShowMenu(false); }}>
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
          <PlugsConnected size={28} color={THEME.accent} />
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

// ============================================================================
// Browse Plugins Overlay
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
