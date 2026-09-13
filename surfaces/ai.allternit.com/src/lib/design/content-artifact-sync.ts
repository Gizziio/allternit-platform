/**
 * Content-artifact gateway sync — A:// Artifacts API.
 *
 * Phase 2 (docs/design/artifacts-api.md §7): the read-through cache lives in
 * `gallery-store` (gateway-first reads, write-through upserts). This module
 * keeps the Phase 1 entry points as thin delegates so existing callers
 * (DesignModeView's gallery capture, NewProjectScreen's gallery list) are
 * unchanged:
 *
 * - `saveGalleryEntryToGateway(entry)` → `syncGalleryEntryToGateway(entry)`
 *   (same idempotency keys as the upsert write-through, so the explicit pass
 *   after `upsertGalleryEntry` dedupes server-side).
 * - `listGalleryEntriesGatewayFirst()` → `listGalleryEntries()` (the store's
 *   list IS gateway-first).
 */

import { listGalleryEntries, syncGalleryEntryToGateway, type GalleryEntry } from './gallery-store';

export type { GalleryEntry };

export async function saveGalleryEntryToGateway(entry: GalleryEntry): Promise<void> {
  return syncGalleryEntryToGateway(entry);
}

export async function listGalleryEntriesGatewayFirst(): Promise<GalleryEntry[]> {
  return listGalleryEntries();
}
