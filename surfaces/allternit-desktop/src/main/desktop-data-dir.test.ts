import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PACKAGED_USER_DATA_LEAF,
  hasUserDataDirSwitch,
  resolveApiDataDir,
  resolveDevUserDataPath,
} from './desktop-data-dir.js';

const appData = path.join('/tmp', 'app-data');
const packagedUserData = path.join(appData, ...PACKAGED_USER_DATA_LEAF);
const scratchUserData = path.join('/tmp', 'scratch-profile');

describe('hasUserDataDirSwitch', () => {
  it('detects equals, space-separated, and absent forms', () => {
    expect(hasUserDataDirSwitch(['electron', '.'])).toBe(false);
    expect(hasUserDataDirSwitch(['electron', '--user-data-dir=/tmp/p'])).toBe(true);
    expect(hasUserDataDirSwitch(['electron', '--user-data-dir', '/tmp/p'])).toBe(true);
  });
});

describe('resolveDevUserDataPath', () => {
  it('never relocates a packaged app', () => {
    expect(
      resolveDevUserDataPath({
        isPackaged: true,
        envUserData: '/tmp/scratch-profile',
        argv: ['electron', '--user-data-dir=/tmp/p'],
      }),
    ).toEqual({ kind: 'unchanged' });
  });

  it('does not create a standing second product profile', () => {
    expect(resolveDevUserDataPath({ isPackaged: false })).toEqual({ kind: 'ephemeral' });
  });

  it('honors ALLTERNIT_USER_DATA_DIR in unpackaged launches', () => {
    expect(
      resolveDevUserDataPath({
        isPackaged: false,
        envUserData: '  /tmp/scratch-profile  ',
      }),
    ).toEqual({ kind: 'path', path: '/tmp/scratch-profile' });
  });

  it('leaves Electron --user-data-dir alone (Playwright / e2e)', () => {
    expect(
      resolveDevUserDataPath({
        isPackaged: false,
        envUserData: '/tmp/scratch-profile',
        argv: ['electron', '--user-data-dir=/tmp/playwright'],
      }),
    ).toEqual({ kind: 'unchanged' });
  });
});

describe('resolveApiDataDir', () => {
  it('pins packaged sqlite under the product userData even if env is set', () => {
    expect(
      resolveApiDataDir({
        isPackaged: true,
        userData: packagedUserData,
        envDataDir: '/tmp/scratch-api',
      }),
    ).toBe(path.join(packagedUserData, 'allternit'));
  });

  it('uses userData/allternit for unpackaged when env is unset', () => {
    expect(
      resolveApiDataDir({ isPackaged: false, userData: scratchUserData }),
    ).toBe(path.join(scratchUserData, 'allternit'));
  });

  it('honors ALLTERNIT_DATA_DIR in unpackaged launches', () => {
    expect(
      resolveApiDataDir({
        isPackaged: false,
        userData: scratchUserData,
        envDataDir: ' /tmp/scratch-api ',
      }),
    ).toBe('/tmp/scratch-api');
  });
});
