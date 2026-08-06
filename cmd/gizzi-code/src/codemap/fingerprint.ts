/**
 * SHA-256 per-module content fingerprinting + codemap.lock read/write/diff.
 *
 * Fingerprints are computed over git-tracked files' *current working-tree*
 * content (not the git blob), so uncommitted edits show up as "stale"
 * immediately — that's the whole point of running this between commits.
 * Uses the same file->module attribution as edges.ts (`nodeIdForFile`), so
 * "which module does this file belong to" has exactly one implementation.
 */
import path from "path"
import { createHash } from "crypto"
import { Filesystem } from "@/shared/util/filesystem"
import { Git } from "@/shared/util/git"
import { nodeIdForFile } from "./edges"
import type { CodemapLock, DiscoveredModule } from "./types"

export const FINGERPRINT_ALGORITHM = "sha256-tracked-paths-plus-contents-v1" as const

async function trackedFiles(root: string): Promise<string[]> {
  const result = await Git.exec(["ls-files"], { cwd: root })
  const text = await result.text()
  return text.split("\n").filter(Boolean).sort()
}

export async function computeModuleFingerprints(
  root: string,
  modules: DiscoveredModule[],
): Promise<Record<string, { fingerprint: string; file_count: number }>> {
  const files = await trackedFiles(root)
  const byModule = new Map<string, string[]>()
  for (const f of files) {
    const moduleId = nodeIdForFile(f, modules)
    if (!moduleId) continue
    if (!byModule.has(moduleId)) byModule.set(moduleId, [])
    byModule.get(moduleId)!.push(f)
  }

  const result: Record<string, { fingerprint: string; file_count: number }> = {}
  for (const m of modules) {
    const moduleFiles = (byModule.get(m.id) ?? []).sort()
    const hash = createHash("sha256")
    for (const f of moduleFiles) {
      let content: Buffer
      try {
        content = await Filesystem.readBytes(path.join(root, f))
      } catch {
        content = Buffer.alloc(0) // deleted-since-ls-files race — hash empty, don't crash
      }
      // Explicit length-prefixing avoids path/content boundary ambiguity
      // (e.g. "ab"+"c" vs "a"+"bc" must not collide).
      hash.update(`${f.length}:${f}\0${content.length}:`)
      hash.update(content)
      hash.update("\0")
    }
    result[m.id] = { fingerprint: hash.digest("hex"), file_count: moduleFiles.length }
  }
  return result
}

export async function buildLock(
  root: string,
  modules: DiscoveredModule[],
  scope: string[],
  excluded: string[],
  generatedAt: string,
): Promise<CodemapLock> {
  const commitResult = await Git.exec(["rev-parse", "HEAD"], { cwd: root })
  const commit = (await commitResult.text()).trim()
  const status = await Git.status(root)
  const dirty = status.modified.length > 0 || status.untracked.length > 0 || status.staged.length > 0
  const modulesFingerprints = await computeModuleFingerprints(root, modules)

  return {
    commit,
    dirty,
    generated_at: generatedAt,
    scope,
    excluded,
    fingerprint_algorithm: FINGERPRINT_ALGORITHM,
    modules: modulesFingerprints,
  }
}

/** Compares a freshly-built lock against whatever's already on disk (if anything). Returns the changed module ids. */
export async function diffStaleModules(root: string, freshLock: CodemapLock): Promise<string[]> {
  const lockPath = path.join(root, "docs", "codemap", "codemap.lock")
  if (!(await Filesystem.exists(lockPath))) {
    return Object.keys(freshLock.modules).sort() // no prior lock — every module is "new"
  }
  let previous: CodemapLock
  try {
    previous = await Filesystem.readJson<CodemapLock>(lockPath)
  } catch {
    return Object.keys(freshLock.modules).sort()
  }

  const stale = new Set<string>()
  const allIds = new Set([...Object.keys(previous.modules), ...Object.keys(freshLock.modules)])
  for (const id of allIds) {
    if (previous.modules[id]?.fingerprint !== freshLock.modules[id]?.fingerprint) stale.add(id)
  }
  return [...stale].sort()
}
