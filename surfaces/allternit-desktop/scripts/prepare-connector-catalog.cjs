#!/usr/bin/env node
/**
 * Generate the open-connector catalog so electron-builder can copy
 * catalog/apps into resources/connector-sidecar. Without it the sidecar
 * exits on boot (ENOENT catalog/apps) and :8014 never binds.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const connectorDir = path.join(repoRoot, 'services', 'open-connector');
const catalogDir = path.join(connectorDir, 'catalog', 'apps');

function log(message) {
  process.stdout.write(`[prepare-connector-catalog] ${message}\n`);
}

if (!fs.existsSync(path.join(connectorDir, 'package.json'))) {
  process.stderr.write(`[prepare-connector-catalog] ✗ missing ${connectorDir}\n`);
  process.exit(1);
}

log(`Generating catalog in ${connectorDir}...`);
// shell: true so `npm` resolves on Windows, where it is an npm.cmd shim that
// execFile cannot find (ENOENT spawnSync npm — run 9 Windows packaging failure).
execFileSync('npm', ['run', 'generate:catalog'], {
  cwd: connectorDir,
  stdio: 'inherit',
  shell: true,
});

const jsonFiles = fs.existsSync(catalogDir)
  ? fs.readdirSync(catalogDir).filter((name) => name.endsWith('.json'))
  : [];

if (jsonFiles.length === 0) {
  process.stderr.write(
    `[prepare-connector-catalog] ✗ catalog/apps is empty after generate:catalog\n`,
  );
  process.exit(1);
}

log(`✓ ${jsonFiles.length} provider catalog files ready`);
