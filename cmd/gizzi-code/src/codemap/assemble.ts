/**
 * Pure combine of discovery + edges + flows into the final CodemapJson.
 * No I/O here — callers pass in already-computed pieces.
 *
 * `generated_at` is the one field excluded from the byte-identical-
 * determinism guarantee (see index.ts's determinism check): wall-clock
 * time can't be deterministic across separate runs, but every other field
 * here is a pure function of repo content, so two runs against unchanged
 * content must still be byte-identical except for that one field.
 */
import type { CodemapEdge, CodemapFlow, CodemapJson, CodemapNode, DiscoveredModule } from "./types"

export function buildCodemapNodes(modules: DiscoveredModule[], entrypoints: Map<string, string[]>): CodemapNode[] {
  return modules.map((m) => ({
    id: m.id,
    path: m.path,
    role: m.role,
    entrypoints: entrypoints.get(m.id) ?? [],
    tests: [],
    constraints: [],
    evidence: [],
  }))
}

export function assembleCodemapJson(
  nodes: CodemapNode[],
  edges: CodemapEdge[],
  flows: CodemapFlow[],
  scope: string[],
  commit: string,
  generatedAt: string,
): CodemapJson {
  return {
    generated_at: generatedAt,
    generated_from_commit: commit,
    scope,
    nodes,
    edges,
    flows,
  }
}
