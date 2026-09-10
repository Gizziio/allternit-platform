#!/usr/bin/env node
/**
 * Install the open-connector sidecar's runtime dependencies so
 * electron-builder can copy services/open-connector/node_modules into
 * resources/connector-sidecar/node_modules.
 *
 * services/open-connector is a plain npm project (own package-lock.json,
 * deliberately excluded from the pnpm workspace — see its PROVENANCE.md and
 * pnpm-workspace.yaml), so a root `pnpm install` never produces its
 * node_modules. Without this step the extraFiles copy in package.json finds
 * nothing, electron-builder logs a one-line warning, and the sidecar
 * crash-loops at runtime with "Cannot find package '@hono/node-server'".
 *
 * Idempotent: `npm ci` only runs when node_modules is missing or older than
 * the lockfile, so repeat local builds are cheap.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const connectorDir = path.join(repoRoot, 'services', 'open-connector');
const lockfile = path.join(connectorDir, 'package-lock.json');
const nodeModules = path.join(connectorDir, 'node_modules');
const installedLockfile = path.join(nodeModules, '.package-lock.json');

function log(message) {
  process.stdout.write(`[prepare-connector-sidecar] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[prepare-connector-sidecar] ✗ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(connectorDir, 'package.json'))) {
  fail(`missing ${connectorDir}`);
}
if (!fs.existsSync(lockfile)) {
  fail(`missing ${lockfile} — open-connector must stay a lockfile-pinned npm project`);
}

function needsInstall() {
  if (!fs.existsSync(installedLockfile)) return true;
  return fs.statSync(lockfile).mtimeMs > fs.statSync(installedLockfile).mtimeMs;
}

if (needsInstall()) {
  log(`Installing open-connector dependencies (npm ci in ${connectorDir})…`);
  // shell: true so `npm` resolves on Windows, where it is an npm.cmd shim
  // that execFile cannot find (same lesson as prepare-connector-catalog).
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: connectorDir,
    stdio: 'inherit',
    shell: true,
  });
} else {
  log('open-connector node_modules is up to date — skipping npm ci');
}

// Hard requirement, not a warning: without the hono server the sidecar
// cannot bind :8014 and every connector-backed source stays unavailable.
const honoServerPkg = path.join(nodeModules, '@hono', 'node-server', 'package.json');
if (!fs.existsSync(honoServerPkg)) {
  fail('npm ci finished but @hono/node-server is not resolvable in node_modules');
}

log('✓ open-connector sidecar dependencies ready');
