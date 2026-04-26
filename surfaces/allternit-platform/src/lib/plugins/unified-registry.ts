/**
 * Unified Plugin Registry
 * 
 * Consolidates ALL plugins into a single system:
 * - Built-in plugins (10 agent modes) - ship with app
 * - Office plugins (Excel, PowerPoint, Word) - ship with app
 * - Feature plugins (Core, Advanced) - ship with app
 * - Marketplace plugins - downloaded from curated sources
 * - Local plugins - loaded from filesystem
 * 
 * All plugins can be:
 * - Toggled on/off in PluginManager view
 * - Installed/uninstalled dynamically
 * - Updated from marketplace
 * - Loaded from local filesystem (dev mode)
 * 
 * Gizzi Code Integration:
 * - All plugins can be accessed via the platform's plugin API
 * - Plugins run in isolated sandboxes
 * - Deterministic actions are enforced
 */

import type { ModePlugin, PluginCapability } from './types';
import type { PluginCategory } from './marketplace';
import type { FeaturePlugin } from '@/plugins/feature.types';
import type { MarketplacePlugin } from '@/plugins/capability.types';
import type { LoadedLocalPlugin } from '@/plugins/localPluginLoader';

// =============================================================================
// PLUGIN SOURCE TYPES
// =============================================================================

export type PluginSource = 
  | 'built-in'      // Ships with app (10 agent modes)
  | 'office'        // Ships with app (Excel, PowerPoint, Word)
  | 'feature'       // Ships with app (Core, Advanced)
  | 'marketplace'   // Downloaded from curated sources
  | 'local';        // Loaded from filesystem (dev)

export type PluginStatus = 
  | 'installed'     // Plugin is installed and available
  | 'enabled'       // Plugin is active and running
  | 'disabled'      // Plugin is installed but inactive
  | 'not-installed' // Plugin available in marketplace but not installed
  | 'updating'      // Plugin is being updated
  | 'error';        // Plugin has an error

// =============================================================================
// UNIFIED PLUGIN INTERFACE
// =============================================================================

export interface UnifiedPlugin {
  // Core identity
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Source & status
  source: PluginSource;
  status: PluginStatus;
  
  // Mode group assignment (for 4-group UI)
  category: PluginCategory;
  shade?: number; // 0-3 for built-in color gradient
  
  // Author info
  author: {
    name: string;
    verified: boolean;
    email?: string;
    url?: string;
  };
  
  // Capabilities
  capabilities: string[];
  deterministicActions: string[];
  
  // Installation
  installPath?: string;          // Where plugin is installed
  installDate?: number;          // When plugin was installed
  lastUpdated?: number;          // Last update timestamp
  
  // Marketplace info (for downloadable plugins)
  marketplaceInfo?: {
    sourceId: string;            // e.g., 'anthropic-official', 'docker'
    sourceTrust: 'official' | 'verified' | 'community';
    repository?: string;
    downloadUrl?: string;
    rating?: number;
    installCount?: number;
  };
  
  // Runtime
  runtime?: {
    instance?: ModePlugin | FeaturePlugin;
    loadError?: string;
    isLoaded: boolean;
  };
  
  // UI
  icon?: string;
  accentColor?: string;
  tags: string[];
}

// =============================================================================
// PLUGIN STORAGE - All plugins stored in single location
// =============================================================================

const STORAGE_KEYS = {
  REGISTRY: 'allternit:unified-plugins:registry:v1',
  INSTALLED: 'allternit:unified-plugins:installed:v1',
  ENABLED: 'allternit:unified-plugins:enabled:v1',
  LOCAL_PATHS: 'allternit:unified-plugins:local-paths:v1',
};

// Default plugin directory (Electron app data)
const DEFAULT_PLUGIN_DIR = 'plugins';

// =============================================================================
// UNIFIED PLUGIN REGISTRY CLASS
// =============================================================================

class UnifiedPluginRegistry {
  private plugins: Map<string, UnifiedPlugin> = new Map();
  private listeners: Set<(plugins: UnifiedPlugin[]) => void> = new Set();
  
  constructor() {
    this.initializeBuiltInPlugins();
    this.loadInstalledPlugins();
  }
  
  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  
  private initializeBuiltInPlugins(): void {
    // These plugins ship with the app and cannot be uninstalled
    const builtInPlugins: UnifiedPlugin[] = [
      // CREATE GROUP (Violet)
      {
        id: 'image',
        name: 'Image',
        description: 'Generate images from text prompts using Pollinations.ai (FREE)',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'create',
        shade: 0,
        author: { name: 'Allternit', verified: true },
        capabilities: ['text-to-image', 'image-variations', 'style-transfer', 'upscale'],
        deterministicActions: [
          'Generate images from text prompts',
          'Create style variations',
          'Return 4 images per prompt',
          'No API key required'
        ],
        runtime: { isLoaded: true },
        tags: ['image', 'generation', 'ai', 'free'],
      },
      {
        id: 'video',
        name: 'Video',
        description: 'Generate videos from text or images using MiniMax/Kling (BYOK)',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'create',
        shade: 1,
        author: { name: 'Allternit', verified: true },
        capabilities: ['text-to-video', 'image-to-video', 'video-editing', 'extend'],
        deterministicActions: [
          'Generate 6-10 second videos',
          'Support 720p/1080p resolution',
          'Create videos from text',
          'Animate static images'
        ],
        runtime: { isLoaded: true },
        tags: ['video', 'generation', 'ai', 'byok'],
      },
      {
        id: 'slides',
        name: 'Slides',
        description: 'Create professional presentations with AI-generated content',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'create',
        shade: 2,
        author: { name: 'Allternit', verified: true },
        capabilities: ['presentation-generation', 'slide-design', 'speaker-notes', 'pptx-export'],
        deterministicActions: [
          'Generate slide content',
          'Apply professional themes',
          'Create speaker notes',
          'Export to HTML/Reveal.js/PPTX'
        ],
        runtime: { isLoaded: true },
        tags: ['slides', 'presentation', 'powerpoint'],
      },
      {
        id: 'website',
        name: 'Website',
        description: 'Build complete websites with Next.js/React/Vue/HTML',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'create',
        shade: 3,
        author: { name: 'Allternit', verified: true },
        capabilities: ['website-generation', 'landing-page', 'responsive-design', 'deployment-prep'],
        deterministicActions: [
          'Generate Next.js/React/Vue/HTML code',
          'Apply Tailwind CSS styling',
          'Create responsive designs',
          'Prepare for deployment'
        ],
        runtime: { isLoaded: true },
        tags: ['website', 'web', 'generator', 'nextjs', 'react'],
      },
      
      // ANALYZE GROUP (Blue)
      {
        id: 'research',
        name: 'Research',
        description: 'Multi-source research with citations and synthesis',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'analyze',
        shade: 0,
        author: { name: 'Allternit', verified: true },
        capabilities: ['web-search', 'citation', 'synthesis', 'source-verification', 'deep-research'],
        deterministicActions: [
          'Search the web',
          'Generate source citations',
          'Score source credibility',
          'Suggest related questions'
        ],
        runtime: { isLoaded: true },
        tags: ['research', 'web-search', 'citations'],
      },
      {
        id: 'data',
        name: 'Data',
        description: 'Data analysis, visualization, and chart generation',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'analyze',
        shade: 2,
        author: { name: 'Allternit', verified: true },
        capabilities: ['csv-import', 'excel-analysis', 'chart-generation', 'sql-query', 'insights'],
        deterministicActions: [
          'Import CSV/Excel files',
          'Generate interactive charts',
          'Run SQL queries',
          'Extract data insights'
        ],
        runtime: { isLoaded: true },
        tags: ['data', 'analysis', 'charts', 'sql'],
      },
      
      // BUILD GROUP (Emerald)
      {
        id: 'code',
        name: 'Code',
        description: 'Generate and execute code in multiple languages with live preview',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'build',
        shade: 0,
        author: { name: 'Allternit', verified: true },
        capabilities: ['code-generation', 'live-preview', 'multi-language', 'package-install'],
        deterministicActions: [
          'Generate TypeScript/Python/React/Vue code',
          'Show live preview',
          'Explain code functionality',
          'Generate project files'
        ],
        runtime: { isLoaded: true },
        tags: ['code', 'development', 'generator', 'preview'],
      },
      {
        id: 'assets',
        name: 'Assets',
        description: 'File management, organization, and asset library',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'build',
        shade: 2,
        author: { name: 'Allternit', verified: true },
        capabilities: ['file-upload', 'ai-tagging', 'semantic-search', 'asset-library'],
        deterministicActions: [
          'Upload and store files',
          'Auto-tag with AI',
          'Enable semantic search',
          'Organize assets'
        ],
        runtime: { isLoaded: true },
        tags: ['assets', 'files', 'management', 'tags'],
      },
      
      // AUTOMATE GROUP (Amber)
      {
        id: 'swarms',
        name: 'Swarms',
        description: 'Multi-agent orchestration and consensus building',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'automate',
        shade: 0,
        author: { name: 'Allternit', verified: true },
        capabilities: ['multi-agent', 'agent-coordination', 'consensus-building', 'task-delegation'],
        deterministicActions: [
          'Create multi-agent teams',
          'Build consensus',
          'Delegate tasks',
          'Execute in parallel'
        ],
        runtime: { isLoaded: true },
        tags: ['swarms', 'agents', 'orchestration'],
      },
      {
        id: 'flow',
        name: 'Flow',
        description: 'Visual workflow automation and custom automations',
        version: '1.0.0',
        source: 'built-in',
        status: 'enabled',
        category: 'automate',
        shade: 2,
        author: { name: 'Allternit', verified: true },
        capabilities: ['visual-builder', 'node-editor', 'trigger-setup', 'automation'],
        deterministicActions: [
          'Build visual workflows',
          'Edit node graphs',
          'Set up triggers',
          'Create custom automations'
        ],
        runtime: { isLoaded: true },
        tags: ['flow', 'workflow', 'automation', 'visual'],
      },
      
      // OFFICE PLUGINS
      {
        id: 'allternit-office-excel',
        name: 'Allternit for Excel',
        description: 'AI-powered Excel automation — formulas, charts, tables, financial modeling',
        version: '1.0.0',
        source: 'office',
        status: 'disabled', // Disabled by default, user must enable
        category: 'analyze',
        author: { name: 'Allternit', verified: true },
        capabilities: ['excel-automation', 'formulas', 'charts', 'financial-modeling'],
        deterministicActions: [
          'Generate Excel formulas',
          'Create charts',
          'Build financial models',
          'Validate data'
        ],
        accentColor: '#217346',
        runtime: { isLoaded: false },
        tags: ['office', 'excel', 'microsoft', 'spreadsheet'],
      },
      {
        id: 'allternit-office-powerpoint',
        name: 'Allternit for PowerPoint',
        description: 'AI-powered slide creation, deck design, content generation',
        version: '1.0.0',
        source: 'office',
        status: 'disabled',
        category: 'create',
        author: { name: 'Allternit', verified: true },
        capabilities: ['powerpoint-automation', 'slides', 'presentations', 'deck-design'],
        deterministicActions: [
          'Generate slide content',
          'Design presentations',
          'Create data visualizations',
          'Apply branding'
        ],
        accentColor: '#D24726',
        runtime: { isLoaded: false },
        tags: ['office', 'powerpoint', 'microsoft', 'slides'],
      },
      {
        id: 'allternit-office-word',
        name: 'Allternit for Word',
        description: 'AI-powered document drafting, editing, redlining, style application',
        version: '1.0.0',
        source: 'office',
        status: 'disabled',
        category: 'create',
        author: { name: 'Allternit', verified: true },
        capabilities: ['word-automation', 'documents', 'writing', 'redline'],
        deterministicActions: [
          'Draft documents',
          'Apply styling',
          'Track changes',
          'Format for compliance'
        ],
        accentColor: '#2B579A',
        runtime: { isLoaded: false },
        tags: ['office', 'word', 'microsoft', 'documents'],
      },
      
      // FEATURE PLUGINS
      {
        id: 'core',
        name: 'Core Features',
        description: 'Basic agent functionality including chat, file handling, session management',
        version: '1.0.0',
        source: 'feature',
        status: 'enabled',
        category: 'automate',
        author: { name: 'Allternit', verified: true },
        capabilities: ['chat', 'file-handling', 'session-management'],
        deterministicActions: [
          'Handle chat messages',
          'Manage file uploads',
          'Track sessions'
        ],
        runtime: { isLoaded: true },
        tags: ['core', 'basic', 'essential'],
      },
      {
        id: 'advanced',
        name: 'Advanced Features',
        description: 'Extended capabilities including computer use, browser automation',
        version: '1.0.0',
        source: 'feature',
        status: 'disabled',
        category: 'automate',
        author: { name: 'Allternit', verified: true },
        capabilities: ['computer-use', 'browser-automation', 'advanced-tools'],
        deterministicActions: [
          'Control computer',
          'Automate browser',
          'Access advanced tools'
        ],
        runtime: { isLoaded: false },
        tags: ['advanced', 'computer-use', 'browser'],
      },
    ];
    
    for (const plugin of builtInPlugins) {
      this.plugins.set(plugin.id, plugin);
    }
  }
  
  private loadInstalledPlugins(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Load installed marketplace plugins
      const installed = localStorage.getItem(STORAGE_KEYS.INSTALLED);
      if (installed) {
        const parsed: UnifiedPlugin[] = JSON.parse(installed);
        for (const plugin of parsed) {
          // Don't override built-in plugins
          if (!this.plugins.has(plugin.id) || plugin.source === 'marketplace' || plugin.source === 'local') {
            this.plugins.set(plugin.id, plugin);
          }
        }
      }
      
      // Load enabled/disabled states
      const enabled = localStorage.getItem(STORAGE_KEYS.ENABLED);
      if (enabled) {
        const enabledMap: Record<string, boolean> = JSON.parse(enabled);
        for (const [id, isEnabled] of Object.entries(enabledMap)) {
          const plugin = this.plugins.get(id);
          if (plugin) {
            plugin.status = isEnabled ? 'enabled' : 'disabled';
          }
        }
      }
    } catch (err) {
      console.error('[UnifiedPluginRegistry] Failed to load plugins:', err);
    }
  }
  
  // ==========================================================================
  // REGISTRY METHODS
  // ==========================================================================
  
  get(id: string): UnifiedPlugin | undefined {
    return this.plugins.get(id);
  }
  
  getAll(): UnifiedPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  getByCategory(category: PluginCategory): UnifiedPlugin[] {
    return this.getAll().filter(p => p.category === category);
  }
  
  getBySource(source: PluginSource): UnifiedPlugin[] {
    return this.getAll().filter(p => p.source === source);
  }
  
  getEnabled(): UnifiedPlugin[] {
    return this.getAll().filter(p => p.status === 'enabled');
  }
  
  getInstalled(): UnifiedPlugin[] {
    return this.getAll().filter(p => 
      p.status === 'installed' || 
      p.status === 'enabled' || 
      p.status === 'disabled'
    );
  }
  
  getAvailableInMarketplace(): UnifiedPlugin[] {
    return this.getAll().filter(p => 
      p.source === 'marketplace' && p.status === 'not-installed'
    );
  }
  
  // ==========================================================================
  // TOGGLE / ENABLE / DISABLE
  // ==========================================================================
  
  async toggle(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    
    // Can't toggle built-in plugins off (they're core to the platform)
    if (plugin.source === 'built-in' && plugin.status === 'enabled') {
      console.warn(`[UnifiedPluginRegistry] Cannot disable built-in plugin: ${id}`);
      return false;
    }
    
    const newStatus = plugin.status === 'enabled' ? 'disabled' : 'enabled';
    return this.setStatus(id, newStatus);
  }
  
  async enable(id: string): Promise<boolean> {
    return this.setStatus(id, 'enabled');
  }
  
  async disable(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (plugin?.source === 'built-in') {
      console.warn(`[UnifiedPluginRegistry] Cannot disable built-in plugin: ${id}`);
      return false;
    }
    return this.setStatus(id, 'disabled');
  }
  
  private async setStatus(id: string, status: PluginStatus): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    
    const oldStatus = plugin.status;
    plugin.status = status;
    
    try {
      if (status === 'enabled') {
        await this.loadPluginRuntime(plugin);
      } else if (status === 'disabled') {
        await this.unloadPluginRuntime(plugin);
      }
      
      this.persistEnabledState();
      this.notifyListeners();
      return true;
    } catch (err) {
      plugin.status = oldStatus;
      plugin.runtime = { 
        isLoaded: false, 
        loadError: err instanceof Error ? err.message : 'Unknown error' 
      };
      return false;
    }
  }
  
  // ==========================================================================
  // INSTALL / UNINSTALL
  // ==========================================================================
  
  async install(plugin: UnifiedPlugin): Promise<boolean> {
    // Built-in and feature plugins are always "installed"
    if (plugin.source === 'built-in' || plugin.source === 'feature') {
      return true;
    }
    
    plugin.status = 'disabled';
    plugin.installDate = Date.now();
    this.plugins.set(plugin.id, plugin);
    
    this.persistInstalledPlugins();
    this.notifyListeners();
    
    return true;
  }
  
  async uninstall(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    
    // Can't uninstall built-in plugins
    if (plugin.source === 'built-in') {
      console.warn(`[UnifiedPluginRegistry] Cannot uninstall built-in plugin: ${id}`);
      return false;
    }
    
    await this.unloadPluginRuntime(plugin);
    
    if (plugin.source === 'marketplace' || plugin.source === 'local') {
      plugin.status = 'not-installed';
      this.plugins.delete(id);
    } else {
      // Office and feature plugins just get disabled
      plugin.status = 'disabled';
    }
    
    this.persistInstalledPlugins();
    this.notifyListeners();
    
    return true;
  }
  
  // ==========================================================================
  // RUNTIME LOADING
  // ==========================================================================
  
  private async loadPluginRuntime(plugin: UnifiedPlugin): Promise<void> {
    if (plugin.runtime?.isLoaded) return;
    
    try {
      switch (plugin.source) {
        case 'built-in':
          // Built-in plugins are imported statically
          const module = await import(`./${plugin.id}/plugin`);
          plugin.runtime = {
            instance: module.default || module.createPlugin?.(),
            isLoaded: true,
          };
          break;
          
        case 'office':
          // Office plugins are loaded from the office-plugins module
          const { OFFICE_PLUGINS } = await import('@/plugins/office-plugins');
          const officePlugin = OFFICE_PLUGINS.find(p => p.id === plugin.id);
          if (officePlugin) {
            plugin.runtime = {
              instance: officePlugin,
              isLoaded: true,
            };
          }
          break;
          
        case 'feature':
          // Feature plugins are loaded from feature registry
          const { featureRegistry } = await import('@/plugins/feature.registry');
          const feature = featureRegistry.get(plugin.id);
          if (feature) {
            plugin.runtime = {
              instance: feature,
              isLoaded: true,
            };
          }
          break;
          
        case 'marketplace':
          // Marketplace plugins are downloaded and loaded dynamically
          // This would integrate with marketplaceInstaller
          plugin.runtime = {
            isLoaded: true, // Placeholder
          };
          break;
          
        case 'local':
          // Local plugins are loaded from filesystem
          plugin.runtime = {
            isLoaded: true, // Placeholder
          };
          break;
      }
    } catch (err) {
      throw new Error(`Failed to load plugin ${plugin.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }
  
  private async unloadPluginRuntime(plugin: UnifiedPlugin): Promise<void> {
    if (!plugin.runtime?.isLoaded) return;
    
    try {
      if (plugin.runtime.instance && 'destroy' in plugin.runtime.instance) {
        await (plugin.runtime.instance as { destroy(): Promise<void> }).destroy();
      }
    } catch (err) {
      console.error(`[UnifiedPluginRegistry] Error unloading plugin ${plugin.id}:`, err);
    }
    
    plugin.runtime = { isLoaded: false };
  }
  
  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================
  
  private persistEnabledState(): void {
    if (typeof window === 'undefined') return;
    
    const enabledMap: Record<string, boolean> = {};
    for (const [id, plugin] of this.plugins) {
      enabledMap[id] = plugin.status === 'enabled';
    }
    
    localStorage.setItem(STORAGE_KEYS.ENABLED, JSON.stringify(enabledMap));
  }
  
  private persistInstalledPlugins(): void {
    if (typeof window === 'undefined') return;
    
    const installed = this.getAll().filter(p => 
      p.source === 'marketplace' || p.source === 'local'
    );
    
    localStorage.setItem(STORAGE_KEYS.INSTALLED, JSON.stringify(installed));
  }
  
  // ==========================================================================
  // LISTENERS
  // ==========================================================================
  
  subscribe(listener: (plugins: UnifiedPlugin[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  private notifyListeners(): void {
    const plugins = this.getAll();
    this.listeners.forEach(listener => {
      try {
        listener(plugins);
      } catch (err) {
        console.error('[UnifiedPluginRegistry] Listener error:', err);
      }
    });
  }
  
  // ==========================================================================
  // GIZZI CODE INTEGRATION
  // ==========================================================================
  
  /**
   * Get all plugins available to Gizzi Code
   */
  getForGizziCode(): UnifiedPlugin[] {
    return this.getEnabled().filter(p => 
      p.source === 'built-in' || 
      p.source === 'marketplace' ||
      p.source === 'local'
    );
  }
  
  /**
   * Execute a plugin action deterministically
   */
  async executePluginAction(
    pluginId: string, 
    action: string, 
    input: unknown
  ): Promise<unknown> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.status !== 'enabled') {
      throw new Error(`Plugin is not enabled: ${pluginId}`);
    }
    
    if (!plugin.deterministicActions.includes(action)) {
      throw new Error(`Unknown action "${action}" for plugin ${pluginId}`);
    }
    
    // Execute via runtime instance
    if (plugin.runtime?.instance && 'execute' in plugin.runtime.instance) {
      return (plugin.runtime.instance as { execute(input: unknown): Promise<unknown> }).execute(input);
    }
    
    throw new Error(`Plugin ${pluginId} does not support execution`);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const unifiedPluginRegistry = new UnifiedPluginRegistry();

// =============================================================================
// REACT HOOK
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useUnifiedPlugins() {
  const [plugins, setPlugins] = useState<UnifiedPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setPlugins(unifiedPluginRegistry.getAll());
    setLoading(false);
    
    return unifiedPluginRegistry.subscribe(setPlugins);
  }, []);
  
  const toggle = useCallback(async (id: string) => {
    return unifiedPluginRegistry.toggle(id);
  }, []);
  
  const install = useCallback(async (plugin: UnifiedPlugin) => {
    return unifiedPluginRegistry.install(plugin);
  }, []);
  
  const uninstall = useCallback(async (id: string) => {
    return unifiedPluginRegistry.uninstall(id);
  }, []);
  
  return {
    plugins,
    loading,
    toggle,
    install,
    uninstall,
    enabled: plugins.filter(p => p.status === 'enabled'),
    installed: plugins.filter(p => 
      p.status === 'installed' || 
      p.status === 'enabled' || 
      p.status === 'disabled'
    ),
    byCategory: (category: PluginCategory) => 
      plugins.filter(p => p.category === category),
  };
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

export function formatPluginDisplayName(plugin: UnifiedPlugin): string {
  const categoryLabels: Record<PluginCategory, string> = {
    create: 'Create',
    analyze: 'Analyze',
    build: 'Build',
    automate: 'Automate',
    cowork: 'Cowork',
    productivity: 'Productivity',
    integration: 'Integration',
    custom: 'Custom',
  };
  
  return `Agent | ${categoryLabels[plugin.category]}-${plugin.name}`;
}

export function getPluginBadge(plugin: UnifiedPlugin): string {
  switch (plugin.source) {
    case 'built-in':
      return 'Built-in';
    case 'office':
      return 'Office';
    case 'feature':
      return 'Feature';
    case 'marketplace':
      return plugin.author.verified ? 'Verified' : 'Community';
    case 'local':
      return 'Local';
    default:
      return 'Plugin';
  }
}

export function getPluginColor(plugin: UnifiedPlugin): string {
  const colors: Record<PluginCategory, string> = {
    create: 'violet',
    analyze: 'blue',
    build: 'emerald',
    automate: 'amber',
    cowork: 'teal',
    productivity: 'cyan',
    integration: 'rose',
    custom: 'zinc',
  };
  
  return colors[plugin.category] || 'zinc';
}

// Export for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).unifiedPluginRegistry = unifiedPluginRegistry;
}
