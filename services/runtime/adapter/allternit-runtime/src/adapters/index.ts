/**
 * Allternit Runtime Bridge - Adapters
 * 
 * Adapter modules for integrating Allternit Kernel with the runtime.
 */

// Session Adapter
export {
  prepareSessionInit,
  cleanupSession,
  getSessionContext,
  getActiveSessions,
  createAllternitGatewayOptions,
  wrapGatewayClient,
  type AllternitGatewayOptions,
  type SessionAdapterOptions,
  _clearActiveSessions,
} from './session-adapter.js';

// Plugin Adapter
export {
  PluginAdapter,
  createWrappedPluginResolver,
  type Plugin,
  type PluginTool,
  type PluginAdapterOptions,
} from './plugin-adapter.js';
