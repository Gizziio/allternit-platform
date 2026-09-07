/**
 * Minimal module-level registry for the name of the document currently open
 * in each office app. Suite app adapters (DocsApp/SheetsApp/SlidesApp/PdfApp)
 * register the name of the `document` prop they receive; extensions read it
 * via `useActiveDocument` to stay aware of the surrounding document without
 * threading new props through the vendored apps.
 */
import { useSyncExternalStore } from 'react';
import type { OfficeAppKey } from '../bridge/types';

const activeDocuments = new Map<OfficeAppKey, string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Register (or clear, with `null`) the open document name for an app. */
export function registerActiveDocument(appKey: OfficeAppKey, name: string | null): void {
  const next = name ?? null;
  if ((activeDocuments.get(appKey) ?? null) === next) return;
  if (next) activeDocuments.set(appKey, next);
  else activeDocuments.delete(appKey);
  emit();
}

/** Non-hook read for event callbacks (e.g. an agent loop's buildContext). */
export function getActiveDocument(appKey: OfficeAppKey): string | null {
  return activeDocuments.get(appKey) ?? null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactively read the open document name for an app (null when unknown). */
export function useActiveDocument(appKey: OfficeAppKey): string | null {
  return useSyncExternalStore(subscribe, () => getActiveDocument(appKey));
}
