import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Plugin } from './plugin.js';

export class PluginLoader {
  private pluginDir: string;
  
  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }
  
  async loadAll(): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    
    try {
      const entries = await fs.readdir(this.pluginDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginDir, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');
          
          try {
            await fs.access(manifestPath);
            const plugin = await this.load(pluginPath);
            plugins.push(plugin);
          } catch {
            // No manifest, skip
          }
        }
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
    
    return plugins;
  }
  
  async load(pluginPath: string): Promise<Plugin> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    const pluginModule = await import(path.join(pluginPath, 'index.js'));
    const PluginClass = pluginModule.default || pluginModule[manifest.main || 'Plugin'];
    
    const plugin = new PluginClass();
    return plugin;
  }
}

export default PluginLoader;
