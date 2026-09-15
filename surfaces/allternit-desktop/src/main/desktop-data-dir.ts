/**
 * Packaged Desktop owns `<appData>/@allternit/desktop` (sqlite + profile).
 * A worktree binary must never migrate that database — that is the V47
 * mismatch. Unpackaged is not a second product: explicit scratch, or an
 * ephemeral temp dir. 8013 vs 18013 is only a fuse so cargo cannot steal
 * the installed gateway; it is not a second Allternit.
 *
 * Packaged ignores ALLTERNIT_USER_DATA_DIR / ALLTERNIT_DATA_DIR, matching
 * ALLTERNIT_API_PORT. `--user-data-dir` (Playwright / e2e) is left alone.
 */
import * as path from 'node:path';

export const PACKAGED_USER_DATA_LEAF = ['@allternit', 'desktop'] as const;

export type DevUserDataDecision =
  | { kind: 'unchanged' }
  | { kind: 'path'; path: string }
  | { kind: 'ephemeral' };

export function hasUserDataDirSwitch(argv: readonly string[]): boolean {
  return argv.some((arg) => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='));
}

export function resolveDevUserDataPath(opts: {
  isPackaged: boolean;
  envUserData?: string | undefined;
  argv?: readonly string[];
}): DevUserDataDecision {
  if (opts.isPackaged) return { kind: 'unchanged' };
  if (hasUserDataDirSwitch(opts.argv ?? [])) return { kind: 'unchanged' };
  const override = opts.envUserData?.trim();
  if (override) return { kind: 'path', path: override };
  return { kind: 'ephemeral' };
}

export function resolveApiDataDir(opts: {
  isPackaged: boolean;
  userData: string;
  envDataDir?: string | undefined;
}): string {
  if (!opts.isPackaged) {
    const override = opts.envDataDir?.trim();
    if (override) return override;
  }
  return path.join(opts.userData, 'allternit');
}
