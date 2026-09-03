/**
 * On-device memory store for the extension.
 *
 * Keeps embeddings, browser-history snapshots, and procedural memories locally
 * in IndexedDB so the agent can recall context without a round-trip to the
 * cloud. When `syncToCloud` is enabled, local writes are also pushed to the
 * Allternit gateway.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'AllternitLocalMemory';
const DB_VERSION = 1;

export interface LocalMemoryItem {
  id: string;
  kind: 'browser_history' | 'procedural' | 'note' | 'embedding';
  payload: unknown;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

interface LocalMemorySchema extends DBSchema {
  memories: {
    key: string;
    value: LocalMemoryItem;
    indexes: {
      byKind: string;
      bySyncedAt: number | undefined;
    };
  };
}

async function getDB(): Promise<IDBPDatabase<LocalMemorySchema>> {
  return openDB<LocalMemorySchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('memories', { keyPath: 'id' });
      store.createIndex('byKind', 'kind');
      store.createIndex('bySyncedAt', 'syncedAt');
    },
  });
}

export async function isLocalMemoryEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get('AllternitLocalMemoryEnabled');
  return result.AllternitLocalMemoryEnabled === true;
}

export async function setLocalMemoryEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ AllternitLocalMemoryEnabled: enabled });
}

export async function isCloudSyncEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get('AllternitLocalMemorySync');
  return result.AllternitLocalMemorySync === true;
}

export async function setCloudSyncEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ AllternitLocalMemorySync: enabled });
}

export async function putLocalMemory(item: Omit<LocalMemoryItem, 'updatedAt'>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('memories', item.id);
  await db.put('memories', {
    ...item,
    updatedAt: Date.now(),
    syncedAt: existing?.syncedAt,
  });
}

export async function getLocalMemory(id: string): Promise<LocalMemoryItem | undefined> {
  const db = await getDB();
  return db.get('memories', id);
}

export async function listLocalMemory(kind?: LocalMemoryItem['kind']): Promise<LocalMemoryItem[]> {
  const db = await getDB();
  if (kind) {
    return db.getAllFromIndex('memories', 'byKind', kind);
  }
  return db.getAll('memories');
}

export async function deleteLocalMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('memories', id);
}

export async function markSynced(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('memories', 'readwrite');
  const now = Date.now();
  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncedAt = now;
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function searchLocalMemory(query: string, kind?: LocalMemoryItem['kind']): Promise<LocalMemoryItem[]> {
  const items = await listLocalMemory(kind);
  const lower = query.toLowerCase();
  return items.filter((item) => {
    const text = JSON.stringify(item.payload).toLowerCase();
    return text.includes(lower);
  });
}

export async function clearLocalMemory(): Promise<void> {
  const db = await getDB();
  await db.clear('memories');
}
