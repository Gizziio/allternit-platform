/**
 * Plugin Runtime
 * 
 * Unified runtime for ALL plugin types:
 * - Built-in plugins: TypeScript implementations
 * - Vendor plugins: Markdown-based deterministic execution
 * 
 * Provides a single interface for the chat system to execute any plugin.
 */

import { loadPlugin, type PluginId } from './index';
import {
  deterministicExecutor,
  exportToPortableFormat,
  type PortablePlugin
} from './deterministic-executor';
import {
  isVendorCommand,
  parseCommandInput,
} from './vendor-integration';
import { getBundledPlugin } from './marketplace-integration';
import { getPluginById } from './registry';

// =============================================================================
// UNIFIED EXECUTION REQUEST
// =============================================================================

export interface PluginExecutionRequest {
  // Input
  input: string;
  files?: File[];
  
  // Context
  context?: {
    messages: Array<{ role: string; content: string }>;
    workspaceId?: string;
    userId?: string;
  };
  
  // Optional explicit plugin selection
  pluginId?: string;
  commandId?: string;
}

export interface PluginExecutionResult {
  success: boolean;
  content: string;
  source: 'built-in' | 'vendor-command' | 'vendor-skill' | 'natural-language';
  pluginId?: string;
  commandId?: string;
  actions: Array<{
    type: string;
    description: string;
    timestamp: number;
  }>;
  artifacts?: Array<{
    type: string;
    name: string;
    url: string;
  }>;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  // For deterministic execution
  deterministic?: boolean;
  auditLog?: unknown[];
}

// =============================================================================
// UNIFIED RUNTIME
// =============================================================================

class PluginRuntime {
  /**
   * Execute any plugin request
   * Automatically detects the plugin type and routes appropriately
   */
  async execute(request: PluginExecutionRequest): Promise<PluginExecutionResult> {
    const { input, pluginId, commandId, files, context } = request;
    
    // 1. Check for explicit vendor command: /legal:triage-nda
    if (input.trim().startsWith('/') && input.includes(':')) {
      return this.executeVendorCommand(input, files, context);
    }
    
    // 2. Check for built-in mode trigger: /research, /code, etc.
    const parsed = parseCommandInput(input);
    if (parsed.type === 'built-in' && parsed.pluginId) {
      return this.executeBuiltIn(parsed.pluginId as PluginId, input, files, context);
    }
    
    // 3. Check for explicit plugin/command IDs
    if (pluginId && commandId) {
      // Check if it's a bundled plugin (including vendor ones)
      const bundled = getBundledPlugin(pluginId);
      if (bundled?.bundledSource === 'vendor') {
        return this.executeVendorPluginCommand(pluginId, commandId, input, files, context);
      }
      
      // Otherwise try built-in
      if (this.isBuiltInPlugin(pluginId)) {
        return this.executeBuiltIn(pluginId as PluginId, input, files, context);
      }
    }
    
    // 4. Natural language - no specific plugin
    return {
      success: true,
      content: input,
      source: 'natural-language',
      actions: [],
    };
  }
  
  /**
   * Execute a built-in TypeScript plugin
   */
  private async executeBuiltIn(
    pluginId: PluginId,
    input: string,
    files?: File[],
    context?: PluginExecutionRequest['context']
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    
    try {
      const plugin = await loadPlugin(pluginId);
      
      const result = await plugin.execute({
        prompt: input,
        files,
        context,
      });
      
      return {
        success: result.success,
        content: result.content || '',
        source: 'built-in',
        pluginId,
        actions: [{
          type: 'plugin-execute',
          description: `Execute ${pluginId} plugin`,
          timestamp: startTime,
        }],
        artifacts: result.artifacts?.map(a => ({
          type: a.type,
          name: a.name,
          url: a.url,
        })),
        deterministic: false, // Built-in plugins may be non-deterministic
      };
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        success: false,
        content: '',
        source: 'built-in',
        pluginId,
        actions: [],
        error: {
          code: 'PLUGIN_EXECUTION_ERROR',
          message: error.message,
          recoverable: false,
        },
      };
    }
  }
  
  /**
   * Execute a vendor command: /legal:triage-nda
   */
  private async executeVendorCommand(
    input: string,
    files?: File[],
    context?: PluginExecutionRequest['context']
  ): Promise<PluginExecutionResult> {
    const trigger = input.trim().split(' ')[0]; // Get just the command part
    
    if (!isVendorCommand(trigger)) {
      return {
        success: false,
        content: '',
        source: 'vendor-command',
        actions: [],
        error: {
          code: 'UNKNOWN_COMMAND',
          message: `Unknown command: ${trigger}`,
          recoverable: true,
        },
      };
    }
    
    // Parse pluginId and commandId from trigger: /legal:triage-nda
    const [pluginId, commandId] = trigger.slice(1).split(':');
    const args = input.trim().slice(trigger.length).trim();
    
    // Execute via deterministic executor
    const result = await deterministicExecutor.execute({
      pluginId,
      commandId,
      inputs: { prompt: args },
      files,
      context: {
        ...context,
        sessionId: context?.workspaceId,
      },
    });
    
    return {
      success: result.success,
      content: result.output,
      source: 'vendor-command',
      pluginId,
      commandId,
      actions: result.actions.map(a => ({
        type: a.type,
        description: a.description,
        timestamp: a.timestamp,
      })),
      artifacts: result.artifacts?.map(a => ({
        type: a.type,
        name: a.name,
        url: `data:${a.format};base64,${Buffer.from(a.content).toString('base64')}`,
      })),
      deterministic: true,
      auditLog: result.actions,
      error: result.error,
    };
  }
  
  /**
   * Execute a specific vendor plugin command by ID
   */
  private async executeVendorPluginCommand(
    pluginId: string,
    commandId: string,
    input: string,
    files?: File[],
    context?: PluginExecutionRequest['context']
  ): Promise<PluginExecutionResult> {
    const result = await deterministicExecutor.execute({
      pluginId,
      commandId,
      inputs: { prompt: input },
      files,
      context: {
        ...context,
        sessionId: context?.workspaceId,
      },
    });
    
    return {
      success: result.success,
      content: result.output,
      source: 'vendor-skill',
      pluginId,
      commandId,
      actions: result.actions.map(a => ({
        type: a.type,
        description: a.description,
        timestamp: a.timestamp,
      })),
      deterministic: true,
      auditLog: result.actions,
      error: result.error,
    };
  }
  
  /**
   * Check if a plugin ID is a built-in plugin
   */
  private isBuiltInPlugin(pluginId: string): boolean {
    const builtInIds = ['image', 'video', 'slides', 'website', 'research', 'data', 'code', 'assets', 'swarms', 'flow'];
    return builtInIds.includes(pluginId);
  }
  
  // =============================================================================
  // EXPORT/IMPORT FOR EXTERNAL USE
  // =============================================================================
  
  /**
   * Export a plugin to portable format for external use
   */
  async exportPlugin(pluginId: string): Promise<PortablePlugin | null> {
    return exportToPortableFormat(pluginId);
  }
  
  /**
   * Get available commands for a plugin
   */
  getPluginCommands(pluginId: string): Array<{ name: string; trigger: string; description: string }> | null {
    const bundled = getBundledPlugin(pluginId);
    if (!bundled) return null;
    
    // For vendor plugins, return command list from registry
    if (bundled.bundledSource === 'vendor') {
      const plugin = getPluginById(pluginId);
      if (!plugin) return null;
      
      return (plugin as any).commands?.map((c: any) => ({
        name: c.name,
        trigger: c.trigger,
        description: c.description,
      }));
    }
    
    // Built-in plugins don't have slash commands
    return [];
  }
  
  /**
   * List all executable plugins
   */
  listExecutablePlugins(): Array<{
    id: string;
    name: string;
    type: 'built-in' | 'vendor';
    commands?: string[];
  }> {
    const plugins: Array<{ id: string; name: string; type: 'built-in' | 'vendor'; commands?: string[] }> = [];
    
    // Built-in plugins
    const builtInIds = ['image', 'video', 'slides', 'website', 'research', 'data', 'code', 'assets', 'swarms', 'flow'];
    for (const id of builtInIds) {
      const plugin = getBundledPlugin(id);
      if (plugin) {
        plugins.push({ id, name: plugin.name, type: 'built-in' });
      }
    }
    
    // Vendor plugins
    const vendorPlugins = getBundledPlugin('legal')?.bundledSource === 'vendor' ? [
      'legal', 'engineering', 'data-claude', 'design', 'sales', 'marketing',
      'finance', 'human-resources', 'customer-support', 'operations',
      'product-management', 'enterprise-search', 'bio-research', 'productivity',
      'cowork-plugin-management', 'partner-built'
    ] : [];
    
    for (const id of vendorPlugins) {
      const plugin = getBundledPlugin(id);
      const commands = this.getPluginCommands(id);
      if (plugin) {
        plugins.push({
          id,
          name: plugin.name,
          type: 'vendor',
          commands: commands?.map(c => c.trigger),
        });
      }
    }
    
    return plugins;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const pluginRuntime = new PluginRuntime();

// =============================================================================
// REACT HOOK
// =============================================================================

import { useState, useCallback } from 'react';

export function usePluginRuntime() {
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<PluginExecutionResult | null>(null);
  
  const execute = useCallback(async (request: PluginExecutionRequest): Promise<PluginExecutionResult> => {
    setExecuting(true);
    try {
      const result = await pluginRuntime.execute(request);
      setLastResult(result);
      return result;
    } finally {
      setExecuting(false);
    }
  }, []);
  
  const executeCommand = useCallback(async (
    pluginId: string,
    commandId: string,
    input: string,
    files?: File[]
  ): Promise<PluginExecutionResult> => {
    return execute({
      pluginId,
      commandId,
      input,
      files,
    });
  }, [execute]);
  
  return {
    execute,
    executeCommand,
    executing,
    lastResult,
    listPlugins: useCallback(() => pluginRuntime.listExecutablePlugins(), []),
    getCommands: useCallback((pluginId: string) => pluginRuntime.getPluginCommands(pluginId), []),
    exportPlugin: useCallback((pluginId: string) => pluginRuntime.exportPlugin(pluginId), []),
  };
}
