/**
 * Module/node discovery for codemap generation.
 *
 * Generic for any repo: prefers a repo's own declared workspace structure
 * (pnpm/npm/yarn workspaces, Cargo workspace, go.work) when present, falls
 * back to top-level directories otherwise. Always caps at <=20 primary
 * nodes via a deterministic, content-derived ranking (tracked-file count),
 * never an arbitrary/alphabetical truncation.
 */
import path from "path"
import { parse as parseYaml } from "yaml"
import { Filesystem } from "@/shared/util/filesystem"
import { Glob } from "@/shared/util/glob"
import { Ripgrep } from "@/shared/file/ripgrep"
import type { DiscoveredModule } from "./types"

const MAX_PRIMARY_NODES = 20
const CATCH_ALL_ID = "other"

async function trackedFileCount(root: string, dir: string): Promise<number> {
  let count = 0
  for await (const _ of Ripgrep.files({ cwd: path.join(root, dir) })) count++
  return count
}

/**
 * Expand workspace glob patterns to actual package directories. `marker`
 * (e.g. "package.json"/"Cargo.toml") restricts matches to directories that
 * actually own a package manifest at that level — matching real workspace-
 * tool semantics (a glob like "cmd/*\/*" declares "packages live at this
 * depth," not "every directory at this depth is a package") and keeping
 * the candidate set to real package roots rather than every subdirectory
 * a broad glob happens to touch.
 */
async function expandGlobs(root: string, patterns: string[], marker: string): Promise<Set<string>> {
  const dirs = new Set<string>()
  for (const pattern of patterns) {
    // Negations (e.g. "!cmd/*/sdks") exclude previously-matched dirs.
    if (pattern.startsWith("!")) {
      const excluded = await Glob.scan(pattern.slice(1), { cwd: root, include: "all" })
      for (const e of excluded) dirs.delete(e.replace(/\/$/, ""))
      continue
    }
    const matches = await Glob.scan(pattern, { cwd: root, include: "all" })
    for (const m of matches) {
      const rel = m.replace(/\/$/, "")
      if (await Filesystem.exists(path.join(root, rel, marker))) dirs.add(rel)
    }
  }
  return dirs
}

/** Tier A: pnpm-workspace.yaml `packages:` glob list. */
async function fromPnpmWorkspace(root: string): Promise<Set<string> | null> {
  const p = path.join(root, "pnpm-workspace.yaml")
  if (!(await Filesystem.exists(p))) return null
  try {
    const doc = parseYaml(await Filesystem.readText(p)) as { packages?: string[] }
    if (!doc.packages?.length) return null
    return expandGlobs(root, doc.packages, "package.json")
  } catch {
    return null
  }
}

/** Tier A: root package.json `workspaces` field (npm/yarn). */
async function fromNodeWorkspaces(root: string): Promise<Set<string> | null> {
  const p = path.join(root, "package.json")
  if (!(await Filesystem.exists(p))) return null
  try {
    const pkg = await Filesystem.readJson<{ workspaces?: string[] | { packages?: string[] } }>(p)
    const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages
    if (!patterns?.length) return null
    return expandGlobs(root, patterns, "package.json")
  } catch {
    return null
  }
}

/** Tier A: root Cargo.toml `[workspace] members` (handles trailing `/*` globs). */
async function fromCargoWorkspace(root: string): Promise<Set<string> | null> {
  const p = path.join(root, "Cargo.toml")
  if (!(await Filesystem.exists(p))) return null
  try {
    const toml = (await import(p)) as { default?: { workspace?: { members?: string[] } } }
    const members = toml.default?.workspace?.members
    if (!members?.length) return null
    const literal = members.filter((m) => !m.includes("*"))
    const globs = members.filter((m) => m.includes("*"))
    const dirs = new Set(literal)
    if (globs.length) {
      const expanded = await expandGlobs(root, globs, "Cargo.toml")
      for (const d of expanded) dirs.add(d)
    }
    return dirs
  } catch {
    return null
  }
}

/** Tier A: go.work `use` directives (single-line or parenthesized block form). */
async function fromGoWork(root: string): Promise<Set<string> | null> {
  const p = path.join(root, "go.work")
  if (!(await Filesystem.exists(p))) return null
  try {
    const text = await Filesystem.readText(p)
    const dirs = new Set<string>()
    const blockMatch = text.match(/use\s*\(([^)]*)\)/)
    if (blockMatch) {
      for (const line of blockMatch[1]!.split("\n")) {
        const trimmed = line.trim()
        if (trimmed) dirs.add(trimmed.replace(/^\.\//, ""))
      }
    }
    for (const m of text.matchAll(/^use\s+([^\s(][^\n]*)$/gm)) {
      dirs.add(m[1]!.trim().replace(/^\.\//, ""))
    }
    return dirs.size ? dirs : null
  } catch {
    return null
  }
}

const GENERATED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".turbo",
  "coverage",
])

/**
 * Tier B fallback: top-level directories under repo root. rg's
 * `--max-depth=1` only returns files directly in `root` itself (depth 0 is
 * the root, depth 1 is its immediate children) — it never descends into
 * subdirectories, so it can't reveal their names. `maxDepth: 2` is the
 * minimum that surfaces `<subdir>/<file>` paths, from which we take just
 * the first path segment.
 */
async function fromTopLevelDirs(root: string): Promise<Set<string>> {
  const dirs = new Set<string>()
  const rootFiles = new Set<string>()
  for await (const file of Ripgrep.files({ cwd: root, maxDepth: 2 })) {
    const segments = file.split(path.sep)
    if (segments.length === 1) {
      rootFiles.add(segments[0]!) // a root-level file, not a directory
      continue
    }
    const top = segments[0]!
    if (GENERATED_DIR_NAMES.has(top)) continue
    dirs.add(top)
  }
  // Confirm each candidate is actually a directory (defensive; rg already
  // implies it via the multi-segment path, but this is a cheap, honest check).
  const confirmed = new Set<string>()
  for (const d of dirs) {
    if (!rootFiles.has(d) && (await Filesystem.isDir(path.join(root, d)))) confirmed.add(d)
  }
  return confirmed
}

/**
 * Discover primary modules for `root`. Returns <=20 modules; if more
 * candidates exist, the lowest-ranked collapse into one deterministic
 * catch-all node (id "other", path ".").
 */
export async function discoverModules(root: string): Promise<DiscoveredModule[]> {
  // Tier A sources are unioned (a polyglot monorepo may declare both a JS
  // and a Rust workspace simultaneously — neither describes the other's
  // directories, so there's no double-counting risk in merging them).
  const tierA = await Promise.all([
    fromPnpmWorkspace(root),
    fromNodeWorkspaces(root),
    fromCargoWorkspace(root),
    fromGoWork(root),
  ])
  const union = new Set<string>()
  for (const result of tierA) {
    if (result) for (const d of result) union.add(d)
  }

  const candidates = union.size > 0 ? union : await fromTopLevelDirs(root)
  const role = union.size > 0 ? "workspace-member" : "top-level-directory"

  const ranked: Array<{ dir: string; fileCount: number }> = []
  for (const dir of candidates) {
    ranked.push({ dir, fileCount: await trackedFileCount(root, dir) })
  }
  ranked.sort((a, b) => b.fileCount - a.fileCount || a.dir.localeCompare(b.dir))

  // Reserve one slot for the catch-all only when there's actually overflow —
  // otherwise a repo with exactly <=20 candidates would lose one for no reason.
  const primaryCount = ranked.length > MAX_PRIMARY_NODES ? MAX_PRIMARY_NODES - 1 : ranked.length
  const primary = ranked.slice(0, primaryCount)
  const overflow = ranked.slice(primaryCount)

  const modules: DiscoveredModule[] = primary.map((r) => ({
    id: r.dir,
    path: r.dir,
    role,
    fileCount: r.fileCount,
  }))

  if (overflow.length > 0) {
    modules.push({
      id: CATCH_ALL_ID,
      path: ".",
      role: "catch-all",
      fileCount: overflow.reduce((sum, r) => sum + r.fileCount, 0),
    })
  }

  return modules
}

/** Maps each module's npm package name (its package.json "name" field, if any) to its module path. */
export async function buildPackageNameMap(root: string, modules: DiscoveredModule[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const m of modules) {
    const pkgPath = path.join(root, m.path, "package.json")
    if (!(await Filesystem.exists(pkgPath))) continue
    try {
      const pkg = await Filesystem.readJson<{ name?: string }>(pkgPath)
      if (pkg.name) map.set(pkg.name, m.path)
    } catch {
      // not real JSON / unreadable — skip, no fabricated mapping
    }
  }
  return map
}

/**
 * Mechanically-derived entrypoints per module: package.json's `main`/`bin`
 * fields (Node), or `src/main.rs`/`src/lib.rs` (Cargo, the real convention
 * for a crate's own root) if present. Never invented — only paths that
 * actually exist on disk are returned, so downstream node-path validation
 * (validate.ts check #2 logic) always holds for entrypoints too.
 */
export async function deriveEntrypoints(root: string, modules: DiscoveredModule[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  for (const m of modules) {
    const entrypoints: string[] = []
    const pkgPath = path.join(m.path, "package.json")
    if (await Filesystem.exists(path.join(root, pkgPath))) {
      try {
        const pkg = await Filesystem.readJson<{ main?: string; bin?: string | Record<string, string> }>(path.join(root, pkgPath))
        if (pkg.main) entrypoints.push(path.join(m.path, pkg.main))
        if (typeof pkg.bin === "string") entrypoints.push(path.join(m.path, pkg.bin))
        else if (pkg.bin) for (const b of Object.values(pkg.bin)) entrypoints.push(path.join(m.path, b))
      } catch {
        // unreadable package.json — no fabricated entrypoint
      }
    }
    for (const candidate of ["src/main.rs", "src/lib.rs"]) {
      const rel = path.join(m.path, candidate)
      if (await Filesystem.exists(path.join(root, rel))) entrypoints.push(rel)
    }
    if (entrypoints.length) result.set(m.id, entrypoints)
  }
  return result
}

/** Maps each module's Rust crate name (its Cargo.toml [package] name, if any) to its module path. */
export async function buildCrateNameMap(root: string, modules: DiscoveredModule[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const m of modules) {
    const cargoPath = path.join(root, m.path, "Cargo.toml")
    if (!(await Filesystem.exists(cargoPath))) continue
    try {
      const toml = (await import(cargoPath)) as { default?: { package?: { name?: string } } }
      const name = toml.default?.package?.name
      if (name) map.set(name.replace(/-/g, "_"), m.path) // Rust normalizes crate names to underscores in `use` paths
    } catch {
      // not real TOML / unreadable — skip, no fabricated mapping
    }
  }
  return map
}
