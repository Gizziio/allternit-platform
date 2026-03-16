/**
 * A2R Runtime Bridge - Adapters
 * 
 * Adapter modules for integrating A2R Kernel with the runtime.
 */

// Session Adapter
export {
  prepareSessionInit,
  cleanupSession,
  getSessionContext,
  getActiveSessions,
  createA2RGatewayOptions,
  wrapGatewayClient,
  type A2RGatewayOptions,
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
