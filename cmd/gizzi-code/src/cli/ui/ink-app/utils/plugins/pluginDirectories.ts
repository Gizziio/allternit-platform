// @ts-nocheck
/**
 * Centralized plugin directory configuration.
 *
 * This module provides the single source of truth for the plugins directory path.
 * It supports switching between 'plugins' and 'cowork_plugins' directories via:
 * - CLI flag: --cowork
 * - Environment variable: CLAUDE_CODE_USE_COWORK_PLUGINS
 *
 * The base directory can be overridden via CLAUDE_CODE_PLUGIN_CACHE_DIR.
 *
 * Canonical location is ~/.gizzi/plugins (gizzi-owned). The upstream-inherited
 * ~/.claude/plugins location is kept as a READ-ONLY legacy fallback: state
 * files (known_marketplaces.json, installed_plugins*.json) are read from
 * legacy when the canonical copy is absent, and `gizzi plugin migrate`
 * copies legacy content into the canonical location.
 */

import { existsSync, mkdirSync } from 'fs'
import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { delimiter, dirname, join } from 'path'
import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { getUseCoworkPlugins } from '../../bootstrap/state.js'
import { logForDebugging } from '../debug.js'
import { getClaudeConfigHomeDir, isEnvTruthy } from '../envUtils.js'
import { errorMessage, isFsInaccessible } from '../errors.js'
import { formatFileSize } from '../format.js'
import { expandTilde } from '../permissions/expandTilde.js'

const PLUGINS_DIR = 'plugins'
const COWORK_PLUGINS_DIR = 'cowork_plugins'

/**
 * Gizzi-owned config home. Plugin state lives under here so the CLI no
 * longer writes into the upstream ~/.claude directory. Override with
 * GIZZI_CONFIG_DIR (tests use this; memoized like getClaudeConfigHomeDir).
 */
export const getGizziConfigHomeDir = memoize(
  (): string => {
    return (process.env.GIZZI_CONFIG_DIR ?? join(homedir(), '.gizzi')).normalize(
      'NFC',
    )
  },
  () => process.env.GIZZI_CONFIG_DIR,
)

/**
 * Get the plugins directory name based on current mode.
 * Uses session state (from --cowork flag) or env var.
 *
 * Priority:
 * 1. Session state (set by CLI flag --cowork)
 * 2. Environment variable CLAUDE_CODE_USE_COWORK_PLUGINS
 * 3. Default: 'plugins'
 */
function getPluginsDirectoryName(): string {
  // Session state takes precedence (set by CLI flag)
  if (getUseCoworkPlugins()) {
    return COWORK_PLUGINS_DIR
  }
  // Fall back to env var
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_COWORK_PLUGINS)) {
    return COWORK_PLUGINS_DIR
  }
  return PLUGINS_DIR
}

/**
 * Get the full path to the canonical plugins directory.
 *
 * Priority:
 * 1. CLAUDE_CODE_PLUGIN_CACHE_DIR env var (explicit override)
 * 2. Default: ~/.gizzi/plugins or ~/.gizzi/cowork_plugins
 */
export function getPluginsDirectory(): string {
  // expandTilde: when CLAUDE_CODE_PLUGIN_CACHE_DIR is set via settings.json
  // `env` (not shell), ~ is not expanded by the shell. Without this, a value
  // like "~/.gizzi/plugins" becomes a literal `~` directory created in the
  // cwd of every project (gh-30794 / CC-212).
  const envOverride = process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
  if (envOverride) {
    return expandTilde(envOverride)
  }
  return join(getGizziConfigHomeDir(), getPluginsDirectoryName())
}

/**
 * The upstream-inherited plugins directory (~/.claude/plugins). Treated as
 * READ-ONLY: existing installs keep working via fallback reads, but nothing
 * new is written here.
 */
export function getLegacyPluginsDirectory(): string {
  return join(getClaudeConfigHomeDir(), getPluginsDirectoryName())
}

let legacyDeprecationWarned = false

/**
 * One-time-per-process deprecation notice for the legacy plugins dir.
 * Called whenever a fallback read actually uses ~/.claude/plugins.
 */
export function warnLegacyPluginsDirOnce(reason: string): void {
  if (legacyDeprecationWarned) return
  legacyDeprecationWarned = true
  logForDebugging(
    `DEPRECATED: plugin state found in ${getLegacyPluginsDirectory()} — ` +
      `${reason} Run \`gizzi plugin migrate\` to copy it to ` +
      `${getPluginsDirectory()}. The legacy directory is read-only and will ` +
      'stop being read in a future release.',
    { level: 'warn' },
  )
}

/**
 * Resolve a state file inside the plugins directory, preferring the
 * canonical location and falling back to the legacy one. Used for READS
 * only — writes always go through getPluginsDirectory().
 *
 * @param filename - File name relative to the plugins dir
 * @returns Absolute path to the file that should be read
 */
export function resolvePluginsStateFile(filename: string): string {
  const canonical = join(getPluginsDirectory(), filename)
  if (existsSync(canonical)) return canonical
  const legacy = join(getLegacyPluginsDirectory(), filename)
  if (existsSync(legacy)) {
    warnLegacyPluginsDirOnce(`reading ${filename} from the legacy location.`)
    return legacy
  }
  // Neither exists — return canonical so writes/creates land there.
  return canonical
}

export type PluginDirsState = {
  canonicalDir: string
  legacyDir: string
  canonicalExists: boolean
  legacyExists: boolean
  /** Legacy dir holds any plugin state (files or dirs we care about). */
  legacyHasState: boolean
  /** Canonical dir already holds state (i.e. migration has run/partial). */
  canonicalHasState: boolean
}

const PLUGIN_STATE_ENTRIES = [
  'known_marketplaces.json',
  'installed_plugins.json',
  'installed_plugins_v2.json',
  'marketplaces',
  'cache',
  'data',
]

function dirHasAnyState(dir: string): boolean {
  return PLUGIN_STATE_ENTRIES.some(entry => existsSync(join(dir, entry)))
}

/**
 * Snapshot of canonical vs legacy plugin directory state, used by
 * `gizzi doctor` and the migration prompt.
 */
export function getPluginDirsState(): PluginDirsState {
  const canonicalDir = getPluginsDirectory()
  const legacyDir = getLegacyPluginsDirectory()
  const canonicalExists = existsSync(canonicalDir)
  const legacyExists = existsSync(legacyDir)
  return {
    canonicalDir,
    legacyDir,
    canonicalExists,
    legacyExists,
    legacyHasState: legacyExists && dirHasAnyState(legacyDir),
    canonicalHasState: canonicalExists && dirHasAnyState(canonicalDir),
  }
}

/**
 * Copy legacy plugin state into the canonical ~/.gizzi/plugins directory.
 * Copies — never moves — so a bad migration cannot destroy the user's
 * existing install; the legacy dir remains as the read-only fallback.
 * Existing canonical files/dirs are never overwritten.
 *
 * @returns List of copied entries and list of skipped (already present) entries
 */
export async function migrateLegacyPluginsDir(): Promise<{
  copied: string[]
  skipped: string[]
}> {
  const state = getPluginDirsState()
  const copied: string[] = []
  const skipped: string[] = []

  if (!state.legacyExists) {
    return { copied, skipped: ['(legacy directory not present — nothing to migrate)'] }
  }

  mkdirSync(state.canonicalDir, { recursive: true })

  for (const entry of PLUGIN_STATE_ENTRIES) {
    const from = join(state.legacyDir, entry)
    const to = join(state.canonicalDir, entry)
    if (!existsSync(from)) continue
    if (existsSync(to)) {
      skipped.push(entry)
      continue
    }
    await copyRecursive(from, to)
    copied.push(entry)
  }
  return { copied, skipped }
}

async function copyRecursive(from: string, to: string): Promise<void> {
  const info = await stat(from)
  if (info.isDirectory()) {
    await mkdir(to, { recursive: true })
    for (const child of await readdir(from)) {
      await copyRecursive(join(from, child), join(to, child))
    }
  } else {
    await mkdir(dirname(to), { recursive: true })
    await copyFile(from, to)
  }
}

/**
 * Get the read-only plugin seed directories, if configured.
 *
 * Customers can pre-bake a populated plugins directory into their container
 * image and point CLAUDE_CODE_PLUGIN_SEED_DIR at it. CC will use it as a
 * read-only fallback layer under the primary plugins directory — marketplaces
 * and plugin caches found in the seed are used in place without re-cloning.
 *
 * Multiple seed directories can be layered using the platform path delimiter
 * (':' on Unix, ';' on Windows), in PATH-like precedence order — the first
 * seed that contains a given marketplace or plugin cache wins.
 *
 * Seed structure mirrors the primary plugins directory:
 *   $CLAUDE_CODE_PLUGIN_SEED_DIR/
 *     known_marketplaces.json
 *     marketplaces/<name>/...
 *     cache/<marketplace>/<plugin>/<version>/...
 *
 * @returns Absolute paths to seed dirs in precedence order (empty if unset)
 */
export function getPluginSeedDirs(): string[] {
  // Same tilde-expansion rationale as getPluginsDirectory (gh-30794).
  const raw = process.env.CLAUDE_CODE_PLUGIN_SEED_DIR
  if (!raw) return []
  return raw.split(delimiter).filter(Boolean).map(expandTilde)
}

function sanitizePluginId(pluginId: string): string {
  // Same character class as the install-cache sanitizer (pluginLoader.ts)
  return pluginId.replace(/[^a-zA-Z0-9\-_]/g, '-')
}

/** Pure path — no mkdir. For display (e.g. uninstall dialog). */
export function pluginDataDirPath(pluginId: string): string {
  return join(getPluginsDirectory(), 'data', sanitizePluginId(pluginId))
}

/**
 * Persistent per-plugin data directory, exposed to plugins as
 * ${CLAUDE_PLUGIN_DATA}. Unlike the version-scoped install cache
 * (${CLAUDE_PLUGIN_ROOT}, which is orphaned and GC'd on every update),
 * this survives plugin updates — only removed on last-scope uninstall.
 *
 * Creates the directory on call (mkdir). The *lazy* behavior is at the
 * substitutePluginVariables call site — the DATA pattern uses function-form
 * .replace() so this isn't invoked unless ${CLAUDE_PLUGIN_DATA} is present
 * (ROOT also uses function-form, but for $-pattern safety, not laziness).
 * Env-var export sites (MCP/LSP server env, hook env) call this eagerly
 * since subprocesses may expect the dir to exist before writing to it.
 *
 * Sync because it's called from substitutePluginVariables (sync, inside
 * String.replace) — making this async would cascade through 6 call sites
 * and their sync iteration loops. One mkdir in plugin-load path is cheap.
 */
export function getPluginDataDir(pluginId: string): string {
  const dir = pluginDataDirPath(pluginId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Size of the data dir for the uninstall confirmation prompt. Returns null
 * when the dir is absent or empty so callers can skip the prompt entirely.
 * Recursive walk — not hot-path (only on uninstall).
 */
export async function getPluginDataDirSize(
  pluginId: string,
): Promise<{ bytes: number; human: string } | null> {
  const dir = pluginDataDirPath(pluginId)
  let bytes = 0
  const walk = async (p: string) => {
    for (const entry of await readdir(p, { withFileTypes: true })) {
      const full = join(p, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        // Per-entry catch: a broken symlink makes stat() throw ENOENT.
        // Without this, one broken link bubbles to the outer catch →
        // returns null → dialog skipped → data silently deleted.
        try {
          bytes += (await stat(full)).size
        } catch {
          // Broken symlink / raced delete — skip this entry, keep walking
        }
      }
    }
  }
  try {
    await walk(dir)
  } catch (e) {
    if (isFsInaccessible(e)) return null
    throw e
  }
  if (bytes === 0) return null
  return { bytes, human: formatFileSize(bytes) }
}

/**
 * Best-effort cleanup on last-scope uninstall. Failure is logged but does
 * not throw — the uninstall itself already succeeded; we don't want a
 * cleanup side-effect surfacing as "uninstall failed". Same rationale as
 * deletePluginOptions (pluginOptionsStorage.ts).
 */
export async function deletePluginDataDir(pluginId: string): Promise<void> {
  const dir = pluginDataDirPath(pluginId)
  try {
    await rm(dir, { recursive: true, force: true })
  } catch (e) {
    logForDebugging(
      `Failed to delete plugin data dir ${dir}: ${errorMessage(e)}`,
      { level: 'warn' },
    )
  }
}
