/**
 * Video recording smoke + unit tests.
 *
 * Unit: staging/artifact path helpers and finalize (move + cleanup) without a
 * browser.
 *
 * Smoke: real headless Chromium via the same binary fallback as
 * site-tools/__tests__/smoke.test.ts (env override → newest cached
 * chromium-* build; the pinned CDN copy may be pulled on this machine).
 *
 * Empirical coverage (the reason this file exists):
 *   1. recordVideo on a context created over chromium.connectOverCDP with
 *      playwright 1.58.2 — verified supported; a .webm lands on disk.
 *   2. recordVideo on a chromium.launch()-created context (control).
 *   3. Full provider path: startRecordedSession → execute/observe drive the
 *      recorded tab through the shared actions.ts primitives →
 *      stopRecordedSession moves the video into the recordings root.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  COMPUTER_USE_PROTOCOL_VERSION,
  type ActionIntent,
} from '@allternit/computer-use-protocol';
import {
  finalizeVideoRecording,
  prepareVideoRecording,
  recordVideoOptions,
  recordingArtifactPath,
  recordingStagingDir,
} from './video-recorder.js';
import { LocalPlaywrightProvider } from './local-provider.js';

const FIXTURE_HTML = '<!doctype html><html><head><title>video fixture</title></head><body><h1>video probe</h1></body></html>';

function resolveChromiumExecutable(): string | null {
  const override = process.env.ALLTERNIT_CHROMIUM_PATH;
  if (override) return existsSync(override) ? override : null;
  const pinned = chromium.executablePath();
  if (existsSync(pinned)) return pinned;
  const cacheRoot = join(process.env.HOME ?? '', 'Library/Caches/ms-playwright');
  try {
    const candidates = readdirSync(cacheRoot)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const entry of candidates) {
      const binary = join(
        cacheRoot,
        entry,
        'chrome-mac-arm64',
        'Google Chrome for Testing.app',
        'Contents/MacOS/Google Chrome for Testing',
      );
      if (existsSync(binary)) return binary;
    }
  } catch {
    // no cache — skip live smokes
  }
  return null;
}

async function waitForDevToolsPort(proc: ChildProcess, timeoutMs = 20_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for DevTools listening line')), timeoutMs);
    let buffered = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      const match = buffered.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited early with code ${code}: ${buffered.slice(-500)}`));
    });
  });
}

describe('video-recorder helpers (unit)', () => {
  it('stages under the recordings root and finalizes to <name>.webm', async () => {
    const root = mkdtempSync(join(tmpdir(), 'allternit-video-unit-'));
    try {
      const start = await prepareVideoRecording(root, 'rec-unit');
      expect(Number.isFinite(start.startedAtEpoch)).toBe(true);
      expect(recordingStagingDir(root, 'rec-unit')).toBe(start.stagingDir);

      const stagedPath = join(start.stagingDir, 'fake.webm');
      writeFileSync(stagedPath, 'webm-bytes');
      const finalized = await finalizeVideoRecording(stagedPath, root, 'rec-unit', start.startedAtEpoch);
      expect(finalized.path).toBe(recordingArtifactPath(root, 'rec-unit'));
      expect(finalized.sizeBytes).toBe('webm-bytes'.length);
      expect(finalized.startedAtEpoch).toBe(start.startedAtEpoch);
      expect(existsSync(finalized.path)).toBe(true);
      expect(existsSync(start.stagingDir)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('recordVideo smoke (headless Chromium)', () => {
  const executable = resolveChromiumExecutable();
  const runLive = executable ? describe : describe.skip;

  let scratch: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'allternit-video-smoke-'));
  });

  afterAll(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  });

  runLive('launched context (control)', () => {
    it('produces a non-empty .webm from a chromium.launch() context', async () => {
      const browser = await chromium.launch({ headless: true, executablePath: executable! });
      try {
        const start = await prepareVideoRecording(scratch, 'rec-launch');
        const context = await browser.newContext(recordVideoOptions(start));
        const page = await context.newPage();
        await page.setContent('<h1>launch control</h1>');
        await page.waitForTimeout(400);
        const video = page.video();
        expect(video).not.toBeNull();
        await context.close();
        const stagedPath = await video!.path();
        const finalized = await finalizeVideoRecording(stagedPath, scratch, 'rec-launch', start.startedAtEpoch);
        expect(finalized.sizeBytes).toBeGreaterThan(0);
        expect(finalized.path).toBe(recordingArtifactPath(scratch, 'rec-launch'));
      } finally {
        await browser.close();
      }
    }, 60_000);
  });

  runLive('CDP-attached provider context', () => {
    let server: Server;
    let fixtureUrl: string;
    let chromeProc: ChildProcess;
    let cdpPort: number;
    let userDataDir: string;

    beforeAll(async () => {
      server = createServer((_req, res) => {
        res.setHeader('content-type', 'text/html');
        res.end(FIXTURE_HTML);
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Fixture server failed to bind');
      fixtureUrl = `http://127.0.0.1:${address.port}/`;

      userDataDir = mkdtempSync(join(tmpdir(), 'allternit-video-udd-'));
      chromeProc = spawn(executable!, [
        '--headless',
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      cdpPort = await waitForDevToolsPort(chromeProc);
    }, 60_000);

    afterAll(async () => {
      try { chromeProc?.kill('SIGKILL'); } catch { /* already exited */ }
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
    });

    it('recordVideo works over connectOverCDP in playwright 1.58.2 (evidence case)', async () => {
      const cdpUrl = `http://127.0.0.1:${cdpPort}`;
      const browser: Browser = await chromium.connectOverCDP(cdpUrl);
      try {
        const start = await prepareVideoRecording(scratch, 'rec-cdp-raw');
        const context = await browser.newContext(recordVideoOptions(start));
        const page = await context.newPage();
        await page.setContent('<h1>cdp case</h1>');
        await page.waitForTimeout(400);
        const video = page.video();
        expect(video).not.toBeNull();
        await context.close();
        const stagedPath = await video!.path();
        const finalized = await finalizeVideoRecording(stagedPath, scratch, 'rec-cdp-raw', start.startedAtEpoch);
        expect(finalized.sizeBytes).toBeGreaterThan(0);
      } finally {
        await browser.close().catch(() => {});
      }
    }, 60_000);

    it('provider startRecordedSession → actions drive the recorded tab → stop moves the .webm', async () => {
      const provider = new LocalPlaywrightProvider();
      const started = await provider.startRecordedSession({
        sessionId: 'session-video',
        cdpUrl: `http://127.0.0.1:${cdpPort}`,
        recordingId: 'rec-provider',
        recordingsRoot: scratch,
      });
      expect(started.binding.sessionId).toBe('session-video');
      expect(Number.isFinite(started.startedAtEpoch)).toBe(true);
      expect(provider.hasRecordedSession('session-video')).toBe(true);
      expect(provider.getRecordedSessionStart('session-video')).toBe(started.startedAtEpoch);

      // Drive the recorded tab through the same primitives site tools use.
      const action: ActionIntent = {
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        actionId: 'act-nav',
        runId: 'run-video',
        sessionId: 'session-video',
        kind: 'navigate',
        input: { url: fixtureUrl },
        reason: 'open fixture',
      };
      const events = await provider.execute(action);
      expect(events.some((event) => event.payload.state === 'committed')).toBe(true);

      const observation = await provider.observe('session-video');
      expect(observation.url).toBe(fixtureUrl);

      const video = await provider.stopRecordedSession('session-video');
      expect(video).not.toBeNull();
      expect(video!.path).toBe(recordingArtifactPath(scratch, 'rec-provider'));
      expect(video!.sizeBytes).toBeGreaterThan(0);
      expect(video!.startedAtEpoch).toBe(started.startedAtEpoch);
      expect(provider.getVideoArtifact('session-video')).toEqual(video);
      expect(provider.hasRecordedSession('session-video')).toBe(false);
    }, 60_000);
  });
});
