#!/usr/bin/env node
/**
 * Pre-build guard for the Electron packaging pipeline.
 *
 * Fails fast when the resources that electron-builder copies into the
 * packaged app are missing. This catches the common failure mode where
 * `npm run dist` is invoked before `scripts/build-desktop.sh` has staged
 * the Rust API binary, gizzi-code brain, voice service, and platform static
 * export.
 */

const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const resourcesDir = path.join(desktopDir, 'resources');

function log(message) {
  process.stdout.write(`[verify-packaged-resources] ${message}\n`);
}

function errorAndExit(message) {
  process.stderr.write(`[verify-packaged-resources] ✗ ${message}\n`);
  process.exit(1);
}

const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';
const gizziName = process.platform === 'win32' ? 'gizzi-code.exe' : 'gizzi-code';
const voiceName = process.platform === 'win32' ? 'allternit-voice-service.exe' : 'allternit-voice-service';

const required = [
  {
    path: path.join(resourcesDir, 'bin', binaryName),
    label: 'Rust API binary (allternit-api)',
    buildStep: 'scripts/build-desktop.sh (or npm run stage:api-binary)',
  },
  {
    path: path.join(resourcesDir, 'bin', gizziName),
    label: 'Gizzi Code brain binary (gizzi-code)',
    buildStep: 'scripts/build-desktop.sh',
  },
  {
    path: path.join(resourcesDir, 'bin', voiceName),
    label: 'Voice service binary (allternit-voice-service)',
    buildStep: 'scripts/build-desktop.sh',
  },
  {
    path: path.join(resourcesDir, 'platform', 'index.html'),
    label: 'Platform static export',
    buildStep: 'npm run prepare:platform-static (or scripts/build-desktop.sh)',
  },
];

let failed = false;

for (const item of required) {
  if (fs.existsSync(item.path)) {
    log(`✓ ${item.label}: ${item.path}`);
  } else {
    failed = true;
    process.stderr.write(
      `[verify-packaged-resources] ✗ Missing ${item.label}\n` +
      `    Expected at: ${item.path}\n` +
      `    Build it with: ${item.buildStep}\n`
    );
  }
}

if (failed) {
  process.stderr.write(
    '\n[verify-packaged-resources] Packaged resources are incomplete. ' +
    'Run the full staging pipeline first:\n' +
    '    bash scripts/build-desktop.sh\n' +
    'Or, for local development packaging only, see npm run stage:api-binary.\n'
  );
  process.exit(1);
}

log('All packaged resources present.');
