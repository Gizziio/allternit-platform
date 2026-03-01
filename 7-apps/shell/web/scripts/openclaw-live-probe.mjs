#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const map = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      map[key] = val.replace(/^['"]|['"]$/g, '');
    }
    return map;
  } catch {
    return {};
  }
}

function findEnvFile(startDir, explicitPath) {
  if (explicitPath) {
    return resolve(explicitPath);
  }

  let current = resolve(startDir);
  for (;;) {
    const candidate = join(current, '.openclaw.env');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return join(resolve(startDir), '.openclaw.env');
}

function extractText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text;

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        if (typeof item.text === 'string') return item.text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  return '';
}

const cwd = process.cwd();
const envPath = findEnvFile(cwd, getArg('--env'));
const envMap = parseEnvFile(envPath);

const token = getArg('--token') || process.env.OPENCLAW_GATEWAY_TOKEN || envMap.OPENCLAW_GATEWAY_TOKEN;
const port = getArg('--port') || process.env.OPENCLAW_PORT || envMap.OPENCLAW_PORT || '18789';
const url = getArg('--url') || `ws://127.0.0.1:${port}`;
const sessionKey = getArg('--session-key') || 'main';
const prompt = getArg('--prompt') || 'Reply with exactly READY and nothing else.';
const timeoutMs = Number(getArg('--timeout-ms') || process.env.OPENCLAW_LIVE_PROBE_TIMEOUT_MS || 90000);

if (!token) {
  console.error('Missing gateway token. Provide --token or OPENCLAW_GATEWAY_TOKEN/.openclaw.env');
  process.exit(1);
}

let requestSeq = 0;
let runId = null;
let finished = false;
const pending = new Map();

const ws = new WebSocket(url);

function nextId() {
  requestSeq += 1;
  return `live-probe-${requestSeq}`;
}

function fail(message) {
  if (finished) return;
  finished = true;
  console.error(`\n[probe] FAIL: ${message}`);
  try { ws.close(1000, 'done'); } catch {}
  setTimeout(() => process.exit(1), 50);
}

function pass(message) {
  if (finished) return;
  finished = true;
  console.log(`\n[probe] PASS: ${message}`);
  try { ws.close(1000, 'done'); } catch {}
  setTimeout(() => process.exit(0), 50);
}

function request(method, params = {}, methodTimeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout for ${method}`));
    }, methodTimeoutMs);

    pending.set(id, { resolve, reject, timer, method });
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

console.log('[probe] Gateway URL:', url);
console.log('[probe] Session   :', sessionKey);
console.log('[probe] Prompt    :', prompt);

const deadline = setTimeout(() => {
  fail(`timed out after ${timeoutMs}ms`);
}, timeoutMs);

ws.onopen = async () => {
  try {
    const hello = await request('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        version: 'a2r-live-probe',
        platform: 'node',
        mode: 'webchat',
        instanceId: `a2r-live-probe-${Date.now()}`,
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      caps: [],
      auth: { token },
      userAgent: 'a2r-live-probe/1.0.0',
      locale: 'en-US',
    }, 20000);

    console.log('[probe] connect ok:', JSON.stringify({ type: hello?.type, protocol: hello?.protocol }));

    const status = await request('status', {}, 12000);
    console.log('[probe] status ok:', JSON.stringify(status).slice(0, 200));

    const send = await request('chat.send', {
      sessionKey,
      message: prompt,
      deliver: false,
      idempotencyKey: `live-probe-${Date.now()}`,
    }, 25000);

    runId = send?.runId || null;
    console.log('[probe] chat.send ack:', JSON.stringify(send));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
};

ws.onmessage = async (event) => {
  let frame;
  try {
    frame = JSON.parse(String(event.data || ''));
  } catch {
    return;
  }

  if (frame?.type === 'res' && typeof frame.id === 'string') {
    const pendingReq = pending.get(frame.id);
    if (!pendingReq) return;
    pending.delete(frame.id);
    clearTimeout(pendingReq.timer);

    if (frame.ok) pendingReq.resolve(frame.payload);
    else pendingReq.reject(new Error(frame?.error?.message || `${pendingReq.method} failed`));
    return;
  }

  if (frame?.type === 'event' && frame?.event === 'chat') {
    const payload = frame.payload || {};
    if (runId && payload.runId && payload.runId !== runId) return;

    if (payload.state === 'error') {
      fail(`chat error: ${payload.errorMessage || 'unknown'}`);
      return;
    }

    if (payload.state === 'final') {
      try {
        const history = await request('chat.history', { sessionKey, limit: 8 }, 15000);
        const messages = Array.isArray(history?.messages) ? history.messages : [];
        const latestAssistant = [...messages].reverse().find((msg) => msg && msg.role === 'assistant');
        const text = extractText(latestAssistant);
        clearTimeout(deadline);
        pass(`assistant reply captured: ${text || '(empty assistant message)'}`);
      } catch (error) {
        fail(`final event received but history read failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
};

ws.onerror = () => {
  fail('websocket error');
};

ws.onclose = (event) => {
  if (!finished && event.code !== 1000) {
    fail(`socket closed (${event.code}): ${event.reason || 'no reason'}`);
  }
};
