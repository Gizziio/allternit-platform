import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { join } from 'path'
import { getGizziConfigHomeDir } from './envUtils.js'

// Read-only legacy home used only as a migration/fallback source from Claude
// Code. Kept local (instead of importing a settings module) so this file
// stays a leaf: importable from tests without dragging the ink-app graph.
const getLegacyClaudeHomeDir = memoize(
  (): string =>
    (process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')).normalize(
      'NFC',
    ),
  () => process.env.CLAUDE_CONFIG_DIR,
)

/**
 * User-scope markdown dirs (commands/skills/agents/...), gizzi-first.
 *
 * `~/.gizzi/<subdir>` is canonical; `~/.claude/<subdir>` loads as a read-only
 * legacy fallback. Both are returned (gizzi first) rather than one
 * suppressing the other — same merge-both precedent as
 * getProjectDirsUpToHome for project scope and the plugins directory
 * pattern, because these are directories of independently-named items, not
 * singleton files (settings.json uses gizzi-wins file resolution instead).
 */
export const getUserMarkdownDirs = memoize(
  (subdir: string): string[] => {
    const gizziHome = getGizziConfigHomeDir()
    const legacyHome = getLegacyClaudeHomeDir()
    const dirs = [join(gizziHome, subdir)]
    if (legacyHome !== gizziHome) {
      dirs.push(join(legacyHome, subdir))
    }
    return dirs
  },
  (subdir: string) =>
    `${subdir}:${process.env.GIZZI_CONFIG_DIR}:${process.env.CLAUDE_CONFIG_DIR}`,
)
