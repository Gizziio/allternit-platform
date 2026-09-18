/**
 * Minimal module-level registry for the document currently open in each office
 * app, read by the AI chat panels for context.
 *
 * Two writers feed one effective value:
 *
 * - `reportActiveDocument` — the vendored app renderer reports the document it
 *   actually has open (name plus a lazy content getter), including documents
 *   the host never passed in (e.g. a blank "Untitled.docx" created in-app and
 *   autosaved under a derived name). App-reported values win.
 * - `registerActiveDocument` — the suite app adapters (DocsApp/SheetsApp/
 *   SlidesApp/PdfApp) report the name of the `document` prop they receive, for
 *   hosts whose vendored app does not report. Prop registration never clears
 *   an app-reported value.
 */
import { useSyncExternalStore } from 'react';
import type { OfficeAppKey } from '../bridge/types';

export interface ActiveDocumentInfo {
  name: string;
  /**
   * Lazy plain-text excerpt of the document, called at context-build time so
   * the assistant sees the current content, not a mount-time snapshot.
   */
  content?: () => string | null | undefined;
}

interface RegistryEntry {
  reported: ActiveDocumentInfo | null;
  propName: string | null;
  /** Cached effective value — useSyncExternalStore snapshots must be stable. */
  cached: ActiveDocumentInfo | null;
}

const entries = new Map<OfficeAppKey, RegistryEntry>();
const listeners = new Set<() => void>();

function entryFor(appKey: OfficeAppKey): RegistryEntry {
  let entry = entries.get(appKey);
  if (!entry) {
    entry = { reported: null, propName: null, cached: null };
    entries.set(appKey, entry);
  }
  return entry;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function effective(entry: RegistryEntry): ActiveDocumentInfo | null {
  const next = entry.reported ?? (entry.propName ? { name: entry.propName } : null);
  // Return the previous object when equivalent so useSyncExternalStore's
  // Object.is snapshot check stays quiet.
  if (sameInfo(entry.cached, next)) return entry.cached;
  entry.cached = next;
  return next;
}

function sameInfo(a: ActiveDocumentInfo | null, b: ActiveDocumentInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.name === b.name && a.content === b.content;
}

/**
 * Report the document the app renderer actually has open. Pass `null` when the
 * document closes or the app unmounts.
 */
export function reportActiveDocument(appKey: OfficeAppKey, doc: ActiveDocumentInfo | null): void {
  const entry = entryFor(appKey);
  const next = doc && doc.name ? doc : null;
  if (entry.reported === next) return;
  entry.reported = next;
  emit();
}

/**
 * Register (or clear, with `null`) the open document name from the host's
 * `document` prop. Clears only the prop contribution — an app-reported
 * document stays authoritative.
 */
export function registerActiveDocument(appKey: OfficeAppKey, name: string | null): void {
  const entry = entryFor(appKey);
  const next = name ?? null;
  if ((entry.propName ?? null) === next) return;
  entry.propName = next;
  emit();
}

/** Non-hook read for event callbacks (e.g. an agent loop's buildContext). */
export function getActiveDocument(appKey: OfficeAppKey): ActiveDocumentInfo | null {
  const entry = entries.get(appKey);
  return entry ? effective(entry) : null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactively read the open document for an app (null when unknown). */
export function useActiveDocument(appKey: OfficeAppKey): ActiveDocumentInfo | null {
  return useSyncExternalStore(subscribe, () => getActiveDocument(appKey));
}
