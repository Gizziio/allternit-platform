// OWNER: T2-A4

/**
 * YJS Types - GAP-66
 * 
 * Type definitions for collaborative editing
 */

import * as Y from 'yjs';

/**
 * YJS Configuration
 */
export interface YjsConfig {
  /** WebRTC signaling server URLs */
  signalingUrls: string[];
  /** STUN/TURN servers for NAT traversal */
  iceServers: RTCIceServer[];
  /** Prefix for room names */
  roomPrefix: string;
  /** Maximum number of peers per room */
  maxPeers?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Collaboration Session
 */
export interface CollaborationSession {
  /** Unique room identifier */
  roomId: string;
  /** Connected participants */
  participants: Participant[];
  /** YJS document */
  doc: Y.Doc;
  /** WebRTC provider */
  provider: any; // WebrtcProvider
  /** Awareness instance */
  awareness: any; // Awareness
  /** Session start time */
  startedAt?: Date;
  /** Last activity time */
  lastActivity?: Date;
}

/**
 * Participant in a collaboration session
 */
export interface Participant {
  /** Unique participant ID */
  id: string;
  /** Display name */
  name: string;
  /** Color for cursor/selection highlighting */
  color: string;
  /** Current cursor position */
  cursor?: CursorPosition;
  /** Current selection range */
  selection?: Range;
  /** Client ID in YJS awareness */
  clientId?: number;
  /** Is this the local user */
  isLocal?: boolean;
}

/**
 * Cursor position in editor
 */
export interface CursorPosition {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Line number (for text editors) */
  line?: number;
  /** Character position (for text editors) */
  ch?: number;
  /** Timestamp of last update */
  timestamp?: number;
}

/**
 * Selection range
 */
export interface Range {
  /** Selection anchor (start) */
  anchor: CursorPosition;
  /** Selection head (end) */
  head: CursorPosition;
}

/**
 * User state for awareness
 */
export interface UserState {
  /** User ID */
  id: string;
  /** User name */
  name: string;
  /** User color */
  color: string;
  /** Current cursor */
  cursor?: CursorPosition;
  /** Current selection */
  selection?: Range;
  /** Status message */
  status?: string;
  /** Is user typing */
  isTyping?: boolean;
}

/**
 * Awareness changes event
 */
export interface AwarenessChanges {
  /** Added client IDs */
  added: number[];
  /** Updated client IDs */
  updated: number[];
  /** Removed client IDs */
  removed: number[];
}

/**
 * Shared document types
 */
export enum DocType {
  TEXT = 'text',
  ARRAY = 'array',
  MAP = 'map',
  XML = 'xml',
  XML_FRAG = 'xml-frag',
}

/**
 * Document operation types
 */
export enum OperationType {
  INSERT = 'insert',
  DELETE = 'delete',
  UPDATE = 'update',
  FORMAT = 'format',
}

/**
 * Document change event
 */
export interface DocChangeEvent {
  /** Type of operation */
  type: OperationType;
  /** Target type */
  targetType: DocType;
  /** Target name */
  targetName: string;
  /** Change delta */
  delta: any;
  /** Origin of change */
  origin: any;
  /** Is local change */
  isLocal: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Sync state for tracking document synchronization
 */
export interface SyncState {
  /** Is currently syncing */
  isSyncing: boolean;
  /** Sync progress (0-100) */
  progress: number;
  /** Last sync time */
  lastSync?: Date;
  /** Sync errors */
  errors: string[];
}

/**
 * Cursor style for rendering
 */
export interface CursorStyle {
  /** Cursor color */
  color: string;
  /** Cursor width in pixels */
  width?: number;
  /** Show user name label */
  showName?: boolean;
  /** Animation class */
  animationClass?: string;
}

/**
 * Collaboration configuration
 */
export interface CollabConfig {
  /** Enable real-time collaboration */
  enabled: boolean;
  /** Room ID for collaboration */
  roomId: string;
  /** YJS configuration */
  yjs: YjsConfig;
  /** Enable cursor tracking */
  showCursors: boolean;
  /** Enable selection tracking */
  showSelections: boolean;
  /** Enable user list */
  showUsers: boolean;
  /** Cursor style */
  cursorStyle: CursorStyle;
}

/**
 * Default collaboration configuration
 */
export const defaultCollabConfig: CollabConfig = {
  enabled: true,
  roomId: '',
  yjs: {
    signalingUrls: [],
    iceServers: [],
    roomPrefix: 'a2r',
    maxPeers: 20,
    debug: false,
  },
  showCursors: true,
  showSelections: true,
  showUsers: true,
  cursorStyle: {
    color: '#000000',
    width: 2,
    showName: true,
  },
};
