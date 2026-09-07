import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "fs"
import { dirname, join, normalize } from "path"

// Importer guard: fails if any path deleted by the dead-code cleanup
// (manifest: test/deleted-paths.txt, one repo-relative path per line)
// reappears on disk or gets re-imported from src/, test/, or script/.
//
// Resolution mirrors tsconfig path mappings (tsconfig.json /
// tsconfig.base.json / src/cli/ui/ink-app/tsconfig.json):
//   @/*, ~/*  -> src/*, src/runtime/*, src/cli/ui/ink-app/*
//   src/*      -> src/*, src/cli/ui/ink-app/*
//   @tui/*     -> src/cli/ui/tui/*
// plus extension/index expansion and TS ESM .js -> .ts/.tsx remapping.

const ROOT = join(dirname(import.meta.dir), "..")
const MANIFEST = join(import.meta.dir, "deleted-paths.txt")

const deleted = new Set(
  readFileSync(MANIFEST, "utf8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#")),
)

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g
const DYNAMIC_RE = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"]
const INDEXES = ["index.ts", "index.tsx", "index.js"]

function candidates(spec: string, importer: string): string[] {
  const out: string[] = []
  const add = (p: string) => out.push(normalize(p).replace(/\\/g, "/"))
  let bases: string[] = []
  if (spec.startsWith(".")) {
    bases = [join(dirname(importer), spec)]
  } else if (spec.startsWith("@/") || spec.startsWith("~/")) {
    const sub = spec.slice(2)
    bases = [
      join("src", sub),
      join("src/runtime", sub),
      join("src/cli/ui/ink-app", sub),
    ]
  } else if (spec.startsWith("src/")) {
    const sub = spec.slice(4)
    bases = [join("src", sub), join("src/cli/ui/ink-app", sub)]
  } else if (spec.startsWith("@tui/")) {
    bases = [join("src/cli/ui/tui", spec.slice(5))]
  } else {
    return []
  }
  const expanded: string[] = []
  for (const b of bases) {
    expanded.push(b)
    for (const e of EXTENSIONS) expanded.push(b + e)
    const dot = b.lastIndexOf(".")
    if (dot > b.lastIndexOf("/")) {
      const stem = b.slice(0, dot)
      for (const e of EXTENSIONS) expanded.push(stem + e)
    }
    for (const i of INDEXES) expanded.push(join(b, i))
  }
  return expanded
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) yield p
  }
}

describe("deleted-paths guard", () => {
  test("manifest is non-trivial", () => {
    expect(deleted.size).toBeGreaterThan(1000)
  })

  test("no deleted path exists on disk", () => {
    const restored: string[] = []
    for (const p of deleted) {
      try {
        statSync(join(ROOT, p))
        restored.push(p)
      } catch {
        // gone, good
      }
    }
    expect(restored).toEqual([])
  })

  test("no dangling symlinks under src/ (deleted targets break importers)", () => {
    const dangling: string[] = []
    const check = (dir: string) => {
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === "dist") continue
        const p = join(dir, entry.name)
        if (entry.isDirectory()) {
          check(p)
        } else if (entry.isSymbolicLink()) {
          try {
            statSync(p)
          } catch {
            dangling.push(normalize(p).replace(/\\/g, "/"))
          }
        }
      }
    }
    check(join(ROOT, "src"))
    expect(dangling).toEqual([])
  })

  test("no import in src/, test/, or script/ resolves to a deleted path", () => {    const scanRoots = ["src", "test", "script"]
    const violations: string[] = []
    for (const root of scanRoots) {
      let files: string[] = []
      try {
        files = [...walk(join(ROOT, root))]
      } catch {
        continue
      }
      for (const abs of files) {
        const rel = normalize(abs.slice(ROOT.length + 1)).replace(/\\/g, "/")
        const text = readFileSync(abs, "utf8")
        const specs = new Set<string>()
        for (const m of text.matchAll(IMPORT_RE)) specs.add(m[1])
        for (const m of text.matchAll(DYNAMIC_RE)) specs.add(m[1])
        for (const spec of specs) {
          for (const c of candidates(spec, rel)) {
            if (deleted.has(c)) {
              violations.push(`${rel}: '${spec}' -> ${c}`)
              break
            }
          }
        }
      }
    }
    expect(violations).toEqual([])
  })
})
