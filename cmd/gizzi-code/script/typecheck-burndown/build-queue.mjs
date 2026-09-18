#!/usr/bin/env node
// build-queue.mjs — generate the @ts-nocheck burn-down queue for cmd/gizzi-code/src.
//
// Plain Node .mjs with ZERO dependencies (must not add to the typed surface).
// Run: node script/typecheck-burndown/build-queue.mjs   (from anywhere; resolves its own root)
//
// What it does:
//   1. Enumerates src/**/*.ts|tsx whose line 1 is `// @ts-nocheck`.
//   2. Excludes (a) React Compiler build artifacts (fingerprint match) and
//      (b) vendored ink-app internals (ink/, vim/ subtrees). Both rules are
//      named constants below.
//   3. Scans imports (static + dynamic + require), resolves them per the
//      tsconfig paths priority (ink-app shadows runtime for the specialized
//      `@/<stratum>/*` prefixes), and builds an intra-queue dependency graph.
//   4. Orders leaf-first: fewest queue-descendants (transitive intra-queue
//      imports) first; twin pairs (src/runtime/* <-> src/cli/ui/ink-app/*)
//      stay adjacent with the runtime copy before the ink-app twin; ties
//      break by LOC ascending.
//   5. Packs batches of 5,000-7,000 LOC (hard cap 7,500). A single file over
//      1,500 LOC gets a dedicated batch; twin pairs are never split.
//
// Output: script/typecheck-burndown/queue.json — deterministic (stable sorts,
// no timestamps) so re-runs diff cleanly. generatedFrom pins the git SHA.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, normalize, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..") // cmd/gizzi-code
const SRC = join(ROOT, "src")
const OUT_DIR = join(ROOT, "script", "typecheck-burndown")
const OUT_FILE = join(OUT_DIR, "queue.json")

// ── Exclusion rules ────────────────────────────────────────────────────────────

// (a) React Compiler build artifacts. These are machine-generated (react-compiler
// output piped through a build step), not handwritten code — burning them down
// is meaningless because the next compiler run regenerates the header.
const COMPILER_ARTIFACT_FINGERPRINTS = [
  "react/compiler-runtime", // compiler-injected runtime import
  "c as _c", // compiler-generated hook cache binding
  "$[0]", // compiler-generated hook cache slot access
]

// (b) Vendored internals under ink-app. Third-party-derived code (ink rendering
// core, vim emulation) that tracks upstream; not part of the handwritten queue.
const VENDORED_SUBTREES = [
  "src/cli/ui/ink-app/ink/",
  "src/cli/ui/ink-app/vim/",
]

// ── Batch packing limits ───────────────────────────────────────────────────────

const BATCH_TARGET_LOC = 7000 // fill batches up to this…
const BATCH_HARD_CAP_LOC = 7500 // …never beyond this
const SOLO_FILE_LOC = 1500 // a single file over this gets a dedicated batch

// ── Import scanning ────────────────────────────────────────────────────────────

const STATIC_IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g
const DYNAMIC_IMPORT_RE = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"]
const INDEX_FILES = ["index.ts", "index.tsx", "index.js"]

// tsconfig paths (tsconfig.json "paths", highest priority = longest prefix).
// Only mappings that can resolve into src/ are listed; workspace-package
// mappings (@allternit/*, react/compiler-runtime) never point at queue files.
// The specialized `@/<stratum>/*` prefixes resolve ink-app FIRST — ink-app
// shadows runtime and src, so the queue must not assume runtime is canonical.
const PATH_PREFIX_MAPPINGS = [
  ["@/ink/", ["src/cli/ui/ink-app/ink/"]],
  ["@/commands/", ["src/cli/ui/ink-app/commands/", "src/commands/", "src/runtime/commands/"]],
  ["@/services/", ["src/cli/ui/ink-app/services/", "src/services/", "src/runtime/services/"]],
  ["@/hooks/", ["src/cli/ui/ink-app/hooks/", "src/hooks/", "src/runtime/hooks/"]],
  ["@/utils/", ["src/cli/ui/ink-app/utils/", "src/utils/", "src/runtime/utils/"]],
  ["@/types/", ["src/cli/ui/ink-app/types/", "src/types/", "src/runtime/types/"]],
  ["@/components/", ["src/cli/ui/ink-app/components/", "src/components/"]],
  ["@/state/", ["src/cli/ui/ink-app/state/", "src/state/", "src/runtime/state/"]],
  ["@/bootstrap/", ["src/cli/ui/ink-app/bootstrap/", "src/bootstrap/"]],
  ["@/tools/", ["src/cli/ui/ink-app/tools/", "src/tools/", "src/runtime/tools/"]],
  ["@/constants/", ["src/cli/ui/ink-app/constants/", "src/constants/"]],
  ["@/core/", ["src/cli/ui/ink-app/core/", "src/core/"]],
  ["@/runtime/", ["src/cli/ui/ink-app/runtime/", "src/runtime/"]],
  ["@/entrypoints/", ["src/cli/ui/ink-app/entrypoints/", "src/entrypoints/"]],
  ["@tui/", ["src/cli/ui/tui/"]],
  ["src/", ["src/", "src/cli/ui/ink-app/"]],
]
// Fallback (lowest priority): `@/x` -> src/x
const AT_FALLBACK_TARGETS = ["src/"]

const NOCHECK_HEADER = "// @ts-nocheck"

// ── Filesystem helpers ─────────────────────────────────────────────────────────

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(entry.name)) yield p
  }
}

function countLines(absPath) {
  // count newlines; a trailing-newline-terminated file's last line still counts
  const text = readFileSync(absPath, "utf8")
  let n = 0
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return text.length > 0 && (text.length === 0 || text.charCodeAt(text.length - 1) !== 10) ? n + 1 : n
}

function isFile(rel) {
  try {
    return statSync(join(ROOT, rel)).isFile()
  } catch {
    return false
  }
}

// TS module resolution for one candidate base path: extension expansion,
// index files, and ESM `.js` -> `.ts`/`.tsx` remapping. First hit wins.
function resolveBase(base) {
  const dot = base.lastIndexOf(".")
  const hasKnownExt = dot > base.lastIndexOf("/") && RESOLVE_EXTENSIONS.includes(base.slice(dot))
  const stem = hasKnownExt ? base.slice(0, dot) : base
  const candidates = []
  if (!hasKnownExt) {
    for (const e of RESOLVE_EXTENSIONS) candidates.push(base + e)
  } else {
    // `.js`/`.mjs`/`.jsx` spec remaps to TS sources
    for (const e of [".ts", ".tsx"]) candidates.push(stem + e)
  }
  for (const e of RESOLVE_EXTENSIONS) candidates.push(stem + e)
  for (const i of INDEX_FILES) candidates.push(join(stem, i))
  for (const c of candidates) {
    const norm = normalize(c).replace(/\\/g, "/")
    if (isFile(norm)) return norm
  }
  return null
}

// Resolve an import specifier to a repo-relative src file per tsconfig paths
// priority (longest matching prefix first; first existing candidate wins).
// Returns null for external packages / unresolvable specs.
export function resolveImport(spec, importerRel) {
  let bases = null
  if (spec.startsWith(".")) {
    bases = [normalize(join(dirname(importerRel), spec)).replace(/\\/g, "/")]
  } else if (spec === "@/ink" || spec === "@/ink.js") {
    const hit = resolveBase("src/cli/ui/ink-app/ink.ts")
    return hit
  } else {
    for (const [prefix, targets] of PATH_PREFIX_MAPPINGS) {
      if (spec.startsWith(prefix)) {
        const sub = spec.slice(prefix.length)
        bases = targets.map(t => normalize(join(t, sub)).replace(/\\/g, "/"))
        break
      }
    }
    if (bases === null && spec.startsWith("@/")) {
      bases = AT_FALLBACK_TARGETS.map(t => normalize(join(t, spec.slice(2))).replace(/\\/g, "/"))
    }
  }
  if (bases === null) return null
  for (const b of bases) {
    const hit = resolveBase(b)
    if (hit) return hit
  }
  return null
}

// ── Queue scan (shared with the guard test) ────────────────────────────────────

export function isCompilerArtifact(text) {
  for (const f of COMPILER_ARTIFACT_FINGERPRINTS) if (text.includes(f)) return true
  return false
}

export function isVendoredSubtree(rel) {
  for (const v of VENDORED_SUBTREES) if (rel.startsWith(v)) return true
  return false
}

// Returns { queue: [{path, loc}], excludedCompilerArtifacts, excludedVendored, totalNocheck }
export function scanQueue() {
  const queue = []
  let excludedCompilerArtifacts = 0
  let excludedVendored = 0
  let totalNocheck = 0
  for (const abs of walk(SRC)) {
    const rel = normalize(relative(ROOT, abs)).replace(/\\/g, "/")
    const text = readFileSync(abs, "utf8")
    if (!text.startsWith(NOCHECK_HEADER)) continue
    totalNocheck++
    if (isCompilerArtifact(text)) {
      excludedCompilerArtifacts++
      continue
    }
    if (isVendoredSubtree(rel)) {
      excludedVendored++
      continue
    }
    queue.push({ path: rel, loc: countLines(abs) })
  }
  queue.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { queue, excludedCompilerArtifacts, excludedVendored, totalNocheck }
}

// ── Dependency graph + leaf-first ordering ─────────────────────────────────────

function buildGraph(queueFiles) {
  const inQueue = new Set(queueFiles.map(f => f.path))
  const edges = new Map() // importer -> Set(imported queue files)
  for (const f of queueFiles) {
    const text = readFileSync(join(ROOT, f.path), "utf8")
    const specs = new Set()
    for (const m of text.matchAll(STATIC_IMPORT_RE)) specs.add(m[1])
    for (const m of text.matchAll(DYNAMIC_IMPORT_RE)) specs.add(m[1])
    const deps = new Set()
    for (const spec of specs) {
      const hit = resolveImport(spec, f.path)
      if (hit && hit !== f.path && inQueue.has(hit)) deps.add(hit)
    }
    edges.set(f.path, deps)
  }
  return edges
}

// transitive intra-queue dependency closure size per file (DFS, memoized)
function closureSizes(queueFiles, edges) {
  const memo = new Map()
  const visiting = new Set()
  const size = (p) => {
    if (memo.has(p)) return memo.get(p)
    if (visiting.has(p)) return 0 // cycle guard: break loops
    visiting.add(p)
    let n = 0
    for (const d of edges.get(p) ?? []) {
      n += 1 + size(d)
    }
    visiting.delete(p)
    memo.set(p, n)
    return n
  }
  for (const f of queueFiles) size(f.path)
  return memo
}

// Twin: same relative path under src/runtime/ and src/cli/ui/ink-app/.
// Pairing both in one batch makes the second fix a mechanical port.
function findTwins(queueFiles) {
  const byPath = new Map(queueFiles.map(f => [f.path, f]))
  const twinOf = new Map() // runtime path -> ink-app path
  for (const f of queueFiles) {
    if (!f.path.startsWith("src/runtime/")) continue
    const inkPath = "src/cli/ui/ink-app/" + f.path.slice("src/runtime/".length)
    if (byPath.has(inkPath)) twinOf.set(f.path, inkPath)
  }
  return twinOf
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function buildQueue() {
  const { queue, excludedCompilerArtifacts, excludedVendored, totalNocheck } = scanQueue()
  const edges = buildGraph(queue)
  const sizes = closureSizes(queue, edges)
  const twinOf = findTwins(queue)
  const byPath = new Map(queue.map(f => [f.path, f]))

  // Group into twin units so pairs stay adjacent (runtime before ink-app).
  const units = []
  const claimed = new Set()
  for (const f of queue) {
    if (claimed.has(f.path)) continue
    if (twinOf.has(f.path)) {
      const ink = byPath.get(twinOf.get(f.path))
      units.push({ files: [f, ink], loc: f.loc + ink.loc })
      claimed.add(f.path)
      claimed.add(ink.path)
    } else if ([...twinOf.values()].includes(f.path)) {
      continue // ink-app twin handled with its runtime sibling
    } else {
      units.push({ files: [f], loc: f.loc })
      claimed.add(f.path)
    }
  }

  // Leaf-first: fewest transitive queue-dependencies first; ties by LOC asc,
  // then path for determinism. Twin unit rank = min of member ranks so the
  // pair lands together.
  const rankOf = p => sizes.get(p) ?? 0
  units.sort((a, b) => {
    const ra = Math.min(...a.files.map(f => rankOf(f.path)))
    const rb = Math.min(...b.files.map(f => rankOf(f.path)))
    if (ra !== rb) return ra - rb
    if (a.loc !== b.loc) return a.loc - b.loc
    return a.files[0].path < b.files[0].path ? -1 : 1
  })

  // Pack batches: 5,000-7,000 LOC target, 7,500 hard cap. Units are consumed
  // in rank order, but a unit that would breach the cap is skipped (it stays
  // in order for the next batch) so batches fill toward the target instead of
  // closing early on one oversized unit. A file over 1,500 LOC gets a
  // dedicated batch (its twin rides along — never split pairs).
  const batches = []
  let pending = [...units]
  while (pending.length > 0) {
    const largeIdx = pending.findIndex(u => u.files.some(f => f.loc > SOLO_FILE_LOC))
    if (largeIdx !== -1 && largeIdx === 0) {
      const unit = pending.shift()
      batches.push(mkBatch([...unit.files], unit.loc))
      continue
    }
    const batch = { files: [], loc: 0 }
    const rest = []
    for (const unit of pending) {
      if (unit.files.some(f => f.loc > SOLO_FILE_LOC)) {
        rest.push(unit) // dedicated batch material; handled at queue front
        continue
      }
      if (batch.loc < BATCH_TARGET_LOC && batch.loc + unit.loc <= BATCH_HARD_CAP_LOC) {
        batch.files.push(...unit.files)
        batch.loc += unit.loc
      } else {
        rest.push(unit)
      }
    }
    if (batch.files.length === 0) {
      // nothing fit (all remaining units are large files) — solo the front one
      const unit = rest.shift()
      pending = rest
      batches.push(mkBatch([...unit.files], unit.loc))
      continue
    }
    pending = rest
    batches.push(mkBatch(batch.files, batch.loc))
  }
  function mkBatch(files, loc) {
    return { id: "", files: files.map(f => f.path), loc, twins: [], state: "NEW" }
  }
  batches.forEach((b, i) => (b.id = `b${String(i + 1).padStart(4, "0")}`))

  // Record twin pairs per batch (runtime path -> ink-app path), batch order.
  for (const batch of batches) {
    const inBatch = new Set(batch.files)
    for (const [rt, ink] of twinOf) {
      if (inBatch.has(rt) && inBatch.has(ink)) {
        batch.twins.push({ runtime: rt, inkApp: ink })
      }
    }
  }

  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim()
  const totalQueueLoc = queue.reduce((n, f) => n + f.loc, 0)
  return {
    version: 1,
    generatedFrom: sha,
    batchCount: batches.length,
    stats: {
      totalNocheck: totalNocheck,
      excludedCompilerArtifacts: excludedCompilerArtifacts,
      excludedVendored: excludedVendored,
      totalQueueFiles: queue.length,
      totalQueueLoc: totalQueueLoc,
    },
    batches,
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const result = buildQueue()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + "\n")
  const locs = result.batches.map(b => b.loc)
  const min = Math.min(...locs)
  const max = Math.max(...locs)
  console.log(
    `queue.json: ${result.stats.totalQueueFiles} files, ${result.stats.totalQueueLoc} LOC, ` +
      `${result.batchCount} batches (loc min ${min} / max ${max})`,
  )
  console.log(
    `excluded: ${result.stats.excludedCompilerArtifacts} compiler artifacts, ` +
      `${result.stats.excludedVendored} vendored ink/vim (of ${result.stats.totalNocheck} nocheck files)`,
  )
}
