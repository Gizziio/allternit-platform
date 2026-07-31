/**
 * Local config store for published HTML artifacts:
 * `.gizzi/artifacts/<slug>/config.json` — primary, always written.
 * `.claude/artifacts/<slug>/config.json` — read-only compat fallback.
 *
 * Same GIZZI-first / CLAUDE-fallback idiom as
 * `getRelativeSettingsFilePathForSource` (settings.ts:305-321) and
 * `pickMemoryFile` (config.ts:1790-1802): prefer the .gizzi path if it
 * exists, else read .claude if that's what's there, else default to
 * .gizzi (so a brand-new artifact always writes the new-style path).
 */
import { existsSync } from 'fs'
import { join } from 'path'
import { getOriginalCwd } from '@/bootstrap/state'
import { Filesystem } from '@/runtime/util/filesystem'
import type { ArtifactInput } from './types'

export interface ArtifactConfig {
  configVersion: 1
  /** The stable upsert key sent as `artifact_key` on every publish. */
  artifactKey: string
  /** Minted once on first publish and reused on every redeploy — the
   * (session_id, artifact_key) pair is allternit-api's upsert identity, so
   * this must never change once a canvas exists under it. See
   * PHASE_2_NOTES.md, "Session context", for why this isn't gizzi-code's
   * own ephemeral chat-session id. */
  sessionId: string
  /** Last known allternit-api canvas id/version, informational — the
   * publish call re-resolves both from the response, this is just what a
   * `status` check can show without a network round-trip. */
  canvasId?: string
  lastPublishedVersion?: number
  lastPublishedAt?: string
  /** The generator input that produced the last publish, so a redeploy
   * doesn't require re-specifying everything by hand. */
  input: ArtifactInput
}

function relativeConfigPath(slug: string): string {
  return join('artifacts', slug, 'config.json')
}

/** Deterministic slug: lowercase, non [a-z0-9] runs collapsed to '-',
 * trimmed. Used both as the default `artifact_key` and the config dirname. */
export function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  if (!slug) throw new Error(`"${input}" has no usable characters for a slug — pass --key explicitly`)
  return slug
}

/** GIZZI-first resolution: prefer `.gizzi/artifacts/<slug>/config.json` if
 * it exists, else fall back to reading `.claude/artifacts/<slug>/config.json`,
 * else default to the `.gizzi` path (new artifacts always write there). */
export function resolveArtifactConfigPath(slug: string): string {
  const root = getOriginalCwd()
  const gizziPath = join(root, '.gizzi', relativeConfigPath(slug))
  const claudePath = join(root, '.claude', relativeConfigPath(slug))
  try {
    if (existsSync(gizziPath)) return gizziPath
    if (existsSync(claudePath)) return claudePath
  } catch {
    // fall through
  }
  return gizziPath
}

/** Always the .gizzi path — writes never target the .claude fallback. */
export function writeArtifactConfigPath(slug: string): string {
  return join(getOriginalCwd(), '.gizzi', relativeConfigPath(slug))
}

export async function loadArtifactConfig(slug: string): Promise<ArtifactConfig | undefined> {
  const path = resolveArtifactConfigPath(slug)
  if (!(await Filesystem.exists(path))) return undefined
  return Filesystem.readJson<ArtifactConfig>(path)
}

export async function saveArtifactConfig(slug: string, config: ArtifactConfig): Promise<void> {
  const path = writeArtifactConfigPath(slug)
  await Filesystem.ensureDir(join(path, '..'))
  await Filesystem.writeJson(path, config)
}
