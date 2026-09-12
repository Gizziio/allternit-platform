/**
 * Virtual project file workspace for Allternit Design mode, Phase 2
 * read-through cache (docs/design/artifacts-api.md §4, §7 Phase 2).
 *
 * Stores files per project in IndexedDB. Each project has a flat file tree
 * keyed by path. Files are strings (HTML, JSON, MD, etc.). The workspace can
 * be imported/exported as ZIP and synced to the active artifact preview.
 *
 * The project's artifact file (`/index.html`) is read-through cached over the
 * gateway content-artifact for the project: writes go to IndexedDB first and
 * then best-effort append/create a gateway version; loads fall back to the
 * gateway body when the local tree has no `/index.html`. The rest of the file
 * tree is local-only (the gateway has no multi-file model in Phase 2).
 */

import {
  appendContentArtifactVersion,
  createContentArtifact,
  getContentArtifact,
  listContentArtifacts,
} from './content-artifact-api';

const DB_NAME = 'allternit-design-files';
const DB_VERSION = 2;
const STORE_NAME = 'projectFiles';
const VERSIONS_STORE_NAME = 'fileVersions';
const MAX_FILE_VERSIONS = 10;

/** The project artifact file — mirrors the project's gateway content-artifact. */
export const PROJECT_ARTIFACT_PATH = '/index.html';

export interface ProjectFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface FileVersion {
  hash: string;
  content: string;
  savedAt: string;
}

export interface ProjectFileVersions {
  id: string;
  projectId: string;
  path: string;
  versions: FileVersion[];
}

export interface ProjectFileTree {
  projectId: string;
  files: Record<string, ProjectFile>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(VERSIONS_STORE_NAME)) {
        db.createObjectStore(VERSIONS_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function loadProjectFiles(projectId: string): Promise<ProjectFileTree> {
  const tree = await loadCachedProjectFiles(projectId);
  if (tree.files[PROJECT_ARTIFACT_PATH]) return tree;
  // Read-through: the gateway artifact for this project may hold a body this
  // browser hasn't cached yet.
  try {
    const res = await listContentArtifacts({ project: projectId, limit: 1 });
    const artifactId = res.artifacts?.[0]?.id;
    if (!artifactId) return tree;
    const full = await getContentArtifact(artifactId);
    const body = full.artifact?.body;
    if (!body) return tree;
    tree.files[PROJECT_ARTIFACT_PATH] = {
      path: PROJECT_ARTIFACT_PATH,
      content: body,
      updatedAt: full.artifact?.updatedAt ?? new Date().toISOString(),
    };
    await saveProjectFiles(tree).catch(() => {});
    return tree;
  } catch {
    return tree;
  }
}

async function loadCachedProjectFiles(projectId: string): Promise<ProjectFileTree> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(projectId);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        resolve((req.result as ProjectFileTree) ?? { projectId, files: {} });
      };
    });
  } catch {
    return { projectId, files: {} };
  }
}

export async function saveProjectFiles(tree: ProjectFileTree): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(tree);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function writeProjectFile(
  projectId: string,
  path: string,
  content: string,
): Promise<ProjectFileTree> {
  const tree = await loadProjectFiles(projectId);
  tree.files[path] = { path, content, updatedAt: new Date().toISOString() };
  await saveProjectFiles(tree);
  // Version history is best-effort: a versioning failure must not lose the write.
  try {
    await appendFileVersion(projectId, path, content);
  } catch {
    // IndexedDB unavailable or version store missing — file write already succeeded.
  }
  // The artifact file also writes through to the gateway content-artifact
  // (create version 1, or append the next immutable version). Best-effort:
  // the IndexedDB write above already succeeded. The idempotency key is
  // content-hashed so a retried identical write dedupes server-side.
  if (path === PROJECT_ARTIFACT_PATH) {
    syncArtifactFileToGateway(projectId, content).catch(() => {});
  }
  return tree;
}

async function syncArtifactFileToGateway(projectId: string, content: string): Promise<void> {
  const res = await listContentArtifacts({ project: projectId, limit: 1 });
  const artifactId = res.artifacts?.[0]?.id;
  if (artifactId) {
    await appendContentArtifactVersion(artifactId, content, {
      idempotencyKey: `files-append-${projectId}-${hashContent(content)}`,
    });
    return;
  }
  await createContentArtifact({
    title: projectId,
    type: 'text/html',
    body: content,
    projectId,
    sandboxPolicy: 'standard',
    idempotencyKey: `files-create-${projectId}`,
  });
}

function fileVersionsId(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}

/** djb2 — a simple deterministic string hash is enough for change detection. */
function hashContent(content: string): number {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

async function appendFileVersion(
  projectId: string,
  path: string,
  content: string,
): Promise<void> {
  const db = await openDb();
  const id = fileVersionsId(projectId, path);
  const record = await new Promise<ProjectFileVersions | undefined>((resolve, reject) => {
    const tx = db.transaction(VERSIONS_STORE_NAME, 'readwrite');
    const req = tx.objectStore(VERSIONS_STORE_NAME).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as ProjectFileVersions | undefined);
  });
  const versions = record?.versions ?? [];
  const hash = String(hashContent(content));
  // Skip back-to-back identical writes (e.g. re-saving unchanged content).
  if (versions.length > 0 && versions[versions.length - 1]!.hash === hash) return;
  versions.push({ hash, content, savedAt: new Date().toISOString() });
  if (versions.length > MAX_FILE_VERSIONS) versions.splice(0, versions.length - MAX_FILE_VERSIONS);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VERSIONS_STORE_NAME, 'readwrite');
    const req = tx.objectStore(VERSIONS_STORE_NAME).put({ id, projectId, path, versions });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/** Version history for a file, oldest first. Empty when no versions exist. */
export async function listFileVersions(projectId: string, path: string): Promise<FileVersion[]> {
  try {
    const db = await openDb();
    const record = await new Promise<ProjectFileVersions | undefined>((resolve, reject) => {
      const tx = db.transaction(VERSIONS_STORE_NAME, 'readonly');
      const req = tx.objectStore(VERSIONS_STORE_NAME).get(fileVersionsId(projectId, path));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result as ProjectFileVersions | undefined);
    });
    return record?.versions ?? [];
  } catch {
    return [];
  }
}

/** Restore a file to a previous version. The restore is itself recorded as a new version. */
export async function restoreFileVersion(
  projectId: string,
  path: string,
  index: number,
): Promise<ProjectFileTree> {
  const versions = await listFileVersions(projectId, path);
  const version = versions[index];
  if (!version) throw new Error(`No file version at index ${index} for ${path}`);
  return writeProjectFile(projectId, path, version.content);
}

export async function deleteProjectFile(projectId: string, path: string): Promise<ProjectFileTree> {
  const tree = await loadProjectFiles(projectId);
  delete tree.files[path];
  await saveProjectFiles(tree);
  return tree;
}

export async function renameProjectFile(
  projectId: string,
  oldPath: string,
  newPath: string,
): Promise<ProjectFileTree> {
  const tree = await loadProjectFiles(projectId);
  const file = tree.files[oldPath];
  if (file) {
    delete tree.files[oldPath];
    tree.files[newPath] = { ...file, path: newPath, updatedAt: new Date().toISOString() };
    await saveProjectFiles(tree);
  }
  return tree;
}
