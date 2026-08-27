#!/usr/bin/env node
/**
 * Prepare the allternit-api Rust binary for packaging.
 *
 * 1. Look for a local build in target/release or target/debug and copy it into
 *    resources/bin/.
 * 2. If no local build exists, download the platform-locked backend archive from
 *    the manifest in src/main/manifest.ts and extract it.
 *
 * This script is wired into the electron-builder pipeline via the
 * `prepare:api-binary` npm script so packaged builds ship with the binary at
 * resources/bin/allternit-api instead of relying on the runtime auto-download.
 */

'use strict';

// Load TypeScript manifest directly; tsx is a workspace dependency.
require('tsx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const resourcesBin = path.join(desktopDir, 'resources', 'bin');
const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';

function log(message) {
  process.stdout.write(`[prepare-api-binary] ${message}\n`);
}

function errorAndExit(message) {
  process.stderr.write(`[prepare-api-binary] ✗ ${message}\n`);
  process.exit(1);
}

async function loadManifest() {
  const manifestPath = path.join(desktopDir, 'src', 'main', 'manifest.ts');
  const module = await import(manifestPath);
  return {
    manifest: module.PLATFORM_MANIFEST,
    getBackendDownloadUrl: module.getBackendDownloadUrl,
    getBackendChecksum: module.getBackendChecksum,
  };
}

function findLocalBinary() {
  const candidates = [
    path.join(repoRoot, 'target', 'release', binaryName),
    path.join(repoRoot, 'target', 'debug', binaryName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function copyLocalBinary(source) {
  fs.mkdirSync(resourcesBin, { recursive: true });
  const dest = path.join(resourcesBin, binaryName);
  fs.copyFileSync(source, dest);
  if (process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }
  log(`✓ Staged local binary: ${source} -> ${dest}`);
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { timeout: 120000 }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          file.close();
          fs.unlinkSync(dest);
          if (!redirectUrl) {
            reject(new Error('Redirect response missing Location header'));
            return;
          }
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }

        const total = parseInt(response.headers['content-length'] || '0', 10);
        let downloaded = 0;
        let lastLoggedPercent = -1;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            if (percent >= lastLoggedPercent + 10) {
              log(`Downloading ${percent}%`);
              lastLoggedPercent = percent;
            }
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });
  });
}

async function extractArchive(archivePath, destDir) {
  const ext = path.extname(archivePath).toLowerCase();
  const base = path.basename(archivePath).toLowerCase();

  if (ext === '.zip' || base.endsWith('.zip')) {
    log('Extracting zip archive...');
    try {
      await execFileAsync('unzip', ['-o', archivePath, '-d', destDir]);
      return;
    } catch {
      // unzip may not be available on Windows build hosts; fall back to PowerShell.
      await execFileAsync(
        'powershell',
        ['-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${destDir}" -Force`],
        { shell: true }
      );
    }
  } else {
    log('Extracting tar.gz archive...');
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir]);
  }
}

async function downloadBackendBinary() {
  const { getBackendDownloadUrl, getBackendChecksum } = await loadManifest();

  let url;
  let expectedChecksum;
  try {
    url = getBackendDownloadUrl();
    expectedChecksum = getBackendChecksum();
  } catch (e) {
    errorAndExit(`Could not resolve backend download URL: ${e.message}`);
  }

  fs.mkdirSync(resourcesBin, { recursive: true });
  const downloadPath = path.join(resourcesBin, `allternit-api-download-${Date.now()}`);

  log(`No local allternit-api build found. Downloading from ${url}...`);
  try {
    await downloadFile(url, downloadPath);
  } catch (e) {
    errorAndExit(`Download failed: ${e.message}`);
  }

  if (expectedChecksum) {
    log('Verifying checksum...');
    const actualChecksum = await sha256File(downloadPath);
    if (actualChecksum !== expectedChecksum) {
      fs.unlinkSync(downloadPath);
      errorAndExit(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
    }
    log('Checksum verified.');
  } else {
    log('Warning: no checksum configured in manifest; skipping verification.');
  }

  log('Extracting archive...');
  try {
    await extractArchive(downloadPath, resourcesBin);
  } catch (e) {
    fs.unlinkSync(downloadPath);
    errorAndExit(`Extraction failed: ${e.message}`);
  }

  fs.unlinkSync(downloadPath);

  const binaryPath = path.join(resourcesBin, binaryName);
  if (!fs.existsSync(binaryPath)) {
    errorAndExit(`Binary not found after extraction: ${binaryPath}`);
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(binaryPath, 0o755);
  }

  log(`✓ Downloaded and staged backend binary: ${binaryPath}`);
}

async function main() {
  const localBinary = findLocalBinary();
  if (localBinary) {
    copyLocalBinary(localBinary);
    return;
  }

  log('No local allternit-api binary found in target/release or target/debug.');
  await downloadBackendBinary();
}

main().catch((e) => {
  errorAndExit(e.message);
});
