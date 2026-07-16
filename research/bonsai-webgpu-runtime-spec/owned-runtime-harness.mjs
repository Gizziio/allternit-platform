import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const PROFILE_DIR = join(PROJECT_ROOT, '.tmp-owned-runtime-profile');
const DISK_FREE_FALL_LIMIT_BYTES = 8_000_000_000;
const POLL_INTERVAL_MS = 5_000;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function freeSpaceBytes() {
  try {
    const out = execFileSync('df', ['-b', '/Users/macbook'], { encoding: 'utf8' });
    const cols = out.trim().split('\n').pop().trim().split(/\s+/);
    return Number(cols[3]) * 512;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

async function startStaticServer(root, port = 0) {
  const server = createServer((req, res) => {
    const target = join(root, new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const stream = createReadStream(target);
    stream.on('error', () => res.writeHead(404).end('Not found'));
    stream.pipe(res);
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function bundleEntry(outDir) {
  const { build } = await import('esbuild');
  await build({
    entryPoints: [join(__dirname, 'owned-runtime-entry.ts')],
    bundle: true,
    outfile: join(outDir, 'owned-runtime-bundle.js'),
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    sourcemap: false,
  });
  await writeFile(join(outDir, 'index.html'), `<!doctype html>
<html>
<head><meta charset="utf-8"><title>owned runtime harness</title></head>
<body>
<script src="/owned-runtime-bundle.js"></script>
</body>
</html>`);
}

async function run() {
  log('Starting owned WebGPU runtime 512px harness');
  const baselineFree = await freeSpaceBytes();
  log(`Baseline filesystem free space: ${Math.round(baselineFree / 1e9)} GiB`);

  const tempDir = join(PROJECT_ROOT, '.tmp-owned-runtime-' + Date.now());
  await mkdir(tempDir, { recursive: true });
  await bundleEntry(tempDir);

  let context;
  let server;
  let stopDiskMonitor;
  let aborted = false;
  let success = false;

  try {
    const serverResult = await startStaticServer(tempDir);
    server = serverResult.server;
    const url = serverResult.url;
    log(`Static server listening at ${url}`);

    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      viewport: { width: 1, height: 1 },
      args: [
        '--use-angle=metal',
        '--enable-unsafe-webgpu',
        '--enable-features=WebGPU',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-position=-10000,-10000',
        '--window-size=1,1',
      ],
    });
    const page = context.pages()[0] ?? await context.newPage();
    page.on('console', msg => log(`[browser] ${msg.text()}`));
    page.on('pageerror', err => log(`[browser error] ${err.message}`));
    page.on('crash', () => log('[browser] page crashed'));
    page.on('close', () => log('[browser] page closed'));
    context.on('close', () => log('[browser] context closed'));
    await page.goto(url + '/index.html');

    stopDiskMonitor = monitorDisk(baselineFree, async () => {
      aborted = true;
      log('Closing browser due to disk guard');
      await context?.close().catch(() => {});
    });

    await page.waitForFunction(() => window.__ownedResult !== undefined, undefined, { timeout: 60 * 60 * 1000 });
    const result = await page.evaluate(() => window.__ownedResult);

    stopDiskMonitor();

    if (!result.ok) {
      console.error("Owned runtime returned failure:", JSON.stringify(result, null, 2));
      throw new Error(`Owned runtime generation failed: ${result.error}`);
    }

    const pngByteLength = result.pngByteLength ?? result.bytes?.length;
    const pngHash = result.pngSha256 ?? createHash('sha256').update(Buffer.from(result.bytes)).digest('hex');
    const summary = {
      timestamp: new Date().toISOString(),
      prompt: 'a red cube',
      width: 512,
      height: 512,
      seed: 42,
      numInferenceSteps: 4,
      durationMs: result.durationMs,
      pngByteLength,
      pngSha256: pngHash,
      baselineFreeBytes: baselineFree,
      finalFreeBytes: await freeSpaceBytes(),
      aborted,
    };

    const capturePath = join(__dirname, 'owned-runtime-result.json');
    await writeFile(capturePath, JSON.stringify(summary, null, 2));
    log(`Result written to ${capturePath}`);
    log(JSON.stringify(summary, null, 2));
    success = true;
  } finally {
    stopDiskMonitor?.();
    await context?.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
    if (success) {
      await rm(PROFILE_DIR, { recursive: true, force: true });
      log('Cleaned temporary profile, server directory, and browser cache');
    } else {
      log(`Left browser profile at ${PROFILE_DIR} for possible resume; delete manually when done`);
    }
  }
}

function monitorDisk(baselineFree, onAbort) {
  let running = true;
  const loop = async () => {
    while (running) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      if (!running) break;
      const free = await freeSpaceBytes();
      const fall = baselineFree - free;
      log(`Disk monitor: free space fell ${Math.round(fall / 1e6)}MB`);
      if (fall >= DISK_FREE_FALL_LIMIT_BYTES) {
        log(`ABORT: filesystem free space fell by ${Math.round(fall / 1e9)} GiB; closing browser`);
        running = false;
        await onAbort();
        break;
      }
    }
  };
  const promise = loop();
  return () => {
    running = false;
    return promise;
  };
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
