import { beforeEach, describe, expect, it } from 'vitest';

import {
  deleteGalleryEntry,
  getEntryByProjectId,
  listGalleryEntries,
  upsertGalleryEntry,
  type GalleryEntry,
} from './gallery-store';

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
        onsuccess: null | ((e: unknown) => void);
        onerror: null;
        onupgradeneeded: null | ((e: unknown) => void);
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

describe('gallery-store', () => {
  beforeEach(() => {
    stores.clear();
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
});
