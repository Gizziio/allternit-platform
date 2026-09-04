#!/usr/bin/env node
/**
 * gizzi / gizzi-code npm launcher shim.
 *
 * The published package ships Bun-compiled platform binaries under dist/
 * (dist/gizzi-code-<platform>-<arch>[.exe], produced by `bun run build`).
 * npm's `bin` entry must point at a stable, checked-in path, so this shim
 * resolves the binary for the current platform and execs it, forwarding
 * arguments, stdio, signals and the exit code.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

const PLATFORM_ALIASES = { darwin: 'darwin', linux: 'linux', win32: 'win32' };
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const platform = PLATFORM_ALIASES[process.platform];
const suffix = process.platform === 'win32' ? '.exe' : '';
const binary = platform && join(dist, `gizzi-code-${platform}-${arch}${suffix}`);

if (!binary || !existsSync(binary)) {
  console.error(
    `gizzi: no prebuilt binary for ${process.platform}-${arch}.\n` +
    `Expected: ${binary || `(unsupported platform ${process.platform})`}\n\n` +
    'This install is missing its compiled binary. Reinstall the package, or ' +
    'build from source: bun run build (in cmd/gizzi-code).',
  );
  process.exit(1);
}

const child = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
child.on('error', (error) => {
  console.error(`gizzi: failed to launch ${binary}: ${error.message}`);
  process.exit(1);
});
