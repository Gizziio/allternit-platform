/**
 * Rolls up file-level edges (from scan-ts.ts/scan-rust.ts) into node-level
 * CodemapEdge[]. A file that doesn't fall under any discovered module's
 * path is simply not represented — never assigned to a fabricated node.
 */
import type { CodemapEdge, DiscoveredModule, Evidence, FileEdge } from "./types"

const MAX_EVIDENCE_PER_EDGE = 5

/**
 * Longest-prefix match: the most specific module a file could belong to
 * wins; falls back to the catch-all node (path ".") if no primary module's
 * path prefixes the file. Exported for reuse by fingerprint.ts, so a file's
 * module attribution is identical whether it's being used for edge roll-up
 * or fingerprinting — one source of truth, not two independently-drifting
 * implementations of the same rule.
 */
export function nodeIdForFile(relFile: string, modules: DiscoveredModule[]): string | undefined {
  let best: DiscoveredModule | undefined
  for (const m of modules) {
    if (m.path === "." || m.path === "") continue // catch-all is fallback, not a prefix match
    if (relFile === m.path || relFile.startsWith(m.path + "/")) {
      if (!best || m.path.length > best.path.length) best = m
    }
  }
  if (best) return best.id
  const catchAll = modules.find((m) => m.path === ".")
  return catchAll?.id
}

export function rollUpToNodeEdges(fileEdges: FileEdge[], modules: DiscoveredModule[]): CodemapEdge[] {
  const merged = new Map<string, { from: string; to: string; type: CodemapEdge["type"]; evidence: Evidence[] }>()

  for (const fe of fileEdges) {
    const from = nodeIdForFile(fe.fromFile, modules)
    const to = nodeIdForFile(fe.toFile, modules)
    if (!from || !to || from === to) continue // unmapped or intra-module — not a cross-module edge

    const key = `${from}\0${to}\0${fe.type}`
    const existing = merged.get(key)
    if (existing) {
      existing.evidence.push(fe.evidence)
    } else {
      merged.set(key, { from, to, type: fe.type, evidence: [fe.evidence] })
    }
  }

  const edges: CodemapEdge[] = []
  for (const e of merged.values()) {
    // Deterministic cap: stable-sort by (file, line) then take the first N —
    // not "first N encountered," which would depend on scan iteration order.
    const sortedEvidence = [...e.evidence].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    edges.push({ from: e.from, to: e.to, type: e.type, evidence: sortedEvidence.slice(0, MAX_EVIDENCE_PER_EDGE) })
  }

  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.type.localeCompare(b.type))
  return edges
}
