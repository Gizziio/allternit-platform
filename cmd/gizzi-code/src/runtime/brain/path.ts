/**
 * Brain path resolution — shared between `gizzi brain` (CLI) and Vault
 * (`src/vault/index.ts`), which now share one storage root. See
 * docs/LENS_CONTEXT_LAYER_PLAN.md for why these two systems were unified.
 *
 * Lives in `runtime/` rather than `cli/commands/brain/` so Vault (deep
 * runtime code) doesn't have to import a CLI-command module for this;
 * `cli/commands/brain/status.ts` re-exports this for its own callers.
 */

import { getSettingsForSource } from "@/shared/utils/settings/settings"
import { DEFAULT_BRAIN_PATH, expandBrainPath } from "@/cli/commands/brain/lib"

/** Settings-backed brain path resolution: --path flag > userSettings.brain.path > ~/brain. */
export function resolveBrainPath(flagPath?: string): string {
  if (flagPath) return expandBrainPath(flagPath)
  try {
    const configured = getSettingsForSource("userSettings")?.brain?.path
    if (configured) return expandBrainPath(configured)
  } catch {
    // settings unavailable — fall through to the default
  }
  return DEFAULT_BRAIN_PATH
}

export { DEFAULT_BRAIN_PATH, expandBrainPath }
