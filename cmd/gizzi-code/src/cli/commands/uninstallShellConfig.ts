/**
 * Marker-disciplined edits of user shell config files (.bashrc, .zshrc,
 * config.fish, and — should a Windows installer ever write one —
 * PowerShell $PROFILE).
 *
 * Contract:
 * - The installer may only add lines between `# gizzi-code begin` and
 *   `# gizzi-code end` marker comments.
 * - The uninstaller removes ONLY that marked block. If the markers are
 *   absent (or the begin marker has no matching end marker), the file is
 *   left byte-for-byte untouched and the caller warns instead of
 *   rewriting blindly — an rc file with other user content must never be
 *   reconstructed from a lossy line filter.
 *
 * Legacy installs wrote a bare `# gizzi-code` comment line immediately
 * above the PATH line with no end marker. Those two lines are still
 * removed as a pair; anything else is left alone.
 */

export const SHELL_BLOCK_BEGIN = "# gizzi-code begin"
export const SHELL_BLOCK_END = "# gizzi-code end"

const LEGACY_COMMENT = /^\s*#\s*gizzi(-code)?\s*$/
const GIZZI_PATH_LINE = /^\s*(export\s+PATH=.*\.gizzi\/bin|fish_add_path\s+.*\.gizzi)/

export type ShellConfigCleanResult =
  | { status: "cleaned"; removedLines: number }
  | { status: "unbalanced-begin" }
  | { status: "no-markers"; gizziReferences: boolean }

export type ShellConfigCleanOutcome = {
  /** New file content, or null when the file must be left untouched. */
  output: string | null
  result: ShellConfigCleanResult
}

export function cleanShellConfigContent(content: string): ShellConfigCleanOutcome {
  const hadTrailingNewline = content.endsWith("\n")
  const lines = content.split("\n")
  // split("\n") on trailing-newline content yields a final "" element;
  // keep it out of the logical line list and re-append on write.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  let removed = 0

  // Remove every begin..end marked block. An unbalanced begin marker
  // aborts: truncating at an unknown point could destroy user content.
  for (;;) {
    const beginIdx = lines.findIndex(line => line.trim() === SHELL_BLOCK_BEGIN)
    if (beginIdx === -1) break
    const endIdx = lines.findIndex(
      (line, idx) => idx > beginIdx && line.trim() === SHELL_BLOCK_END,
    )
    if (endIdx === -1) {
      return { output: null, result: { status: "unbalanced-begin" } }
    }
    lines.splice(beginIdx, endIdx - beginIdx + 1)
    collapseDoubledBlankAt(lines, beginIdx)
    removed += endIdx - beginIdx + 1
  }

  // Legacy format: bare "# gizzi-code" comment directly above the PATH line.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!LEGACY_COMMENT.test(lines[i])) continue
    let end = i
    if (i + 1 < lines.length && GIZZI_PATH_LINE.test(lines[i + 1])) {
      end = i + 1
    }
    lines.splice(i, end - i + 1)
    collapseDoubledBlankAt(lines, i)
    removed += end - i + 1
  }

  if (removed > 0) {
    return { output: finish(lines, hadTrailingNewline), result: { status: "cleaned", removedLines: removed } }
  }

  const gizziReferences = lines.some(line => line.includes(".gizzi"))
  return { output: null, result: { status: "no-markers", gizziReferences } }
}

/** Collapse a blank line left directly above another blank line by a removal. */
function collapseDoubledBlankAt(lines: string[], idx: number) {
  while (idx > 0 && lines[idx - 1] === "" && lines[idx] === "") {
    lines.splice(idx, 1)
  }
}

function finish(lines: string[], hadTrailingNewline: boolean): string {
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop()
  }
  return lines.join("\n") + (hadTrailingNewline || lines.length > 0 ? "\n" : "")
}

/**
 * PowerShell $PROFILE discipline: no gizzi installer currently writes to
 * $PROFILE (install.ps1 edits the User PATH environment variable, not the
 * profile). If a profile is ever edited, it MUST use these markers and
 * uninstall MUST go through removeMarkedBlock — never a line rewrite.
 */
export const POWERSHELL_BLOCK_BEGIN = "# gizzi-code begin"
export const POWERSHELL_BLOCK_END = "# gizzi-code end"

export function removeMarkedBlock(content: string, begin: string, end: string): ShellConfigCleanOutcome {
  const lines = content.split("\n")
  const beginIdx = lines.findIndex(line => line.trim() === begin)
  if (beginIdx === -1) {
    return { output: null, result: { status: "no-markers", gizziReferences: content.includes("gizzi") } }
  }
  const endIdx = lines.findIndex((line, idx) => idx > beginIdx && line.trim() === end)
  if (endIdx === -1) {
    return { output: null, result: { status: "unbalanced-begin" } }
  }
  lines.splice(beginIdx, endIdx - beginIdx + 1)
  return { output: lines.join("\n"), result: { status: "cleaned", removedLines: endIdx - beginIdx + 1 } }
}
