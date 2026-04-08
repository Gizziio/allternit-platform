/**
 * Allternit Mode Plugins Registry
 * 
 * Central registry for all 10 core mode plugins.
 * Each plugin is lazy-loaded to reduce bundle size.
 */

import type { ModePlugin, PluginCapability } from './types';

// Plugin definitions with lazy loading
export const PLUGINS = {
  research: {
    id: 'research',
    name: 'Research',
    description: 'Multi-source research with citations via Allternit Computer Use',
    icon: 'FileText',
    lazyImport: () => import('@/plugins/built-in/research/plugin'),
    capabilities: ['web-search', 'citation', 'synthesis', 'source-verification'],
    requiresConfig: false,
  },
  data: {
    id: 'data',
    name: 'Data',
    description: 'Data analysis & visualization via Excel Plugin',
    icon: 'Table',
    lazyImport: () => import('@/plugins/built-in/data/plugin'),
    capabilities: ['csv-import', 'excel-analysis', 'chart-generation', 'sql-query', 'insights'],
    requiresConfig: false,
  },
  slides: {
    id: 'slides',
    name: 'Slides',
    description: 'Presentation generation via PPT Plugin',
    icon: 'MonitorPlay',
    lazyImport: () => import('@/plugins/built-in/slides/plugin'),
    capabilities: ['ppt-generation', 'template-selection', 'speaker-notes', 'export-pdf'],
    requiresConfig: false,
  },
  code: {
    id: 'code',
    name: 'Code',
    description: 'Code generation & execution via Sandpack',
    icon: 'Code',
    lazyImport: () => import('@/plugins/built-in/code/plugin'),
    capabilities: ['code-generation', 'live-preview', 'multi-language', 'package-install'],
    requiresConfig: false,
  },
  assets: {
    id: 'assets',
    name: 'Assets',
    description: 'File management via Office Plugin',
    icon: 'FolderOpen',
    lazyImport: () => import('@/plugins/built-in/assets/plugin'),
    capabilities: ['file-upload', 'ai-tagging', 'semantic-search', 'preview'],
    requiresConfig: false,
  },
  swarms: {
    id: 'swarms',
    name: 'Swarms',
    description: 'Multi-agent orchestration for complex tasks',
    icon: 'Cpu',
    lazyImport: () => import('@/plugins/built-in/swarms/plugin'),
    capabilities: ['multi-agent', 'agent-coordination', 'consensus-building', 'parallel-processing'],
    requiresConfig: false,
  },
  flow: {
    id: 'flow',
    name: 'Flow',
    description: 'Workflow automation via Flowise',
    icon: 'Network',
    lazyImport: () => import('@/plugins/built-in/flow/plugin'),
    capabilities: ['visual-builder', 'node-editor', 'trigger-setup', 'automation'],
    requiresConfig: false,
  },
  website: {
    id: 'website',
    name: 'Website',
    description: 'Site generation via Extension + Sandpack',
    icon: 'Globe',
    lazyImport: () => import('@/plugins/built-in/website/plugin'),
    capabilities: ['dom-capture', 'site-clone', 'live-preview', 'deploy'],
    requiresConfig: false,
  },
  image: {
    id: 'image',
    name: 'Image',
    description: 'Image generation via Pollinations (FREE)',
    icon: 'Image',
    lazyImport: () => import('@/plugins/built-in/image/plugin'),
    capabilities: ['text-to-image', 'image-variations', 'style-transfer', 'upscale'],
    requiresConfig: false,
  },
  video: {
    id: 'video',
    name: 'Video',
    description: 'Video generation via MiniMax/Kling (BYOK)',
    icon: 'Video',
    lazyImport: () => import('@/plugins/built-in/video/plugin'),
    capabilities: ['text-to-video', 'image-to-video', 'video-editing', 'extend'],
    requiresConfig: true,
    configType: 'byok',
  },
} as const;

export type PluginId = keyof typeof PLUGINS;

// Plugin cache
const pluginCache = new Map<string, ModePlugin>();

/**
 * Load a plugin by ID
 */
export async function loadPlugin(id: PluginId): Promise<ModePlugin> {
  if (pluginCache.has(id)) {
    return pluginCache.get(id)!;
  }

  const definition = PLUGINS[id];
  if (!definition) {
    throw new Error(`Plugin not found: ${id}`);
  }

  const module = await definition.lazyImport();
  const plugin = module.default || module.plugin;
  
  // Initialize the plugin
  await plugin.initialize();
  
  pluginCache.set(id, plugin);
  return plugin;
}

/**
 * Get plugin info without loading
 */
export function getPluginInfo(id: PluginId) {
  const def = PLUGINS[id];
  if (!def) return null;
  
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    capabilities: def.capabilities,
    requiresConfig: def.requiresConfig,
    configType: def.configType,
  };
}

/**
 * List all available plugins
 */
export function listPlugins() {
  return Object.values(PLUGINS).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    capabilities: p.capabilities,
    requiresConfig: p.requiresConfig,
    configType: p.configType,
  }));
}

/**
 * Check if plugin is loaded
 */
export function isPluginLoaded(id: PluginId): boolean {
  return pluginCache.has(id);
}

/**
 * Unload a plugin
 */
export async function unloadPlugin(id: PluginId): Promise<void> {
  const plugin = pluginCache.get(id);
  if (plugin) {
    await plugin.destroy();
    pluginCache.delete(id);
  }
}

// Re-export types
export * from './types';
