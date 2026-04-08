// ============================================================================
// Capsule Browser Module Exports
// ============================================================================

export { BrowserCapsuleEnhanced as BrowserCapsule, openSampleA2UITab, sampleA2UIPayload } from './BrowserCapsuleEnhanced';
export { BrowserCapsuleEnhanced, sampleA2UIPayload as sampleA2UIPayloadEnhanced } from './BrowserCapsuleEnhanced';
export { BrowserCapsuleReal } from './BrowserCapsuleReal';
export { BrowserChatPane } from './BrowserChatPane';
export { BrowserExtensionPane } from './BrowserExtensionPane';
export { ExtensionSidepanelShell } from '../../../../shared/extension-sidepanel/ExtensionSidepanelShell';
export { BrowserChatPaneMenu } from './BrowserChatPaneMenu';
export { useBrowserExtensionPaneAdapter } from './browserExtensionPane.adapter';
export { useBrowserChatPaneStore } from './browserChatPane.store';
export { useExtensionBridge, isExtensionConnected } from './useExtensionBridge';
export type { BrowserChatPaneState, ScheduledTaskBanner } from './browserChatPane.store';
export type {
  ExtensionSidepanelAdapter,
  ExtensionSidepanelConfig,
  ExtensionSidepanelCopy,
  ExtensionSidepanelActivity,
  ExtensionSidepanelHistoricalEvent,
  ExtensionSidepanelSessionRecord,
  ExtensionSidepanelStatus,
} from '../../../../shared/extension-sidepanel/ExtensionSidepanelShell.types';
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
