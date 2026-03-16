/**
 * @fileoverview DEPRECATED - A2R Legacy Bridge
 * 
 * This bridge was used for escaping to legacy services.
 * It is now deprecated in favor of the api-client.
 * 
 * MIGRATION:
 * - For Gateway access: Use api-client.ts
 * - For Brain/AI access: Use api.createSession() and api.sendMessage()
 * - For Voice: Use api.voice.* methods (when available)
 * 
 * @deprecated Use api-client.ts instead
 */

// console.warn('[DEPRECATED] legacy.bridge.ts is deprecated. Use api-client.ts instead.');

export interface LegacyServices {
  gateway?: any;
  brain?: any;
  conversation?: any;
  voice?: any;
}

// Global bridge instance - maintained for backward compatibility
export const legacyBridge: LegacyServices = {
  gateway: null,
  brain: null,
  conversation: null,
  voice: null,
};

/**
 * @deprecated Use api-client instead
 */
export function initLegacyBridge(services: LegacyServices) {
  console.warn('[DEPRECATED] initLegacyBridge is deprecated. Use api-client instead.');
  Object.assign(legacyBridge, services);
  console.log('[platform] legacy bridge initialized (deprecated)');
}
