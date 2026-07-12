#!/usr/bin/env node
import crypto from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { installNativeHost } from './native-host-installer.mjs';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(__filename);
const NATIVE_HOST_PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(NATIVE_HOST_PACKAGE_DIR, '..', '..', '..');
const EXTENSION_DIR = resolve(REPO_ROOT, 'surfaces/allternit-extensions/allternit-extension/.output/chrome-mv3-dev');
const MANIFEST_PATH = join(EXTENSION_DIR, 'manifest.json');
const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 3011;

function extensionIdFromManifestKey(key) {
  const hex = crypto.createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32);
  return hex.replace(/[0-9a-f]/g, (char) => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(char, 16)));
}

async function assertExists(path, label) {
  await stat(path).catch(() => {
    throw new Error(`${label} not found at ${path}. Build the extension/native host first.`);
  });
}

async function startBridge() {
  const received = [];
  const server = net.createServer((socket) => {
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;

        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }

        received.push(message);
        if (message.type === 'ping') {
          socket.write(JSON.stringify({ id: message.id, type: 'pong', timestamp: Date.now() }) + '\n');
        } else if (message.type === 'register') {
          socket.write(
            JSON.stringify({
              id: message.id,
              type: 'event',
              payload: { registered: true, smoke: true },
              timestamp: Date.now(),
            }) + '\n',
          );
        }
      }
    });
  });

  await new Promise((resolveListen, rejectListen) => {
    server.listen(BRIDGE_PORT, BRIDGE_HOST, resolveListen).once('error', rejectListen);
  });

  return {
    received,
    close: () =>
      new Promise((resolveClose) => {
        server.close(resolveClose);
      }),
  };
}

async function waitForServiceWorker(context, expectedExtensionId) {
  for (let index = 0; index < 100; index += 1) {
    const worker = context.serviceWorkers().find((candidate) =>
      candidate.url().startsWith(`chrome-extension://${expectedExtensionId}/`),
    );
    if (worker) return worker;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Allternit extension service worker did not start for ${expectedExtensionId}`);
}

async function main() {
  await assertExists(MANIFEST_PATH, 'Development extension manifest');
  await assertExists(join(NATIVE_HOST_PACKAGE_DIR, 'dist', 'native-host'), 'Native host binary');

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  if (!manifest.key) throw new Error('Extension manifest has no stable key; cannot compute deterministic extension id.');
  const extensionId = extensionIdFromManifestKey(manifest.key);
  const profileDir = await mkdtemp(join(tmpdir(), 'allternit-browser-mode-smoke-'));
  const runtimePackageDir = join(profileDir, 'native-host-runtime');
  const runtimeDistDir = join(runtimePackageDir, 'dist');
  await mkdir(runtimeDistDir, { recursive: true });
  await copyFile(join(NATIVE_HOST_PACKAGE_DIR, 'dist', 'native-host'), join(runtimeDistDir, 'native-host'));
  await chmod(join(runtimeDistDir, 'native-host'), 0o755);

  let context;
  const bridge = await startBridge();
  try {
    await installNativeHost({
      allowedOrigins: [`chrome-extension://${extensionId}/`],
      includeDefaultBrowsers: false,
      packageDir: runtimePackageDir,
      profileDirs: [profileDir],
    });

    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`, '--no-first-run'],
    });

    const page = await context.newPage();
    await page.goto('https://example.com/');
    await page.waitForTimeout(1000);

    const worker = await waitForServiceWorker(context, extensionId);
    const contentReady = await page.evaluate(() => document.documentElement.dataset.allternitExtensionReady ?? null);
    const nativePing = await worker.evaluate(
      ({ hostName }) =>
        new Promise((resolvePing) => {
          const id = `ping-${Date.now()}`;
          let port;
          const timeout = setTimeout(() => {
            try {
              port?.disconnect();
            } catch {
              // ignore cleanup errors
            }
            resolvePing({ ok: false, timeout: true, lastError: chrome.runtime.lastError?.message });
          }, 8000);

          try {
            port = chrome.runtime.connectNative(hostName);
            port.onMessage.addListener((message) => {
              if (message?.id !== id) return;
              clearTimeout(timeout);
              try {
                port.disconnect();
              } catch {
                // ignore cleanup errors
              }
              resolvePing({ ok: message.type === 'pong', message });
            });
            port.onDisconnect.addListener(() => {
              const error = chrome.runtime.lastError?.message;
              if (error) {
                clearTimeout(timeout);
                resolvePing({ ok: false, disconnected: true, error });
              }
            });
            port.postMessage({ id, type: 'ping', timestamp: Date.now() });
          } catch (error) {
            clearTimeout(timeout);
            resolvePing({ ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        }),
      { hostName: 'com.allternit.desktop' },
    );

    const result = {
      ok: Boolean(nativePing.ok && contentReady === extensionId),
      extensionId,
      serviceWorker: worker.url(),
      contentReady,
      nativePing,
      bridgeMessages: bridge.received.map((message) => message.type),
    };

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    if (context) await context.close().catch(() => {});
    await bridge.close().catch(() => {});
    if (!process.env.ALLTERNIT_KEEP_BROWSER_MODE_SMOKE_PROFILE) {
      await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
