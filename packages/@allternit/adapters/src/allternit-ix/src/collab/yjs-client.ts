// OWNER: T2-A4

/**
 * YJS Client Setup - GAP-65
 * 
 * Collaborative editing client using YJS CRDTs
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Awareness } from 'y-protocols/awareness';

export interface YjsConfig {
  signalingUrls: string[];
  iceServers: RTCIceServer[];
  roomPrefix: string;
  maxPeers?: number;
}

export interface CollaborationSession {
  roomId: string;
  participants: Participant[];
  doc: Y.Doc;
  provider: WebrtcProvider;
  awareness: Awareness;
}

export interface Participant {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  selection?: Range;
}

export interface CursorPosition {
  x: number;
  y: number;
  line?: number;
  ch?: number;
}

export interface Range {
  anchor: CursorPosition;
  head: CursorPosition;
}

export class YjsClient {
  private doc: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private awareness: Awareness | null = null;
  private config: YjsConfig;
  private roomId: string;
  private session: CollaborationSession | null = null;

  constructor(roomId: string, config: YjsConfig) {
    this.roomId = roomId;
    this.config = config;
    
    // 1. Create Y.Doc
    this.doc = new Y.Doc();
    
    // 2. Setup WebRTC provider with signaling
    this.setupProvider();
    
    // 3. Configure awareness for participant tracking
    this.setupAwareness();
  }

  private setupProvider(): void {
    // 2. Setup WebRTC provider with signaling
    // 3. Configure TURN/STUN servers
    // 4. Connect to room
    this.provider = new WebrtcProvider(
      `${this.config.roomPrefix}-${this.roomId}`,
      this.doc,
      {
        signaling: this.config.signalingUrls,
        iceServers: this.config.iceServers,
        maxConns: this.config.maxPeers || 20,
      }
    );

    this.session = {
      roomId: this.roomId,
      participants: [],
      doc: this.doc,
      provider: this.provider,
      awareness: this.awareness!,
    };
  }

  private setupAwareness(): void {
    if (this.provider) {
      this.awareness = new Awareness(this.doc);
      
      // Set local user state
      this.awareness.setLocalStateField('user', {
        id: this.generateUserId(),
        name: 'Anonymous',
        color: this.generateColor(),
      });

      // Listen for participant changes
      this.awareness.on('change', ({ added, updated, removed }) => {
        this.handleAwarenessChange(added, updated, removed);
      });
    }
  }

  private handleAwarenessChange(
    added: number[],
    updated: number[],
    removed: number[]
  ): void {
    if (!this.awareness) return;

    const states = this.awareness.getStates();
    
    // Update participants list
    if (this.session) {
      this.session.participants = Array.from(states.values()).map((state: any) => ({
        id: state.user?.id || 'unknown',
        name: state.user?.name || 'Unknown',
        color: state.user?.color || '#000000',
        cursor: state.cursor,
        selection: state.selection,
      }));
    }
  }

  private generateUserId(): string {
    return `user_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get shared text for collaborative editing
   */
  getText(name: string = 'default'): Y.Text {
    return this.doc.getText(name);
  }

  /**
   * Get shared array
   */
  getArray<T>(name: string): Y.Array<T> {
    return this.doc.getArray<T>(name);
  }

  /**
   * Get shared map
   */
  getMap<T>(name: string): Y.Map<T> {
    return this.doc.getMap<T>(name);
  }

  /**
   * Get the underlying Y.Doc
   */
  getDoc(): Y.Doc {
    return this.doc;
  }

  /**
   * Get current session
   */
  getSession(): CollaborationSession | null {
    return this.session;
  }

  /**
   * Get all participants
   */
  getParticipants(): Participant[] {
    return this.session?.participants || [];
  }

  /**
   * Update local user state
   */
  updateLocalState(state: Partial<Participant>): void {
    if (this.awareness) {
      const currentState = this.awareness.getLocalState() || {};
      this.awareness.setLocalState({
        ...currentState,
        user: {
          ...currentState.user,
          ...state,
        },
      });
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(cursor: CursorPosition): void {
    if (this.awareness) {
      const currentState = this.awareness.getLocalState() || {};
      this.awareness.setLocalState({
        ...currentState,
        cursor,
      });
    }
  }

  /**
   * Update selection range
   */
  updateSelection(selection: Range): void {
    if (this.awareness) {
      const currentState = this.awareness.getLocalState() || {};
      this.awareness.setLocalState({
        ...currentState,
        selection,
      });
    }
  }

  /**
   * Disconnect from the room
   */
  disconnect(): void {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.awareness) {
      this.awareness.destroy();
      this.awareness = null;
    }
    this.session = null;
  }
}

/**
 * Create a new YJS client
 */
export function createYjsClient(roomId: string, config: YjsConfig): YjsClient {
  return new YjsClient(roomId, config);
}

/**
 * Default configuration for common use cases
 */
export const defaultConfig: YjsConfig = {
  signalingUrls: [
    'wss://signaling.yjs.dev',
    'wss://y-webrtc-signaling-us.herokuapp.com',
    'wss://y-webrtc-signaling-eu.herokuapp.com',
  ],
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  roomPrefix: 'a2r-collab',
  maxPeers: 20,
};
