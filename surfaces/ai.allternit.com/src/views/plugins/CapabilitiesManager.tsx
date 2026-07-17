/**
 * PluginManager
 * 
 * 2-pane capability library:
 * - Left Pane: capability categories and marketplace actions
 * - Main Pane: list or selected-item detail
 * - Child Overlay: file preview with rendered/code modes
 * 
 * Features:
 * - Centered application overlay with backdrop blur
 * - Item detail replaces the list pane
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
  WebhooksLogo,
  SquaresFour,
  Command,
  BookOpen,
  Wrench,
  Cpu,
  Shield,
  GearSix,
  ArrowSquareOut,
  ArrowsClockwise,
  CircleNotch,
  PencilSimple,
  Package,
  Globe,
  UploadSimple,
} from '@phosphor-icons/react';
import { useFileSystem, type FileSystemAPI } from '../../plugins/fileSystem';
import type { FileNode, MarketplacePlugin } from '../../plugins/capability.types';
import { WorkspaceChatEditor } from '@/components/agent-workspace/WorkspaceChatEditor';
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
  CURATED_MARKETPLACE_SOURCES,
} from '../../plugins/marketplaceApi';
import { enable as enableCapabilityState, disable as disableCapabilityState } from '../../plugins/capabilityEnabled.store';
import { PluginReviews } from '../../components/PluginReviews';
import {
  resolveDependencies,
  type DependencyResolutionResult,
  type DependencyConflict,
} from '../../plugins/dependencies';
import { DependencyTree } from '../../components/DependencyTree';
import { DependencyModal } from '../../components/DependencyModal';
import { DependencyConflictModal } from '../../components/DependencyConflictModal';
import { McpMarketplace } from '@/components/agents';
import { useToolRegistryStore } from '@/lib/agents/tool-registry.store';

import { THEME } from './PluginManager/constants';
import { ConfirmModal } from '@/components/ConfirmModal';
import { 
  TabId, 
  Capability, 
  ConnectorMarketplaceItem, 
  PersonalMarketplaceSource, 
  PersonalMarketplaceType,
  ConnectorConnectionState,
  ConnectorGroupId,
  PluginMarketplaceTab,
  PluginManagerPersistedState,
  CreateMenuAction
} from './PluginManager/types';
import { 
  isPluginBlockedByTrustPolicy,
  slugify
} from './PluginManager/utils';
import { GenericContent, FileContent } from './PluginManager/components/ContentPreview';
import { SkillUploadModal } from './PluginManager/components/SkillUploadModal';
import { ConnectorConnectModal } from './PluginManager/components/ConnectorConnectModal';
import { BrowseConnectorsOverlay } from './PluginManager/components/BrowseConnectorsOverlay';
import { BrowsePluginsOverlay } from './PluginManager/components/BrowsePluginsOverlay';
import { openInBrowser } from '@/lib/openInBrowser';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CapabilitiesManager');

interface PluginManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  /** Deep-link to a specific tab on open (e.g. from a Settings panel's "Open full manager" link). Defaults to 'skills'. */
  initialTab?: TabId;
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



// ============================================================================
// Storage Keys
// ============================================================================

const ENABLED_OVERRIDES_STORAGE_KEY = 'allternit:plugin-manager:enabled-overrides:v1';
const MARKETPLACE_INSTALLS_STORAGE_KEY = 'allternit:plugin-manager:marketplace-installs:v1';
const PERSONAL_MARKETPLACE_STORAGE_KEY = 'allternit:plugin-manager:personal-marketplaces:v1';
const CONNECTOR_CONNECTIONS_STORAGE_KEY = 'allternit:plugin-manager:connector-connections:v1';
const CURATED_SOURCE_SETTINGS_STORAGE_KEY = 'allternit:plugin-manager:curated-source-settings:v1';
const ALLOW_UNTRUSTED_MARKETPLACE_STORAGE_KEY = 'allternit:plugin-manager:allow-untrusted-marketplace:v1';
const PLUGIN_MANAGER_STATE_DIR = '.allternit/plugin-manager';
const PLUGIN_MANAGER_STATE_FILE = 'ui-state.json';
const PLUGIN_MANAGER_STATE_VERSION = 1;
const SKILL_IMPORT_DIR = '.allternit/skills';


// ============================================================================
// Utility Functions
// ============================================================================

const safeJSONParse = <T,>(raw: string | null, defaultValue: T): T => {
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse JSON from localStorage');
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

export function PluginManager({ isOpen, onClose, onOpenSettings, initialTab }: PluginManagerProps) {
  return (
    <ErrorBoundary>
      <PluginManagerContent isOpen={isOpen} onClose={onClose} onOpenSettings={onOpenSettings} initialTab={initialTab} />
    </ErrorBoundary>
  );
}

function PluginManagerContent({ isOpen, onClose, onOpenSettings, initialTab }: PluginManagerProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => {
        setAnimateIn(true);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // IntegrationsPanel fully unmounts this component when closed (isOpen gates
  // the mount, not just visibility), so seeding useState from a prop here is
  // sufficient — no sync effect needed for re-opens with a different tab.
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'skills');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<'item' | 'file'>('item');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200);
  const [viewMode, setViewMode] = useState<'human' | 'code'>('human');
  const [showBrowseOverlay, setShowBrowseOverlay] = useState(false);
  const [browseInitialTab, setBrowseInitialTab] = useState<PluginMarketplaceTab>('marketplace');
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
  const [importUrlDraft, setImportUrlDraft] = useState<string | null>(null);
  const [createSkillDraft, setCreateSkillDraft] = useState<{ name: string; description: string } | null>(null);
  const [editDescriptionDraft, setEditDescriptionDraft] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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
        logger.error({ err: error }, 'Update check failed');
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

    // The two sources (filesystem scan, CLI-tools API) can produce different
    // entries that still share an id — React keys on item.id, so collapse id
    // duplicates (first wins) to avoid duplicate-key warnings.
    const seenIds = new Set<string>();
    return Array.from(mergedByName.values())
      .filter((tool) => {
        if (seenIds.has(tool.id)) return false;
        seenIds.add(tool.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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
  const selectedItem = filteredData.find((item) => item.id === selectedItemId) || null;

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
      if (selectedFileId) {
        setSelectedFileId(null);
        setActiveSelection('item');
        return;
      }
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

  // Keep current selection if still valid; lists open without forcing a detail view.
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

    setSelectedItemId(null);
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

  const handleConnectorConnectFlow = useCallback(async (item: Capability, requestedAccountLabel?: string, confirmed = false) => {
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

    if (currentlyConnected && !confirmed) {
      setConfirmDialog({
        title: 'Disconnect',
        message: `Disconnect ${item.appName || item.name}?`,
        onConfirm: () => {
          setConfirmDialog(null);
          void handleConnectorConnectFlow(item, requestedAccountLabel, true);
        },
      });
      return;
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

  const handleImportFromFile = useCallback(() => {
    setShowCreateMenu(false);
    fileImportRef.current?.click();
  }, []);

  const handleImportFromUrl = useCallback(() => {
    setShowCreateMenu(false);
    setImportUrlDraft('');
  }, []);

  const commitImportFromUrl = (url: string) => {
    setImportUrlDraft(null);
    if (!url.trim()) return;
    void (async () => {
      try {
        const response = await fetch(url.trim());
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const text = await response.text();
        const fallbackName = url.trim().split('/').pop() || `import-${activeTab}`;
        handleImportFromText(fallbackName, text);
      } catch (e) {
        showError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  };

  const handleCreateNew = useCallback(() => {
    setShowCreateMenu(false);
    setCreateFormTab(activeTab);
  }, [activeTab]);

  const handleCreateSkillWithAssistant = useCallback(() => {
    setShowCreateMenu(false);
    setCreateSkillDraft({ name: '', description: '' });
  }, []);

  const commitCreateSkillWithAssistant = (name: string, description: string) => {
    setCreateSkillDraft(null);
    if (!name.trim()) return;
    const finalName = name.trim();
    const finalDescription = description.trim() || `Assist with ${finalName.toLowerCase()}.`;
    const content = [
      `# ${finalName}`,
      '',
      '## Purpose',
      finalDescription,
      '',
      '## Instructions',
      '- Clarify user intent before taking action.',
      '- Execute steps with deterministic output when possible.',
      '- Return concise results and include constraints or assumptions.',
    ].join('\n');
    void handleCreateCapability('skills', { name: finalName, description: finalDescription, content });
  };

  const handleOpenSkillUploadModal = useCallback(() => {
    setShowCreateMenu(false);
    setShowSkillUploadModal(true);
  }, []);

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

    setEditDescriptionDraft(selectedItem.description || '');
  };

  const commitEditDescription = async (nextDescription: string) => {
    if (!selectedItem) return;
    setEditDescriptionDraft(null);
    const capabilityType = capabilityTypeFromTab(activeTab);
    const result = await updateCapabilityMetadata(capabilityType, selectedItem.id, { description: nextDescription });
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

  const handleUninstallSelected = () => {
    if (!selectedItem) return;
    setConfirmDialog({
      title: 'Delete',
      message: `Are you sure you want to delete "${selectedItem.name}"?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!selectedItem) return;
        const result = await deleteCapability(capabilityTypeFromTab(activeTab), selectedItem.id);
        if (result.success) {
          showInfo('Deleted successfully');
          setSelectedItemId(null);
          setSelectedFileId(null);
          await refresh();
        } else {
          showError(`Failed to delete: ${result.error}`);
        }
      },
    });
  };

  // Context menu
  const { state: contextMenuState, menuRef: contextMenuRef, showContextMenu, hideContextMenu } = useContextMenu({});

  if (!shouldRender) return null;

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
  const handleSelectFile = (id: string) => {
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
        // The inspector keeps its empty state when a file cannot be read.
      }
    })();
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/20 p-6 transition-all duration-200 ease-out ${
        animateIn ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        '--view-settings-bg': '#ffffff',
        '--surface-canvas': '#ffffff',
        '--surface-panel': '#ffffff',
        '--surface-panel-muted': '#f0f0ec',
        '--surface-floating': '#ffffff',
        '--surface-hover': '#f6f6f3',
        '--ui-text-primary': '#191918',
        '--ui-text-secondary': '#62625d',
        '--ui-text-tertiary': '#8d8d86',
        '--ui-text-muted': '#8d8d86',
        '--ui-text-inverse': '#ffffff',
        '--ui-border-muted': '#deded8',
        '--ui-border-default': '#d4d4cd',
        '--ui-border-strong': '#c7c7bf',
        '--text-primary': '#191918',
        '--text-secondary': '#62625d',
        '--text-tertiary': '#8d8d86',
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f6f6f3',
        '--border-subtle': '#deded8',
        '--accent-primary': '#2d2d2a',
      } as React.CSSProperties}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Capability Library"
    >
      <div 
        className={`flex h-[min(800px,calc(100vh-48px))] min-h-[620px] w-[min(1080px,calc(100vw-48px))] flex-col overflow-hidden rounded-[10px] border border-solid border-[var(--ui-border-muted)] shadow-2xl transition-all duration-200 ease-out ${
          animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'
        }`}
        style={{ backgroundColor: 'var(--view-settings-bg, var(--surface-canvas))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-16 shrink-0 items-center justify-between px-5">
          <h1 className="m-0 text-[22px] font-semibold text-[var(--ui-text-primary)]">Capability Library</h1>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md border-none bg-transparent text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)]"
            aria-label="Close Capability Library"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
        <LeftPane
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedItemId(null);
            setSelectedFileId(null);
            setActiveSelection('item');
          }}
          onBrowsePlugins={() => {
            setBrowseInitialTab('marketplace');
            setShowBrowseOverlay(true);
          }}
          onOpenMarketplaceView={(tab) => {
            setActiveTab('plugins');
            setBrowseInitialTab(tab);
            setShowBrowseOverlay(true);
          }}
          onCheckForUpdates={handleCheckForUpdates}
          updateCount={availableUpdates.length}
        />

        <div className="flex min-w-0 flex-1 overflow-hidden">
          {!selectedItem ? (
          <MiddlePane
            activeTab={activeTab}
            items={filteredData}
            onSelectItem={(id) => {
              setSelectedItemId(id);
              setSelectedFileId(null);
              setActiveSelection('item');
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchInputRef={searchInputRef}
            onBrowsePlugins={() => {
              setBrowseInitialTab('marketplace');
              setShowBrowseOverlay(true);
            }}
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
            updateCount={availableUpdates.length}
            onShowUpdateModal={() => setShowUpdateModal(true)}
          />
          ) : (
            <RightPane
              item={selectedItem}
              selectedFile={null}
              itemType={activeTab}
              viewMode={viewMode}
              onToggle={() => handleToggle(selectedItem.id)}
              onEdit={handleEditSelected}
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
              expandedNodes={expandedNodes}
              onToggleNode={toggleNode}
              onSelectFile={handleSelectFile}
              onFileContextMenu={showContextMenu}
              onBack={() => {
                setSelectedItemId(null);
                setSelectedFileId(null);
                setActiveSelection('item');
              }}
            />
          )}
        </div>
        </div>
      </div>

      {selectedItem && selectedFile && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-10 backdrop-blur-[2px]"
          onClick={() => {
            setSelectedFileId(null);
            setActiveSelection('item');
          }}
        >
          <section
            className="flex h-[min(680px,calc(100vh-80px))] w-[min(900px,calc(100vw-80px))] flex-col overflow-hidden rounded-[10px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-floating)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedFile.name} inspector`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex h-14 shrink-0 items-center justify-between border-0 border-b border-solid border-[var(--ui-border-muted)] px-5">
              <div>
                <div className="text-[14px] font-semibold text-[var(--ui-text-primary)]">{selectedFile.name}</div>
                <div className="text-[11px] text-[var(--ui-text-tertiary)]">{selectedFile.path}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFileId(null);
                  setActiveSelection('item');
                }}
                className="flex size-8 items-center justify-center rounded-md border-none bg-transparent text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)]"
                aria-label="Close file inspector"
              >
                <X size={17} />
              </button>
            </header>
            <div className="flex min-h-0 flex-1 flex-col p-5">
              <div className="mb-3 flex items-center justify-end gap-1">
                <button type="button" onClick={() => setViewMode('human')} className={`flex items-center gap-1.5 rounded-md border-none px-3 py-1.5 text-[12px] ${viewMode === 'human' ? 'bg-[var(--ui-border-muted)] text-[var(--ui-text-primary)]' : 'bg-transparent text-[var(--ui-text-tertiary)]'}`}><Eye size={14} /> Human</button>
                <button type="button" onClick={() => setViewMode('code')} className={`flex items-center gap-1.5 rounded-md border-none px-3 py-1.5 text-[12px] ${viewMode === 'code' ? 'bg-[var(--ui-border-muted)] text-[var(--ui-text-primary)]' : 'bg-transparent text-[var(--ui-text-tertiary)]'}`}><Code size={14} /> Code</button>
                <button type="button" onClick={handleCopySelected} className="flex size-8 items-center justify-center border-none bg-transparent text-[var(--ui-text-tertiary)]" aria-label="Copy file"><Copy size={14} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-canvas)]">
                <FileContent file={selectedFile} viewMode={viewMode} />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Browse Overlays */}
      {showBrowseOverlay && activeTab === 'plugins' && (
        <BrowsePluginsOverlay
          initialTab={browseInitialTab}
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
      {showBrowseOverlay && activeTab === 'mcps' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'color-mix(in srgb, var(--surface-canvas) 92%, transparent)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: THEME.textPrimary, margin: 0 }}>MCP Marketplace</h2>
            <button type="button"
              onClick={() => setShowBrowseOverlay(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                background: 'transparent',
                border: `1px solid ${THEME.border}`,
                color: THEME.textPrimary,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <McpMarketplace
              onInstall={async (tool) => {
                try {
                  await useToolRegistryStore.getState().registerTool(tool);
                  showInfo(`MCP tool "${tool.name}" registered`);
                  await refresh();
                } catch (err) {
                  showError(`Failed to register MCP tool: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* File Input */}
      <input ref={fileImportRef}
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
      <UpdateNotification
        updates={availableUpdates}
        onUpdate={handlePluginUpdateAction}
        onDismiss={handleDismissUpdate}
        onLater={handleLaterUpdate}
        onShowAll={() => setShowUpdateModal(true)}
        maxVisible={3}
      />

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
        <div role="button" tabIndex={0}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--surface-canvas) 80%, transparent)',
            backdropFilter: 'blur(12px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowDependencyTree(false)}
        >
          <div role="button" tabIndex={0}
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
              <button type="button"
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

      {/* Confirm dialog */}
      <ConfirmModal
        isOpen={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        destructive
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* Import from URL dialog */}
      {importUrlDraft !== null && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setImportUrlDraft(null)}>
          <div style={{ background: THEME.bgGlass, border: `1px solid ${THEME.borderStrong}`, borderRadius: 12, padding: 24, width: 420, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: 0, fontWeight: 600, color: THEME.textPrimary }}>Import from URL</p>
            <input aria-label="Import URL" autoFocus type="url" value={importUrlDraft}
              onChange={(e) => setImportUrlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitImportFromUrl(importUrlDraft); else if (e.key === 'Escape') setImportUrlDraft(null); }}
              placeholder="https://..."
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: THEME.bgDeep, color: THEME.textPrimary, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setImportUrlDraft(null)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: 'transparent', color: THEME.textSecondary, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="button" onClick={() => commitImportFromUrl(importUrlDraft)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: THEME.accent, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Create skill with assistant dialog */}
      {createSkillDraft !== null && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCreateSkillDraft(null)}>
          <div style={{ background: THEME.bgGlass, border: `1px solid ${THEME.borderStrong}`, borderRadius: 12, padding: 24, width: 420, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: 0, fontWeight: 600, color: THEME.textPrimary }}>Create Skill</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, color: THEME.textSecondary }}>Skill name</div>
              <input aria-label="New Skill" autoFocus type="text" value={createSkillDraft.name} placeholder="New Skill"
                onChange={(e) => setCreateSkillDraft({ ...createSkillDraft, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Escape') setCreateSkillDraft(null); }}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: THEME.bgDeep, color: THEME.textPrimary, fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, color: THEME.textSecondary }}>What should it do?</div>
              <input aria-label="Describe the skill" type="text" value={createSkillDraft.description} placeholder="Describe the skill's purpose…"
                onChange={(e) => setCreateSkillDraft({ ...createSkillDraft, description: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') commitCreateSkillWithAssistant(createSkillDraft.name, createSkillDraft.description); else if (e.key === 'Escape') setCreateSkillDraft(null); }}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: THEME.bgDeep, color: THEME.textPrimary, fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCreateSkillDraft(null)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: 'transparent', color: THEME.textSecondary, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="button" onClick={() => commitCreateSkillWithAssistant(createSkillDraft.name, createSkillDraft.description)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: THEME.accent, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit description dialog */}
      {editDescriptionDraft !== null && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditDescriptionDraft(null)}>
          <div style={{ background: THEME.bgGlass, border: `1px solid ${THEME.borderStrong}`, borderRadius: 12, padding: 24, width: 420, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: 0, fontWeight: 600, color: THEME.textPrimary }}>Edit description — {selectedItem.name}</p>
            <input aria-label="Edit description" autoFocus type="text" value={editDescriptionDraft}
              onChange={(e) => setEditDescriptionDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEditDescription(editDescriptionDraft); else if (e.key === 'Escape') setEditDescriptionDraft(null); }}
              placeholder="Description…"
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: THEME.bgDeep, color: THEME.textPrimary, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditDescriptionDraft(null)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, background: 'transparent', color: THEME.textSecondary, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="button" onClick={() => commitEditDescription(editDescriptionDraft)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: THEME.accent, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pm-list-row[data-selected="false"]:hover {
          background-color: var(--surface-hover) !important;
        }

        .pm-file-row[data-selected="false"]:hover {
          background-color: var(--surface-hover) !important;
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
  onBrowsePlugins,
  onOpenMarketplaceView,
  onCheckForUpdates,
  updateCount,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onBrowsePlugins: () => void;
  onOpenMarketplaceView: (tab: PluginMarketplaceTab) => void;
  onCheckForUpdates?: () => void;
  updateCount?: number;
}) {
  return (
    <nav
      className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-0 border-r border-solid border-[var(--ui-border-muted)] bg-transparent p-[6px_12px_14px] shadow-none"
      aria-label="Capability categories"
    >
      <div className="text-[12px] font-semibold text-[var(--ui-text-tertiary)] uppercase tracking-[0.05em] mb-1 px-2">
        Capabilities
      </div>

      <div className="flex-1 overflow-y-auto pr-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button type="button"
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2.5 p-[6px_12px] rounded-[7px] border-none cursor-pointer mb-px text-left transition-colors duration-150 w-full ${
                isActive ? 'bg-[var(--accent-primary)]/10' : 'bg-transparent'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <Icon
                size={16}
                className={isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--ui-text-secondary)]'}
              />
              <span className={`flex-1 text-[13px] ${isActive ? 'font-semibold text-[var(--ui-text-primary)]' : 'font-normal text-[var(--ui-text-secondary)]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        <div className="mx-2 my-2 border-0 border-t border-solid border-[var(--ui-border-muted)]" />
        <div className="mb-1 px-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--ui-text-tertiary)]">
          Marketplace
        </div>
        <button
          type="button"
          onClick={() => onOpenMarketplaceView('directories')}
          className="mb-px flex w-full items-center gap-2.5 rounded-[7px] border-none bg-transparent p-[6px_12px] text-left text-[13px] text-[var(--ui-text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          <Globe size={16} />
          Sources
        </button>
        <button
          type="button"
          onClick={() => onOpenMarketplaceView('publish')}
          className="mb-px flex w-full items-center gap-2.5 rounded-[7px] border-none bg-transparent p-[6px_12px] text-left text-[13px] text-[var(--ui-text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          <UploadSimple size={16} />
          Publish
        </button>
      </div>

      <div className="border-t border-solid border-[var(--ui-border-muted)] pt-2.5 mt-2.5">
        <div className="text-[12px] text-[var(--ui-text-tertiary)] leading-[1.4] mb-2">
          Discover installable capabilities and manage your active toolset.
        </div>
        <button type="button"
          onClick={onBrowsePlugins}
          className="w-full p-[8px_12px] rounded-[7px] border border-solid border-[var(--ui-border-strong)] bg-[var(--accent-primary)]/10 text-[var(--ui-text-primary)] cursor-pointer text-[12px] font-semibold mb-2 last:mb-0"
        >
          Browse Marketplace
        </button>
        
        {onCheckForUpdates && (
          <button type="button"
            onClick={onCheckForUpdates}
            className={`w-full p-[8px_12px] rounded-[7px] border border-solid cursor-pointer text-[12px] font-semibold flex items-center justify-center gap-1.5 ${
              updateCount && updateCount > 0 
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' 
                : 'border-[var(--ui-border-muted)] bg-transparent text-[var(--ui-text-secondary)]'
            }`}
          >
            <ArrowsClockwise size={13} />
            Check for Updates
            {updateCount !== undefined && updateCount > 0 && (
              <span className="p-[2px_6px] bg-[var(--accent-primary)] rounded-[10px] text-[12px] text-[var(--surface-canvas)] ml-1">
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
  onSelectItem,
  searchQuery,
  onSearchChange,
  searchInputRef,
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
  updateCount,
  onShowUpdateModal,
}: {
  activeTab: TabId;
  items: Capability[];
  onSelectItem: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
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
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent"
      role="region"
      aria-label="Capability list"
    >
      {/* Header with Search and Add Button */}
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-4">
        <div className="text-[14px] font-[650] text-[var(--ui-text-primary)]">
          {TABS.find(t => t.id === activeTab)?.label}
        </div>

        {/* Search */}
        <div className="flex-1 flex items-center gap-2 p-[6px_10px] bg-[var(--surface-hover)] rounded-md border border-solid border-[var(--ui-border-muted)]">
          <MagnifyingGlass size={14} className="text-[var(--ui-text-tertiary)]" />
          <input ref={searchInputRef}
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent border-none outline-none text-[var(--ui-text-primary)] text-[13px] w-[100px]"
            aria-label="Search capabilities"
          />
        </div>

        {/* Add Button with Dropdown */}
        <div className="relative">
          {(activeTab === 'plugins' || activeTab === 'connectors' || activeTab === 'mcps') && (
            <button type="button"
              onClick={onBrowsePlugins}
              className="flex items-center gap-1 p-[6px_10px] rounded-md bg-[var(--accent-primary)]/10 border-none text-[var(--accent-primary)] text-[12px] cursor-pointer mr-1.5"
              aria-label="Browse plugins"
            >
              <SquaresFour size={14} />
              Browse
            </button>
          )}
          {activeTab !== 'connectors' && (
            <React.Fragment>
            <button type="button"
              onClick={onToggleCreateMenu}
              className="flex items-center justify-center size-7 rounded-md bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer"
              aria-label="Create new"
              aria-expanded={showCreateMenu}
            >
              <Plus size={14} />
            </button>
              
              {showCreateMenu && (
                <>
                  <div role="button" tabIndex={0}
                    className="fixed inset-0 z-[50]"
                    onClick={onCloseCreateMenu}
                  />
                  <div
                    className="absolute top-full right-0 mt-1 bg-[var(--surface-floating)] border border-solid border-[var(--ui-border-muted)] rounded-lg p-1 min-w-[160px] z-[51]"
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

        <button type="button"
          onClick={() => void onRefresh()}
          className="size-7 rounded-md bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer flex items-center justify-center"
          aria-label="Refresh"
        >
          <ArrowsClockwise size={13} />
        </button>

        {activeTab === 'connectors' && onOpenSettings && (
          <button type="button"
            onClick={onOpenSettings}
            className="size-7 rounded-md bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer flex items-center justify-center"
            aria-label="Connector settings"
          >
            <GearSix size={13} />
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-auto p-[7px_11px_18px]" role="list">
        {error && (
          <div
            style={{
              margin: 12,
              padding: 10,
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--status-error) 35%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--status-error) 12%, transparent)',
              color: 'var(--status-error)',
              fontSize: 12,
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {groupedSections.map((group) => (
          <div key={group.id} className="mb-4 grid grid-cols-2 gap-[6px]">
            {group.label && (
              <div className="col-span-2 px-1 pb-1 pt-2 text-[11px] font-semibold text-[var(--ui-text-tertiary)]">
                {group.label}
              </div>
            )}

            {group.items.map((item) => {
              const connectorGroup = activeTab === 'connectors'
                ? (getConnectorGroupId
                  ? getConnectorGroupId(item)
                  : (isDesktopConnector(item) ? 'desktop' : (item.enabled ? 'connected' : 'not-connected')))
                : null;
              const isConnected = connectorGroup === 'desktop' || connectorGroup === 'connected';
              const isEnabledVisual = activeTab === 'connectors' ? isConnected : item.enabled;

	              return (
	                <div key={item.id} className="min-w-0">
	                  <button type="button"
	                    className="w-full min-h-[82px] border border-solid border-transparent bg-transparent rounded-[7px] p-2.5 grid grid-cols-[34px_minmax(0,1fr)_auto] gap-2.5 text-left items-start transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--ui-border-muted)]"
	                    onClick={() => onSelectItem(item.id)}
	                    onContextMenu={(e) => onContextMenu(e, 'capability', item.id)}
	                  role="listitem"
	                    data-selected="false"
	                  >
                    <span className="flex size-[34px] items-center justify-center rounded-[7px] border border-solid border-[var(--ui-border-muted)] bg-white shrink-0">
                      <Icon name={item.icon} size={16} color={isEnabledVisual ? 'var(--ui-text-primary)' : 'var(--ui-text-tertiary)'} />
                    </span>
                    <span className="min-w-0">
                      <h3 className="block truncate text-[12px] font-semibold text-[var(--ui-text-primary)] m-0 mt-px mb-0.5">{item.name}</h3>
                      <p className="line-clamp-2 block text-[10px] leading-[1.4] text-[var(--ui-text-secondary)] m-0">
                        {item.description || `Manage the ${item.name} capability and its included resources.`}
                      </p>
                    </span>
                    <span className={`size-[7px] rounded-full mt-[5px] shrink-0 ${isEnabledVisual ? 'bg-[#26734d]' : 'bg-[#bbb]'}`} title={isEnabledVisual ? 'Enabled' : 'Available'} />
	                  </button>
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
            <button type="button"
              onClick={activeTab === 'plugins' || activeTab === 'connectors' || activeTab === 'mcps'
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
            <div style={{ fontSize: 13 }}>Scanning…</div>
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

    // Determine icon symbol matching prototype
    let symbol = '▤';
    if (node.type === 'directory') {
      symbol = isExpanded ? '📂' : '📁';
    } else if (node.name.endsWith('.md')) {
      symbol = '▣';
    } else if (node.name.endsWith('.json')) {
      symbol = '⌁';
    } else if (node.name.endsWith('.ts') || node.name.endsWith('.js') || node.name.endsWith('.tsx')) {
      symbol = '⌘';
    }

	  return (
	    <div>
		      <button type="button"
		        className={`flex h-[38px] w-full items-center gap-2 border-0 border-t border-solid border-[var(--ui-border-muted)] bg-white px-2.5 text-[10px] text-left transition-colors duration-150 hover:bg-[var(--surface-hover)] first:border-t-0`}
            style={{ paddingLeft: 10 + depth * 16 }}
		        onClick={handleClick}
		        onContextMenu={(e) => onContextMenu(e, node.type, node.id, node.path, node.name)}
	        role="treeitem"
	        data-selected={isSelected ? 'true' : 'false'}
	        aria-selected={isActiveFile}
	        aria-expanded={hasChildren ? isExpanded : undefined}
	      >
          <span className="text-[12px] text-[var(--ui-text-secondary)] shrink-0 w-4 text-center">
            {symbol}
          </span>
          <span className="flex-1 truncate text-[10px] font-medium text-[var(--ui-text-primary)]">
            {node.name}
          </span>
          <span className="ml-auto text-[9px] text-[var(--ui-text-tertiary)] uppercase tracking-wider shrink-0">
            {node.type} {hasChildren ? (isExpanded ? '▴' : '▾') : '›'}
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
// Main Pane - Selected Capability Detail
// ============================================================================

function RightPane({
  item,
  selectedFile,
  itemType,
  viewMode,
  onToggle,
  onEdit,
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
  expandedNodes,
  onToggleNode,
  onSelectFile,
  onFileContextMenu,
  onBack,
}: {
  item: Capability;
  selectedFile: FileNode | null;
  itemType: TabId;
  viewMode: 'human' | 'code';
  onToggle: () => void;
  onEdit: () => void;
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
  expandedNodes: Set<string>;
  onToggleNode: (id: string) => void;
  onSelectFile: (id: string) => void;
  onFileContextMenu: (e: React.MouseEvent, type: 'file' | 'directory' | 'capability', id: string, path?: string, name?: string) => void;
  onBack: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  const displayItem = selectedFile || item;
  const isFileView = !!selectedFile;
  const isConnectorItem = itemType === 'connectors' && !isFileView;
  const connectorEnabled = connectorGroupId === 'desktop' || connectorGroupId === 'connected';
  const toggleEnabled = isConnectorItem ? connectorEnabled : item.enabled;

  return (
    <main
      className="flex min-h-0 min-w-[260px] flex-[1_1_auto] flex-col overflow-y-auto overflow-x-hidden bg-white"
    >
      <div className="p-[8px_24px_28px] max-w-[800px] w-full flex flex-col min-h-full">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="h-[30px] border-none bg-transparent p-0 text-[11px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] flex items-center gap-1.5 cursor-pointer text-left font-sans"
        >
          <CaretRight size={13} className="rotate-180 text-[var(--ui-text-tertiary)]" />
          Back to {TABS.find((tab) => tab.id === itemType)?.label}
        </button>

        {/* Header (Preview Area) */}
        <header className="mt-[7px]">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 items-start">
            {/* Icon */}
            <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)]">
              <Icon name={item.icon} size={19} color="var(--ui-text-primary)" />
            </span>

            {/* Title / Author */}
            <div className="min-w-0">
              <h2 className="m-0 mt-[1px] mb-1 truncate text-[17px] font-semibold leading-tight text-[var(--ui-text-primary)]">
                {isFileView ? displayItem.name : (item.trigger || item.name)}
              </h2>
              <div className="text-[11px] text-[var(--ui-text-secondary)]">
                by {item.author || 'Allternit'} · <span className="text-[#26734d] font-medium">✓ verified</span>
              </div>
            </div>

            {/* Actions (Toggles / Edits / Menu) */}
            <div className="flex items-center gap-2">
              {isEditing && editingContent !== null ? (
                <>
                  <button type="button"
                    onClick={onSaveEdit}
                    className="p-[6px_12px] rounded-md border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[12px] font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                  <button type="button"
                    onClick={onCancelEdit}
                    className="p-[6px_12px] rounded-md border border-solid border-[var(--ui-border-muted)] bg-transparent text-[var(--ui-text-secondary)] text-[12px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : null}

              {/* Toggle Switch */}
              {!isFileView && (
                <button type="button"
                  onClick={isConnectorItem ? onConnectorToggle : onToggle}
                  className={`w-11 h-6 rounded-xl border-none cursor-pointer relative transition-colors duration-200 ${
                    toggleEnabled ? 'bg-[var(--accent-primary)]' : 'bg-black/20'
                  } ${connectorBusy ? 'opacity-70' : 'opacity-100'}`}
                  aria-pressed={toggleEnabled}
                  aria-label={toggleEnabled ? 'Disable' : 'Enable'}
                >
                  <div
                    className={`absolute top-0.5 size-5 rounded-full bg-white transition-all duration-200 ${
                      toggleEnabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              )}

              {/* More options Menu */}
              <div className="relative">
                <button type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="bg-transparent border-none cursor-pointer p-1 rounded hover:bg-[var(--surface-hover)] flex items-center justify-center"
                  aria-label="More options"
                  aria-expanded={showMenu}
                >
                  <DotsThreeOutline size={18} color="var(--ui-text-tertiary)" />
                </button>

                {showMenu && (
                  <div
                    className="absolute top-full right-0 mt-1 bg-white border border-solid border-[var(--ui-border-muted)] rounded-lg p-1 min-w-[160px] z-[51] shadow-lg"
                    role="menu"
                  >
                    {!isEditing && (
                      <MenuItem icon={PencilSimple} onClick={() => { onEdit(); setShowMenu(false); }}>
                        Edit
                      </MenuItem>
                    )}
                    {!isEditing && <div className="border-t border-solid border-[var(--ui-border-muted)] my-1" />}
                    <MenuItem icon={ArrowSquareOut} onClick={() => { onOpenInVsCode(); setShowMenu(false); }}>
                      Open in VS Code
                    </MenuItem>
                    <MenuItem icon={Folder} onClick={() => { onShowInFolder(); setShowMenu(false); }}>
                      Show in folder
                    </MenuItem>
                    <div className="border-t border-solid border-[var(--ui-border-muted)] my-1" />
                    <MenuItem icon={X} danger onClick={() => { onUninstall(); setShowMenu(false); }}>
                      Uninstall
                    </MenuItem>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Path or Description */}
          {isFileView ? (
            <p className="text-[12px] text-[var(--ui-text-secondary)] m-0 mt-4 mb-2 leading-[1.5] break-all font-mono">
              {(selectedFile as FileNode).path}
            </p>
          ) : (
            <p className="m-0 mt-5 mb-5 text-[12px] leading-[1.55] text-[#44443f] break-words">
              {item.description || 'No description provided.'}
            </p>
          )}
        </header>

        {/* Detailed Sections (Only shown when not file inspection or isEditing) */}
        {!isFileView && !isEditing ? (
          <>
            {/* Section 1: Capabilities */}
            <div className="py-[17px] border-t border-solid border-[var(--ui-border-muted)]">
              <h3 className="text-[11px] font-semibold text-[var(--ui-text-primary)] m-0 mb-[9px] uppercase tracking-[0.05em]">
                Capabilities
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="p-[4px_8px] border border-solid border-[var(--ui-border-muted)] rounded-[11px] bg-[var(--surface-hover)] text-[9px] text-[#55554f]">
                  {itemType}
                </span>
                <span className="p-[4px_8px] border border-solid border-[var(--ui-border-muted)] rounded-[11px] bg-[var(--surface-hover)] text-[9px] text-[#55554f]">
                  workspace access
                </span>
                <span className="p-[4px_8px] border border-solid border-[var(--ui-border-muted)] rounded-[11px] bg-[var(--surface-hover)] text-[9px] text-[#55554f]">
                  structured output
                </span>
                <span className="p-[4px_8px] border border-solid border-[var(--ui-border-muted)] rounded-[11px] bg-[var(--surface-hover)] text-[9px] text-[#55554f]">
                  automation
                </span>
              </div>
            </div>

            {/* Section 2: Included skills, connectors, and files */}
            {item.files && item.files.length > 0 && (
              <div className="py-[17px] border-t border-solid border-[var(--ui-border-muted)]">
                <h3 className="text-[11px] font-semibold text-[var(--ui-text-primary)] m-0 mb-[9px] uppercase tracking-[0.05em]">
                  Included skills, connectors, and files
                </h3>
                <div className="border border-solid border-[var(--ui-border-muted)] rounded-[7px] overflow-hidden">
                  {item.files.map((node) => (
                    <FileTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      selectedFileId={null}
                      activeSelection="item"
                      expandedNodes={expandedNodes}
                      onToggle={onToggleNode}
                      onSelectFile={onSelectFile}
                      onContextMenu={onFileContextMenu}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Additional custom contents or dependencies if any */}
            {itemType === 'plugins' && (
              <>
                {/* Dependencies Section */}
                {(item as Capability & { dependencies?: Record<string, string> }).dependencies && (
                  <div className="py-[17px] border-t border-solid border-[var(--ui-border-muted)]">
                    <h3 className="text-[11px] font-semibold text-[var(--ui-text-primary)] m-0 mb-[9px] uppercase tracking-[0.05em]">
                      Dependencies
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(
                        (item as Capability & { dependencies?: Record<string, string> }).dependencies || {}
                      ).map(([depId, versionRange]) => (
                        <div
                          key={depId}
                          className="flex items-center justify-between p-[8px_12px] bg-[var(--surface-hover)] rounded-md border border-solid border-[var(--ui-border-muted)]"
                        >
                          <span className="text-[12px] text-[var(--ui-text-primary)] font-medium">
                            {depId}
                          </span>
                          <span className="text-[10px] text-[var(--ui-text-secondary)] p-[2px_8px] bg-[var(--accent-primary)]/10 rounded-[4px]">
                            {versionRange}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="py-[17px] border-t border-solid border-[var(--ui-border-muted)]">
                  <PluginReviews pluginId={item.id} pluginName={item.name} />
                </div>
              </>
            )}

            {/* Section 3: Details */}
            <div className="py-[17px] border-t border-solid border-[var(--ui-border-muted)]">
              <div className="grid grid-cols-2 gap-x-[30px] gap-y-[14px] text-[10px]">
                <div>
                  <div className="text-[var(--ui-text-secondary)] font-medium mb-1">Version</div>
                  <div className="text-[var(--ui-text-primary)]">{item.version || '1.4.0'}</div>
                </div>
                <div>
                  <div className="text-[var(--ui-text-secondary)] font-medium mb-1">Status</div>
                  <div className="text-[var(--ui-text-primary)]">
                    {itemType === 'connectors' ? (connectorEnabled ? 'Connected' : 'Available') : (item.enabled ? 'Enabled' : 'Available')}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--ui-text-secondary)] font-medium mb-1">Source</div>
                  <div className="text-[#3e6183] underline underline-offset-2 cursor-pointer font-medium font-sans">
                    Allternit Marketplace ↗
                  </div>
                </div>
                <div>
                  <div className="text-[var(--ui-text-secondary)] font-medium mb-1">Updated</div>
                  <div className="text-[var(--ui-text-primary)]">{item.updatedAt || 'Today'}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Editor or FileContent (Shown when file is selected or isEditing) */
          <>
            <div className="min-h-0 flex-1 overflow-auto bg-transparent border-t border-solid border-[var(--ui-border-muted)] pt-4">
              {isEditing && editingContent !== null ? (
                <textarea aria-label="Text Area" value={editingContent}
                  onChange={(e) => onEditingContentChange(e.target.value)}
                  className="size-full min-h-[300px] p-4 bg-transparent border-none text-[var(--ui-text-primary)] font-mono text-[12px] leading-[1.6] resize-none outline-none"
                />
              ) : (
                <FileContent file={selectedFile!} viewMode={viewMode} />
              )}
            </div>
            {/* Chat-to-edit alongside the direct text editor: the assistant
                reads the open file and proposes a full revision (streamed
                preview); Apply loads it into the textarea above, Save persists.
                Mirrors the agent-workspace Edit-with-chat panel. */}
            {isEditing && editingContent !== null && (
              <WorkspaceChatEditor
                agentId={`capability-${item.id}`}
                agentName="the assistant"
                filePath={selectedFile?.path || item.name}
                content={editingContent}
                onApply={onEditingContentChange}
                subject={`a file of the "${item.name}" ${itemType.replace(/s$/, '')} capability`}
              />
            )}
          </>
        )}
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
            fontFamily: 'var(--font-mono)',
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
          backgroundColor: THEME.bgElevated,
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
    <div className="p-6 max-w-[880px]">
      <div className="flex items-center gap-3.5 mb-[18px]">
        <div className="size-[60px] rounded-[14px] bg-[var(--accent-primary)]/10 border border-solid border-[var(--ui-border-strong)] flex items-center justify-center">
          <PlugsConnected size={28} className="text-[var(--accent-primary)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-[20px] text-[var(--ui-text-primary)] m-0 mb-1">
            {item.appName || item.name}
          </h3>
          <p className="text-[13px] text-[var(--ui-text-secondary)] m-0 leading-[1.5]">
            {item.description}
          </p>
        </div>
        {isDesktopIncluded && (
          <span className="p-[3px_8px] rounded-full border border-solid border-[var(--ui-border-strong)] text-[var(--ui-text-secondary)] text-[12px] tracking-[0.05em] uppercase">
            Included
          </span>
        )}
      </div>

      <div className="mb-3.5 rounded-[10px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-floating)] p-3.5">
        <div className="text-[12px] text-[var(--ui-text-tertiary)] mb-1.5">Connection</div>
        <div className="flex items-center justify-between gap-2.5">
          <div className="text-[var(--ui-text-secondary)] text-[13px]">
            {isDesktopIncluded
              ? 'Included connector is ready in this workspace.'
              : isBusy
                ? 'Updating connection status...'
                : isConnected
                  ? `Connected as ${accountLabel}`
                  : 'Not connected yet. Connect to enable tools and context sync.'}
          </div>
          {!isDesktopIncluded && !isConnected ? (
            <button type="button"
              onClick={onConnectToggle}
              className={`p-[8px_14px] rounded-[7px] bg-[var(--ui-text-primary)] text-[var(--surface-canvas)] border-none text-[13px] font-semibold cursor-pointer whitespace-nowrap ${isBusy ? 'opacity-70' : 'opacity-100'}`}
              disabled={isBusy}
            >
              {isBusy ? 'Connecting...' : 'Connect'}
            </button>
          ) : !isDesktopIncluded ? (
            <button type="button"
              onClick={onConnectToggle}
              className={`p-[7px_12px] rounded-[7px] border border-solid border-[var(--ui-border-strong)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[12px] cursor-pointer whitespace-nowrap ${isBusy ? 'opacity-70' : 'opacity-100'}`}
              disabled={isBusy}
            >
              {isBusy ? 'Updating...' : 'Disconnect'}
            </button>
          ) : (
            <div className="p-[4px_10px] rounded-full text-[12px] text-[var(--status-success)] bg-[var(--status-success-bg)] border border-solid border-[var(--status-success-40)] whitespace-nowrap">
              Connected
            </div>
          )}
        </div>
        {!isDesktopIncluded && isConnected && (
          <div className="mt-2.5 flex gap-3.5 flex-wrap">
            <div className="text-[12px] text-[var(--ui-text-tertiary)]">
              Account: <span className="text-[var(--ui-text-secondary)]">{accountLabel}</span>
            </div>
            {connectedAtLabel && (
              <div className="text-[12px] text-[var(--ui-text-tertiary)]">
                Connected: <span className="text-[var(--ui-text-secondary)]">{connectedAtLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-[10px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-floating)] p-3.5">
        <div className="text-[12px] text-[var(--ui-text-tertiary)] mb-2">Tool permissions</div>
        <ul className="m-0 pl-[18px] text-[var(--ui-text-secondary)] text-[13px] leading-[1.7]">
          {permissionRows.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button"
          onClick={() => openInBrowser('https://docs.allternit.dev/connectors')}
          className="mt-3 border-none bg-transparent text-[var(--accent-primary)] p-0 text-[12px] cursor-pointer hover:underline"
        >
          Manage connector settings
        </button>
      </div>
    </div>
  );
}

function CreateMenuItem({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button"
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
    <button type="button"
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
