#!/usr/bin/env node
/**
 * Build the platform static export and copy it into resources/ for the packaged desktop app.
 *
 * The Rust API serves the platform static export directly via tower-http ServeDir
 * when the desktop app runs offline.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const platformDir = path.join(repoRoot, 'surfaces', 'ai.allternit.com');
const platformResourcesDir = path.join(desktopDir, 'resources', 'platform');

function log(message) {
  process.stdout.write(`[prepare-platform-static] ${message}\n`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmrf(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true });
  }
}

function runBuild(cwd, script, envExtra = {}) {
  log(`Running pnpm ${script} in ${cwd}...`);
  try {
    execFileSync('pnpm', ['run', script], {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...envExtra,
      },
    });
  } catch (e) {
    log(`Failed to run pnpm ${script}: ${e.message}`);
    process.exit(1);
  }
}

function copyExport(src, dest, label) {
  if (!fs.existsSync(src)) {
    log(`Output directory ${src} not found for ${label}.`);
    process.exit(1);
  }
  rmrf(dest);
  fs.mkdirSync(dest, { recursive: true });
  log(`Copying ${src} -> ${dest}...`);
  copyDir(src, dest);
  log(`${label} static export ready at ${dest}`);
}

function checkRequiredBinaries() {
  // Fail fast if the gizzi-code brain binary is missing. A packaged app without it
  // throws at runtime ("gizzi-code binary not found" in GizziManager) — catch that
  // here, at build time, with a clear remediation. The canonical pipeline
  // (scripts/build-desktop.sh) stages this binary before the electron build.
  const resourcesBin = path.join(desktopDir, 'resources', 'bin');
  const gizziBin = path.join(resourcesBin, process.platform === 'win32' ? 'gizzi-code.exe' : 'gizzi-code');
  if (!fs.existsSync(gizziBin)) {
    log('ERROR: resources/bin/gizzi-code is missing — the packaged app would ship without a brain.');
    log('Build it first via the canonical pipeline: ../../scripts/build-desktop.sh');
    log('(which runs cmd/gizzi-code/build-production.js and copies dist/gizzi-code into resources/bin/).');
    process.exit(1);
  }
  log(`gizzi-code brain present at ${gizziBin}`);

  const voiceBin = path.join(resourcesBin, process.platform === 'win32' ? 'allternit-voice-service.exe' : 'allternit-voice-service');
  if (!fs.existsSync(voiceBin)) {
    log('ERROR: resources/bin/allternit-voice-service is missing — packaged Voice Mode would not start.');
    log('Build it first via the canonical pipeline: ../../scripts/build-desktop.sh');
    process.exit(1);
  }
  log(`voice service present at ${voiceBin}`);
}

function main() {
  checkRequiredBinaries();

  if (!fs.existsSync(platformDir)) {
    log(`Platform surface not found at ${platformDir}. Skipping static export.`);
    process.exit(0);
  }

  // Build and copy platform static export
  runBuild(platformDir, 'build', { CLOUDFLARE_PAGES: '1' });
  copyExport(path.join(platformDir, 'dist'), platformResourcesDir, 'Platform');
}

main();
