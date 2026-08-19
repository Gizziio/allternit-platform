const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const VERSION = '0.20.1-nightly.20260818.32173745999';
const ASSET = `cua-driver-rs-${VERSION}-darwin-universal-binary.tar.gz`;
const SHA256 = 'f57e7192da3c818b2cf9e30bacc2c32a9a254387e43612e9dc021debbc17ef93';
const URL = `https://github.com/trycua/cua/releases/download/nightly-cua-driver-rs-v${VERSION}/${ASSET}`;
const outputDir = path.resolve(__dirname, '..', 'resources', 'computer-use');
const output = path.join(outputDir, 'cua-driver');

function download(url, destination, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects while downloading Cua Driver'));
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'allternit-desktop-packager' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(response.headers.location, destination, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Cua Driver download failed with HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destination, { mode: 0o600 });
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  if (process.platform !== 'darwin') {
    console.log('Cua Driver bundle preparation skipped: macOS-only embedded backend.');
    return;
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allternit-cua-driver-'));
  const archive = path.join(tempDir, ASSET);
  try {
    await download(URL, archive);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    if (actual !== SHA256) throw new Error(`Cua Driver checksum mismatch: expected ${SHA256}, got ${actual}`);
    const extract = spawnSync('tar', ['-xzf', archive, '-C', tempDir], { encoding: 'utf8' });
    if (extract.status !== 0) throw new Error(extract.stderr || 'Unable to extract Cua Driver');
    const candidates = fs.readdirSync(tempDir, { recursive: true })
      .map((entry) => path.join(tempDir, entry))
      .filter((entry) => path.basename(entry) === 'cua-driver' && fs.statSync(entry).isFile());
    if (!candidates[0]) throw new Error('Cua Driver binary was not present in the verified release archive');
    fs.copyFileSync(candidates[0], output);
    fs.chmodSync(output, 0o755);
    fs.writeFileSync(path.join(outputDir, 'VERSION.json'), JSON.stringify({ version: VERSION, asset: ASSET, sha256: SHA256, source: URL }, null, 2) + '\n');
    console.log(`Prepared embedded Cua Driver ${VERSION} for Allternit Desktop.`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
