// @ts-nocheck
import { randomBytes } from 'crypto'
import memoize from 'lodash-es/memoize.js'
import { tmpdir } from 'os'
import { join, sep } from 'path'
import { getOriginalCwd, getSessionId } from '../../bootstrap/state.js'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { getFsImplementation } from '../fsOperations.js'
import { sanitizePath } from '../path.js'
import { getPlatform } from '../platform.js'

declare const MACRO: { VERSION: string }

/**
 * Checks if the scratchpad directory feature is enabled.
 * The scratchpad is a per-session directory for Claude to write temporary files.
 * Controlled by the tengu_scratch Statsig gate.
 */
export function isScratchpadEnabled(): boolean {
  return checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_scratch')
}

/**
 * Returns the user-specific Claude temp directory name.
 * On Unix: 'claude-{uid}' to prevent multi-user permission conflicts
 * On Windows: 'claude' (tmpdir() is already per-user)
 */
export function getClaudeTempDirName(): string {
  if (getPlatform() === 'windows') {
    return 'claude'
  }
  // Use UID to create per-user directories, preventing permission conflicts
  // when multiple users share the same /tmp directory
  const uid = process.getuid?.() ?? 0
  return `claude-${uid}`
}

/**
 * Returns the Claude temp directory path with symlinks resolved.
 * Uses TMPDIR env var if set, otherwise:
 * - On Unix: /tmp/claude-{uid}/ (resolved to /private/tmp/claude-{uid}/ on macOS)
 * - On Windows: {tmpdir}/claude/ (e.g., C:\Users\{user}\AppData\Local\Temp\claude\)
 * This is a per-user temporary directory used by gizzi-code for all temp files.
 *
 * NOTE: We resolve symlinks to ensure this path matches the resolved paths used
 * in permission checks. On macOS, /tmp is a symlink to /private/tmp, so without
 * resolution, paths like /tmp/claude-{uid}/... wouldn't match /private/tmp/claude-{uid}/...
 */
// Memoized: called per-tool from permission checks (yoloClassifier, sandbox-adapter)
// and per-turn from BashTool prompt. Inputs (GIZZI_CODE_TMPDIR env + platform) are
// fixed at startup, and the realpath of the system tmp dir does not change mid-session.
export const getClaudeTempDir = memoize(function getClaudeTempDir(): string {
  const baseTmpDir =
    process.env.GIZZI_CODE_TMPDIR ||
    (getPlatform() === 'windows' ? tmpdir() : '/tmp')

  // Resolve symlinks in the base temp directory (e.g., /tmp -> /private/tmp on macOS)
  // This ensures the path matches resolved paths in permission checks
  const fs = getFsImplementation()
  let resolvedBaseTmpDir = baseTmpDir
  try {
    resolvedBaseTmpDir = fs.realpathSync(baseTmpDir)
  } catch {
    // If resolution fails, use the original path
  }

  return join(resolvedBaseTmpDir, getClaudeTempDirName()) + sep
})

/**
 * Root for bundled-skill file extraction (see bundledSkills.ts).
 *
 * SECURITY: The per-process random nonce is the load-bearing defense here.
 * Every other path component (uid, VERSION, skill name, file keys) is public
 * knowledge, so without it a local attacker can pre-create the tree on a
 * shared /tmp — sticky bit prevents deletion, not creation — and either
 * symlink an intermediate directory (O_NOFOLLOW only checks the final
 * component) or own a parent dir and swap file contents post-write for prompt
 * injection via the read allowlist. diskOutput.ts gets the same property from
 * the session-ID UUID in its path.
 *
 * Memoized so the extraction writes and the permission check agree on the
 * path for the life of the process. Version-scoped so stale extractions from
 * other binaries don't fall under the allowlist.
 */
export const getBundledSkillsRoot = memoize(
  function getBundledSkillsRoot(): string {
    const nonce = randomBytes(16).toString('hex')
    return join(getClaudeTempDir(), 'bundled-skills', MACRO.VERSION, nonce)
  },
)

/**
 * Returns the project temp directory path with trailing separator.
 * Path format: /tmp/claude-{uid}/{sanitized-cwd}/
 */
export function getProjectTempDir(): string {
  return join(getClaudeTempDir(), sanitizePath(getOriginalCwd())) + sep
}

/**
 * Returns the scratchpad directory path for the current session.
 * Path format: /tmp/claude-{uid}/{sanitized-cwd}/{sessionId}/scratchpad/
 */
export function getScratchpadDir(): string {
  return join(getProjectTempDir(), getSessionId(), 'scratchpad')
}

/**
 * Ensures the scratchpad directory exists for the current session.
 * Creates the directory with secure permissions (0o700) if it doesn't exist.
 * Returns the path to the scratchpad directory.
 * @throws If scratchpad feature is not enabled
 */
export async function ensureScratchpadDir(): Promise<string> {
  if (!isScratchpadEnabled()) {
    throw new Error('Scratchpad directory feature is not enabled')
  }

  const fs = getFsImplementation()
  const scratchpadDir = getScratchpadDir()

  // Create directory recursively with secure permissions (owner-only access)
  // FsOperations.mkdir handles recursive: true internally and is a no-op if dir exists
  await fs.mkdir(scratchpadDir, { mode: 0o700 })

  return scratchpadDir
}
