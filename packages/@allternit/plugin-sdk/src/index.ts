/**
 * Allternit Plugin SDK
 * 
 * Universal plugin runtime for LLM platforms.
 * Build once, run anywhere.
 */

// Core types
export * from './types';

// Adapters
export { McpAdapter, McpAdapterConfig } from './adapters/mcp';
export { HttpAdapter, HttpAdapterConfig } from './adapters/http';
export { NativeAdapter, NativeAdapterConfig, AllternitRuntime } from './adapters/native';
export { CliAdapter, CliAdapterConfig } from './adapters/cli';
export { VSCodeAdapter, VSCodeAdapterConfig } from './adapters/vscode';
export { LangChainAdapter, LangChainAdapterConfig, AllternitTool } from './adapters/langchain';

// Plugin base class
import { Plugin, PluginManifest, PluginHost, ExecutionContext, ExecutionResult } from './types';

/**
 * Base plugin class
 * 
 * Extend this to create plugins with type safety.
 */
export abstract class BasePlugin implements Plugin {
  abstract readonly manifest: PluginManifest;
  
  protected host!: PluginHost;
  
  async initialize(host: PluginHost): Promise<void> {
    this.host = host;
    await this.onInit?.();
  }
  
  abstract execute(
    functionName: string,
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<ExecutionResult>;
  
  async destroy?(): Promise<void> {
    // Override to cleanup
  }
  
  protected onInit?(): Promise<void>;
}

/**
 * Plugin registry
 */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  
  register(plugin: Plugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }
  
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }
  
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  async loadFromDirectory(dir: string): Promise<void> {
    // Dynamic import plugins
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(dir, entry.name, 'index.js');
        try {
          const module = await import(pluginPath);
          if (module.default) {
            this.register(new module.default());
          }
        } catch (e) {
          console.error(`Failed to load plugin from ${pluginPath}:`, e);
        }
      }
    }
  }
}

/**
 * Plugin runtime
 * 
 * Manages plugin lifecycle and adapter selection.
 */
export class PluginRuntime {
  private registry = new PluginRegistry();
  
  constructor(private config: {
    adapters: Array<{ name: string; adapter: any; config?: any }>;
  }) {}
  
  async start(): Promise<void> {
    for (const { name, adapter, config } of this.config.adapters) {
      if (adapter.canActivate()) {
        console.error(`Starting adapter: ${name}`);
        // Initialize plugins with this adapter
      }
    }
  }
}

/**
 * Utility functions
 */
export const utils = {
  /**
   * Validate plugin manifest
   */
  validateManifest(manifest: any): manifest is PluginManifest {
    return (
      typeof manifest === 'object' &&
      typeof manifest.id === 'string' &&
      typeof manifest.name === 'string' &&
      typeof manifest.version === 'string' &&
      typeof manifest.runtime === 'string' &&
      typeof manifest.provides === 'object'
    );
  },
  
  /**
   * Load manifest from file
   */
  async loadManifest(path: string): Promise<PluginManifest> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  },
  
  /**
   * Create plugin package
   */
  async packagePlugin(sourceDir: string, outputPath: string): Promise<void> {
    // Would create .allp file
    console.error(`Packaging ${sourceDir} -> ${outputPath}`);
  },
};
