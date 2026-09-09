#!/usr/bin/env node
/**
 * Smoke test for the built Computers MCP server (dist/index.js).
 *
 * Spawns the stdio server as a subprocess, performs the JSON-RPC handshake
 * (initialize → notifications/initialized → tools/list), and asserts the
 * expected 22 tool names are present. No network access: tools/list is
 * served from the static spec.
 *
 * Usage: node scripts/smoke.mjs
 * Exit 0 = PASS, 1 = FAIL.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(here, '../dist/index.js');

const EXPECTED_TOOLS = [
  'computers.create',
  'computers.list',
  'computers.get',
  'computers.start',
  'computers.stop',
  'computers.restart',
  'computers.resize',
  'computers.clone',
  'computers.delete',
  'computers.screenshot',
  'computers.mouse',
  'computers.keyboard',
  'computers.shell',
  'computers.files.upload',
  'computers.files.download',
  'computers.snapshots.list',
  'computers.snapshots.create',
  'computers.snapshots.restore',
  'computers.snapshots.delete',
  'templates.list',
  'templates.import',
  'templates.build',
];

const child = spawn(process.execPath, [serverEntry], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buffer = '';
const pending = new Map();
let nextId = 0;

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  }
});

function send(message) {
  child.stdin.write(JSON.stringify(message) + '\n');
}

function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    send({ jsonrpc: '2.0', id, method, params });
  });
}

function fail(reason) {
  console.error(`FAIL: ${reason}`);
  child.kill('SIGKILL');
  process.exit(1);
}

try {
  const init = await request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'computers-smoke', version: '0.0.1' },
  });
  if (init.error) fail(`initialize error: ${JSON.stringify(init.error)}`);
  if (init.result?.serverInfo?.name !== 'allternit-computers') {
    fail(`unexpected serverInfo: ${JSON.stringify(init.result?.serverInfo)}`);
  }
  console.log(`initialize ok: ${JSON.stringify(init.result.serverInfo)}`);

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const list = await request('tools/list', {});
  if (list.error) fail(`tools/list error: ${JSON.stringify(list.error)}`);
  const names = (list.result?.tools ?? []).map((t) => t.name);
  const missing = EXPECTED_TOOLS.filter((name) => !names.includes(name));
  if (missing.length > 0) fail(`missing tools: ${missing.join(', ')}`);
  if (names.length !== EXPECTED_TOOLS.length) {
    fail(`expected ${EXPECTED_TOOLS.length} tools, got ${names.length}: ${names.join(', ')}`);
  }

  const risky = ['computers.create', 'computers.start', 'computers.stop', 'computers.restart', 'computers.resize', 'computers.clone', 'computers.delete', 'computers.mouse', 'computers.keyboard', 'computers.shell', 'computers.files.upload', 'templates.build'];
  const specByName = new Map((list.result.tools).map((t) => [t.name, t]));
  for (const name of risky) {
    const approval = specByName.get(name)?.inputSchema?.properties?.approvalId;
    if (!approval) fail(`risky tool ${name} lacks approvalId in inputSchema`);
  }

  console.log(`tools/list ok: ${names.length} tools, all expected names present`);
  console.log('risky tools expose optional approvalId: ok');
  console.log('PASS');
  child.kill('SIGKILL');
  process.exit(0);
} catch (error) {
  fail(error.message);
}
