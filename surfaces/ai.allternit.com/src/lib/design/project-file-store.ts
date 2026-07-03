/**
 * Virtual project file workspace for Allternit Design mode.
 *
 * Stores files per project in IndexedDB. Each project has a flat file tree
 * keyed by path. Files are strings (HTML, JSON, MD, etc.). The workspace can
 * be imported/exported as ZIP and synced to the active artifact preview.
 */

const DB_NAME = 'allternit-design-files';
const DB_VERSION = 1;
const STORE_NAME = 'projectFiles';

export interface ProjectFile {
  path: string;
  content: string;
  updatedAt: string;
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
    };
  });
}

export async function loadProjectFiles(projectId: string): Promise<ProjectFileTree> {
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
  return tree;
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
