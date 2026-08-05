/**
 * Leaf-to-leaf semantic linking and cross-cluster bridges.
 *
 * Shared top-K-above-threshold nearest-neighbor search over TF-IDF vectors
 * (see embedding.ts) — used twice by graph/build.ts: once for ordinary
 * "similar" leaf-to-leaf edges, once for rarer, cross-cluster "bridge"
 * edges (the "what in domain X relates to this domain Y note" pass).
 *
 * Deliberately excludes notes with frontmatter.sensitivity === "restricted"
 * from the candidate pool entirely — matches the Lens MCP server's
 * fail-closed convention (mcp-server.ts) of never surfacing restricted
 * content. Does not introduce any tag-based linking.
 *
 * Scale ceiling: this is an O(n^2) pairwise comparison. Fine up to roughly
 * 5,000-10,000 notes; beyond that this would need blocking (e.g. compare
 * only within-cluster first) or an ANN index. Not solved here — a personal
 * vault won't reach that scale before this needs revisiting.
 */

import type { Vault } from "../types"
import { cosineSimilarity } from "./embedding"

export interface SemanticEdge {
  source: string
  target: string
  relation: "similar" | "bridge"
  weight: number
}

export interface SemanticLinkingOptions {
  relation: "similar" | "bridge"
  topK: number
  threshold: number
  /** When true, only consider pairs whose top-level folder differs. */
  crossClusterOnly?: boolean
}

function topLevelFolder(note: Vault.Note): string {
  return note.folder.split("/")[0] ?? ""
}

function isEligible(note: Vault.Note): boolean {
  return note.frontmatter.sensitivity !== "restricted"
}

export function computeSemanticEdges(
  notes: Vault.Note[],
  embeddings: Map<string, number[]>,
  opts: SemanticLinkingOptions,
): SemanticEdge[] {
  const eligible = notes.filter(isEligible)
  const edges: SemanticEdge[] = []
  const seenPairs = new Set<string>()

  for (const note of eligible) {
    const vector = embeddings.get(note.relPath)
    if (!vector) continue

    const scored: Array<{ target: Vault.Note; score: number }> = []
    for (const other of eligible) {
      if (other.relPath === note.relPath) continue
      if (opts.crossClusterOnly && topLevelFolder(other) === topLevelFolder(note)) continue
      const otherVector = embeddings.get(other.relPath)
      if (!otherVector) continue
      const score = cosineSimilarity(vector, otherVector)
      if (score >= opts.threshold) scored.push({ target: other, score })
    }

    // Stable sort: score desc, then relPath asc as a deterministic tiebreaker
    // (cosineSimilarity ties are otherwise resolved by original array order,
    // which is fine since `notes` order is itself deterministic, but being
    // explicit here removes any dependency on that).
    scored.sort((a, b) => b.score - a.score || a.target.relPath.localeCompare(b.target.relPath))

    for (const { target, score } of scored.slice(0, opts.topK)) {
      const pairKey = [note.relPath, target.relPath].sort().join("\0") + "\0" + opts.relation
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)
      edges.push({ source: note.relPath, target: target.relPath, relation: opts.relation, weight: score })
    }
  }

  return edges
}
