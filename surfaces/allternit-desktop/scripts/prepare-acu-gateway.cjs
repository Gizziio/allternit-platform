#!/usr/bin/env node
/**
 * Stage the ACU computer-use Python tree for packaging.
 *
 * Copies domains/computer-use/core (source only — not .venv) into
 * resources/computer-use/acu so Desktop can spawn launch.py.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const src = path.join(repoRoot, 'domains', 'computer-use', 'core');
const dest = path.join(desktopDir, 'resources', 'computer-use', 'acu');

const SKIP_DIRS = new Set([
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  'tests',
  'build',
  '.git',
  'golden-paths',
  'evaluation',
  'node_modules',
]);

function log(message) {
  process.stdout.write(`[prepare-acu-gateway] ${message}\n`);
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.endsWith('.pyc')) continue;
    const nextFrom = path.join(from, entry.name);
    const nextTo = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(nextFrom, nextTo);
    else fs.copyFileSync(nextFrom, nextTo);
  }
}

if (!fs.existsSync(path.join(src, 'launch.py'))) {
  process.stderr.write(`[prepare-acu-gateway] ✗ missing ${path.join(src, 'launch.py')}\n`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
copyTree(src, dest);
if (!fs.existsSync(path.join(dest, 'launch.py'))) {
  process.stderr.write('[prepare-acu-gateway] ✗ launch.py did not copy\n');
  process.exit(1);
}
log(`staged ${dest}`);
