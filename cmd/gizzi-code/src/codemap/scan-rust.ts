/**
 * Best-effort Rust cross-crate edge extraction via regex — no Rust parser
 * is installed anywhere in this monorepo (only `tree-sitter-bash`), and
 * adding one is a real new-dependency decision out of scope here. This is
 * honestly a textual heuristic, not AST-verified: every edge it produces is
 * tagged `confidence: "textual"`, never `"verified"`.
 *
 * Only cross-crate references are useful as inter-module edges: `use
 * crate::...`/`use super::...`/bare `mod foo;` all refer to the *same*
 * crate (self-edges, dropped during roll-up in edges.ts). The interesting
 * signal is `use <other_crate_name>::...`, where `other_crate_name` matches
 * another workspace member's Cargo.toml `[package] name` (Rust normalizes
 * hyphens to underscores in `use` paths — `internalCrates` keys are
 * pre-normalized the same way, see discover.ts's buildCrateNameMap).
 */
import path from "path"
import { Filesystem } from "@/shared/util/filesystem"
import type { FileEdge } from "./types"

const RUST_KEYWORDS_NOT_CRATES = new Set(["crate", "super", "self", "std", "core", "alloc"])

// Fresh RegExp per file (ported from the dead repo-map.ts's technique) to
// avoid a stateful-`lastIndex` bug from reusing one `g`-flagged regex object
// across files in a loop.
const USE_PATTERN_SOURCE = /^\s*(?:pub\s+)?use\s+(?:::)?([a-zA-Z_][\w]*)::/gm

export async function scanRustFile(root: string, relFile: string, internalCrates: Map<string, string>): Promise<FileEdge[]> {
  const abs = path.join(root, relFile)
  const size = await Filesystem.size(abs)
  if (size > 500_000) return []

  let content: string
  try {
    content = await Filesystem.readText(abs)
  } catch {
    return []
  }

  const edges: FileEdge[] = []
  const regex = new RegExp(USE_PATTERN_SOURCE.source, USE_PATTERN_SOURCE.flags)
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const crateName = match[1]!
    if (RUST_KEYWORDS_NOT_CRATES.has(crateName)) continue
    const targetPath = internalCrates.get(crateName)
    if (!targetPath) continue // external crate or unresolvable — no fabricated edge

    const line = content.slice(0, match.index).split("\n").length
    edges.push({
      fromFile: relFile,
      toFile: targetPath, // a module path, not a specific file — roll-up in edges.ts matches this directly
      type: "imports",
      evidence: { file: relFile, line, symbol: `use ${crateName}::…`, confidence: "textual" },
    })
  }
  return edges
}
