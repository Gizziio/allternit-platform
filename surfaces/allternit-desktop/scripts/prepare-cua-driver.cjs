const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const VERSION = '0.20.1-nightly.20260818.32173745999';
const RELEASE = `https://github.com/trycua/cua/releases/download/nightly-cua-driver-rs-v${VERSION}`;
const outputRoot = path.resolve(__dirname, '..', 'resources', 'computer-use');

const ASSETS = {
  darwin: {
    asset: `cua-driver-rs-${VERSION}-darwin-universal-binary.tar.gz`,
    sha256: 'f57e7192da3c818b2cf9e30bacc2c32a9a254387e43612e9dc021debbc17ef93',
    binary: 'cua-driver',
  },
  linux: {
    asset: `cua-driver-rs-${VERSION}-linux-x86_64-binary.tar.gz`,
    sha256: 'a1b178a53fc407215583384ffa28de9132794e1f96d7eb3f7f20048f53ab5c53',
    binary: 'cua-driver',
  },
  win32: {
    asset: `cua-driver-rs-${VERSION}-windows-x86_64-binary.zip`,
    sha256: '4770c35556335f9a930b624a9dd3ba31486867d570e08b01ffbea6ba79260d65',
    binary: 'cua-driver.exe',
  },
};

function packTargets() {
  const requested = process.env.ALLTERNIT_PACK_OS;
  if (requested) {
    if (!ASSETS[requested]) {
      throw new Error(`Unsupported ALLTERNIT_PACK_OS=${requested} (expected darwin, linux, or win32)`);
    }
    return [requested];
  }
  if (process.env.ALLTERNIT_PACK_ALL === '1' || process.platform === 'darwin') {
    return ['darwin', 'linux', 'win32'];
  }
  if (!ASSETS[process.platform]) {
    console.log(`Cua Driver bundle preparation skipped: no asset for ${process.platform}.`);
    return [];
  }
  return [process.platform];
}

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

function extractArchive(archive, tempDir) {
  if (archive.endsWith('.zip')) {
    const unzip = spawnSync('unzip', ['-o', archive, '-d', tempDir], { encoding: 'utf8' });
    if (unzip.status === 0) return;
    const tar = spawnSync('tar', ['-xf', archive, '-C', tempDir], { encoding: 'utf8' });
    if (tar.status !== 0) {
      throw new Error(unzip.stderr || tar.stderr || 'Unable to extract Cua Driver zip');
    }
    return;
  }
  const extract = spawnSync('tar', ['-xzf', archive, '-C', tempDir], { encoding: 'utf8' });
  if (extract.status !== 0) throw new Error(extract.stderr || 'Unable to extract Cua Driver');
}

function findBinary(tempDir, binaryName) {
  return fs.readdirSync(tempDir, { recursive: true })
    .map((entry) => path.join(tempDir, entry))
    .find((entry) => path.basename(entry) === binaryName && fs.statSync(entry).isFile());
}

async function prepareTarget(platform) {
  const spec = ASSETS[platform];
  const platformDir = path.join(outputRoot, platform);
  const output = path.join(platformDir, spec.binary);
  fs.mkdirSync(platformDir, { recursive: true });

  const versionPath = path.join(outputRoot, 'VERSION.json');
  if (fs.existsSync(output) && fs.existsSync(versionPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      const recorded = existing.platforms?.[platform]?.sha256 || (platform === 'darwin' ? existing.sha256 : '');
      if (existing.version === VERSION && recorded === spec.sha256) {
        console.log(`Cua Driver ${VERSION} already present for ${platform} at ${output}`);
        return spec;
      }
    } catch {
      /* re-download */
    }
  }

  const url = `${RELEASE}/${spec.asset}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `allternit-cua-driver-${platform}-`));
  const archive = path.join(tempDir, spec.asset);
  try {
    await download(url, archive);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    if (actual !== spec.sha256) {
      throw new Error(`Cua Driver checksum mismatch for ${platform}: expected ${spec.sha256}, got ${actual}`);
    }
    extractArchive(archive, tempDir);
    const candidate = findBinary(tempDir, spec.binary);
    if (!candidate) throw new Error(`Cua Driver binary ${spec.binary} was not present in the ${platform} archive`);
    fs.copyFileSync(candidate, output);
    if (platform !== 'win32') fs.chmodSync(output, 0o755);
    console.log(`Prepared embedded Cua Driver ${VERSION} for ${platform} at ${output}`);
    return spec;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

(async () => {
  const targets = packTargets();
  if (targets.length === 0) return;
  fs.mkdirSync(outputRoot, { recursive: true });
  const prepared = {};
  for (const platform of targets) {
    prepared[platform] = await prepareTarget(platform);
  }
  const darwin = prepared.darwin || ASSETS.darwin;
  fs.writeFileSync(path.join(outputRoot, 'VERSION.json'), JSON.stringify({
    version: VERSION,
    asset: darwin.asset,
    sha256: darwin.sha256,
    source: `${RELEASE}/${darwin.asset}`,
    platforms: Object.fromEntries(
      Object.entries(ASSETS).map(([platform, spec]) => [platform, {
        asset: spec.asset,
        sha256: spec.sha256,
        binary: spec.binary,
        source: `${RELEASE}/${spec.asset}`,
      }])
    ),
  }, null, 2) + '\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
