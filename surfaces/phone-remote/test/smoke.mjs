#!/usr/bin/env node
// smoke.mjs — live end-to-end smoke on loopback: real server, real capture,
// input helper in dry-run (echoes, posts no events). Reports measured fps and
// JPEG sizes; validates JPEG magic bytes and the input path response.
// Run: node test/smoke.mjs [seconds]
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const DUR = Number(process.argv[2] || 6);
const PORT = 8481;
const TOKEN = 'smoke-token';

const server = spawn('node', [join(HERE, '..', 'server', 'index.mjs'),
  '--port', String(PORT), '--bind', '127.0.0.1', '--token', TOKEN,
  '--fps', '10', '--input-dry-run'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

try {
  await new Promise((r) => setTimeout(r, 1500));

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?t=${TOKEN}`, ['pr1']);
  ws.binaryType = 'arraybuffer';

  const messages = [];
  const frames = [];
  let firstFrameAt = null;
  const t0 = performance.now();

  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      messages.push(JSON.parse(ev.data));
    } else {
      if (firstFrameAt === null) firstFrameAt = performance.now() - t0;
      frames.push(new Uint8Array(ev.data));
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  // send a dry-run input event once we know the image size
  let sentInput = false;
  const start = performance.now();
  await new Promise((resolve) => {
    const iv = setInterval(() => {
      if (!sentInput && frames.length) {
        sentInput = true;
        ws.send(JSON.stringify({ type: 'view', imgW: 960, imgH: 540 }));
        ws.send(JSON.stringify({ type: 'input', ev: { type: 'click', x: 480, y: 270 } }));
      }
      if (performance.now() - start > DUR * 1000) { clearInterval(iv); resolve(); }
    }, 100);
  });
  ws.close();
  await new Promise((r) => setTimeout(r, 300));

  const elapsed = (performance.now() - start) / 1000;
  const sizes = frames.map((f) => f.length);
  const allJpeg = frames.every((f) => f[0] === 0xff && f[1] === 0xd8);
  const hello = messages.find((m) => m.type === 'hello');
  const display = messages.find((m) => m.type === 'display');
  const inputErr = messages.find((m) => m.type === 'input-error');

  assert.ok(hello, 'hello received');
  assert.ok(frames.length > 0, 'frames received');
  assert.ok(allJpeg, 'all frames are JPEG (FFD8)');
  assert.ok(!inputErr, `no input-error (got: ${inputErr?.error ?? 'none'})`);

  console.log(`hello: ${JSON.stringify(hello)}`);
  if (display) console.log(`display: ${JSON.stringify(display)}`);
  console.log(`frames=${frames.length} in ${elapsed.toFixed(1)}s → ${(frames.length / elapsed).toFixed(1)} fps over loopback WS`);
  console.log(`first_frame_latency=${Math.round(firstFrameAt)}ms (includes stream startup)`);
  console.log(`jpeg_bytes min=${Math.min(...sizes)} avg=${Math.round(sizes.reduce((a, b) => a + b) / sizes.length)} max=${Math.max(...sizes)}`);
  console.log('SMOKE PASS');
} finally {
  server.kill('SIGTERM');
  console.log('--- server log ---');
  console.log(serverLog.trim());
}
