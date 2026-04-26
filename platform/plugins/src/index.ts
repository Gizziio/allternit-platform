/**
 * Allternit Plugin System
 * 
 * Extensible plugin framework for Allternit
 */

export { BasePlugin } from './plugin.js';
export type { Plugin, PluginContext, Command, View, Tool, PluginConfig } from './plugin.js';
export { PluginRegistry } from './registry.js';
export { PluginLoader } from './loader.js';

export default { BasePlugin, PluginRegistry, PluginLoader };
