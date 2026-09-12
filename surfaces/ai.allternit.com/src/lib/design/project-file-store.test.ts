import { beforeEach, describe, expect, it } from 'vitest';

import {
  deleteProjectFile,
  listFileVersions,
  loadProjectFiles,
  restoreFileVersion,
  writeProjectFile,
} from './project-file-store';

/**
 * Store-aware in-memory IndexedDB fake — jsdom provides no indexedDB.
 * Unlike the gallery-store fake (single anonymous store per DB), this one
 * tracks named object stores per DB and models onupgradeneeded so the real
 * DB v1 → v2 upgrade path is exercised.
 */

interface FakeDbState {
  stores: Map<string, Map<string, unknown>>;
  version: number;
}

const dbs = new Map<string, FakeDbState>();

function makeRequest(result: unknown) {
  const req: { result: unknown; error: null; onsuccess: null | ((e: unknown) => void); onerror: null } = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
  };
  queueMicrotask(() => req.onsuccess?.({ target: req }));
  return req;
}

function fakeIndexedDB() {
  return {
    open(dbName: string, version: number) {
      const req: {
        result: unknown;
        error: null;
        onsuccess: null | ((e: unknown) => void);
        onerror: null;
        onupgradeneeded: null | ((e: unknown) => void);
      } = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (!dbs.has(dbName)) dbs.set(dbName, { stores: new Map(), version: 0 });
        const state = dbs.get(dbName)!;
        const upgraded = version > state.version;
        if (upgraded) state.version = version;

        const db = {
          objectStoreNames: {
            contains: (name: string) => state.stores.has(name),
          },
          createObjectStore: (name: string) => {
            if (!state.stores.has(name)) state.stores.set(name, new Map());
            return {};
          },
          transaction: (storeName: string, _mode: string) => {
            const store = state.stores.get(storeName);
            const tx: {
              onerror: null;
              onabort: null;
              oncomplete: null | (() => void);
              objectStore: () => unknown;
            } = {
              onerror: null,
              onabort: null,
              oncomplete: null,
              objectStore: () => {
                if (!store) throw new Error(`No object store named ${storeName}`);
                return {
                  put: (value: { id?: string; projectId?: string }) => {
                    const key = value.id ?? value.projectId;
                    store.set(key, structuredClone(value));
                    return makeRequest(undefined);
                  },
                  get: (key: string) => makeRequest(structuredClone(store.get(key))),
                  getAll: () => makeRequest([...store.values()].map((v) => structuredClone(v))),
                  delete: (key: string) => {
                    store.delete(key);
                    return makeRequest(undefined);
                  },
                };
              },
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
        };

        req.result = db;
        if (upgraded) req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

/** Simulate a pre-existing v1-shaped DB: projectFiles store only, version 1. */
function seedV1Db() {
  const state: FakeDbState = { stores: new Map(), version: 1 };
  state.stores.set('projectFiles', new Map());
  dbs.set('allternit-design-files', state);
}

describe('project-file-store', () => {
  beforeEach(() => {
    dbs.clear();
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB();
  });

  it('writes and reads back a project file', async () => {
    await writeProjectFile('p1', '/index.html', '<h1>v1</h1>');
    const tree = await loadProjectFiles('p1');
    expect(tree.files['/index.html']?.content).toBe('<h1>v1</h1>');
  });

  it('accumulates one version per distinct write', async () => {
    await writeProjectFile('p1', '/a.html', 'one');
    await writeProjectFile('p1', '/a.html', 'two');
    await writeProjectFile('p1', '/a.html', 'two'); // identical — deduped
    const versions = await listFileVersions('p1', '/a.html');
    expect(versions.map((v) => v.content)).toEqual(['one', 'two']);
    expect(versions[0]!.hash).toBeTruthy();
    expect(versions[0]!.savedAt).toBeTruthy();
  });

  it('caps history at 10 versions, dropping the oldest', async () => {
    for (let i = 1; i <= 13; i++) {
      await writeProjectFile('p1', '/a.html', `content-${i}`);
    }
    const versions = await listFileVersions('p1', '/a.html');
    expect(versions).toHaveLength(10);
    expect(versions[0]!.content).toBe('content-4');
    expect(versions[9]!.content).toBe('content-13');
  });

  it('restores the requested version content', async () => {
    await writeProjectFile('p1', '/a.html', 'original');
    await writeProjectFile('p1', '/a.html', 'changed');
    const versions = await listFileVersions('p1', '/a.html');
    expect(versions).toHaveLength(2);

    const tree = await restoreFileVersion('p1', '/a.html', 0);
    expect(tree.files['/a.html']?.content).toBe('original');

    // Restore is recorded as a new version.
    const after = await listFileVersions('p1', '/a.html');
    expect(after[after.length - 1]!.content).toBe('original');
  });

  it('throws when restoring a missing version index', async () => {
    await writeProjectFile('p1', '/a.html', 'only');
    await expect(restoreFileVersion('p1', '/a.html', 7)).rejects.toThrow('No file version at index 7');
  });

  it('keeps version history per project and per path', async () => {
    await writeProjectFile('p1', '/a.html', 'a1');
    await writeProjectFile('p2', '/a.html', 'b1');
    await writeProjectFile('p1', '/b.html', 'c1');
    expect(await listFileVersions('p1', '/a.html')).toHaveLength(1);
    expect((await listFileVersions('p2', '/a.html'))[0]!.content).toBe('b1');
    expect((await listFileVersions('p1', '/b.html'))[0]!.content).toBe('c1');
  });

  it('survives a delete of the file itself', async () => {
    await writeProjectFile('p1', '/a.html', 'one');
    await deleteProjectFile('p1', '/a.html');
    expect((await loadProjectFiles('p1')).files['/a.html']).toBeUndefined();
    // History remains available for potential restore.
    expect(await listFileVersions('p1', '/a.html')).toHaveLength(1);
  });

  it('upgrades a v1-shaped DB without crashing and versions work after', async () => {
    seedV1Db();
    // Pre-existing v1 data: a projectFiles record only.
    await writeProjectFile('p1', '/a.html', 'v1-data');
    // The v2 open created the fileVersions store on upgrade; versions work.
    const versions = await listFileVersions('p1', '/a.html');
    expect(versions).toHaveLength(1);
    expect(versions[0]!.content).toBe('v1-data');
  });
});
