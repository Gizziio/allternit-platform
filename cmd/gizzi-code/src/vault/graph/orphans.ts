/**
 * Orphan detection: notes with zero incoming AND zero outgoing edges in the
 * full graph (wikilinks + entity mentions + semantic/bridge edges) — noise
 * in the index that dilutes retrieval without adding recall.
 *
 * Detection always runs as part of `gizzi vault graph`; deletion never
 * happens automatically — see cli/commands/vault.ts's `--delete-orphans`
 * flag. Sensitivity is not special-cased here: it's a structural graph
 * property, not a content-visibility gate.
 */

import type { Vault } from "../types"

export function findOrphans(notes: Vault.Note[], graph: Vault.Graph): Vault.Note[] {
  const hasOutgoing = new Set<string>()
  const hasIncoming = new Set<string>()

  for (const [nodeId, node] of graph.nodes) {
    for (const edge of node.edges) {
      hasOutgoing.add(nodeId)
      hasIncoming.add(edge.target)
    }
  }

  return notes.filter((n) => !hasOutgoing.has(n.relPath) && !hasIncoming.has(n.relPath))
}
