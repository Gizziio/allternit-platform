// OWNER: T2-A5

/**
 * YJS Protocols - GAP-67, 68
 * 
 * Broadcast and Sync protocols for YJS
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { encoding, decoding } from 'lib0';

import { AwarenessChanges, UserState, SyncState } from './yjs-types';

/**
 * Broadcast Protocol - GAP-67
 * 
 * Broadcast changes to all peers via WebRTC
 */
export class BroadcastProtocol {
  private doc: Y.Doc;
  private provider: any;
  private isSyncing: boolean = false;

  constructor(doc: Y.Doc, provider: any) {
    this.doc = doc;
    this.provider = provider;
  }

  /**
   * Broadcast update to all peers
   */
  broadcastUpdate(update: Uint8Array): void {
    if (!this.provider) return;

    try {
      // 1. Encode update
      const message = syncProtocol.createUpdateMessage(update);
      
      // 2. Send via WebRTC provider
      this.provider.broadcastMessage(message);
      
      // 3. Handle sync state
      this.isSyncing = false;
    } catch (error) {
      console.error('Failed to broadcast update:', error);
      this.isSyncing = false;
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(message: Uint8Array, from: number): void {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case syncProtocol.messageYjsSyncStep1:
      case syncProtocol.messageYjsSyncStep2:
      case syncProtocol.messageYjsUpdate:
        this.handleSyncMessage(decoder, from);
        break;
      case awarenessProtocol.messageAwareness:
        this.handleAwarenessMessage(decoder, from);
        break;
    }
  }

  private handleSyncMessage(decoder: decoding.Decoder, from: number): void {
    this.isSyncing = true;
    
    try {
      syncProtocol.readSyncMessage(
        decoder,
        encoding.createEncoder(),
        this.doc,
        null,
        from
      );
    } finally {
      this.isSyncing = false;
    }
  }

  private handleAwarenessMessage(decoder: decoding.Decoder, from: number): void {
    if (this.provider.awareness) {
      awarenessProtocol.applyAwarenessUpdate(
        this.provider.awareness,
        decoding.readVarUint8Array(decoder),
        from
      );
    }
  }

  /**
   * Get sync state
   */
  getSyncState(): SyncState {
    return {
      isSyncing: this.isSyncing,
      progress: this.isSyncing ? 50 : 100,
      lastSync: new Date(),
      errors: [],
    };
  }

  /**
   * Force sync with all peers
   */
  forceSync(): void {
    if (!this.provider) return;

    // Request sync step 1 from all peers
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.provider.broadcastMessage(encoding.toUint8Array(encoder));
  }
}

/**
 * Sync Protocol - GAP-67
 * 
 * Handle document synchronization
 */
export class SyncProtocol {
  private doc: Y.Doc;
  private syncState: Map<number, any> = new Map();

  constructor(doc: Y.Doc) {
    this.doc = doc;
  }

  /**
   * Sync document with remote
   */
  syncDocument(remoteDoc: Y.Doc): void {
    // 1. Create sync state vector
    const stateVector = Y.encodeStateVector(this.doc);
    
    // 2. Exchange with remote
    const remoteStateVector = Y.encodeStateVector(remoteDoc);
    
    // 3. Apply missing updates
    const missingUpdates = Y.encodeStateAsUpdate(this.doc, remoteStateVector);
    const remoteUpdates = Y.encodeStateAsUpdate(remoteDoc, stateVector);
    
    Y.applyUpdate(this.doc, remoteUpdates);
  }

  /**
   * Create sync message
   */
  createSyncMessage(): Uint8Array {
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    return encoding.toUint8Array(encoder);
  }

  /**
   * Handle sync step 1
   */
  handleSyncStep1(encoder: encoding.Encoder, decoder: decoding.Decoder): void {
    syncProtocol.readSyncStep1(decoder, encoder, this.doc);
  }

  /**
   * Handle sync step 2
   */
  handleSyncStep2(decoder: decoding.Decoder): void {
    syncProtocol.readSyncStep2(decoder, this.doc, null);
  }

  /**
   * Handle update
   */
  handleUpdate(decoder: decoding.Decoder): void {
    syncProtocol.readUpdate(decoder, this.doc, null);
  }

  /**
   * Get sync status for a peer
   */
  getPeerSyncStatus(peerId: number): any {
    return this.syncState.get(peerId) || { synced: false };
  }
}

/**
 * Awareness Manager - GAP-68
 * 
 * Manage user awareness and presence
 */
export class AwarenessManager {
  private awareness: Awareness;
  private onChangeCallbacks: Set<(changes: AwarenessChanges) => void> = new Set();

  constructor(doc: Y.Doc) {
    this.awareness = new Awareness(doc);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.awareness.on('change', (changes: AwarenessChanges) => {
      this.onChangeCallbacks.forEach(cb => cb(changes));
    });
  }

  /**
   * Set local user state
   */
  setLocalState(state: UserState): void {
    this.awareness.setLocalStateField('user', state);
  }

  /**
   * Set local state field
   */
  setLocalStateField<T>(key: string, value: T): void {
    const currentState = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({
      ...currentState,
      [key]: value,
    });
  }

  /**
   * Get all participant states
   */
  getStates(): Map<number, UserState> {
    return this.awareness.getStates();
  }

  /**
   * Get local state
   */
  getLocalState(): UserState | null {
    return this.awareness.getLocalState()?.user || null;
  }

  /**
   * Get state for specific client
   */
  getState(clientId: number): UserState | null {
    return this.awareness.getStates().get(clientId) || null;
  }

  /**
   * Listen for changes
   */
  onChange(callback: (changes: AwarenessChanges) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): number[] {
    return Array.from(this.awareness.getStates().keys());
  }

  /**
   * Remove client state
   */
  removeLocalState(): void {
    this.awareness.setLocalState(null);
  }

  /**
   * Get awareness instance
   */
  getAwareness(): Awareness {
    return this.awareness;
  }

  /**
   * Destroy awareness manager
   */
  destroy(): void {
    this.awareness.destroy();
    this.onChangeCallbacks.clear();
  }
}

/**
 * Create awareness manager
 */
export function createAwarenessManager(doc: Y.Doc): AwarenessManager {
  return new AwarenessManager(doc);
}
