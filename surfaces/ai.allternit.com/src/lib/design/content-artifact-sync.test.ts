import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/integration/api-client';

import {
  listGalleryEntriesGatewayFirst,
  saveGalleryEntryToGateway,
  type GalleryEntry,
} from './content-artifact-sync';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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
        onsuccess: null; onerror: null; onupgradeneeded: null;
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

const entry = (overrides: Partial<GalleryEntry> = {}): GalleryEntry => ({
  id: 'gallery-design-1',
  projectId: 'design-1',
  projectName: 'Acme landing',
  prompt: 'Create a SaaS landing page',
  type: 'prototype',
  artifactHtml: '<html><body><h1>Acme</h1></body></html>',
  createdAt: Date.parse('2026-09-12T10:00:00Z'),
  updatedAt: Date.parse('2026-09-12T11:00:00Z'),
  ...overrides,
});

describe('content-artifact-sync (Phase 2 delegates)', () => {
  beforeEach(() => {
    stores.clear();
    vi.clearAllMocks();
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB();
  });

  describe('saveGalleryEntryToGateway', () => {
    it('creates with version 1 when the project has no gateway artifact', async () => {
      mockedApi.get.mockResolvedValueOnce({ artifacts: [] });
      mockedApi.post.mockResolvedValueOnce({});

      await saveGalleryEntryToGateway(entry());

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

    it('appends a version when the project already has a gateway artifact', async () => {
      mockedApi.get.mockResolvedValueOnce({
        artifacts: [{ id: 'art_01', projectId: 'design-1' }],
      });
      mockedApi.put.mockResolvedValueOnce({});

      await saveGalleryEntryToGateway(entry());

      expect(mockedApi.put).toHaveBeenCalledWith(
        '/api/v1/content-artifacts/art_01/versions',
        expect.objectContaining({
          body: '<html><body><h1>Acme</h1></body></html>',
          idempotencyKey: `gallery-append-design-1-${Date.parse('2026-09-12T11:00:00Z')}`,
        }),
      );
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  describe('listGalleryEntriesGatewayFirst', () => {
    it('delegates to the store gateway-first list', async () => {
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

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: 'art_02',
        projectId: 'proj-x',
        type: 'other',
        artifactHtml: '<html>remote</html>',
      });
    });
  });
});
