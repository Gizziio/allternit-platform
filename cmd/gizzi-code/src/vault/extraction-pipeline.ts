/**
 * Extraction Pipeline
 *
 * One generic mapper from "raw items fetched from a connected source" to
 * Vault Notes — replaces the old pattern of one hand-written sync file per
 * source (see vault/sync/gmail.ts) with a single metadata-driven ingest
 * function. A source-specific connector only needs to produce ExtractedItem[]
 * (see vault/connectors/sidecar.ts); this file owns frontmatter shape,
 * filename convention, and sensitivity tagging.
 *
 * See docs/LENS_CONTEXT_LAYER_PLAN.md Phase 2.
 */

import path from "path"
import type { Vault } from "./types"
import type { VaultManager } from "./index"
import * as IO from "./io"

export interface ExtractedItem {
  /** Stable id from the source (e.g. GitHub repo id, Notion page id) — used
   * for the filename so re-syncing the same item updates it in place instead
   * of creating a duplicate note. */
  id: string
  title: string
  /** Markdown body (frontmatter is added by ingestItems, don't include it). */
  content: string
  tags?: string[]
  entities?: string[]
  /** ISO date string; defaults to now if omitted. */
  date?: string
  /** Vault folder, defaults to "Topics" (matches the existing gmail/calendar
   * convention — see vault/io.ts ensureVaultStructure). */
  folder?: string
}

/**
 * Write a batch of extracted items into the vault as Notes, tagging each
 * with its source and a sensitivity level. Sensitivity defaults to
 * "private" (fail closed) — pass "public" explicitly for sources whose
 * content is meant to be broadly shareable via the Lens MCP server.
 */
export async function ingestItems(
  vault: VaultManager,
  source: string,
  items: ExtractedItem[],
  sensitivity: Vault.Sensitivity = "private",
): Promise<number> {
  let count = 0
  for (const item of items) {
    const safeTitle = IO.sanitizeFilename(item.title || item.id)
    const folder = item.folder || "Topics"
    const relPath = path.join(folder, `${source}-${safeTitle}-${item.id}.md`)

    const frontmatter: Vault.Frontmatter = {
      title: item.title,
      date: item.date || new Date().toISOString(),
      tags: [...new Set([source, ...(item.tags || [])])],
      entities: item.entities,
      source,
      sensitivity,
    }

    await vault.writeNote(relPath, item.content, frontmatter)
    count++
  }
  return count
}
