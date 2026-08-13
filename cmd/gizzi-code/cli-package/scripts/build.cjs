#!/usr/bin/env node
/**
 * Packaging build for the @allternit/gizzi-code-cli npm distribution.
 *
 * Gizzi Code is built as a native executable by the parent workspace package
 * (cmd/gizzi-code) using Bun's compiler. The npm package ships the current
 * platform's binary plus a small Node.js fallback used when the binary is
 * unavailable.
 */
const { copyFileSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const packageRoot = dirname(__dirname);
const distDir = join(packageRoot, 'dist');
const parentBinary = join(packageRoot, '..', 'dist', 'gizzi-code');
const targetBinary = join(distDir, 'gizzi');
const targetFallback = join(distDir, 'gizzi.js');

if (!existsSync(parentBinary)) {
  console.error(
    '[cli-package] Parent build artifact not found: ' + parentBinary + '\n' +
    'Run `pnpm --filter gizzi-code build` first.'
  );
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });

// Ship the compiled native executable as the preferred runtime.
copyFileSync(parentBinary, targetBinary);

// Minimal Node.js fallback so the package's `main` entry resolves.
writeFileSync(
  targetFallback,
  `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const binaryPath = join(dirname(fileURLToPath(import.meta.url)), 'gizzi');
if (!existsSync(binaryPath)) {
  console.error('Gizzi binary not found. Reinstall the package or build from source.');
  process.exit(1);
}

const child = spawn(binaryPath, process.argv.slice(2), { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
`,
  'utf8'
);

console.log('[cli-package] Packaged gizzi binary and fallback to dist/');
