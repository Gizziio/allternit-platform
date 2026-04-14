/**
 * Plugin Adapter
 * 
 * Adapts runtime plugin loading to inject A2R Kernel governance.
 */

import type { A2RKernel } from '@a2r/governor';
import type {
  RuntimeToolPolicy,

} from '../types.js';

/**
 * Plugin tool metadata
 */
export interface PluginTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  pluginId: string;
  version?: string;
}

/**
 * Plugin metadata
 */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  tools: PluginTool[];
  hooks?: {
    onLoad?: () => void | Promise<void>;
    onUnload?: () => void | Promise<void>;
  };
}

/**
 * Plugin adapter options
 */
export interface PluginAdapterOptions {
  kernel: A2RKernel;
  allowedPlugins?: string[];
  deniedPlugins?: string[];
  requireWih?: boolean;
  toolPolicy?: RuntimeToolPolicy;
  onPluginLoad?: (plugin: Plugin) => void;
  onPluginDenied?: (pluginId: string, reason: string) => void;
}

/**
 * Plugin registry entry
 */
interface RegistryEntry {
  plugin: Plugin;
  loadedAt: string;
  wihId?: string;
}

/**
 * Plugin adapter
 */
export class PluginAdapter {
  private registry = new Map<string, RegistryEntry>();
  private options: PluginAdapterOptions;

  constructor(options: PluginAdapterOptions) {
    this.options = {
      requireWih: true,
      ...options,
    };
  }

  async canLoadPlugin(
    pluginId: string,
    context?: { wihId?: string; sessionId?: string }
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (this.options.allowedPlugins && 
        !this.options.allowedPlugins.includes(pluginId)) {
      return {
        allowed: false,
        reason: `Plugin '${pluginId}' not in allowlist`,
      };
    }

    if (this.options.deniedPlugins?.includes(pluginId)) {
      return {
        allowed: false,
        reason: `Plugin '${pluginId}' is in denylist`,
      };
    }

    if (this.options.requireWih && context?.wihId) {
      const wih = await this.options.kernel.getWih(context.wihId);
      
      if (!wih) {
        return {
          allowed: false,
          reason: `WIH ${context.wihId} not found`,
        };
      }

      if (wih.status === 'blocked') {
        return {
          allowed: false,
          reason: `WIH ${context.wihId} is blocked`,
        };
      }

      if ((wih.routing as any)?.allowedPlugins && 
          !(wih.routing as any).allowedPlugins.includes(pluginId)) {
        return {
          allowed: false,
          reason: `Plugin '${pluginId}' not allowed by WIH ${context.wihId}`,
        };
      }
    }

    return { allowed: true };
  }

  async loadPlugin(
    plugin: Plugin,
    context?: { wihId?: string; sessionId?: string }
  ): Promise<{ success: boolean; error?: string }> {
    const check = await this.canLoadPlugin(plugin.id, context);
    
    if (!check.allowed) {
      this.options.onPluginDenied?.(plugin.id, check.reason!);
      return { success: false, error: check.reason };
    }

    const filteredTools = this.filterTools(plugin.tools);
    
    if (filteredTools.length !== plugin.tools.length) {
      console.log(
        `Plugin ${plugin.id}: ${plugin.tools.length - filteredTools.length} tools filtered by policy`
      );
    }

    const governedPlugin: Plugin = {
      ...plugin,
      tools: filteredTools,
    };

    this.registry.set(plugin.id, {
      plugin: governedPlugin,
      loadedAt: new Date().toISOString(),
      wihId: context?.wihId,
    });

    if (plugin.hooks?.onLoad) {
      try {
        await plugin.hooks.onLoad();
      } catch (error) {
        console.error(`Plugin ${plugin.id} onLoad error:`, error);
      }
    }

    this.options.onPluginLoad?.(governedPlugin);

    return { success: true };
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      return false;
    }

    if (entry.plugin.hooks?.onUnload) {
      try {
        await entry.plugin.hooks.onUnload();
      } catch (error) {
        console.error(`Plugin ${pluginId} onUnload error:`, error);
      }
    }

    this.registry.delete(pluginId);
    return true;
  }

  getPlugin(pluginId: string): Plugin | null {
    return this.registry.get(pluginId)?.plugin ?? null;
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.registry.values()).map(e => e.plugin);
  }

  getAllTools(): PluginTool[] {
    return this.getAllPlugins().flatMap(p => p.tools);
  }

  getPluginTools(pluginId: string): PluginTool[] {
    return this.getPlugin(pluginId)?.tools ?? [];
  }

  hasTool(toolName: string): boolean {
    return this.getAllTools().some(t => t.name === toolName);
  }

  getTool(toolName: string): PluginTool | null {
    return this.getAllTools().find(t => t.name === toolName) ?? null;
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    return tool.execute(params);
  }

  private filterTools(tools: PluginTool[]): PluginTool[] {
    if (!this.options.toolPolicy) {
      return tools;
    }

    const { allow, deny } = this.options.toolPolicy;

    return tools.filter(tool => {
      if (deny?.includes(tool.name)) {
        return false;
      }

      if (allow && !allow.includes(tool.name)) {
        return false;
      }

      return true;
    });
  }

  async clear(): Promise<void> {
    for (const [id] of this.registry) {
      await this.unloadPlugin(id);
    }
  }

  getStats(): {
    totalPlugins: number;
    totalTools: number;
    toolsByPlugin: Record<string, number>;
  } {
    const toolsByPlugin: Record<string, number> = {};
    
    for (const [id, entry] of this.registry) {
      toolsByPlugin[id] = entry.plugin.tools.length;
    }

    return {
      totalPlugins: this.registry.size,
      totalTools: this.getAllTools().length,
      toolsByPlugin,
    };
  }
}

export function createWrappedPluginResolver(options: PluginAdapterOptions) {
  const adapter = new PluginAdapter(options);

  return {
    adapter,
    async resolve(params: {
      wihId?: string;
      sessionId?: string;
      availablePlugins: Plugin[];
    }): Promise<Plugin[]> {
      for (const plugin of params.availablePlugins) {
        await adapter.loadPlugin(plugin, {
          wihId: params.wihId,
          sessionId: params.sessionId,
        });
      }

      return adapter.getAllPlugins();
    },

    getTools(): PluginTool[] {
      return adapter.getAllTools();
    },

    executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
      return adapter.executeTool(toolName, params);
    },
  };
}
