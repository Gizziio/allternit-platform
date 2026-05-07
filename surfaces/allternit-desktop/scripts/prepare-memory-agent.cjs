#!/usr/bin/env node
/**
 * Builds the Memory Agent TypeScript and stages it under
 * resources/memory-agent/ for bundling into the Electron app.
 *
 * IMPORTANT: The Memory Agent runs as a child process using the system 'node'
 * binary found in PATH at runtime. Native modules (better-sqlite3) MUST be
 * compiled against that same Node.js ABI version. Do NOT run this script with
 * a different Node.js version than what will be used at runtime — an ABI
 * mismatch will cause a NODE_MODULE_VERSION error on startup.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot   = path.resolve(desktopDir, '..', '..');
const agentDir   = path.join(repoRoot, 'api', 'services', 'memory', 'agent');
const outputDir  = path.join(desktopDir, 'resources', 'memory-agent');

function log(msg) {
  process.stdout.write(`[prepare-memory-agent] ${msg}\n`);
}

if (!fs.existsSync(agentDir)) {
  log(`Warning: Memory Agent not found at ${agentDir} — skipping`);
  process.exit(0);
}

// Install dependencies (needed for tsc in devDependencies)
log('Installing Memory Agent build dependencies...');
execFileSync('npm', ['install'], { cwd: agentDir, stdio: 'inherit' });

// Build TypeScript → dist/
log('Building Memory Agent TypeScript...');
execFileSync('npm', ['run', 'build'], { cwd: agentDir, stdio: 'inherit' });

const distDir = path.join(agentDir, 'dist');
if (!fs.existsSync(distDir)) {
  throw new Error(`Memory Agent build did not produce dist/ at ${distDir}`);
}

// Clear and recreate output dir
log(`Staging to ${outputDir}`);
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

// Copy compiled output + package manifest
fs.cpSync(distDir, path.join(outputDir, 'dist'), { recursive: true, dereference: true });
fs.copyFileSync(path.join(agentDir, 'package.json'), path.join(outputDir, 'package.json'));

// Install production dependencies (builds native modules for current platform).
// --no-workspaces prevents npm from traversing up to the monorepo workspace root,
// which causes an @npmcli/arborist "Cannot read properties of null" crash.
log('Installing production dependencies...');
execFileSync('npm', ['install', '--omit=dev', '--no-workspaces'], {
  cwd: outputDir,
  stdio: 'inherit',
});

log(`Memory Agent ready at ${outputDir}`);
