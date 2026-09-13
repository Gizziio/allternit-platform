import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/integration/api-client';

import {
  deleteProjectFile,
  listFileVersions,
  loadProjectFiles,
  renameProjectFile,
  restoreFileVersion,
  writeProjectFile,
} from './project-file-store';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

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
    vi.clearAllMocks();
    // Default: gateway offline — exercises the pure-cache paths.
    mockedApi.get.mockRejectedValue(new Error('gateway unreachable'));
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

  describe('gateway read/write-through (/index.html)', () => {
    it('creates a gateway artifact on first artifact-file write', async () => {
      mockedApi.get
        .mockResolvedValueOnce({ artifacts: [] }) // load read-through lookup
        .mockResolvedValueOnce({ artifacts: [] }); // write-through find-existing
      mockedApi.post.mockResolvedValueOnce({});

      await writeProjectFile('p1', '/index.html', '<h1>v1</h1>');

      await vi.waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/v1/content-artifacts',
        expect.objectContaining({
          projectId: 'p1',
          type: 'text/html',
          body: '<h1>v1</h1>',
          idempotencyKey: 'files-create-p1',
        }),
      );
    });

    it('appends a gateway version when the project already has an artifact', async () => {
      await writeProjectFile('p1', '/index.html', 'old'); // seeded while gateway offline
      mockedApi.get.mockResolvedValue({ artifacts: [{ id: 'art_1', projectId: 'p1' }] });
      mockedApi.put.mockResolvedValue({});

      await writeProjectFile('p1', '/index.html', 'new');

      await vi.waitFor(() => expect(mockedApi.put).toHaveBeenCalled());
      expect(mockedApi.put).toHaveBeenCalledWith(
        '/api/v1/content-artifacts/art_1/versions',
        expect.objectContaining({ body: 'new' }),
      );
    });

    it('fills /index.html from the gateway when the local tree has it missing', async () => {
      mockedApi.get
        .mockResolvedValueOnce({ artifacts: [{ id: 'art_9', projectId: 'p9' }] })
        .mockResolvedValueOnce({
          artifact: { body: '<html>gateway</html>', updatedAt: '2026-09-12T10:00:00Z' },
        });

      const tree = await loadProjectFiles('p9');
      expect(tree.files['/index.html']?.content).toBe('<html>gateway</html>');

      // Cached on read — a second load does not hit the gateway again.
      const calls = mockedApi.get.mock.calls.length;
      const again = await loadProjectFiles('p9');
      expect(again.files['/index.html']?.content).toBe('<html>gateway</html>');
      expect(mockedApi.get.mock.calls.length).toBe(calls);
    });
  });

  describe('whole-tree gateway sync (multi-file)', () => {
    it('mirrors a non-artifact file into the artifact file index', async () => {
      await writeProjectFile('p1', '/index.html', 'seed'); // local-only seed
      mockedApi.get.mockResolvedValue({ artifacts: [{ id: 'art_1', projectId: 'p1' }] });
      mockedApi.put.mockResolvedValue({});

      await writeProjectFile('p1', '/styles.css', 'body { color: red }');

      await vi.waitFor(() => expect(mockedApi.put).toHaveBeenCalled());
      expect(mockedApi.put).toHaveBeenCalledWith(
        '/api/v1/content-artifacts/art_1/files/styles.css',
        { body: 'body { color: red }' },
      );
      // The non-artifact write must NOT append an artifact version.
      expect(mockedApi.put).not.toHaveBeenCalledWith(
        '/api/v1/content-artifacts/art_1/versions',
        expect.anything(),
      );
    });

    it('skips the tree mirror for non-artifact files when no artifact exists yet', async () => {
      mockedApi.get.mockResolvedValue({ artifacts: [] });
      mockedApi.put.mockResolvedValue({});

      await writeProjectFile('p1', '/styles.css', 'orphan');

      // Nothing to hang the file on — no gateway write of any kind.
      expect(mockedApi.put).not.toHaveBeenCalled();
    });

    it('mirrors /index.html to BOTH the version body and the file tree', async () => {
      mockedApi.get.mockResolvedValue({ artifacts: [{ id: 'art_1', projectId: 'p1' }] });
      mockedApi.put.mockResolvedValue({});

      await writeProjectFile('p1', '/index.html', '<h1>v2</h1>');

      await vi.waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalledWith(
          '/api/v1/content-artifacts/art_1/versions',
          expect.objectContaining({ body: '<h1>v2</h1>' }),
        );
        expect(mockedApi.put).toHaveBeenCalledWith(
          '/api/v1/content-artifacts/art_1/files/index.html',
          { body: '<h1>v2</h1>' },
        );
      });
    });

    it('fills the whole tree from the gateway index when the local cache is empty', async () => {
      mockedApi.get
        .mockResolvedValueOnce({ artifacts: [{ id: 'art_9', projectId: 'p9' }] })
        .mockResolvedValueOnce({
          artifact: { body: '<html>gateway</html>', updatedAt: '2026-09-12T10:00:00Z' },
        })
        .mockResolvedValueOnce({
          files: [
            { path: '/index.html', sha256: 'aaa', updatedAt: '2026-09-12T10:00:00Z' },
            { path: '/styles.css', sha256: 'bbb', updatedAt: '2026-09-12T10:05:00Z' },
          ],
        })
        .mockResolvedValueOnce({
          path: '/styles.css',
          body: 'body { color: blue }',
          sha256: 'bbb',
          updatedAt: '2026-09-12T10:05:00Z',
        });

      const tree = await loadProjectFiles('p9');
      expect(tree.files['/index.html']?.content).toBe('<html>gateway</html>');
      expect(tree.files['/styles.css']?.content).toBe('body { color: blue }');
    });

    it('delete and rename mirror to the gateway tree best-effort', async () => {
      mockedApi.get.mockResolvedValue({ artifacts: [{ id: 'art_1', projectId: 'p1' }] });
      mockedApi.put.mockResolvedValue({});
      mockedApi.delete.mockResolvedValue({});

      await writeProjectFile('p1', '/a.css', 'a');
      await deleteProjectFile('p1', '/a.css');
      await vi.waitFor(() =>
        expect(mockedApi.delete).toHaveBeenCalledWith(
          '/api/v1/content-artifacts/art_1/files/a.css',
        ),
      );

      await writeProjectFile('p1', '/b.css', 'b');
      await renameProjectFile('p1', '/b.css', '/c.css');
      await vi.waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalledWith(
          '/api/v1/content-artifacts/art_1/files/c.css',
          { body: 'b' },
        );
        expect(mockedApi.delete).toHaveBeenCalledWith(
          '/api/v1/content-artifacts/art_1/files/b.css',
        );
      });
    });
  });
});
