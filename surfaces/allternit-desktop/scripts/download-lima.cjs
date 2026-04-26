/**
 * Downloads the limactl binary for the current platform/arch and places it at
 * resources/lima/limactl so electron-builder can bundle it into the app.
 *
 * Usage:
 *   node scripts/download-lima.cjs              # auto-detects arch
 *   node scripts/download-lima.cjs arm64        # force arm64
 *   node scripts/download-lima.cjs x86_64       # force x86_64
 *
 * CI: run this before electron-builder so the binary is present for packaging.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

const LIMA_VERSION = '1.0.3'; // pin — update when you want a newer Lima release

const ARCH_MAP = {
  arm64: 'arm64',
  aarch64: 'arm64',
  x64: 'x86_64',
  x86_64: 'x86_64',
};

const rawArch = process.argv[2] || process.arch;
const arch = ARCH_MAP[rawArch];
if (!arch) {
  console.error(`Unsupported arch: ${rawArch}`);
  process.exit(1);
}

const tarballName = `lima-${LIMA_VERSION}-macOS-${arch}.tar.gz`;
const url = `https://github.com/lima-vm/lima/releases/download/v${LIMA_VERSION}/${tarballName}`;
const outDir = path.join(__dirname, '..', 'resources', 'lima');
const tarballPath = path.join(outDir, tarballName);
const binaryPath = path.join(outDir, 'limactl');

fs.mkdirSync(outDir, { recursive: true });

// Skip if binary already matches the target version
if (fs.existsSync(binaryPath)) {
  try {
    const ver = execSync(`"${binaryPath}" --version`, { encoding: 'utf8' }).trim();
    if (ver.includes(LIMA_VERSION)) {
      console.log(`limactl ${LIMA_VERSION} already present at ${binaryPath} — skipping download`);
      process.exit(0);
    }
  } catch { /* fall through and re-download */ }
}

console.log(`Downloading ${url}...`);

function download(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  https.get(url, (res) => {
    // Follow redirects (GitHub releases use one redirect)
    if (res.statusCode === 301 || res.statusCode === 302) {
      file.close();
      fs.unlinkSync(dest);
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      file.close();
      cb(new Error(`HTTP ${res.statusCode} for ${url}`));
      return;
    }
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  }).on('error', (err) => {
    fs.unlinkSync(dest);
    cb(err);
  });
}

download(url, tarballPath, (err) => {
  if (err) { console.error('Download failed:', err.message); process.exit(1); }

  console.log(`Extracting ${tarballName}...`);
  try {
    // Extract only bin/limactl from the tarball
    execSync(
      `tar -xzf "${tarballPath}" --strip-components=1 -C "${outDir}" bin/limactl`,
      { stdio: 'pipe' }
    );
    fs.unlinkSync(tarballPath);
    fs.chmodSync(binaryPath, 0o755);
    console.log(`limactl ${LIMA_VERSION} ready at ${binaryPath}`);
  } catch (e) {
    console.error('Extraction failed:', e.message);
    process.exit(1);
  }
});
