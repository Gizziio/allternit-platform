import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'surfaces', 'ai.allternit.com', 'public');
const WORKER_FILENAME = 'bonsai-webgpu-worker.js';
const PROFILE_DIR = join(PROJECT_ROOT, '.tmp-phase-a-profile');
const DISK_FREE_FALL_LIMIT_BYTES = 8_000_000_000;
const POLL_INTERVAL_MS = 5_000;

function log(message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);
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

async function run() {
  log('Starting Phase A 512px evidence harness');
  const baselineFree = await freeSpaceBytes();
  log(`Baseline filesystem free space: ${Math.round(baselineFree / 1e9)} GiB`);

  const tempDir = join(PROJECT_ROOT, '.tmp-phase-a-' + Date.now());
  await mkdir(tempDir, { recursive: true });
  const workerSource = await readFile(join(PUBLIC_DIR, WORKER_FILENAME), 'utf8');
  await writeFile(join(tempDir, WORKER_FILENAME), workerSource);
  await writeFile(join(tempDir, 'index.html'), `<!doctype html><html><body><p>Phase A harness</p></body></html>`);

  let browser;
  let context;
  let page;
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
    page = context.pages()[0] ?? await context.newPage();
    page.on('console', msg => log(`[browser] ${msg.text()}`));
    page.on('pageerror', err => log(`[browser error] ${err.message}`));
    page.on('close', () => log('[browser] Page closed unexpectedly'));
    await page.goto(url + '/index.html');

    stopDiskMonitor = monitorDisk(baselineFree, async () => {
      aborted = true;
      log('Closing browser due to disk guard');
      await context?.close().catch(() => {});
    });

    const result = await page.evaluate(async ({ workerUrl }) => {
      const worker = new Worker(workerUrl, { name: 'allternit-bonsai-webgpu' });

      function call(action, payload = {}, timeoutMs = 60 * 60 * 1000) {
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error(`Worker action ${action} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
          let lastLoggedMb = -1;
          const onMessage = event => {
            const message = event.data;
            if (message?.source !== 'allternit-bonsai-webgpu' || message.id !== id) return;
            if (message.progress) {
              const completedMb = Math.round((message.progress.completedBytes ?? 0) / 1e6);
              const totalMb = Math.round((message.progress.totalBytes ?? 0) / 1e6);
              if (completedMb !== lastLoggedMb) {
                lastLoggedMb = completedMb;
                console.log(`Progress: ${message.progress.message} (${completedMb}MB / ${totalMb}MB)`);
              }
              return;
            }
            worker.removeEventListener('message', onMessage);
            clearTimeout(timer);
            if (message.ok) resolve(message.result);
            else reject(new Error(message.error ?? 'Worker action failed'));
          };
          worker.addEventListener('message', onMessage);
          worker.addEventListener('error', error => {
            clearTimeout(timer);
            reject(error);
          }, { once: true });
          worker.postMessage({ source: 'allternit-parent', id, action, ...payload });
        });
      }

      try {
        console.log('Probing runtime...');
        await call('probe-runtime', {});
        console.log('Runtime probe succeeded');

        console.log('Installing model...');
        await call('install', {});
        console.log('Install reported ready');

        const generateStart = Date.now();
        console.log('Generating 512x512 seed-42 "a red cube"...');
        const generateResult = await call('generate', {
          prompt: 'a red cube',
          width: 512,
          height: 512,
          numInferenceSteps: 4,
          seed: 42,
        });
        const durationMs = Date.now() - generateStart;
        console.log(`Generation completed in ${Math.round(durationMs / 1000)}s`);

        const exportResult = await call('export-spec', {});

        const blobBytes = Array.from(new Uint8Array(await generateResult.blob.arrayBuffer()));
        worker.terminate();
        return { blobBytes, durationMs, spec: exportResult.spec };
      } catch (error) {
        worker.terminate();
        throw error;
      }
    }, { workerUrl: '/' + WORKER_FILENAME });

    stopDiskMonitor();

    const pngBuffer = Buffer.from(result.blobBytes);
    const pngHash = createHash('sha256').update(pngBuffer).digest('hex');

    const summary = {
      timestamp: new Date().toISOString(),
      prompt: 'a red cube',
      width: 512,
      height: 512,
      seed: 42,
      numInferenceSteps: 4,
      durationMs: result.durationMs,
      pngByteLength: pngBuffer.length,
      pngSha256: pngHash,
      baselineFreeBytes: baselineFree,
      finalFreeBytes: await freeSpaceBytes(),
      specSummary: {
        shaderCount: result.spec.shaders.length,
        fetchCount: result.spec.fetches.length,
        pipelineCount: result.spec.pipelines.length,
        bindGroupCount: result.spec.bindGroups.length,
        writeCount: result.spec.writes.length,
        dispatchCount: result.spec.dispatches.length,
      },
      aborted,
    };

    const capturePath = join(__dirname, 'phase-a-capture.json');
    await writeFile(capturePath, JSON.stringify({ summary, spec: result.spec }, null, 2));
    log(`Evidence written to ${capturePath}`);
    log(JSON.stringify(summary, null, 2));
    success = true;
  } finally {
    stopDiskMonitor?.();
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
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
