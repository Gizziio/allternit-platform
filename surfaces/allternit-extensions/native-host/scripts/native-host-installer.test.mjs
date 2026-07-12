import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createManifest,
  createWrapperScript,
  getNativeMessagingDirs,
  installNativeHost,
  normalizeExtensionOrigin,
  parseAllowedOrigins,
  wrapperPathFor,
} from './native-host-installer.mjs';

const extensionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const extensionOrigin = `chrome-extension://${extensionId}/`;

test('normalizes exact extension ids and rejects wildcard origins', () => {
  assert.equal(normalizeExtensionOrigin(extensionId), extensionOrigin);
  assert.equal(normalizeExtensionOrigin(extensionOrigin), extensionOrigin);
  assert.throws(() => normalizeExtensionOrigin('chrome-extension://*/'), /Invalid extension origin/);
});

test('parses explicit and environment origins without duplicates', () => {
  assert.deepEqual(
    parseAllowedOrigins([extensionId], {
      ALLTERNIT_EXTENSION_IDS: `${extensionId},bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`,
    }),
    [extensionOrigin, 'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/'],
  );
});

test('creates a manifest with a concrete executable path and exact allowed origins', () => {
  const manifest = createManifest({
    wrapperPath: '/tmp/allternit-native-host-wrapper',
    allowedOrigins: [extensionOrigin],
  });

  assert.equal(manifest.name, 'com.allternit.desktop');
  assert.equal(manifest.path, '/tmp/allternit-native-host-wrapper');
  assert.deepEqual(manifest.allowed_origins, [extensionOrigin]);
});

test('creates wrapper scripts under package dist', async () => {
  const packageDir = await mkdtemp(join(tmpdir(), 'allternit-native-host-test-'));
  try {
    const result = await createWrapperScript({
      packageDir,
      targetPlatform: 'darwin',
      command: 'node native-host.js',
    });

    assert.equal(result.wrapperPath, wrapperPathFor(packageDir, 'darwin'));
    assert.match(await readFile(result.wrapperPath, 'utf8'), /exec node native-host\.js/);
  } finally {
    await rm(packageDir, { recursive: true, force: true });
  }
});

test('dry-run install returns all target manifest paths without writing', async () => {
  const home = await mkdtemp(join(tmpdir(), 'allternit-native-host-home-'));
  const packageDir = await mkdtemp(join(tmpdir(), 'allternit-native-host-package-'));
  const profileDir = await mkdtemp(join(tmpdir(), 'allternit-native-host-profile-'));
  try {
    const result = await installNativeHost({
      allowedOrigins: [extensionOrigin],
      packageDir,
      home,
      profileDirs: [profileDir],
      targetPlatform: 'darwin',
      command: 'node native-host.js',
      dryRun: true,
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.manifest.allowed_origins[0], extensionOrigin);
    assert.deepEqual(
      result.writes.map((write) => write.browser),
      [...getNativeMessagingDirs('darwin', home).map(([browser]) => browser), `Browser profile: ${profileDir}`],
    );
    assert.equal(result.writes.at(-1)?.manifestPath, join(profileDir, 'NativeMessagingHosts', 'com.allternit.desktop.json'));
  } finally {
    await rm(home, { recursive: true, force: true });
    await rm(packageDir, { recursive: true, force: true });
    await rm(profileDir, { recursive: true, force: true });
  }
});
