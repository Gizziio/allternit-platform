/**
 * Yjs/CRDT Adapter for Allternit-IX
 * 
 * Real-time collaborative state synchronization using Yjs.
 */

import type { StateStore, StateStoreConfig } from '../state/store';
import type { JSONPatch } from '../state/patch';

// Yjs types (would be imported from 'yjs' in production)
interface YDoc {
  getMap(name: string): YMap;
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  transact(callback: () => void): void;
  destroy(): void;
}

interface YMap {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  has(key: string): boolean;
  delete(key: string): void;
  toJSON(): Record<string, unknown>;
  observe(callback: (event: YMapEvent) => void): void;
  unobserve(callback: (event: YMapEvent) => void): void;
}

interface YMapEvent {
  changes: {
    keys: Map<string, { action: 'add' | 'update' | 'delete'; oldValue: unknown }>;
  };
}

interface YProvider {
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  destroy(): void;
}

export interface YjsAdapterConfig {
  /** Yjs document instance */
  doc: YDoc;
  /** Yjs provider (WebSocket, WebRTC, etc.) */
  provider?: YProvider;
  /** Map name for state storage */
  mapName?: string;
  /** User ID for awareness */
  userId?: string;
  /** User info for awareness */
  userInfo?: Record<string, unknown>;
  /** Conflict resolution strategy */
  conflictResolution?: 'last-write-wins' | 'first-write-wins' | 'merge';
  /** Batch updates (ms) */
  batchDelay?: number;
}

export interface YjsAdapter {
  /** Get local state store */
  getStore(): StateStore;
  /** Apply local patch (will sync to others) */
  applyPatch(patch: JSONPatch): void;
  /** Get current awareness state */
  getAwareness(): Map<number, AwarenessState>;
  /** Set local awareness state */
  setAwareness(state: Partial<AwarenessState>): void;
  /** Subscribe to awareness changes */
  subscribeAwareness(callback: (states: Map<number, AwarenessState>) => void): () => void;
  /** Get sync status */
  getSyncStatus(): 'synced' | 'syncing' | 'disconnected';
  /** Subscribe to sync status changes */
  subscribeSyncStatus(callback: (status: 'synced' | 'syncing' | 'disconnected') => void): () => void;
  /** Destroy adapter */
  destroy(): void;
}

export interface AwarenessState {
  user?: {
    id: string;
    name?: string;
    color?: string;
    [key: string]: unknown;
  };
  cursor?: {
    x: number;
    y: number;
    componentId?: string;
  };
  selection?: string[];
  [key: string]: unknown;
}

/**
 * Create Yjs adapter for collaborative state
 */
export function createYjsAdapter(config: YjsAdapterConfig): YjsAdapter {
  const { doc, provider, mapName = 'allternit-ix-state' } = config;
  const ymap = doc.getMap(mapName);
  
  // Local state store wrapper
  let localState: Record<string, unknown> = {};
  const subscribers = new Map<string, Set<(value: unknown) => void>>();
  const syncStatusSubscribers = new Set<(status: 'synced' | 'syncing' | 'disconnected') => void>();
  const awarenessSubscribers = new Set<(states: Map<number, AwarenessState>) => void>();
  
  let syncStatus: 'synced' | 'syncing' | 'disconnected' = 'syncing';
  const awarenessMap = new Map<number, AwarenessState>();
  const clientId = 0;

  /**
   * Initialize from Yjs map
   */
  function initialize(): void {
    // Load initial state
    localState = { ...ymap.toJSON() };

    // Observe Yjs changes
    ymap.observe((event) => {
      doc.transact(() => {
        event.changes.keys.forEach((change, key) => {
          const newValue = ymap.get(key);
          
          if (change.action === 'delete') {
            delete localState[key];
          } else {
            localState[key] = newValue;
          }

          // Notify local subscribers
          notifySubscribers(key, newValue);
        });
      });
    });

    // Set up provider sync status
    if (provider) {
      provider.on('sync', () => {
        updateSyncStatus('synced');
      });

      provider.on('disconnect', () => {
        updateSyncStatus('disconnected');
      });

      provider.on('connect', () => {
        updateSyncStatus('syncing');
      });
    }
  }

  /**
   * Update sync status
   */
  function updateSyncStatus(status: 'synced' | 'syncing' | 'disconnected'): void {
    syncStatus = status;
    syncStatusSubscribers.forEach((cb) => cb(status));
  }

  /**
   * Notify subscribers
   */
  function notifySubscribers(path: string, value: unknown): void {
    const pathSubscribers = subscribers.get(path);
    if (pathSubscribers) {
      pathSubscribers.forEach((cb) => cb(value));
    }

    // Notify parent path subscribers
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      const parentSubscribers = subscribers.get(parentPath);
      if (parentSubscribers) {
        const parentValue = getValue(parentPath);
        parentSubscribers.forEach((cb) => cb(parentValue));
      }
    }
  }

  /**
   * Get value at path
   */
  function getValue(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = localState;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set value at path
   */
  function setValue(path: string, value: unknown): void {
    const parts = path.split('.');
    
    doc.transact(() => {
      if (parts.length === 1) {
        if (value === undefined) {
          ymap.delete(path);
          delete localState[path];
        } else {
          ymap.set(path, value);
          localState[path] = value;
        }
      } else {
        // Handle nested paths
        const rootKey = parts[0];
        let root = (ymap.get(rootKey) as Record<string, unknown>) || {};
        
        // Clone to avoid modifying shared Yjs object directly
        root = { ...root };
        
        let current: Record<string, unknown> = root;
        for (let i = 1; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }

        if (value === undefined) {
          delete current[parts[parts.length - 1]];
        } else {
          current[parts[parts.length - 1]] = value;
        }

        ymap.set(rootKey, root);
        localState[rootKey] = root;
      }
    });

    notifySubscribers(path, value);
  }

  /**
   * Apply JSON Patch
   */
  function applyPatch(patch: JSONPatch): void {
    doc.transact(() => {
      patch.forEach((op) => {
        const path = op.path.slice(1).replace(/\//g, '.');
        
        switch (op.op) {
          case 'add':
          case 'replace':
            setValue(path, op.value);
            break;
          case 'remove':
            setValue(path, undefined);
            break;
        }
      });
    });
  }

  /**
   * Create state store interface
   */
  function getStore(): StateStore {
    return {
      get: <T>(path: string) => getValue(path) as T | undefined,
      set: <T>(path: string, value: T) => setValue(path, value),
      subscribe: (path: string, callback: (value: unknown) => void) => {
        if (!subscribers.has(path)) {
          subscribers.set(path, new Set());
        }
        subscribers.get(path)!.add(callback);

        return () => {
          subscribers.get(path)?.delete(callback);
        };
      },
      batch: (updates: Record<string, unknown>) => {
        doc.transact(() => {
          Object.entries(updates).forEach(([path, value]) => {
            setValue(path, value);
          });
        });
      },
      snapshot: () => ({ ...localState }),
      restore: (snapshot: Record<string, unknown>) => {
        doc.transact(() => {
          Object.entries(snapshot).forEach(([key, value]) => {
            ymap.set(key, value);
            localState[key] = value;
          });
        });
      },
      reset: () => {
        doc.transact(() => {
          Object.keys(ymap.toJSON()).forEach((key) => {
            ymap.delete(key);
          });
          localState = {};
        });
      },
      compute: () => {},
      bind: () => {},
      getBindings: () => [],
    };
  }

  /**
   * Get awareness state
   */
  function getAwareness(): Map<number, AwarenessState> {
    return new Map(awarenessMap);
  }

  /**
   * Set awareness state
   */
  function setAwareness(state: Partial<AwarenessState>): void {
    const current = awarenessMap.get(clientId) || {};
    awarenessMap.set(clientId, { ...current, ...state });
    
    // Broadcast to others (would use y-protocols in production)
    awarenessSubscribers.forEach((cb) => cb(new Map(awarenessMap)));
  }

  /**
   * Subscribe to awareness changes
   */
  function subscribeAwareness(callback: (states: Map<number, AwarenessState>) => void): () => void {
    awarenessSubscribers.add(callback);
    return () => awarenessSubscribers.delete(callback);
  }

  /**
   * Get sync status
   */
  function getSyncStatus(): 'synced' | 'syncing' | 'disconnected' {
    return syncStatus;
  }

  /**
   * Subscribe to sync status
   */
  function subscribeSyncStatus(callback: (status: 'synced' | 'syncing' | 'disconnected') => void): () => void {
    syncStatusSubscribers.add(callback);
    return () => syncStatusSubscribers.delete(callback);
  }

  /**
   * Destroy adapter
   */
  function destroy(): void {
    subscribers.clear();
    syncStatusSubscribers.clear();
    awarenessSubscribers.clear();
    
    if (provider) {
      provider.destroy();
    }
    
    // Clear all keys from ymap
    const keys = Object.keys(ymap.toJSON());
    keys.forEach((key) => ymap.delete(key));
  }

  // Initialize
  initialize();

  // Set initial user awareness
  if (config.userId) {
    setAwareness({
      user: {
        id: config.userId,
        ...config.userInfo,
      },
    });
  }

  return {
    getStore,
    applyPatch,
    getAwareness,
    setAwareness,
    subscribeAwareness,
    getSyncStatus,
    subscribeSyncStatus,
    destroy,
  };
}

/**
 * Create collaborative state store
 */
export function createCollaborativeStore(
  yjsConfig: YjsAdapterConfig,
  localConfig: Omit<StateStoreConfig, 'initial' | 'variables'> = {}
): StateStore {
  const adapter = createYjsAdapter(yjsConfig);
  return adapter.getStore();
}
