/**
 * Allternit Plugin System
 * 
 * Extensible plugin framework for Allternit
 */

import { BasePlugin } from './plugin.js';
import { PluginRegistry } from './registry.js';
import { PluginLoader } from './loader.js';

export { BasePlugin } from './plugin.js';
export type { Plugin, PluginContext, Command, View, Tool, PluginConfig } from './plugin.js';
export { PluginRegistry } from './registry.js';
export { PluginLoader } from './loader.js';
export { QwenMMPluginAdapter } from './adapters/qwen-mm.js';
export type { QwenMMAdapterOptions } from './adapters/qwen-mm.js';
export {
  validateCapabilityManifest,
  validateMarketplaceManifest,
  validatePluginVersions,
  QwenMMValidationError,
} from './adapters/qwen-mm.schema.js';
export type {
  QwenMMCapabilityManifest,
  QwenMMMarketplaceManifest,
  QwenMMPluginVersions,
  QwenMMPluginEntry,
  QwenMMCapabilityTool,
} from './adapters/qwen-mm.schema.js';

export default { BasePlugin, PluginRegistry, PluginLoader };
