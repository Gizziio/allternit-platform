/**
 * The six honesty checks every codemap generation must pass before writing
 * anything: schema-valid, every node path exists, every evidence citation
 * is actually found in source, html/json share identical id sets, the lock
 * matches fresh git state, and confidence is never omitted. Any failure
 * aborts the whole step — no partial files are ever written (see index.ts).
 */
import path from "path"
import { Filesystem } from "@/shared/util/filesystem"
import { Git } from "@/shared/util/git"
import { computeModuleFingerprints } from "./fingerprint"
import { CodemapJson as CodemapJsonSchema, CodemapLock as CodemapLockSchema } from "./types"
import type { CodemapJson, CodemapLock, DiscoveredModule } from "./types"

export async function validateCodemap(
  root: string,
  json: CodemapJson,
  html: string,
  lock: CodemapLock,
  modules: DiscoveredModule[],
): Promise<string[]> {
  const issues: string[] = []

  // 1. Schema-valid (also structurally enforces #6: confidence is a
  // required field on every Evidence, so it can never be silently omitted).
  const jsonResult = CodemapJsonSchema.safeParse(json)
  if (!jsonResult.success) issues.push(`codemap.json failed schema validation: ${jsonResult.error.message}`)
  const lockResult = CodemapLockSchema.safeParse(lock)
  if (!lockResult.success) issues.push(`codemap.lock failed schema validation: ${lockResult.error.message}`)

  // 2. Every node path exists on disk.
  for (const node of json.nodes) {
    if (!(await Filesystem.exists(path.join(root, node.path)))) {
      issues.push(`node "${node.id}" cites path "${node.path}" which does not exist`)
    }
  }

  // 3. Every evidence citation is actually found in the cited source.
  const fileCache = new Map<string, string[]>()
  async function linesOf(file: string): Promise<string[] | undefined> {
    if (fileCache.has(file)) return fileCache.get(file)
    try {
      const text = await Filesystem.readText(path.join(root, file))
      const lines = text.split("\n")
      fileCache.set(file, lines)
      return lines
    } catch {
      fileCache.set(file, [])
      return undefined
    }
  }
  for (const edge of json.edges) {
    for (const ev of edge.evidence) {
      if (ev.confidence === "unknown") continue // no evidence claimed, nothing to verify
      const lines = await linesOf(ev.file)
      const line = lines?.[ev.line - 1]
      if (line === undefined) {
        issues.push(`edge ${edge.from}->${edge.to} cites ${ev.file}:${ev.line}, which doesn't exist`)
      } else if (ev.symbol && !line.includes(ev.symbol)) {
        issues.push(`edge ${edge.from}->${edge.to} cites "${ev.symbol}" at ${ev.file}:${ev.line}, not found on that line`)
      }
    }
  }

  // 4. html/json share identical node/edge/flow id sets. codemap.html
  // embeds the exact same CodemapJson as a <script type="application/json">
  // data island (see render-html.ts) rather than a hand-maintained parallel
  // structure, so this is nearly tautological by construction — still
  // assert it to catch a future refactor introducing drift.
  const dataIslandMatch = html.match(/<script id="codemap-data" type="application\/json">([\s\S]*?)<\/script>/)
  if (!dataIslandMatch) {
    issues.push("codemap.html is missing its embedded codemap-data script tag")
  } else {
    try {
      // The data island escapes "<" via a JSON unicode escape (which
      // JSON.parse decodes natively) rather than HTML entities — see
      // render-html.ts's jsonForScriptTag for why HTML-entity-escaping
      // would be wrong for a <script> element's raw-text content.
      const embedded = JSON.parse(dataIslandMatch[1]!) as CodemapJson
      const idSet = (arr: { id?: string }[]) => new Set(arr.map((x) => x.id).filter(Boolean))
      const jsonNodeIds = idSet(json.nodes)
      const htmlNodeIds = idSet(embedded.nodes)
      if (jsonNodeIds.size !== htmlNodeIds.size || [...jsonNodeIds].some((id) => !htmlNodeIds.has(id))) {
        issues.push("codemap.html's embedded node ids don't match codemap.json's")
      }
      if (embedded.edges.length !== json.edges.length) {
        issues.push("codemap.html's embedded edge count doesn't match codemap.json's")
      }
      if (embedded.flows.length !== json.flows.length) {
        issues.push("codemap.html's embedded flow count doesn't match codemap.json's")
      }
    } catch {
      issues.push("codemap.html's embedded codemap-data script tag is not valid JSON")
    }
  }

  // 5. codemap.lock matches a fresh git read taken at (approximately) the
  // same instant, and its fingerprints match freshly recomputed ones.
  const freshCommit = (await (await Git.exec(["rev-parse", "HEAD"], { cwd: root })).text()).trim()
  if (lock.commit !== freshCommit) issues.push(`codemap.lock commit "${lock.commit}" doesn't match current HEAD "${freshCommit}"`)
  const freshStatus = await Git.status(root)
  const freshDirty = freshStatus.modified.length > 0 || freshStatus.untracked.length > 0 || freshStatus.staged.length > 0
  if (lock.dirty !== freshDirty) issues.push(`codemap.lock dirty=${lock.dirty} doesn't match current working-tree state (${freshDirty})`)
  const freshFingerprints = await computeModuleFingerprints(root, modules)
  for (const [id, fp] of Object.entries(freshFingerprints)) {
    if (lock.modules[id]?.fingerprint !== fp.fingerprint) {
      issues.push(`codemap.lock fingerprint for module "${id}" doesn't match a fresh recomputation`)
    }
  }

  return issues
}
