#!/usr/bin/env node
/**
 * gizzi / gizzi-code npm launcher shim.
 *
 * Binary resolution, in order:
 *   1. A Bun-compiled platform binary shipped inside this package under
 *      dist/ (dist/gizzi-code-<platform>-<arch>[.exe]).
 *   2. The matching optional platform package
 *      @allternit/gizzi-code-<platform>-<arch>, which npm installs
 *      automatically via optionalDependencies on supported platforms.
 *
 * npm's `bin` entry must point at a stable, checked-in path, so this shim
 * resolves the binary for the current platform and execs it, forwarding
 * arguments, stdio, signals and the exit code.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const PLATFORM_ALIASES = { darwin: 'darwin', linux: 'linux', win32: 'win32' };
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const platform = PLATFORM_ALIASES[process.platform];
const suffix = process.platform === 'win32' ? '.exe' : '';
const binaryName = platform && `gizzi-code-${platform}-${arch}${suffix}`;

function platformPackageCandidates() {
  // Walk up from this shim looking for the optional platform package.
  // Covers global installs (bin/ inside the package dir), nested installs,
  // and hoisted layouts.
  const pkgName = `@allternit/gizzi-code-${platform}-${arch}`;
  const candidates = [];
  let dir = here;
  for (let i = 0; i < 8; i++) {
    candidates.push(join(dir, 'node_modules', pkgName, binaryName));
    candidates.push(join(dir, 'node_modules', pkgName, 'bin', binaryName));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return candidates;
}

function resolveBinary() {
  if (!binaryName) return null;
  const local = join(here, '..', 'dist', binaryName);
  if (existsSync(local)) return local;
  for (const candidate of platformPackageCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const binary = resolveBinary();

if (!binary) {
  console.error(
    `gizzi: no prebuilt binary for ${process.platform}-${arch}.\n` +
    `Expected: ${binaryName || `(unsupported platform ${process.platform})`}\n\n` +
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
