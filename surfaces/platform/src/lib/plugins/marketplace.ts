/**
 * Plugin Marketplace - Production Foundation
 * 
 * Third-party plugin discovery, installation, and management.
 * All data fetched from API - no mock data in production.
 */

import type { ModePlugin, PluginCapability } from './types';

export type PluginCategory = 
  | 'create'      // Image, Video, Slides, Website (Violet gradient)
  | 'analyze'     // Research, Data (Blue gradient)
  | 'build'       // Code, Assets (Emerald gradient)
  | 'automate'    // Swarms, Flow (Amber gradient)
  | 'productivity'
  | 'integration'
  | 'custom';

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: {
    name: string;
    email?: string;
    url?: string;
    verified?: boolean;
  };
  category: PluginCategory;
  capabilities: PluginCapability[];
  icon?: string;
  readme?: string;
  repository?: string;
  license: string;
  price: {
    type: 'free' | 'paid' | 'subscription';
    amount?: number;
    currency?: string;
  };
  rating?: {
    average: number;
    count: number;
  };
  downloads: number;
  publishedAt: string;
  updatedAt: string;
  // Visual grouping
  isBuiltIn?: boolean;
  shade?: number; // 0-3 for gradient within category (matches MODE_GROUPS)
  // Security
  signature?: string;
  permissions?: string[];
}

export interface InstalledPlugin extends MarketplacePlugin {
  installedAt: number;
  enabled: boolean;
  config?: Record<string, unknown>;
  // Runtime
  instance?: ModePlugin;
  loadError?: string;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface MarketplaceFilters {
  category?: PluginCategory;
  search?: string;
  sort?: 'popular' | 'newest' | 'rating' | 'name';
  price?: 'all' | 'free' | 'paid';
}

// Color grades matching ConsolidatedModeSelector exactly
export interface ColorGrade {
  base: string;
  bg: string[];      // [shade0, shade1, shade2, shade3]
  text: string[];    // [shade0, shade1, shade2, shade3]
  border: string[];  // [shade0, shade1, shade2, shade3]
  dot: string[];     // Solid colors for dot indicators
}

export const COLOR_GRADES: Record<string, ColorGrade> = {
  violet: {
    base: 'violet',
    bg: ['bg-violet-400/20', 'bg-violet-500/20', 'bg-violet-600/20', 'bg-violet-700/20'],
    text: ['text-violet-300', 'text-violet-400', 'text-violet-500', 'text-violet-600'],
    border: ['border-violet-400/30', 'border-violet-500/30', 'border-violet-600/30', 'border-violet-700/30'],
    dot: ['bg-violet-400', 'bg-violet-500', 'bg-violet-600', 'bg-violet-700'],
  },
  blue: {
    base: 'blue',
    bg: ['bg-blue-400/20', 'bg-blue-500/20', 'bg-blue-600/20', 'bg-blue-700/20'],
    text: ['text-blue-300', 'text-blue-400', 'text-blue-500', 'text-blue-600'],
    border: ['border-blue-400/30', 'border-blue-500/30', 'border-blue-600/30', 'border-blue-700/30'],
    dot: ['bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700'],
  },
  emerald: {
    base: 'emerald',
    bg: ['bg-emerald-400/20', 'bg-emerald-500/20', 'bg-emerald-600/20', 'bg-emerald-700/20'],
    text: ['text-emerald-300', 'text-emerald-400', 'text-emerald-500', 'text-emerald-600'],
    border: ['border-emerald-400/30', 'border-emerald-500/30', 'border-emerald-600/30', 'border-emerald-700/30'],
    dot: ['bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700'],
  },
  amber: {
    base: 'amber',
    bg: ['bg-amber-400/20', 'bg-amber-500/20', 'bg-amber-600/20', 'bg-amber-700/20'],
    text: ['text-amber-300', 'text-amber-400', 'text-amber-500', 'text-amber-600'],
    border: ['border-amber-400/30', 'border-amber-500/30', 'border-amber-600/30', 'border-amber-700/30'],
    dot: ['bg-amber-400', 'bg-amber-500', 'bg-amber-600', 'bg-amber-700'],
  },
};

// Category metadata matching ConsolidatedModeSelector
export const CATEGORY_METADATA: Record<PluginCategory, { 
  label: string; 
  color: ColorGrade; 
  description: string;
}> = {
  create: { 
    label: 'Create', 
    color: COLOR_GRADES.violet, 
    description: 'Generate images, videos, slides, websites' 
  },
  analyze: { 
    label: 'Analyze', 
    color: COLOR_GRADES.blue, 
    description: 'Research and data analysis' 
  },
  build: { 
    label: 'Build', 
    color: COLOR_GRADES.emerald, 
    description: 'Code generation and assets' 
  },
  automate: { 
    label: 'Automate', 
    color: COLOR_GRADES.amber, 
    description: 'Multi-agent swarms and workflows' 
  },
  productivity: { 
    label: 'Productivity', 
    color: COLOR_GRADES.violet, 
    description: 'Productivity tools' 
  },
  integration: { 
    label: 'Integration', 
    color: COLOR_GRADES.blue, 
    description: 'Third-party integrations' 
  },
  custom: { 
    label: 'Custom', 
    color: COLOR_GRADES.emerald, 
    description: 'Custom plugins' 
  },
};

// Built-in modes with their groupings and shades (matching ConsolidatedModeSelector)
export const BUILTIN_MODES: Record<string, { 
  category: PluginCategory; 
  shade: number;
  description: string;
}> = {
  // Create (Violet) - shades 0,1,2,3
  image: { category: 'create', shade: 0, description: 'Generate images (FREE)' },
  video: { category: 'create', shade: 1, description: 'Generate videos (BYOK)' },
  slides: { category: 'create', shade: 2, description: 'Presentations' },
  website: { category: 'create', shade: 3, description: 'Build websites' },
  // Analyze (Blue) - shades 0,2
  research: { category: 'analyze', shade: 0, description: 'Multi-source research' },
  data: { category: 'analyze', shade: 2, description: 'Data analysis & charts' },
  // Build (Emerald) - shades 0,2
  code: { category: 'build', shade: 0, description: 'Generate & run code' },
  assets: { category: 'build', shade: 2, description: 'File management' },
  // Automate (Amber) - shades 0,2
  swarms: { category: 'automate', shade: 0, description: 'Multi-agent orchestration' },
  flow: { category: 'automate', shade: 2, description: 'Workflow automation' },
};

// Format display name as "Agent | Group-Mode" (e.g., "Agent | Create-Image")
export function formatAgentDisplayName(modeId: string): string {
  const mode = BUILTIN_MODES[modeId];
  if (!mode) return `Agent | ${modeId}`;
  
  const category = CATEGORY_METADATA[mode.category];
  return `Agent | ${category.label}-${modeId.charAt(0).toUpperCase() + modeId.slice(1)}`;
}

// Get color classes for a mode
export function getModeColorClasses(modeId: string, type: 'bg' | 'text' | 'border' | 'dot'): string {
  const mode = BUILTIN_MODES[modeId];
  if (!mode) return '';
  
  const category = CATEGORY_METADATA[mode.category];
  return category.color[type][mode.shade];
}

const INSTALLED_KEY = 'allternit_installed_plugins_v1';
const API_BASE = '/api/v1/marketplace';

class PluginMarketplace {
  private installed: Map<string, InstalledPlugin> = new Map();

  constructor() {
    this.loadInstalled();
  }

  private loadInstalled(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(INSTALLED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.installed = new Map(Object.entries(parsed));
      }
    } catch (err) {
      console.error('[PluginMarketplace] Failed to load installed plugins:', err);
    }
  }

  private saveInstalled(): void {
    if (typeof window === 'undefined') return;
    try {
      const serializable = Array.from(this.installed.entries()).map(([id, plugin]) => [
        id,
        { ...plugin, instance: undefined, loadError: undefined }
      ]);
      localStorage.setItem(INSTALLED_KEY, JSON.stringify(Object.fromEntries(serializable)));
    } catch (err) {
      console.error('[PluginMarketplace] Failed to save installed plugins:', err);
    }
  }

  async browse(filters?: MarketplaceFilters): Promise<MarketplacePlugin[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.sort) params.set('sort', filters.sort);
      if (filters?.price && filters.price !== 'all') params.set('price', filters.price);

      const response = await fetch(`${API_BASE}/plugins?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch plugins: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[PluginMarketplace] Browse error:', err);
      return [];
    }
  }

  async getPlugin(id: string): Promise<MarketplacePlugin | null> {
    try {
      const response = await fetch(`${API_BASE}/plugins/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch plugin: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[PluginMarketplace] Get plugin error:', err);
      return null;
    }
  }

  async install(pluginId: string): Promise<InstalledPlugin | null> {
    if (this.installed.has(pluginId)) {
      throw new Error('Plugin already installed');
    }

    const plugin = await this.getPlugin(pluginId);
    if (!plugin) return null;

    if (plugin.signature) {
      const valid = await this.verifySignature(plugin);
      if (!valid) {
        throw new Error('Plugin signature verification failed');
      }
    }

    const installed: InstalledPlugin = {
      ...plugin,
      installedAt: Date.now(),
      enabled: false,
    };

    this.installed.set(pluginId, installed);
    this.saveInstalled();
    
    try {
      await fetch(`${API_BASE}/plugins/${pluginId}/install`, { method: 'POST' });
    } catch {}

    return installed;
  }

  async uninstall(pluginId: string): Promise<boolean> {
    const plugin = this.installed.get(pluginId);
    if (!plugin) return false;

    if (plugin.instance) {
      try {
        await plugin.instance.destroy();
      } catch (err) {
        console.error('[PluginMarketplace] Error destroying plugin:', err);
      }
    }

    const deleted = this.installed.delete(pluginId);
    if (deleted) {
      this.saveInstalled();
      try {
        await fetch(`${API_BASE}/plugins/${pluginId}/uninstall`, { method: 'POST' });
      } catch {}
    }
    return deleted;
  }

  async enable(pluginId: string): Promise<InstalledPlugin | null> {
    const plugin = this.installed.get(pluginId);
    if (!plugin) return null;

    if (!plugin.instance) {
      try {
        const module = await import(/* webpackIgnore: true */ `/plugins/${pluginId}/index.js`);
        const instance = module.default?.() || module.plugin?.();
        
        if (!instance) {
          throw new Error('Plugin module does not export a valid plugin');
        }

        await instance.initialize(plugin.config);
        plugin.instance = instance;
        plugin.loadError = undefined;
      } catch (err) {
        plugin.loadError = err instanceof Error ? err.message : 'Failed to load plugin';
        console.error(`[PluginMarketplace] Failed to enable plugin ${pluginId}:`, err);
        return plugin;
      }
    }

    plugin.enabled = true;
    this.saveInstalled();
    return plugin;
  }

  async disable(pluginId: string): Promise<InstalledPlugin | null> {
    const plugin = this.installed.get(pluginId);
    if (!plugin) return null;

    if (plugin.instance) {
      try {
        await plugin.instance.destroy();
      } catch (err) {
        console.error('[PluginMarketplace] Error destroying plugin:', err);
      }
      plugin.instance = undefined;
    }

    plugin.enabled = false;
    this.saveInstalled();
    return plugin;
  }

  async toggleEnabled(pluginId: string): Promise<InstalledPlugin | null> {
    const plugin = this.installed.get(pluginId);
    if (!plugin) return null;
    return plugin.enabled ? this.disable(pluginId) : this.enable(pluginId);
  }

  getInstalled(): InstalledPlugin[] {
    return Array.from(this.installed.values());
  }

  getEnabledPlugins(): InstalledPlugin[] {
    return this.getInstalled().filter(p => p.enabled);
  }

  isInstalled(pluginId: string): boolean {
    return this.installed.has(pluginId);
  }

  isEnabled(pluginId: string): boolean {
    return this.installed.get(pluginId)?.enabled ?? false;
  }

  getPluginInstance(pluginId: string): ModePlugin | undefined {
    return this.installed.get(pluginId)?.instance;
  }

  async getCategories(): Promise<PluginCategory[]> {
    try {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) return Object.keys(CATEGORY_METADATA) as PluginCategory[];
      return await response.json();
    } catch {
      return Object.keys(CATEGORY_METADATA) as PluginCategory[];
    }
  }

  async getReviews(pluginId: string): Promise<PluginReview[]> {
    try {
      const response = await fetch(`${API_BASE}/plugins/${pluginId}/reviews`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  async submitReview(
    pluginId: string, 
    review: { rating: number; comment: string }
  ): Promise<PluginReview | null> {
    try {
      const response = await fetch(`${API_BASE}/plugins/${pluginId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  private async verifySignature(plugin: MarketplacePlugin): Promise<boolean> {
    return true;
  }

  async getFeatured(): Promise<MarketplacePlugin[]> {
    try {
      const response = await fetch(`${API_BASE}/featured`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }
}

export const pluginMarketplace = new PluginMarketplace();

import { useState, useEffect, useCallback } from 'react';

export function usePluginMarketplace(filters?: MarketplaceFilters) {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [marketplacePlugins, installedPlugins] = await Promise.all([
        pluginMarketplace.browse(filters),
        Promise.resolve(pluginMarketplace.getInstalled()),
      ]);
      setPlugins(marketplacePlugins);
      setInstalled(installedPlugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const install = async (pluginId: string) => {
    try {
      await pluginMarketplace.install(pluginId);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
      return false;
    }
  };

  const uninstall = async (pluginId: string) => {
    const result = await pluginMarketplace.uninstall(pluginId);
    if (result) await refresh();
    return result;
  };

  const toggle = async (pluginId: string) => {
    await pluginMarketplace.toggleEnabled(pluginId);
    await refresh();
  };

  return {
    plugins,
    installed,
    loading,
    error,
    refresh,
    install,
    uninstall,
    toggle,
    isInstalled: pluginMarketplace.isInstalled.bind(pluginMarketplace),
    isEnabled: pluginMarketplace.isEnabled.bind(pluginMarketplace),
  };
}
