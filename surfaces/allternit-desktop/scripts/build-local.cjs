#!/usr/bin/env node
// Local electron-builder launcher. Stamps a build number into artifact names
// (Allternit-Desktop-1.1.1-b4177-arm64.dmg) so consecutive ad-hoc builds of
// the same version are distinguishable — the version field only moves on
// release commits, so without this every local rebuild overwrites the same
// filename and latest-mac.yml.
//
// Rules:
//   - CI/release builds keep clean version-only names: the suffix is only
//     set when CI / GITHUB_ACTIONS are unset.
//   - ALLTERNIT_BUILD_SUFFIX overrides everything (set to "" for clean names
//     even locally). Default local suffix: -b<git rev-list count>.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (
  process.env.ALLTERNIT_BUILD_SUFFIX === undefined &&
  !process.env.CI &&
  !process.env.GITHUB_ACTIONS
) {
  const rev = spawnSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' });
  const height = rev.status === 0 && rev.stdout.trim() ? rev.stdout.trim() : String(Date.now());
  process.env.ALLTERNIT_BUILD_SUFFIX = `-b${height}`;
}

let command = process.execPath;
let args;
let shell = false;
try {
  const pkgJson = require.resolve('electron-builder/package.json', { paths: [path.join(__dirname, '..')] });
  args = [path.join(path.dirname(pkgJson), require(pkgJson).bin['electron-builder'])];
} catch {
  command = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
  shell = true;
}

const result = spawnSync(command, [...args, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  shell,
});
process.exit(result.status == null ? 1 : result.status);
