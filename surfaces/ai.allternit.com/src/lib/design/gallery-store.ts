/**
 * Use-case gallery for the A:// Studio landing (mapping doc §6, P0), Phase 2
 * read-through cache (docs/design/artifacts-api.md §4, §7 Phase 2).
 *
 * The gateway (`/api/v1/content-artifacts`) is canonical; this IndexedDB store
 * (`allternit-design-gallery`) is the read-through cache:
 *
 * - Read (list / get-by-project): gateway-first — gateway rows populate the
 *   cache, and the IndexedDB copy answers when the gateway is unreachable.
 * - Write (upsert): IndexedDB first (so the UI never blocks on the network),
 *   then a best-effort write-through (create version 1, or append the next
 *   immutable version when the project already has an artifact). Idempotency
 *   keys make retries — including DesignModeView's explicit
 *   `saveGalleryEntryToGateway` pass after upsert — server-side no-ops.
 * - Delete: cache delete + best-effort gateway soft delete.
 *
 * Gateway failures never throw out of this module: a cache exists precisely
 * so a down gateway degrades to local-only behavior.
 */

import {
  appendContentArtifactVersion,
  createContentArtifact,
  deleteContentArtifact,
  getContentArtifact,
  listContentArtifacts,
} from './content-artifact-api';

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

async function putEntry(entry: GalleryEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(entry);
  await txDone(tx);
}

async function listCachedEntries(): Promise<GalleryEntry[]> {
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

/** MIME type for the gateway; gallery category slugs map to html-first. */
function gatewayType(entry: GalleryEntry): string {
  return entry.type.includes('/') ? entry.type : 'text/html';
}

function entryFromGatewayRecord(
  a: {
    id: string;
    title?: string;
    type?: string;
    projectId?: string;
    provenance?: { prompt?: string; designSystemId?: string; skillId?: string; skillName?: string; sourceSessionId?: string };
    thumbnail?: string;
    createdAt?: string;
    updatedAt?: string;
  },
  localEntry: GalleryEntry | undefined,
  artifactHtml: string,
): GalleryEntry {
  const provenance = a.provenance ?? {};
  return {
    id: a.id,
    projectId: a.projectId ?? localEntry?.projectId ?? '',
    projectName: a.title || localEntry?.projectName || 'Untitled',
    prompt: provenance.prompt ?? localEntry?.prompt ?? '',
    // Gateway stores MIME types; the UI category comes from the local
    // cache when available, else 'other'.
    type: localEntry?.type ?? 'other',
    designSystemId: provenance.designSystemId ?? localEntry?.designSystemId,
    skillId: provenance.skillId ?? localEntry?.skillId,
    skillName: provenance.skillName ?? localEntry?.skillName,
    artifactHtml,
    thumbnail: a.thumbnail ?? localEntry?.thumbnail,
    createdAt: (a.createdAt ? Date.parse(a.createdAt) : NaN) || localEntry?.createdAt || Date.now(),
    updatedAt: (a.updatedAt ? Date.parse(a.updatedAt) : NaN) || Date.now(),
  };
}

/**
 * Write one gallery entry through the content-artifacts API. Appends a
 * version when the project already has a gateway artifact; creates it
 * (with version 1) otherwise. Throws when the gateway rejects the write —
 * callers that treat the gateway as best-effort catch per the P0 capture's
 * semantics; `upsertGalleryEntry` does that for you.
 */
export async function syncGalleryEntryToGateway(entry: GalleryEntry): Promise<void> {
  const existing = await listContentArtifacts({ project: entry.projectId, limit: 1 });
  const found = existing.artifacts?.[0];
  if (found?.id) {
    await appendContentArtifactVersion(found.id, entry.artifactHtml, {
      thumbnail: entry.thumbnail,
      idempotencyKey: `gallery-append-${entry.projectId}-${entry.updatedAt}`,
    });
    return;
  }
  await createContentArtifact({
    title: entry.projectName,
    type: gatewayType(entry),
    body: entry.artifactHtml,
    projectId: entry.projectId,
    prompt: entry.prompt,
    designSystemId: entry.designSystemId,
    skillId: entry.skillId,
    skillName: entry.skillName,
    sandboxPolicy: 'standard',
    thumbnail: entry.thumbnail,
    idempotencyKey: `gallery-create-${entry.projectId}`,
  });
}

/** Create or replace the gallery entry for a project (IndexedDB + gateway write-through). */
export async function upsertGalleryEntry(
  entry: Omit<GalleryEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<GalleryEntry> {
  const existing = await getEntryByProjectId(entry.projectId);
  const now = Date.now();
  const full: GalleryEntry = {
    ...entry,
    id: existing?.id ?? `gallery-${entry.projectId}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await putEntry(full);
  // Best-effort write-through: the cache write above already succeeded, so a
  // down gateway must not fail the save. The idempotency keys also make the
  // explicit saveGalleryEntryToGateway pass in DesignModeView a no-op.
  syncGalleryEntryToGateway(full).catch(() => {});
  return full;
}

export async function getEntryByProjectId(projectId: string): Promise<GalleryEntry | undefined> {
  const cached = await listCachedEntries();
  const hit = cached.find((e) => e.projectId === projectId);
  if (hit) return hit;
  // Cache miss — the gateway may hold an artifact this browser hasn't seen.
  try {
    const res = await listContentArtifacts({ project: projectId, limit: 1 });
    const a = res.artifacts?.[0];
    if (!a?.id) return undefined;
    let artifactHtml = '';
    try {
      const full = await getContentArtifact(a.id);
      artifactHtml = full.artifact?.body ?? '';
    } catch {
      // Body fetch is best-effort; thumbnails still render.
    }
    const entry = entryFromGatewayRecord(a, undefined, artifactHtml);
    if (entry.projectId) await putEntry(entry).catch(() => {});
    return entry;
  } catch {
    return undefined;
  }
}

/**
 * Gallery list, read-through: the gateway's canonical artifact list is the
 * source of truth; bodies and UI categories come from the local cache when
 * the entry was saved from this browser, and are fetched once per
 * gateway-only artifact (then cached). Local-only entries (saved while the
 * gateway was unreachable) are kept so nothing disappears. Falls back to the
 * pure IndexedDB list when the gateway cannot be reached.
 */
export async function listGalleryEntries(): Promise<GalleryEntry[]> {
  const local = await listCachedEntries();
  try {
    const res = await listContentArtifacts({ limit: 100 });
    const remote = res.artifacts;
    if (!Array.isArray(remote)) return local;

    const localByProject = new Map(local.map((e) => [e.projectId, e]));
    const merged = await Promise.all(
      remote.map(async (a): Promise<GalleryEntry> => {
        const localEntry = a.projectId ? localByProject.get(a.projectId) : undefined;
        let artifactHtml = localEntry?.artifactHtml ?? '';
        if (!artifactHtml && a.id) {
          try {
            const full = await getContentArtifact(a.id);
            artifactHtml = full.artifact?.body ?? '';
          } catch {
            // Body fetch is best-effort; thumbnails still render.
          }
        }
        return entryFromGatewayRecord(a, localEntry, artifactHtml);
      }),
    );

    // Populate the cache with what the gateway knows (canonical), so an
    // offline launch still lists the gallery.
    for (const entry of merged) {
      if (entry.projectId) await putEntry(entry).catch(() => {});
    }

    const remoteProjects = new Set(remote.map((a) => a.projectId).filter(Boolean));
    const localOnly = local.filter((e) => !remoteProjects.has(e.projectId));
    return [...merged, ...localOnly].sort((x, y) => y.updatedAt - x.updatedAt);
  } catch {
    return local;
  }
}

export async function deleteGalleryEntry(projectId: string): Promise<void> {
  const existing = await getEntryByProjectId(projectId);
  if (existing) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(existing.id);
    await txDone(tx);
  }
  // Best-effort gateway soft delete — the artifact is identified by project.
  try {
    const res = await listContentArtifacts({ project: projectId, limit: 1 });
    const id = res.artifacts?.[0]?.id;
    if (id) await deleteContentArtifact(id);
  } catch {
    // Gateway down — the local delete above already happened.
  }
}
