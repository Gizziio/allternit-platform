#!/usr/bin/env node
// Benchmark a length-prefixed JPEG frame stream (sc_capture): fps, size, first-frame latency.
// Usage: node test/bench-capture.mjs [--dur SECONDS] -- <command...>
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const durIdx = argv.indexOf('--dur');
const dur = durIdx >= 0 ? Number(argv[durIdx + 1]) : 5;
const cmd = sep >= 0 ? argv.slice(sep + 1) : argv.filter((a, i) => a !== '--dur' && (durIdx < 0 || i !== durIdx + 1));

const child = spawn(cmd[0], cmd.slice(1));
const start = performance.now();
let buf = Buffer.alloc(0);
let frames = 0;
let firstAt = null;
let min = Infinity, max = 0, total = 0;
let stderr = '';

child.stderr.on('data', (d) => { stderr += d; });
child.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    if (buf.length < 4) break;
    const n = buf.readUInt32BE(0);
    if (buf.length < 4 + n) break;
    if (firstAt === null) firstAt = performance.now() - start;
    frames++;
    total += n;
    if (n < min) min = n;
    if (n > max) max = n;
    buf = buf.subarray(4 + n);
  }
});

setTimeout(() => {
  child.kill('SIGTERM');
  const elapsed = (performance.now() - start) / 1000;
  console.log(`frames=${frames} elapsed=${elapsed.toFixed(2)}s fps=${(frames / elapsed).toFixed(1)}`);
  console.log(`first_frame_latency=${firstAt === null ? 'n/a' : Math.round(firstAt) + 'ms'}`);
  if (frames) console.log(`jpeg_bytes min=${min} avg=${Math.round(total / frames)} max=${max}`);
  console.log(`stderr: ${stderr.trim().slice(0, 600)}`);
  process.exit(0);
}, dur * 1000);
