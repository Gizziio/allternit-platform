/**
 * Deterministic flow detection: every flow is mechanically derived from
 * real, already-cited edges — never invented narrative. See the plan doc
 * for the full rationale; summary:
 *
 *   1. Enumerate simple paths of 2-4 edges through the node-level edge
 *      graph (no revisits/cycles).
 *   2. Score = (total evidence count across the path's edges) x (count of
 *      distinct edge types in the path) — rewards evidence-backed paths
 *      that cross more relationship kinds, both properties of the edge
 *      data itself.
 *   3. Deterministic tie-break: score desc, then the path's node-id
 *      sequence joined with "->" ascending.
 *   4. Take the fixed top MAX_FLOWS — never padded if fewer qualify.
 *   5. `trigger`/`outcome` are template-derived from the first/last node's
 *      role/entrypoints and the terminal edge's type — one fixed string
 *      template per case, never free text.
 */
import type { CodemapEdge, CodemapFlow, CodemapNode } from "./types"

const MAX_FLOWS = 12
const MAX_EDGES_PER_PATH = 4

interface Path {
  nodeIds: string[]
  edges: CodemapEdge[]
}

function enumeratePaths(edges: CodemapEdge[]): Path[] {
  const adjacency = new Map<string, CodemapEdge[]>()
  for (const e of edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, [])
    adjacency.get(e.from)!.push(e)
  }
  for (const list of adjacency.values()) list.sort((a, b) => a.to.localeCompare(b.to) || a.type.localeCompare(b.type))

  const paths: Path[] = []
  const startNodes = [...adjacency.keys()].sort()

  function dfs(current: string, nodeIds: string[], pathEdges: CodemapEdge[]) {
    if (pathEdges.length >= 2) {
      paths.push({ nodeIds: [...nodeIds], edges: [...pathEdges] })
    }
    if (pathEdges.length >= MAX_EDGES_PER_PATH) return
    for (const e of adjacency.get(current) ?? []) {
      if (nodeIds.includes(e.to)) continue // no cycles/revisits — simple paths only
      dfs(e.to, [...nodeIds, e.to], [...pathEdges, e])
    }
  }

  for (const start of startNodes) dfs(start, [start], [])
  return paths
}

function scorePath(p: Path): number {
  const totalEvidence = p.edges.reduce((sum, e) => sum + e.evidence.length, 0)
  const distinctTypes = new Set(p.edges.map((e) => e.type)).size
  return totalEvidence * distinctTypes
}

const OUTCOME_TEMPLATE: Record<CodemapEdge["type"], (id: string) => string> = {
  imports: (id) => `reaches: ${id}`,
  calls: (id) => `invokes: ${id}`,
  reads: (id) => `reads from: ${id}`,
  writes: (id) => `writes to: ${id}`,
  publishes: (id) => `publishes to: ${id}`,
  subscribes: (id) => `subscribes to: ${id}`,
}

function deriveTrigger(node: CodemapNode | undefined, id: string): string {
  if (node?.entrypoints.length) return `entrypoint: ${node.entrypoints[0]}`
  return `${node?.role ?? "module"}: ${id}`
}

export function detectFlows(nodes: CodemapNode[], edges: CodemapEdge[]): CodemapFlow[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const candidates = enumeratePaths(edges)

  candidates.sort((a, b) => {
    const scoreDiff = scorePath(b) - scorePath(a)
    if (scoreDiff !== 0) return scoreDiff
    return a.nodeIds.join("→").localeCompare(b.nodeIds.join("→"))
  })

  const selected = candidates.slice(0, MAX_FLOWS)

  return selected.map((p) => {
    const firstId = p.nodeIds[0]!
    const lastId = p.nodeIds[p.nodeIds.length - 1]!
    const lastEdge = p.edges[p.edges.length - 1]!
    return {
      trigger: deriveTrigger(nodeById.get(firstId), firstId),
      steps: p.nodeIds,
      outcome: OUTCOME_TEMPLATE[lastEdge.type](lastId),
    }
  })
}
