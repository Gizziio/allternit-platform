/**
 * Use-case gallery for the A:// Studio landing (mapping doc §6, P0).
 *
 * Every design artifact that passes the P0 lint gate at finalization is
 * upserted here (one entry per project) so the landing can show real outputs —
 * "outputs, not inputs" — and offer click-to-remix. IndexedDB only; no backend.
 */

const DB_NAME = 'allternit-design-gallery';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

export interface GalleryEntry {
  id: string;
  /** Owning design project — one gallery entry per project. */
  projectId: string;
  projectName: string;
  /** First user message of the session that produced the artifact. */
  prompt: string;
  type: string;
  designSystemId?: string;
  skillId?: string;
  skillName?: string;
  /** Full artifact HTML — copied into the remix project's file tree. */
  artifactHtml: string;
  /** JPEG dataURL captured at save time; undefined when capture failed. */
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

/** Create or replace the gallery entry for a project. */
export async function upsertGalleryEntry(
  entry: Omit<GalleryEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<GalleryEntry> {
  const db = await openDb();
  const existing = await getEntryByProjectId(entry.projectId);
  const now = Date.now();
  const full: GalleryEntry = {
    ...entry,
    id: existing?.id ?? `gallery-${entry.projectId}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(full);
  await txDone(tx);
  return full;
}

export async function getEntryByProjectId(projectId: string): Promise<GalleryEntry | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    // No index on projectId — scan (entry counts are small, one per project).
    const all = tx.objectStore(STORE_NAME).getAll();
    all.onerror = () => reject(all.error);
    all.onsuccess = () => {
      const entries = (all.result as GalleryEntry[]).filter((e) => e.projectId === projectId);
      resolve(entries[0]);
    };
  });
}

export async function listGalleryEntries(): Promise<GalleryEntry[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const entries = req.result as GalleryEntry[];
        entries.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(entries);
      };
    });
  } catch {
    return [];
  }
}

export async function deleteGalleryEntry(projectId: string): Promise<void> {
  const existing = await getEntryByProjectId(projectId);
  if (!existing) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(existing.id);
  await txDone(tx);
}
