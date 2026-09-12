import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/integration/api-client';

import { listGalleryEntries, upsertGalleryEntry, type GalleryEntry } from './gallery-store';
import {
  listGalleryEntriesGatewayFirst,
  saveGalleryEntryToGateway,
} from './content-artifact-sync';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

/** Minimal in-memory IndexedDB fake — same approach as gallery-store.test.ts. */
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
        onsuccess: null | ((e: unknown) => void);
        onerror: null;
        onupgradeneeded: null;
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

async function savedEntry(overrides: Parameters<typeof entry>[0] = {}): Promise<GalleryEntry> {
  return upsertGalleryEntry(entry(overrides));
}

describe('content-artifact-sync', () => {
  beforeEach(() => {
    stores.clear();
    vi.clearAllMocks();
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB();
  });

  describe('saveGalleryEntryToGateway', () => {
    it('creates with version 1 when the project has no gateway artifact', async () => {
      mockedApi.get.mockResolvedValueOnce({ artifacts: [] });
      mockedApi.post.mockResolvedValueOnce({});

      await saveGalleryEntryToGateway(await savedEntry());

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/v1/content-artifacts',
        expect.objectContaining({
          title: 'Acme landing',
          type: 'text/html',
          body: '<html><body><h1>Acme</h1></body></html>',
          projectId: 'design-1',
          prompt: 'Create a SaaS landing page',
          sandboxPolicy: 'standard',
          idempotencyKey: 'gallery-create-design-1',
        }),
      );
      expect(mockedApi.put).not.toHaveBeenCalled();
    });

    it('passes MIME types through unchanged', async () => {
      mockedApi.get.mockResolvedValueOnce({ artifacts: [] });
      mockedApi.post.mockResolvedValueOnce({});

      await saveGalleryEntryToGateway(await savedEntry({ type: 'image/svg+xml' }));

      expect(mockedApi.post.mock.calls[0]![1]).toMatchObject({ type: 'image/svg+xml' });
    });

    it('appends a version when the project already has a gateway artifact', async () => {
      const saved = await savedEntry();
      mockedApi.get.mockResolvedValueOnce({
        artifacts: [{ id: 'art_01', projectId: 'design-1' }],
      });
      mockedApi.put.mockResolvedValueOnce({});

      await saveGalleryEntryToGateway(saved);

      expect(mockedApi.put).toHaveBeenCalledWith(
        '/api/v1/content-artifacts/art_01/versions',
        expect.objectContaining({
          body: '<html><body><h1>Acme</h1></body></html>',
          idempotencyKey: `gallery-append-design-1-${saved.updatedAt}`,
        }),
      );
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  describe('listGalleryEntriesGatewayFirst', () => {
    it('maps gateway records, reusing the local category and body', async () => {
      await savedEntry({ skillId: 'saas-landing', skillName: 'SaaS Landing' });
      mockedApi.get.mockResolvedValueOnce({
        artifacts: [
          {
            id: 'art_01',
            title: 'Acme landing',
            type: 'text/html',
            projectId: 'design-1',
            provenance: { prompt: 'Create a SaaS landing page', skillId: 'saas-landing', skillName: 'SaaS Landing' },
            thumbnail: 'data:image/jpeg;base64,x',
            createdAt: '2026-09-12T10:00:00Z',
            updatedAt: '2026-09-12T11:00:00Z',
          },
        ],
      });

      const entries = await listGalleryEntriesGatewayFirst();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: 'art_01',
        projectId: 'design-1',
        projectName: 'Acme landing',
        prompt: 'Create a SaaS landing page',
        // UI category comes from the local cache, not the MIME type.
        type: 'prototype',
        skillId: 'saas-landing',
        artifactHtml: '<html><body><h1>Acme</h1></body></html>',
        thumbnail: 'data:image/jpeg;base64,x',
      });
      expect(entries[0]!.createdAt).toBe(Date.parse('2026-09-12T10:00:00Z'));
      // No per-artifact body fetch needed — the local cache had it.
      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });

    it('fetches the body once for gateway-only artifacts', async () => {
      mockedApi.get
        .mockResolvedValueOnce({
          artifacts: [
            {
              id: 'art_02',
              title: 'Cross-surface deck',
              type: 'text/html',
              projectId: 'proj-x',
              createdAt: '2026-09-12T10:00:00Z',
              updatedAt: '2026-09-12T10:00:00Z',
            },
          ],
        })
        .mockResolvedValueOnce({ artifact: { body: '<html>remote</html>' } });

      const entries = await listGalleryEntriesGatewayFirst();

      expect(entries[0]).toMatchObject({
        id: 'art_02',
        projectId: 'proj-x',
        type: 'other',
        artifactHtml: '<html>remote</html>',
      });
    });

    it('keeps local-only entries and falls back to IndexedDB when the gateway is down', async () => {
      await savedEntry({ projectId: 'local-1', projectName: 'Offline save' });
      mockedApi.get.mockRejectedValueOnce(new Error('gateway unreachable'));

      const entries = await listGalleryEntriesGatewayFirst();

      expect(entries.map((e) => e.projectName)).toEqual(['Offline save']);
      expect(await listGalleryEntries()).toHaveLength(1);
    });

    it('merges local-only entries into a reachable gateway list', async () => {
      await savedEntry({ projectId: 'local-1', projectName: 'Offline save' });
      await savedEntry({ projectId: 'design-1', projectName: 'Synced' });
      mockedApi.get.mockResolvedValueOnce({
        artifacts: [
          {
            id: 'art_01',
            title: 'Synced',
            type: 'text/html',
            projectId: 'design-1',
            updatedAt: '2026-09-12T11:00:00Z',
          },
        ],
      });

      const entries = await listGalleryEntriesGatewayFirst();

      expect(entries.map((e) => e.projectId).sort()).toEqual(['design-1', 'local-1']);
    });
  });
});
