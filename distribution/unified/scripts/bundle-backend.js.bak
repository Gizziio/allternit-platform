#!/usr/bin/env node
/**
 * Bundle A2R Backend binaries with Desktop installer
 * 
 * This script downloads backend binaries for all platforms and
 * places them in the bundled-backend/ directory for electron-builder
 * to include in the installer.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

const BACKEND_VERSION = '1.0.0';
const GITHUB_RELEASES = `https://github.com/a2r/backend/releases/download/v${BACKEND_VERSION}`;

const PLATFORMS = [
  { os: 'mac', arch: 'x64', target: 'x86_64-macos' },
  { os: 'mac', arch: 'arm64', target: 'aarch64-macos' },
  { os: 'win', arch: 'x64', target: 'x86_64-windows' },
  { os: 'linux', arch: 'x64', target: 'x86_64-linux' },
  { os: 'linux', arch: 'arm64', target: 'aarch64-linux' },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'bundled-backend');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Download failed: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function extractTarGz(archivePath, destDir) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    const tar = spawn('tar', ['-xzf', archivePath, '-C', destDir, '--strip-components=1']);
    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Extraction failed with code ${code}`));
      }
    });
    tar.on('error', reject);
  });
}

async function bundleBackend() {
  console.log('Bundling A2R Backend binaries...\n');

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const platform of PLATFORMS) {
    const { os, arch, target } = platform;
    const filename = `a2r-backend-${BACKEND_VERSION}-${target}.tar.gz`;
    const url = `${GITHUB_RELEASES}/${filename}`;
    const platformDir = path.join(OUTPUT_DIR, os, arch);
    const archivePath = path.join(OUTPUT_DIR, filename);

    console.log(`[${os}/${arch}] ${target}`);

    try {
      // Check if already downloaded
      if (fs.existsSync(platformDir)) {
        console.log(`  ✓ Already bundled`);
        continue;
      }

      // Download
      console.log(`  → Downloading...`);
      await downloadFile(url, archivePath);

      // Extract
      console.log(`  → Extracting...`);
      await extractTarGz(archivePath, platformDir);

      // Cleanup archive
      fs.unlinkSync(archivePath);

      console.log(`  ✓ Bundled`);
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      // Continue with other platforms
    }
  }

  console.log('\n✓ Backend bundling complete!');
  console.log(`Output: ${OUTPUT_DIR}`);
}

// Run if called directly
if (require.main === module) {
  bundleBackend().catch(console.error);
}

module.exports = { bundleBackend };
