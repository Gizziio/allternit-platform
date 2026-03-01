// ============================================================================
// Capsule/MiniApp Browser System - Types
// ============================================================================
// This module defines the extended browser tab system that supports multiple
// content types: web URLs, A2UI payloads, miniapps, and component rendering.
// ============================================================================

// Re-export A2UI types from the a2ui module
export type {
  A2UIPayload,
  A2UISurface,
  A2UIAction,
  ComponentNode as A2UIComponentNode,
} from '../a2ui/a2ui.types';

/** Type of content being displayed in a browser tab */
export type BrowserContentType = 
  | 'web'      // Traditional URL-based web content
  | 'a2ui'     // A2UI JSON payload rendering
  | 'miniapp'  // Miniapp manifest-based capsule
  | 'component'; // Direct React component reference

/** Base interface for all browser tabs */
export interface BrowserTabBase {
  id: string;
  title: string;
  favicon?: string;
  isActive: boolean;
  contentType: BrowserContentType;
}

/** Web content tab - traditional browsing */
export interface WebTab extends BrowserTabBase {
  contentType: 'web';
  url: string;
}

/** A2UI payload tab - agent-generated UI */
export interface A2UITab extends BrowserTabBase {
  contentType: 'a2ui';
  payload: import('../a2ui/a2ui.types').A2UIPayload;
  source?: string; // Optional source identifier (e.g., agent ID)
}

/** Miniapp tab - capsule-based miniapp */
export interface MiniappTab extends BrowserTabBase {
  contentType: 'miniapp';
  manifest: MiniappManifest;
  capsuleId: string;
  entryPoint: string;
}

/** Component tab - direct React component rendering */
export interface ComponentTab extends BrowserTabBase {
  contentType: 'component';
  componentId: string;
  props?: Record<string, unknown>;
}

/** Union type for all browser tab types */
export type BrowserTab = WebTab | A2UITab | MiniappTab | ComponentTab;

// ============================================================================
// Miniapp Manifest System
// ============================================================================

type A2UISurface = import('../a2ui/a2ui.types').A2UISurface;
type A2UIAction = import('../a2ui/a2ui.types').A2UIAction;

/** Miniapp manifest defining the capsule structure */
export interface MiniappManifest {
  /** Manifest version */
  version: '1.0.0';
  
  /** Miniapp metadata */
  meta: {
    id: string;
    name: string;
    description?: string;
    version: string;
    author?: string;
    icon?: string;
    keywords?: string[];
  };
  
  /** Entry point configuration */
  entry: {
    /** Type of entry point */
    type: 'a2ui' | 'html' | 'component';
    /** Path or reference to entry resource */
    src: string;
    /** Initial data model for A2UI entries */
    initialData?: Record<string, unknown>;
  };
  
  /** UI surfaces for A2UI-based miniapps */
  surfaces?: A2UISurface[];
  
  /** Actions that can be triggered */
  actions?: A2UIAction[];
  
  /** Required capabilities */
  capabilities?: string[];
  
  /** Content security policy */
  csp?: {
    allowedOrigins?: string[];
    allowedScripts?: string[];
    allowInlineScripts?: boolean;
  };
}

// ============================================================================
// Protocol Handlers
// ============================================================================

/** URL protocol detection result */
export interface ProtocolParseResult {
  /** Detected content type */
  type: BrowserContentType;
  /** Normalized resource identifier */
  resource: string;
  /** Additional metadata from URL */
  meta?: Record<string, string>;
}

/** Supported protocols and their mappings */
export const PROTOCOL_MAP: Record<string, BrowserContentType> = {
  'http': 'web',
  'https': 'web',
  'a2ui': 'a2ui',
  'miniapp': 'miniapp',
  'capsule': 'miniapp',
  'component': 'component',
  'file': 'web',
};

// ============================================================================
// Capsule Registry Entry
// ============================================================================

/** Registered capsule for quick access */
export interface CapsuleRegistryEntry {
  id: string;
  manifest: MiniappManifest;
  installedAt: Date;
  lastUsedAt?: Date;
  favorite?: boolean;
}

/** Capsule runtime state */
export interface CapsuleRuntimeState {
  capsuleId: string;
  dataModel: Record<string, unknown>;
  history: unknown[];
  pendingActions: string[];
}
