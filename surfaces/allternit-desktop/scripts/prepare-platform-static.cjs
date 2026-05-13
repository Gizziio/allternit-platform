#!/usr/bin/env node
/**
 * Build the Next.js platform static export and copy it into resources/platform/.
 *
 * The desktop loads https://ai.allternit.com in production, but for offline mode
 * the Rust API serves the static export directly via tower-http ServeDir.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const platformDir = path.join(repoRoot, 'surfaces', 'ai.allternit.com');
const resourcesDir = path.join(desktopDir, 'resources', 'platform');

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

function main() {
  if (!fs.existsSync(platformDir)) {
    log(`Platform surface not found at ${platformDir}. Skipping static export.`);
    process.exit(0);
  }

  log(`Building static export from ${platformDir}...`);

  // Build Next.js static export
  try {
    execFileSync('npm', ['run', 'build'], {
      cwd: platformDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        CLOUDFLARE_PAGES: '1',
      },
    });
  } catch (e) {
    log(`Failed to build platform static export: ${e.message}`);
    process.exit(1);
  }

  const outDir = path.join(platformDir, 'dist');
  if (!fs.existsSync(outDir)) {
    log(`Output directory ${outDir} not found after build.`);
    process.exit(1);
  }

  // Clean and copy to resources
  if (fs.existsSync(resourcesDir)) {
    log(`Removing old resources/platform...`);
    fs.rmSync(resourcesDir, { recursive: true });
  }
  fs.mkdirSync(resourcesDir, { recursive: true });

  log(`Copying ${outDir} -> ${resourcesDir}...`);
  copyDir(outDir, resourcesDir);

  log(`Platform static export ready at ${resourcesDir}`);
}

main();
