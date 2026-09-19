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
//   6. Quarantines files the burn-down cannot fix type-onlyly (pilot batch
//      b0001 escalated 16 files, all from three avoidable causes):
//        a. suspect-malformed — not valid JS/TS grammar (TEMPORARY SHIM stubs
//           with unclosed function bodies). Detected by a string/comment/
//           regex/template-aware bracket-pairing scan plus an ESM rule:
//           `export`/`import` declarations at brace depth > 0 (outside
//           namespace/declare blocks) mean an enclosing body was never closed.
//        b. suspect-dead-shim — a relative import specifier that does not
//           resolve on disk, or resolves only with different casing (TS1261
//           on case-insensitive filesystems). Fixing needs import-specifier
//           changes, banned by the type-only burn rule.
//        c. alias — queued paths sharing one realpath (symlink pairs). One
//           physical file must burn once: the canonical path (its own
//           realpath) stays in the queue; symlink aliases are quarantined
//           with an `aliasOf` note.
//      Quarantined files are excluded from batches and counted separately.
//
// Batches whose entire file list left the live queue (burned, quarantined, or
// deleted from disk) are kept as retired records (files: [], state and
// burnedFiles/burnedLoc/escalated/note preserved) so burn history is not
// lost. DONE batches retire even when a live remainder is still queued: the
// recorded burn must not vanish on regen, and the leftover files return to
// the pool and are repacked into active batches.
//
// Batch IDs are stable across regens: a repacked batch whose sorted file list
// is byte-identical to a previous queue entry keeps that entry's ID; only
// genuinely new batches take fresh IDs numbered after the highest ID ever
// used. IDs appear only in queue.json, but burn agents and ledger summaries
// cite them, so regen must not renumber unchanged work.
//
// Output: script/typecheck-burndown/queue.json — deterministic (stable sorts,
// no timestamps) so re-runs diff cleanly. generatedFrom pins the git SHA.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, normalize, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..") // cmd/gizzi-code
const SRC = join(ROOT, "src")
const OUT_DIR = join(ROOT, "script", "typecheck-burndown")
const OUT_FILE = join(OUT_DIR, "queue.json")

// ── Exclusion rules ────────────────────────────────────────────────────────────

// (a) React Compiler build artifacts: DELETED with the §6.2 final stub-machinery
// PR (INK_APP_COMPILER_ARTIFACTS.md). All 360 artifacts are converted to ordinary
// TSX, so no fingerprint exclusion remains; the queue stat stays in the schema
// (pinned at 0) so queue.json and the guard test keep a stable shape.

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
// mappings (@allternit/*) never point at queue files.
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

export function isVendoredSubtree(rel) {
  for (const v of VENDORED_SUBTREES) if (rel.startsWith(v)) return true
  return false
}

// Returns { queue: [{path, loc}], excludedCompilerArtifacts, excludedVendored, totalNocheck }
// excludedCompilerArtifacts is pinned at 0: the artifact fingerprints and their
// exclusion were deleted with the §6.2 stub machinery (see header note above).
export function scanQueue() {
  const queue = []
  const excludedCompilerArtifacts = 0
  let excludedVendored = 0
  let totalNocheck = 0
  for (const abs of walk(SRC)) {
    const rel = normalize(relative(ROOT, abs)).replace(/\\/g, "/")
    const text = readFileSync(abs, "utf8")
    if (!text.startsWith(NOCHECK_HEADER)) continue
    totalNocheck++
    if (isVendoredSubtree(rel)) {
      excludedVendored++
      continue
    }
    queue.push({ path: rel, loc: countLines(abs) })
  }
  queue.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { queue, excludedCompilerArtifacts, excludedVendored, totalNocheck }
}

// ── Quarantine check (a): malformed grammar ────────────────────────────────────

// Keywords after which a regex literal or string may legally begin. Used for
// the regex-vs-division heuristic; deliberately conservative (a word like
// `from`/`as` is a common identifier, so it only counts for strings, below).
const LITERAL_KEYWORDS = new Set([
  "return", "typeof", "case", "in", "of", "do", "else", "void",
  "delete", "throw", "new", "yield", "await", "instanceof",
])
// TS contextual keywords that can precede a string literal (`x as 'a'`,
// `from 'mod'`, `T satisfies 'x'`) — apostrophe decision only, never regex.
const STRING_KEYWORDS = new Set([...LITERAL_KEYWORDS, "as", "from", "satisfies"])

// Words that may follow `export`/`import` in a real declaration. JSX text can
// contain the bare words "export"/"import" at brace depth > 0 (e.g. shell
// instructions rendered in a <Text>); those are not module keywords. A genuine
// `export`/`import` inside a block (the malformed-shim signature) is always
// followed by one of these or by `{` / `*` / `=`.
const DECL_CONTINUATION_WORDS = new Set([
  "default", "type", "interface", "class", "function", "const", "let", "var",
  "enum", "namespace", "abstract", "async", "declare", "as",
])

// From index `from`, skip whitespace and comments and report the next token:
// { kind: "word", word } or { kind: "punct", ch } or null at end of input.
function nextToken(text, from) {
  let i = from
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue }
    if (c === "/" && text[i + 1] === "/") { while (i < n && text[i] !== "\n") i++; continue }
    if (c === "/" && text[i + 1] === "*") { i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue }
    if (/[A-Za-z0-9_$]/.test(c)) {
      let w = ""
      while (i < n && /[A-Za-z0-9_$]/.test(text[i])) { w += text[i]; i++ }
      return { kind: "word", word: w }
    }
    return { kind: "punct", ch: c }
  }
  return null
}

// Structural grammar check, string/comment/regex/template-aware. Not a parser:
// it tokenizes enough of the language to pair (), {}, [] and to locate module
// keywords, which is exactly what the malformed TEMPORARY SHIM stubs violate
// (their unclosed function bodies leave `export` declarations at brace depth
// > 0, and their piled-up trailing closers pair to the wrong openers... or
// happen to pair cleanly, which is why the export-at-depth rule carries the
// detection). Returns null when the file passes, else a short reason.
export function malformedReason(text, isTsx = false) {
  let i = 0
  const n = text.length
  let prev = "" // last significant char in code mode
  let bangPostfix = false // last emitted "!" was postfix (non-null assertion)
  let word = "" // identifier chars since the last non-word token
  let lastWord = "" // previous completed identifier
  let wordStartPrev = "" // char preceding the current word (`.` access check)
  let pendingKw = null // completed export/import awaiting its next token
  let pendingBraceKind = null // "ns" | "declare" — next `{` is namespace/declare block
  const stack = [] // [{ch, interp, ns, line}] — interp marks a template `${` opener

  const canStartLiteral = () => {
    if (prev === "!") return !bangPostfix // `x! / y` divides, `! /re/` negates
    return prev === "" || prev === "`" || LITERAL_KEYWORDS.has(word) ||
      LITERAL_KEYWORDS.has(lastWord) || "(,=:[&|?{};+-*%^~<>\\".includes(prev)
  }
  const canStartString = () =>
    canStartLiteral() || STRING_KEYWORDS.has(word) || STRING_KEYWORDS.has(lastWord)

  while (i < n) {
    const c = text[i]
    // template-literal mode: only backtick, escape, and ${ matter
    if (stack.length && stack[stack.length - 1].ch === "T") {
      if (c === "\\") { i += 2; continue }
      if (c === "`") { stack.pop(); prev = "`"; word = ""; bangPostfix = false; i++; continue }
      if (c === "$" && text[i + 1] === "{") {
        stack.push({ ch: "{", interp: true })
        prev = "{"; word = ""
        i += 2; continue
      }
      i++; continue
    }
    // string mode
    if (stack.length && stack[stack.length - 1].ch === "S") {
      const q = stack[stack.length - 1].q
      if (c === "\\") { i += 2; continue }
      if (c === q) { stack.pop(); prev = q; word = ""; bangPostfix = false }
      i++; continue
    }
    // code mode
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      if (word) {
        if ((word === "export" || word === "import") && wordStartPrev !== ".") {
          const depth = stack.filter(e => e.ch === "{").length
          // At depth > 0 the export/import keyword check exists only to catch
          // declarations nested in unclosed shim bodies; JSX text may use the
          // bare words at any depth, so require a declaration continuation.
          let isDecl = true
          if (depth > 0) {
            const nx = nextToken(text, i)
            isDecl = nx !== null && (
              (nx.kind === "word" && DECL_CONTINUATION_WORDS.has(nx.word)) ||
              (nx.kind === "punct" && (nx.ch === "{" || nx.ch === "*" || nx.ch === "="))
            )
          }
          if (isDecl) pendingKw = { kw: word, depth }
        }
        if (word === "namespace") pendingBraceKind = "ns"
        else if ((word === "module" || word === "global") && lastWord === "declare") {
          pendingBraceKind = "declare"
        }
        lastWord = word
      }
      word = ""
      i++; continue
    }
    const c2 = text[i + 1]
    if (c === "/" && c2 === "/") { while (i < n && text[i] !== "\n") i++; continue }
    if (c === "/" && c2 === "*") { i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue }
    // regex literal: `/` where an expression can begin, excluding JSX closes
    // (`</tag`, `/>` in .tsx) and `</` which never starts a real regex
    const jsxClose = isTsx && (prev === ">" || prev === "}") && /[A-Za-z>]/.test(c2)
    if (c === "/" && !jsxClose && !(isTsx && c2 === ">") && prev !== "<" && canStartLiteral()) {
      i++
      let inClass = false
      while (i < n) {
        const rc = text[i]
        if (rc === "\\") { i += 2; continue }
        if (rc === "[") inClass = true
        else if (rc === "]") inClass = false
        else if (rc === "/" && !inClass) break
        else if (rc === "\n") break
        i++
      }
      i++ // closing / (or bail position)
      while (i < n && /[a-z]/i.test(text[i])) i++ // flags
      prev = "/"; word = ""
      continue
    }
    if (c === '"' || c === "`") {
      stack.push({ ch: c === "`" ? "T" : "S", q: c })
      i++; continue
    }
    if (c === "'") {
      // an apostrophe can only open a string where a literal may begin;
      // elsewhere it is JSX text or a possessive — a code char
      if (canStartString()) stack.push({ ch: "S", q: c })
      else { prev = c; word = "" }
      i++; continue
    }
    if (c === "{" || c === "(" || c === "[") {
      stack.push({ ch: c, ns: c === "{" ? pendingBraceKind : undefined, line: undefined })
      pendingBraceKind = null
      prev = c; word = ""
      i++; continue
    }
    if (c === "}" || c === ")" || c === "]") {
      const top = stack[stack.length - 1]
      if (!top || top.ch === "T" || top.ch === "S") return `stray closing "${c}"`
      const open = c === "}" ? "{" : c === ")" ? "(" : "["
      if (top.ch !== open) return `mismatched "${c}" closes "${top.ch}"`
      stack.pop()
      if (c === "}" && top.interp) { prev = "`"; word = ""; bangPostfix = false }
      else { prev = c; word = "" }
      i++; continue
    }
    if (c === "!") {
      bangPostfix = /[A-Za-z0-9_$)\]}]/.test(prev)
      prev = c; word = ""
      i++; continue
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      if (word === "") wordStartPrev = prev
      word += c
      bangPostfix = false
      if (word.length > 12) word = word.slice(-12)
    } else {
      if (word) {
        if ((word === "export" || word === "import") && wordStartPrev !== ".") {
          const depth = stack.filter(e => e.ch === "{").length
          // At depth > 0 the export/import keyword check exists only to catch
          // declarations nested in unclosed shim bodies; JSX text may use the
          // bare words at any depth, so require a declaration continuation.
          let isDecl = true
          if (depth > 0) {
            const nx = nextToken(text, i)
            isDecl = nx !== null && (
              (nx.kind === "word" && DECL_CONTINUATION_WORDS.has(nx.word)) ||
              (nx.kind === "punct" && (nx.ch === "{" || nx.ch === "*" || nx.ch === "="))
            )
          }
          if (isDecl) pendingKw = { kw: word, depth }
        }
        if (word === "namespace") pendingBraceKind = "ns"
        else if ((word === "module" || word === "global") && lastWord === "declare") {
          pendingBraceKind = "declare"
        }
        lastWord = word
        if (";=(,)&|!?".includes(c)) pendingBraceKind = null
      }
      word = ""
      bangPostfix = false
    }
    // export/import declarations are only legal at module top level; inside a
    // block (and outside namespace/declare blocks, which legitimately nest
    // them) some enclosing body was never closed — the malformed-shim signature
    if (pendingKw) {
      const keyOrMethod = c === ":" || c === "(" // `{ export: 1 }`, `{ export() {} }`
      const dynamic = pendingKw.kw === "import" && (c === "(" || c === "." || c2 === "(")
      const inNsBlock = stack.some(e => e.ch === "{" && e.ns)
      if (!keyOrMethod && !dynamic && pendingKw.depth > 0 && !inNsBlock) {
        return `${pendingKw.kw} declaration at brace depth ${pendingKw.depth}`
      }
      pendingKw = null
    }
    prev = c
    i++
  }
  if (stack.length) {
    const top = stack[stack.length - 1]
    if (top.ch === "T") return "unterminated template literal"
    if (top.ch === "S") return "unterminated string literal"
    return `unclosed "${top.ch}" at end of file`
  }
  return null
}

// ── Quarantine check (b): dead re-export shims ────────────────────────────────

// Relative specifiers that point at assets, not TS modules — unresolvable is
// expected for these, so they never quarantine.
const ASSET_SPEC_RE = /\.(css|scss|less|sass|svg|png|jpe?g|gif|webp|ico|wasm|txt|md|ya?ml|csv|sql|html?)$/i

const dirEntryCache = new Map()
function dirEntries(relDir) {
  if (!dirEntryCache.has(relDir)) {
    try {
      dirEntryCache.set(relDir, new Set(readdirSync(join(ROOT, relDir))))
    } catch {
      dirEntryCache.set(relDir, new Set())
    }
  }
  return dirEntryCache.get(relDir)
}

// Case-sensitive existence: on a case-insensitive FS (macOS), statSync happily
// confirms `Markdown.ts` when the disk says `markdown.ts` — the TS1261 trap.
function exactCaseExists(rel) {
  const parts = rel.split("/")
  return dirEntries(parts.slice(0, -1).join("/")).has(parts[parts.length - 1])
}

// Like resolveBase, but distinguishes "does not exist" from "exists with
// different casing". Returns { hit } | { caseMismatch: true } | {}.
function resolveBaseExact(base) {
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
  for (const i of INDEX_FILES) candidates.push(join(stem, i).replace(/\\/g, "/"))
  let caseMismatch = false
  for (const c of candidates) {
    if (!isFile(c)) continue
    if (!exactCaseExists(c)) { caseMismatch = true; continue }
    return { hit: c }
  }
  return caseMismatch ? { caseMismatch: true } : {}
}

// Resolve every relative import specifier of a queued file against the disk.
// Returns { unresolved: [spec...], caseMismatch: [spec...] } — both empty for
// healthy files. Alias/wildcard specs (`export * as ns from` is still a plain
// path; glob-like specs simply fail resolution and land in `unresolved`).
export function deadShimSpecs(rel, text) {
  const specs = new Set()
  for (const m of text.matchAll(STATIC_IMPORT_RE)) specs.add(m[1])
  for (const m of text.matchAll(DYNAMIC_IMPORT_RE)) specs.add(m[1])
  const unresolved = []
  const caseMismatch = []
  for (const spec of specs) {
    if (!spec.startsWith(".")) continue
    if (ASSET_SPEC_RE.test(spec)) continue
    const base = normalize(join(dirname(rel), spec)).replace(/\\/g, "/")
    const r = resolveBaseExact(base)
    if (r.caseMismatch) caseMismatch.push(spec)
    else if (!r.hit) unresolved.push(spec)
  }
  unresolved.sort()
  caseMismatch.sort()
  return { unresolved, caseMismatch }
}

// ── Quarantine check (c): symlink alias pairs ──────────────────────────────────

// Groups queued paths by realpath. Returns { canonical: [paths kept in the
// queue], aliases: [{path, aliasOf}] } — one physical file burns once, so a
// symlink that resolves to another queued file is quarantined as an alias of
// the canonical path (a path that is its own realpath wins; tie-break lexical).
function splitAliases(queueFiles) {
  const byReal = new Map()
  for (const f of queueFiles) {
    const rp = realpathSync(join(ROOT, f.path))
    if (!byReal.has(rp)) byReal.set(rp, [])
    byReal.get(rp).push(f.path)
  }
  const aliases = []
  const canonical = []
  for (const paths of byReal.values()) {
    paths.sort()
    if (paths.length === 1) {
      canonical.push(paths[0])
      continue
    }
    const self = paths.filter(p => realpathSync(join(ROOT, p)) === join(ROOT, p))
    const keep = self.length > 0 ? self.sort()[0] : paths[0]
    canonical.push(keep)
    for (const p of paths) {
      if (p !== keep) aliases.push({ path: p, aliasOf: keep })
    }
  }
  return { canonical: canonical.sort(), aliases }
}

// Runs the full quarantine pipeline over the live scan. Shared by buildQueue
// and the guard test: { kept: [{path, loc}], quarantined: [entry...] }.
export function scanQuarantined() {
  const { queue } = scanQueue()
  const { canonical, aliases } = splitAliases(queue)
  const quarantined = []
  for (const a of aliases) {
    quarantined.push({ path: a.path, reason: "alias", aliasOf: a.aliasOf })
  }
  const kept = []
  for (const rel of canonical) {
    const f = queue.find(q => q.path === rel)
    const text = readFileSync(join(ROOT, rel), "utf8")
    const malformed = malformedReason(text, rel.endsWith(".tsx"))
    if (malformed) {
      quarantined.push({ path: rel, reason: "suspect-malformed", detail: malformed })
      continue
    }
    const dead = deadShimSpecs(rel, text)
    if (dead.unresolved.length > 0 || dead.caseMismatch.length > 0) {
      const parts = []
      if (dead.unresolved.length > 0) parts.push(`unresolved: ${dead.unresolved.join(", ")}`)
      if (dead.caseMismatch.length > 0) parts.push(`case-mismatch: ${dead.caseMismatch.join(", ")}`)
      quarantined.push({ path: rel, reason: "suspect-dead-shim", detail: parts.join("; ") })
      continue
    }
    kept.push(f)
  }
  kept.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  quarantined.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { kept, quarantined }
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

// Loads the committed queue.json (if any) so batch history (DONE state, burned
// counts, escalations, notes) survives regeneration. Batches whose entire file
// list moved to quarantine retire to a zero-file record instead of vanishing.
function loadPreviousBatches() {
  try {
    const prev = JSON.parse(readFileSync(OUT_FILE, "utf8"))
    return Array.isArray(prev.batches) ? prev.batches : []
  } catch {
    return []
  }
}

export function buildQueue() {
  const { queue, excludedCompilerArtifacts, excludedVendored, totalNocheck } = scanQueue()
  const { kept, quarantined } = scanQuarantined()

  const edges = buildGraph(kept)
  const sizes = closureSizes(kept, edges)
  const twinOf = findTwins(kept)
  const byPath = new Map(kept.map(f => [f.path, f]))

  // Group into twin units so pairs stay adjacent (runtime before ink-app).
  const units = []
  const claimed = new Set()
  for (const f of kept) {
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

  // Record twin pairs per batch (runtime path -> ink-app path), batch order.
  for (const batch of batches) {
    const inBatch = new Set(batch.files)
    for (const [rt, ink] of twinOf) {
      if (inBatch.has(rt) && inBatch.has(ink)) {
        batch.twins.push({ runtime: rt, inkApp: ink })
      }
    }
  }

  // Retire historical batches, carrying their record over so burn history
  // survives regeneration. Already-retired records (files: []) carry forward
  // verbatim so re-runs are idempotent. A batch with history retires when no
  // file in it is still live in the queue (burned headers, quarantine, and
  // out-of-band deletions all count), and a DONE batch retires regardless —
  // any live remainder is repacked below, and dropping its record would lose
  // the burnedFiles count the burn-accounting identity is derived from.
  const keptPaths = new Set(kept.map(f => f.path))
  const previous = loadPreviousBatches()
  const retired = []
  for (const old of previous) {
    const hasHistory = old.state !== "NEW" || old.escalated || old.note !== undefined
    if (!hasHistory) continue
    if (old.files.length === 0) {
      retired.push({ ...old })
      continue
    }
    if (old.state === "DONE" || old.files.every(f => !keptPaths.has(f))) {
      retired.push({
        id: old.id,
        files: [],
        loc: 0,
        twins: [],
        state: old.state,
        burnedFiles: old.burnedFiles,
        burnedLoc: old.burnedLoc,
        escalated: old.escalated,
        note: old.note,
      })
    }
  }
  retired.sort((a, b) => (a.id < b.id ? -1 : 1))
  const usedIds = new Set(retired.map(b => b.id))

  // Stable batch IDs: reuse the previous queue's ID when a repacked batch has
  // the identical sorted file list (first previous batch with that key wins,
  // by ascending id); fresh batches continue numbering after the highest id
  // ever used, skipping ids held by retired records.
  const prevIdByKey = new Map()
  let maxIdNum = 0
  for (const old of previous) {
    const m = /^b(\d+)$/.exec(old.id ?? "")
    if (m) maxIdNum = Math.max(maxIdNum, parseInt(m[1], 10))
    if (old.files.length === 0) continue
    const key = [...old.files].sort().join("\n")
    if (!prevIdByKey.has(key)) prevIdByKey.set(key, old.id)
  }
  let nextIdNum = maxIdNum + 1
  for (const batch of batches) {
    const key = [...batch.files].sort().join("\n")
    const reuse = prevIdByKey.get(key)
    let id = reuse && !usedIds.has(reuse) ? reuse : null
    if (id === null) {
      do {
        id = `b${String(nextIdNum++).padStart(4, "0")}`
      } while (usedIds.has(id))
    }
    batch.id = id
    usedIds.add(id)
  }

  // Zero-importer files (informational only — many are entrypoints): counted
  // over the packed queue via the intra-queue dependency graph.
  const importedBy = new Set()
  for (const deps of edges.values()) {
    for (const d of deps) importedBy.add(d)
  }
  const zeroImporter = kept.filter(f => !importedBy.has(f.path)).length

  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim()
  const totalQueueLoc = kept.reduce((n, f) => n + f.loc, 0)
  const byReason = {}
  for (const q of quarantined) byReason[q.reason] = (byReason[q.reason] ?? 0) + 1
  // Burn-accounting baseline: the handwritten population the queue accounts
  // for. live nocheck files + recorded burns must always equal this number —
  // a header removed without recording its burn breaks the identity.
  const totalBurned = retired.reduce(
    (n, b) => n + (typeof b.burnedFiles === "number" ? b.burnedFiles : 0),
    0,
  )
  return {
    version: 1,
    generatedFrom: sha,
    batchCount: retired.length + batches.length,
    stats: {
      totalNocheck: totalNocheck,
      excludedCompilerArtifacts: excludedCompilerArtifacts,
      excludedVendored: excludedVendored,
      totalQueueFiles: kept.length,
      totalQueueLoc: totalQueueLoc,
      quarantined: quarantined.length,
      quarantinedByReason: byReason,
      zeroImporter: zeroImporter,
      totalAccounted: kept.length + quarantined.length + totalBurned,
    },
    batches: [...retired, ...batches],
    quarantined,
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const result = buildQueue()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + "\n")
  const active = result.batches.filter(b => b.files.length > 0)
  const locs = active.map(b => b.loc)
  const min = Math.min(...locs)
  const max = Math.max(...locs)
  console.log(
    `queue.json: ${result.stats.totalQueueFiles} files, ${result.stats.totalQueueLoc} LOC, ` +
      `${result.batchCount} batches (loc min ${min} / max ${max})`,
  )
  console.log(
    `quarantined: ${result.stats.quarantined} ` +
      `(${Object.entries(result.stats.quarantinedByReason).map(([k, v]) => `${k} ${v}`).join(", ")}), ` +
      `zero-importer ${result.stats.zeroImporter}`,
  )
  console.log(
    `excluded: ${result.stats.excludedCompilerArtifacts} compiler artifacts, ` +
      `${result.stats.excludedVendored} vendored ink/vim (of ${result.stats.totalNocheck} nocheck files)`,
  )
}
