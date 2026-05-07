// ============================================================================
// Capsule Browser Module Exports
// ============================================================================

export { BrowserCapsuleEnhanced as BrowserCapsule, openSampleA2UITab, sampleA2UIPayload } from './BrowserCapsuleEnhanced';
export { BrowserCapsuleEnhanced, sampleA2UIPayload as sampleA2UIPayloadEnhanced } from './BrowserCapsuleEnhanced';
export { BrowserCapsuleReal } from './BrowserCapsuleReal';
export { BrowserChatPane } from './BrowserChatPane';
export { useExtensionBridge, isExtensionConnected } from './useExtensionBridge';
export { useBrowserStore, useActiveTab, useTabCount, useActiveTabType, parseBrowserInput } from './browser.store';
export {
  createWebTab,
  createA2UITab,
  createMiniappTab,
  createComponentTab,
} from './browser.store';

export type {
  // Tab Types
  BrowserTab,
  BrowserContentType,
  WebTab,
  A2UITab,
  MiniappTab,
  ComponentTab,
  // Manifest Types
  MiniappManifest,
  CapsuleRegistryEntry,
  CapsuleRuntimeState,
  // Protocol Types
  ProtocolParseResult,
  // A2UI Types (re-exported from a2ui)
  A2UIPayload,
  A2UISurface,
  A2UIAction,
} from './browser.types';
