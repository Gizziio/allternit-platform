/**
 * Packaged vs unpackaged data-dir ownership.
 *
 * The installed app and `npm run dev` share Electron's default userData
 * (`<appData>/@allternit/desktop`, from package.json "name") — so cargo/dev
 * migrations used to rewrite the production SQLite and the next packaged
 * boot died on a version mismatch. Port 8013 vs 18013 already splits the
 * gateway; these helpers split the profile and the API sqlite the same way.
 *
 * Packaged launches ignore ALLTERNIT_USER_DATA_DIR / ALLTERNIT_DATA_DIR,
 * matching ALLTERNIT_API_PORT. Unpackaged: env wins, else a sibling
 * `desktop-dev` profile. `--user-data-dir` (Playwright / e2e) is left alone.
 */
import * as path from 'node:path';

export const PACKAGED_USER_DATA_LEAF = ['@allternit', 'desktop'] as const;
export const DEV_USER_DATA_LEAF = ['@allternit', 'desktop-dev'] as const;

export function hasUserDataDirSwitch(argv: readonly string[]): boolean {
  return argv.some((arg) => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='));
}

export function resolveDevUserDataPath(opts: {
  isPackaged: boolean;
  appData: string;
  envUserData?: string | undefined;
  argv?: readonly string[];
}): string | null {
  if (opts.isPackaged) return null;
  if (hasUserDataDirSwitch(opts.argv ?? [])) return null;
  const override = opts.envUserData?.trim();
  if (override) return override;
  return path.join(opts.appData, ...DEV_USER_DATA_LEAF);
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
