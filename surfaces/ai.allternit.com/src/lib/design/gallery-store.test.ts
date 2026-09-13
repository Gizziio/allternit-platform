import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/integration/api-client';

import {
  deleteGalleryEntry,
  getEntryByProjectId,
  listGalleryEntries,
  upsertGalleryEntry,
  type GalleryEntry,
} from './gallery-store';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

/** Minimal in-memory IndexedDB fake — jsdom provides no indexedDB. */
const stores = new Map<string, Map<string, unknown>>();

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
    open(dbName: string, _version: number) {
      const req: {
        result: unknown;
        error: null;
        onsuccess: null | ((e: unknown) => void); onerror: null; onupgradeneeded: null | ((e: unknown) => void);
      } = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (!stores.has(dbName)) stores.set(dbName, new Map());
        const store = stores.get(dbName)!;
        req.result = {
          transaction: () => {
            const tx: { onerror: null; onabort: null; oncomplete: null | (() => void); objectStore: () => unknown } = {
              onerror: null,
              onabort: null,
              oncomplete: null,
              objectStore: () => ({
                put: (value: { id: string }) => {
                  store.set(value.id, structuredClone(value));
                  return makeRequest(undefined);
                },
                getAll: () => makeRequest([...store.values()]),
                delete: (key: string) => {
                  store.delete(key);
                  return makeRequest(undefined);
                },
              }),
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
        };
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

const entry = (overrides: Partial<Parameters<typeof upsertGalleryEntry>[0]>) => ({
  projectId: 'design-1',
  projectName: 'Acme landing',
  prompt: 'Create a SaaS landing page',
  type: 'prototype',
  artifactHtml: '<html><body><h1>Acme</h1></body></html>',
  ...overrides,
});

describe('gallery-store (read-through cache)', () => {
  beforeEach(() => {
    stores.clear();
    vi.clearAllMocks();
    // Default: gateway offline — exercises the pure-cache paths.
    mockedApi.get.mockRejectedValue(new Error('gateway unreachable'));
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB();
  });

  it('upserts one entry per project and preserves createdAt', async () => {
    const first = await upsertGalleryEntry(entry({}));
    const second = await upsertGalleryEntry(entry({ projectName: 'Renamed' }));

    const all = await listGalleryEntries();
    expect(all).toHaveLength(1);
    expect(all[0]!.projectName).toBe('Renamed');
    expect(all[0]!.createdAt).toBe(first.createdAt);
    expect(all[0]!.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
    expect(second.id).toBe(first.id);
  });

  it('lists newest-updated first', async () => {
    await upsertGalleryEntry(entry({ projectId: 'p-old', projectName: 'Old' }));
    await new Promise((r) => setTimeout(r, 5));
    await upsertGalleryEntry(entry({ projectId: 'p-new', projectName: 'New' }));
    const all = await listGalleryEntries();
    expect(all.map((e) => e.projectName)).toEqual(['New', 'Old']);
  });

  it('looks up by project id and deletes', async () => {
    await upsertGalleryEntry(entry({}));
    const found = await getEntryByProjectId('design-1');
    expect(found?.prompt).toBe('Create a SaaS landing page');
    expect(await getEntryByProjectId('nope')).toBeUndefined();

    await deleteGalleryEntry('design-1');
    expect(await listGalleryEntries()).toHaveLength(0);
    // Deleting a missing entry is a no-op, not an error.
    await deleteGalleryEntry('design-1');
  });

  it('carries skill, design system, and thumbnail fields', async () => {
    const saved = await upsertGalleryEntry(
      entry({ skillId: 'saas-landing', skillName: 'SaaS Landing', designSystemId: 'allternit-brand', thumbnail: 'data:image/jpeg;base64,x' }),
    );
    const fetched = (await getEntryByProjectId('design-1')) as GalleryEntry;
    expect(fetched.skillId).toBe('saas-landing');
    expect(fetched.designSystemId).toBe('allternit-brand');
    expect(fetched.thumbnail).toBe('data:image/jpeg;base64,x');
    expect(saved.artifactHtml).toContain('<h1>Acme</h1>');
  });

  describe('gateway write-through', () => {
    it('creates a gateway artifact on upsert when the project has none', async () => {
      // getEntryByProjectId (cache miss) consumes the first lookup, the
      // write-through the second.
      mockedApi.get
        .mockResolvedValueOnce({ artifacts: [] })
        .mockResolvedValueOnce({ artifacts: [] });
      mockedApi.post.mockResolvedValueOnce({});

      await upsertGalleryEntry(entry({}));
      // Allow the fire-and-forget write-through to settle.
      await vi.waitFor(() => expect(mockedApi.post).toHaveBeenCalled());

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/v1/content-artifacts',
        expect.objectContaining({
          title: 'Acme landing',
          projectId: 'design-1',
          idempotencyKey: 'gallery-create-design-1',
        }),
      );
    });

    it('appends a gateway version on upsert when the project already has an artifact', async () => {
      // Cache-miss lookup, then body fetch for the found entry, then the
      // write-through's own find-existing lookup.
      mockedApi.get
        .mockResolvedValueOnce({
          artifacts: [{ id: 'art_01', projectId: 'design-1' }],
        })
        .mockResolvedValueOnce({ artifact: { body: '<html><body><h1>Acme</h1></body></html>' } })
        .mockResolvedValueOnce({
          artifacts: [{ id: 'art_01', projectId: 'design-1' }],
        });
      mockedApi.put.mockResolvedValueOnce({});

      await upsertGalleryEntry(entry({}));
      await vi.waitFor(() => expect(mockedApi.put).toHaveBeenCalled());

      expect(mockedApi.put).toHaveBeenCalledWith(
        '/api/v1/content-artifacts/art_01/versions',
        expect.objectContaining({ body: '<html><body><h1>Acme</h1></body></html>' }),
      );
    });

    it('soft-deletes the gateway artifact on delete', async () => {
      await upsertGalleryEntry(entry({}));
      mockedApi.get.mockResolvedValueOnce({
        artifacts: [{ id: 'art_01', projectId: 'design-1' }],
      });
      mockedApi.delete.mockResolvedValueOnce({} as never);

      await deleteGalleryEntry('design-1');

      expect(mockedApi.delete).toHaveBeenCalledWith('/api/v1/content-artifacts/art_01');
    });
  });

  describe('gateway-first reads', () => {
    it('serves the gateway list and merges local-only entries', async () => {
      await upsertGalleryEntry(entry({ projectId: 'local-1', projectName: 'Offline save' }));
      mockedApi.get
        .mockResolvedValueOnce({
          artifacts: [
            {
              id: 'art_01',
              title: 'Synced',
              type: 'text/html',
              projectId: 'design-1',
              provenance: { prompt: 'Create a SaaS landing page' },
              createdAt: '2026-09-12T10:00:00Z',
              updatedAt: '2026-09-12T11:00:00Z',
            },
          ],
        })
        .mockResolvedValueOnce({ artifact: { body: '<html>remote</html>' } });

      const all = await listGalleryEntries();

      expect(all.map((e) => e.projectId).sort()).toEqual(['design-1', 'local-1']);
      const synced = all.find((e) => e.projectId === 'design-1')!;
      expect(synced.artifactHtml).toBe('<html>remote</html>');
      expect(synced.type).toBe('other');
    });

    it('falls back to the cache when the gateway is unreachable', async () => {
      await upsertGalleryEntry(entry({ projectName: 'Offline save' }));

      const all = await listGalleryEntries();

      expect(all.map((e) => e.projectName)).toEqual(['Offline save']);
    });

    it('fills a cache miss from the gateway on getEntryByProjectId', async () => {
      mockedApi.get
        .mockResolvedValueOnce({
          artifacts: [
            {
              id: 'art_09',
              title: 'Remote only',
              type: 'text/html',
              projectId: 'remote-1',
              createdAt: '2026-09-12T10:00:00Z',
              updatedAt: '2026-09-12T10:00:00Z',
            },
          ],
        })
        .mockResolvedValueOnce({ artifact: { body: '<html>from-gateway</html>' } });

      const found = await getEntryByProjectId('remote-1');

      expect(found).toMatchObject({
        id: 'art_09',
        projectId: 'remote-1',
        artifactHtml: '<html>from-gateway</html>',
      });
    });
  });
});
