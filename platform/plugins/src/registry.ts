import { Plugin, PluginContext } from './plugin.js';
import { QwenMMPluginAdapter } from './adapters/qwen-mm.js';

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private commands: Map<string, any> = new Map();
  private views: Map<string, any> = new Map();
  private tools: Map<string, any> = new Map();
  
  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);
    console.log(`Registered plugin: ${plugin.id}`);
  }
  
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }
  
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    const context = this.createContext(plugin);
    await plugin.activate(context);
    console.log(`Activated plugin: ${pluginId}`);
  }
  
  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await plugin.deactivate();
      console.log(`Deactivated plugin: ${pluginId}`);
    }
  }
  
  async activateAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await this.activate(plugin.id);
      } catch (error) {
        console.error(`Failed to activate ${plugin.id}:`, error);
      }
    }
  }
  
  async deactivateAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.deactivate();
    }
  }

  async registerQwenMMPlugin(manifestPath: string, config?: Record<string, string>): Promise<void> {
    const adapter = await QwenMMPluginAdapter.fromManifestPath(manifestPath);
    if (config) {
      Object.assign(adapter, { config });
    }
    this.register(adapter);
    await this.activate(adapter.id);
  }

  private createContext(plugin: Plugin): PluginContext {
    return {
      config: {},
      log: (message: string) => console.log(`[${plugin.id}] ${message}`),
      warn: (message: string) => console.warn(`[${plugin.id}] ${message}`),
      error: (message: string) => console.error(`[${plugin.id}] ${message}`),
      registerCommand: (command) => this.commands.set(command.id, command),
      registerView: (view) => this.views.set(view.id, view),
      registerTool: (tool) => this.tools.set(tool.id, tool),
      on: (event, handler) => { /* Event handling */ },
      emit: (event, data) => { /* Event emission */ }
    };
  }
  
  getCommand(id: string): any {
    return this.commands.get(id);
  }
  
  getView(id: string): any {
    return this.views.get(id);
  }
  
  getTool(id: string): any {
    return this.tools.get(id);
  }
}

export default PluginRegistry;
