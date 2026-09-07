#!/usr/bin/env bun
/**
 * One-shot codemod: purge CLAUDE_* env/config identifiers to GIZZI_*.
 *
 * Policy (2026-09-04 purge, owner directive): hard rename, zero legacy
 * fallback. Every renamed token becomes GIZZI_<rest> 1:1. Tokens under the
 * CLAUDE_AI_/CLAUDEAI_ families are OAuth/claude.ai URL constants
 * (functional floor — see docs/anthropic-allowlist.md) and are NOT touched.
 *
 * Usage: bun script/purge-claude-naming.ts [--apply]
 * Without --apply: dry run, prints report only.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { join, relative } from "path"

const ROOT = join(import.meta.dir, "..")
const SCOPES = ["src", "test", "script", "packages"]
const EXTENSIONS = new Set([".ts", ".tsx"])
const APPLY = process.argv.includes("--apply")

// Functional floor: claude.ai OAuth/URL constant families — never rename.
const KEEP_PREFIXES = ["CLAUDE_AI_", "CLAUDEAI_"]
// Functional floor: exact tokens that locate the legacy ~/.claude home for
// read-only migration (floor item: plugin-state legacy fallback). Renaming
// would break the migration path itself.
const KEEP_TOKENS = new Set(["CLAUDE_CONFIG_DIR"])
// Whole-token renames applied AFTER the main token pass — these are tokens
// the main pass can't capture because a prefix (ANT_, AGENT_SDK_) blocks its
// lookbehind. KIND "exact" renames need identifier boundaries; "prefix"
// renames replace every occurrence regardless of what follows.
const PLAIN_RENAMES: Array<[string, string, "exact" | "prefix"]> = [
  // AN_ = Anthropic-internal metrics override; give it a clean gizzi name.
  ["ANT_CLAUDE_CODE_METRICS_ENDPOINT", "GIZZI_METRICS_ENDPOINT", "exact"],
  // Internal system-prompt constant identifier (value is already Gizzi-branded).
  ["AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX", "AGENT_SDK_GIZZI_PRESET_PREFIX", "exact"],
  // Per-model Vertex region config vars (prefix-matched in registries).
  ["VERTEX_REGION_CLAUDE_", "VERTEX_REGION_GIZZI_", "prefix"],
  // Settings-schema keys for the security permission patterns. Values like
  // '/.claude/**' are legacy-dir paths (functional floor) and stay.
  ["GLOBAL_CLAUDE_FOLDER_PERMISSION_PATTERN", "GLOBAL_GIZZI_FOLDER_PERMISSION_PATTERN", "exact"],
  ["CLAUDE_FOLDER_PERMISSION_PATTERN", "GIZZI_FOLDER_PERMISSION_PATTERN", "exact"],
  // Env vars naming the memory-file convention; also unifies the stray
  // GIZZI_CODE_ prefix in the ink-app tree down to GIZZI_.
  ["GIZZI_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD", "GIZZI_ADDITIONAL_DIRECTORIES_GIZZI_MD", "exact"],
  ["GIZZI_ADDITIONAL_DIRECTORIES_CLAUDE_MD", "GIZZI_ADDITIONAL_DIRECTORIES_GIZZI_MD", "exact"],
]

const SKIP_FILES = new Set([
  // Filter handled manually: legacy case labels removed rather than renamed
  // (renaming would duplicate the existing GIZZI_ cases).
  "src/runtime/drivers/local-cli-driver.ts",
  // Hub already rewritten by hand.
  "src/shared/utils/gizziEnv.ts",
  // This script documents the tokens it renames; leave it intact.
  "script/purge-claude-naming.ts",
])

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === "vendored") continue
      yield* walk(full)
    } else {
      const dot = entry.lastIndexOf(".")
      if (dot >= 0 && EXTENSIONS.has(entry.slice(dot))) yield full
    }
  }
}

// Uppercase token starting CLAUDE_ (not preceded by an identifier char), or
// the bare CLAUDECODE marker / CLAUDECODE_ prefix.
const TOKEN_RE = /(?<![A-Z0-9_])(CLAUDE_[A-Z0-9_]+|CLAUDECODE_?[A-Z0-9_]*)/g

function kept(token: string): boolean {
  if (KEEP_TOKENS.has(token)) return true
  return KEEP_PREFIXES.some(p => token.startsWith(p))
}

function replacement(token: string): string {
  if (token.startsWith("CLAUDECODE")) {
    return "GIZZI_CODE" + token.slice("CLAUDECODE".length)
  }
  return "GIZZI_" + token.slice("CLAUDE_".length)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const tokenCounts = new Map<string, number>()
const collisions: string[] = []
const touched: string[] = []
let filesScanned = 0
let filesChanged = 0

for (const scope of SCOPES) {
  const scopeDir = join(ROOT, scope)
  let entries: Generator<string>
  try {
    statSync(scopeDir)
    entries = walk(scopeDir)
  } catch {
    continue
  }
  for (const file of entries) {
    filesScanned++
    const rel = relative(ROOT, file)
    if (SKIP_FILES.has(rel)) continue
    const before = readFileSync(file, "utf8")
    if (!before.includes("CLAUDE")) continue
    // Collision check: tokens that already exist as GIZZI_ in this file.
    const existing = new Set<string>()
    for (const m of before.matchAll(/(?<![A-Z0-9_])GIZZI_[A-Z0-9_]+/g)) {
      existing.add(m[0])
    }
    const localCollisions = new Set<string>()
    const after = before.replace(TOKEN_RE, (whole, token: string) => {
      if (kept(token)) return whole
      const rep = replacement(token)
      if (existing.has(rep) && rep !== whole) localCollisions.add(`${token} -> ${rep}`)
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
      return rep
    }).replace(
      // Prefix renames: every occurrence regardless of following chars.
      new RegExp(PLAIN_RENAMES.filter(([, , k]) => k === "prefix").map(([from]) => escapeRe(from)).join("|"), "g"),
      whole => {
        const hit = PLAIN_RENAMES.find(([from, , k]) => k === "prefix" && whole.startsWith(from))
        if (!hit) return whole
        tokenCounts.set(hit[0], (tokenCounts.get(hit[0]) ?? 0) + 1)
        return hit[1] + whole.slice(hit[0].length)
      },
    ).replace(
      // Exact whole-token renames the main pass cannot capture (prefix-blocked).
      new RegExp(
        `(?<![A-Z0-9_])(${PLAIN_RENAMES.filter(([, , k]) => k === "exact").map(([from]) => escapeRe(from)).join("|")})(?![A-Z0-9_])`,
        "g",
      ),
      whole => {
        const hit = PLAIN_RENAMES.find(([from, , k]) => k === "exact" && whole.includes(from))
        if (!hit) return whole
        tokenCounts.set(hit[0], (tokenCounts.get(hit[0]) ?? 0) + 1)
        return hit[1]
      },
    )
    if (localCollisions.size) {
      collisions.push(`${rel}: ${[...localCollisions].join(", ")}`)
    }
    if (after !== before) {
      filesChanged++
      touched.push(rel)
      if (APPLY) writeFileSync(file, after)
    }
  }
}

const sorted = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1])
console.log(`${APPLY ? "APPLIED" : "DRY RUN"}: scanned ${filesScanned} files, changed ${filesChanged}`)
console.log(`distinct tokens renamed: ${sorted.length}`)
console.log("top tokens:", sorted.slice(0, 15).map(([t, c]) => `${t}(${c})`).join(" "))
if (sorted.length > 15) console.log(`... and ${sorted.length - 15} more (full list in report)`)
if (collisions.length) {
  console.log(`\nCOLLISIONS (${collisions.length} files) — manual review required:`)
  for (const c of collisions) console.log("  " + c)
}
writeFileSync(
  join(ROOT, "purge-claude-naming-report.json"),
  JSON.stringify({ apply: APPLY, filesScanned, filesChanged, tokenCounts: Object.fromEntries(sorted), collisions, touched }, null, 2),
)
console.log("\nreport: purge-claude-naming-report.json")
