#!/usr/bin/env node
/**
 * prepublishOnly / prepack gate for the @allternit/gizzi-code npm package.
 *
 * Fails the publish when the launcher shim is missing, so a broken publish
 * (bin pointing at a nonexistent file) can never reach the registry.
 *
 * The platform binary itself is distributed two ways: bundled under dist/
 * (legacy single-platform tarballs) or via the optional platform packages
 * @allternit/gizzi-code-<platform>-<arch> (cross-platform installs). A
 * missing local binary is therefore a warning, not a hard failure — the
 * launcher shim resolves the platform package at runtime and prints install
 * guidance when neither source is present.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const launcher = join(root, 'bin', 'gizzi.js');

if (!existsSync(launcher)) {
  console.error(`Refusing to publish @allternit/gizzi-code: launcher shim missing: ${launcher}`);
  process.exit(1);
}

const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const binaryName = `gizzi-code-${process.platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`;
if (!existsSync(join(root, 'dist', binaryName))) {
  console.warn(
    `warning: dist/${binaryName} not bundled — cross-platform installs rely on ` +
    'the @allternit/gizzi-code-<platform>-<arch> optional packages.',
  );
}

console.log('publish check ok: bin/gizzi.js (launcher) present');
