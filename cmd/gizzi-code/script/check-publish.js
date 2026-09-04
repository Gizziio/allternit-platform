#!/usr/bin/env node
/**
 * prepublishOnly / prepack gate for the @allternit/gizzi-code npm package.
 *
 * Fails the publish when the launcher shim or the compiled platform binary
 * for the current platform is missing from the package, so a broken publish
 * (bin pointing at a nonexistent file) can never reach the registry.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const launcher = join(root, 'bin', 'gizzi.js');

const failures = [];
if (!existsSync(launcher)) {
  failures.push(`launcher shim missing: ${launcher}`);
}

const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const binaryName = `gizzi-code-${process.platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`;
if (!existsSync(join(root, 'dist', binaryName))) {
  failures.push(
    `compiled binary missing: dist/${binaryName}\n` +
    '  Build it first: bun run build  (or bun run build --all to ship every platform)',
  );
}

if (failures.length > 0) {
  console.error('Refusing to publish @allternit/gizzi-code:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}

console.log(`publish check ok: bin/gizzi.js + dist/${binaryName}`);
