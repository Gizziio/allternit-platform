#!/usr/bin/env node
/**
 * Pre-build guard for the Electron packaging pipeline.
 *
 * Fails fast when the resources that electron-builder copies into the
 * packaged app are missing. This catches the common failure mode where
 * `npm run dist` is invoked before `scripts/build-desktop.sh` has staged
 * the Rust API binary, gizzi-code brain, voice service, and platform static
 * export.
 */

const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const resourcesDir = path.join(desktopDir, 'resources');
const connectorCatalogDir = path.join(repoRoot, 'services', 'open-connector', 'catalog', 'apps');
const connectorNodeModulesDir = path.join(repoRoot, 'services', 'open-connector', 'node_modules');

function log(message) {
  process.stdout.write(`[verify-packaged-resources] ${message}\n`);
}

function errorAndExit(message) {
  process.stderr.write(`[verify-packaged-resources] ✗ ${message}\n`);
  process.exit(1);
}

const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';
const localEngineName = process.platform === 'win32' ? 'allternit-local-engine.exe' : 'allternit-local-engine';
const gizziName = process.platform === 'win32' ? 'gizzi-code.exe' : 'gizzi-code';
const voiceName = process.platform === 'win32' ? 'allternit-voice-service.exe' : 'allternit-voice-service';
const whisperName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';

const required = [
  {
    path: path.join(resourcesDir, 'bin', binaryName),
    label: 'Rust API binary (allternit-api)',
    buildStep: 'scripts/build-desktop.sh (or npm run stage:api-binary)',
  },
  {
    path: path.join(resourcesDir, 'bin', localEngineName),
    label: 'Local engine binary (allternit-local-engine)',
    buildStep: 'scripts/build-desktop.sh (or npm run stage:local-engine)',
  },
  {
    path: path.join(resourcesDir, 'bin', gizziName),
    label: 'Gizzi Code brain binary (gizzi-code)',
    buildStep: 'scripts/build-desktop.sh',
  },
  {
    path: path.join(resourcesDir, 'bin', voiceName),
    label: 'Voice service binary (allternit-voice-service, Rust + whisper.cpp)',
    buildStep: 'scripts/build-desktop.sh',
  },
  {
    path: path.join(resourcesDir, 'bin', whisperName),
    label: 'whisper-cli (local STT engine)',
    buildStep: 'services/voice/build-whisper.sh (via scripts/build-desktop.sh)',
  },
  {
    path: path.join(resourcesDir, 'platform', 'index.html'),
    label: 'Platform static export',
    buildStep: 'npm run prepare:platform-static (or scripts/build-desktop.sh)',
  },
  {
    path: path.join(resourcesDir, 'computer-use', 'acu', 'launch.py'),
    label: 'ACU computer-use gateway (launch.py)',
    buildStep: 'npm run prepare:acu-gateway',
  },
];

let failed = false;

const allowMissingApi = process.env.ALLTERNIT_ALLOW_MISSING_API === '1';
const allowMissingLocalEngine = process.env.ALLTERNIT_ALLOW_MISSING_LOCAL_ENGINE === '1';

for (const item of required) {
  if (fs.existsSync(item.path)) {
    log(`✓ ${item.label}: ${item.path}`);
    continue;
  }
  const isApi = item.path.endsWith(binaryName);
  if (isApi && allowMissingApi) {
    process.stderr.write(
      `[verify-packaged-resources] ⚠ Missing ${item.label} (allowed by ALLTERNIT_ALLOW_MISSING_API=1)\n` +
      `    Expected at: ${item.path}\n` +
      `    Packaged app will fail closed at boot until a native CI/OS build stages this binary.\n`
    );
    continue;
  }
  const isLocalEngine = item.path.endsWith(localEngineName);
  if (isLocalEngine && allowMissingLocalEngine) {
    process.stderr.write(
      `[verify-packaged-resources] ⚠ Missing ${item.label} (allowed by ALLTERNIT_ALLOW_MISSING_LOCAL_ENGINE=1)\n` +
      `    Expected at: ${item.path}\n` +
      `    Model Lab telemetry will show "Unavailable" until a native CI/OS build stages this binary.\n`
    );
    continue;
  }
  failed = true;
  process.stderr.write(
    `[verify-packaged-resources] ✗ Missing ${item.label}\n` +
    `    Expected at: ${item.path}\n` +
    `    Build it with: ${item.buildStep}\n`
  );
}

const catalogFiles = fs.existsSync(connectorCatalogDir)
  ? fs.readdirSync(connectorCatalogDir).filter((name) => name.endsWith('.json'))
  : [];
if (catalogFiles.length === 0) {
  failed = true;
  process.stderr.write(
    `[verify-packaged-resources] ✗ Missing connector sidecar catalog\n` +
    `    Expected JSON files in: ${connectorCatalogDir}\n` +
    `    Build it with: npm run prepare:connector-catalog\n`
  );
} else {
  log(`✓ Connector sidecar catalog: ${catalogFiles.length} providers (${connectorCatalogDir})`);
}

// The voice sidecar must be the Rust binary, not the PyInstaller-packaged
// Python tree that predates the voice-cleanup. Stale copies of the old
// bootloader can survive in resources/bin (copied from an old checkout) —
// it crashes at boot on older macOS (pyexpat built for a newer SDK) and
// Voice Mode silently dies.
function isPyInstallerBootloader(filePath) {
  // One-file PyInstaller bootchains embed these marker strings; the Rust
  // binary never does. Scan the first 64 MB — markers live in the early
  // LOAD segments.
  const handle = fs.openSync(filePath, 'r');
  try {
    const size = Math.min(fs.fstatSync(handle).size, 64 * 1024 * 1024);
    const buf = Buffer.alloc(size);
    fs.readSync(handle, buf, 0, size, 0);
    const text = buf.toString('latin1');
    return text.includes('_MEIPASS') || text.includes('pyi_rth') || text.includes('PyInstaller');
  } finally {
    fs.closeSync(handle);
  }
}

const voicePath = path.join(resourcesDir, 'bin', voiceName);
if (fs.existsSync(voicePath) && isPyInstallerBootloader(voicePath)) {
  failed = true;
  process.stderr.write(
    `[verify-packaged-resources] ✗ ${voicePath} is the PRE-CLEANUP PyInstaller voice binary, not the Rust voice-service.\n` +
    `    It crashes at boot (pyexpat SDK mismatch) and Voice Mode will not start.\n` +
    '    Rebuild it with: cargo build --release -p voice-service && cp target/release/voice-service ' +
    path.join('surfaces', 'allternit-desktop', 'resources', 'bin', voiceName) + '\n'
  );
} else if (fs.existsSync(voicePath)) {
  log(`✓ Voice service binary is not a PyInstaller bootloader (${voicePath})`);
}

// The connector sidecar's runtime deps must actually be installed — they are
// NOT covered by the root pnpm install (open-connector is a standalone npm
// project, excluded from the workspace on purpose).
const honoServerPkg = path.join(connectorNodeModulesDir, '@hono', 'node-server', 'package.json');
if (!fs.existsSync(honoServerPkg)) {
  failed = true;
  process.stderr.write(
    `[verify-packaged-resources] ✗ Connector sidecar dependencies missing (@hono/node-server not resolvable)\n` +
    `    Expected at: ${honoServerPkg}\n` +
    '    Build it with: npm run prepare:connector-sidecar\n'
  );
} else {
  log(`✓ Connector sidecar dependencies installed (${connectorNodeModulesDir})`);
}

if (failed) {
  process.stderr.write(
    '\n[verify-packaged-resources] Packaged resources are incomplete. ' +
    'Run the full staging pipeline first:\n' +
    '    bash scripts/build-desktop.sh\n' +
    'Or, for local development packaging only, see npm run stage:api-binary.\n'
  );
  process.exit(1);
}

log('All packaged resources present.');
