#!/usr/bin/env node
/**
 * model-proxy — local dev model gateway for ai.allternit.com.
 *
 * Exposes an OpenAI-compatible /v1/chat/completions on 127.0.0.1:8090 and
 * routes each request by its registry model id to a real backend:
 *
 *   kimi/* , kimi-*       → https://api.kimi.com/coding/v1 (kimi-code OAuth;
 *                           token auto-refreshed at auth.kimi.com with
 *                           rotation written back atomically so the kimi CLI
 *                           stays healthy)
 *   anthropic/* , claude* → `claude -p --output-format json` subprocess
 *                           (Claude subscription; concurrency-capped)
 *   anything else         → local Ollama passthrough (127.0.0.1:11434)
 *
 * Credentials live in this process only — the browser never sees them. This
 * is the dev-mode stand-in for the platform's server-side provider adapter;
 * the same routing belongs in allternit-api once its /v1 LLM routes exist.
 *
 * Run: bun scripts/model-proxy.mjs   (PORT=8090 by default)
 *
 * Bun also enables the /mirofish/* server-side simulation routes (the
 * engine is TS with tsconfig paths — see mirofish-server-runs.mjs). Under
 * plain node those routes 501 while /v1 model routing still works.
 */

import { execFile } from 'node:child_process';
import { readFile, writeFile, rename } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { handleMiroFishRoute } from './mirofish-server-runs.mjs';

const PORT = Number(process.env.PORT || 8090);
const KIMI_CRED_PATH = path.join(os.homedir(), '.kimi-code/credentials/kimi-code.json');
const KIMI_BASE = 'https://api.kimi.com/coding/v1';
const KIMI_OAUTH_TOKEN_URL = 'https://auth.kimi.com/api/oauth/token';
const KIMI_CLIENT_ID = '17e5f671-d194-4dfb-9706-5516cb48c098';
/** Verified accepted by the coding endpoint; registry ids map onto it. */
const KIMI_UPSTREAM_MODEL = 'kimi-k2';
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const CLAUDE_CONCURRENCY = 3;
const CLAUDE_TIMEOUT_MS = 150_000;

const log = (...args) => process.stderr.write(`[model-proxy] ${args.join(' ')}\n`);

// ---------------------------------------------------------------------------
// Kimi token management — single-flight refresh, rotation written back.
// ---------------------------------------------------------------------------

let kimiRefreshInFlight = null;

async function readKimiCred() {
  return JSON.parse(await readFile(KIMI_CRED_PATH, 'utf8'));
}

async function refreshKimiToken(cred) {
  const body = new URLSearchParams({
    client_id: KIMI_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: cred.refresh_token,
  });
  const res = await fetch(KIMI_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`kimi token refresh failed: ${res.status} ${await res.text()}`);
  }
  const tok = await res.json();
  const next = {
    ...cred,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || cred.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(tok.expires_in || 900),
    expires_in: tok.expires_in ?? cred.expires_in,
  };
  const tmp = `${KIMI_CRED_PATH}.model-proxy.tmp`;
  await writeFile(tmp, JSON.stringify(next));
  await rename(tmp, KIMI_CRED_PATH);
  log('kimi token refreshed', tok.refresh_token ? '(rotated)' : '');
  return next;
}

async function kimiAccessToken() {
  let cred = await readKimiCred();
  const now = Math.floor(Date.now() / 1000);
  if (cred.expires_at - 60 <= now) {
    kimiRefreshInFlight ??= refreshKimiToken(cred).finally(() => {
      kimiRefreshInFlight = null;
    });
    cred = await kimiRefreshInFlight;
  }
  return cred.access_token;
}

async function handleKimi(body) {
  const token = await kimiAccessToken();
  const upstreamBody = { ...body, model: KIMI_UPSTREAM_MODEL };
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(upstreamBody),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// ---------------------------------------------------------------------------
// Claude subprocess backend — bounded concurrency queue.
// ---------------------------------------------------------------------------

let claudeActive = 0;
const claudeQueue = [];

function claudeSlot() {
  if (claudeActive < CLAUDE_CONCURRENCY) {
    claudeActive += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => claudeQueue.push(resolve));
}

function releaseClaudeSlot() {
  const next = claudeQueue.shift();
  if (next) next();
  else claudeActive -= 1;
}

function claudeModelAlias(modelId) {
  const id = modelId.toLowerCase();
  if (id.includes('haiku')) return 'haiku';
  if (id.includes('opus')) return 'opus';
  return 'sonnet';
}

function messagesToPrompt(messages) {
  return (messages ?? [])
    .map((m) => {
      const content = Array.isArray(m.content)
        ? m.content.map((part) => (typeof part === 'string' ? part : part.text ?? '')).join('\n')
        : String(m.content ?? '');
      if (m.role === 'system') return `System instructions:\n${content}`;
      if (m.role === 'assistant') return `Assistant (you) previously said:\n${content}`;
      return content;
    })
    .join('\n\n');
}

function runClaude(prompt, alias) {
  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      ['-p', prompt, '--output-format', 'json', '--model', alias],
      { timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(new Error(`claude subprocess failed: ${error.message}`));
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.is_error) return reject(new Error(`claude returned error: ${parsed.result}`));
          resolve(parsed.result ?? '');
        } catch {
          reject(new Error(`claude output unparseable: ${stdout.slice(0, 200)}`));
        }
      }
    );
  });
}

async function handleClaude(body) {
  await claudeSlot();
  try {
    const text = await runClaude(messagesToPrompt(body.messages), claudeModelAlias(body.model));
    return {
      status: 200,
      body: JSON.stringify({
        id: `mp-${Date.now().toString(36)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    };
  } finally {
    releaseClaudeSlot();
  }
}

// ---------------------------------------------------------------------------
// Ollama passthrough.
// ---------------------------------------------------------------------------

async function handleOllama(body) {
  const upstream = { ...body, model: body.model.replace(/^ollama\//, '') };
  const res = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(upstream),
  });
  return { status: res.status, body: await res.text() };
}

// ---------------------------------------------------------------------------
// HTTP server.
// ---------------------------------------------------------------------------

function pickBackend(modelId) {
  const id = String(modelId || '').toLowerCase();
  if (id.startsWith('kimi/') || id.startsWith('kimi-') || id.startsWith('moonshotai/')) return handleKimi;
  if (id.startsWith('anthropic/') || id.startsWith('claude')) return handleClaude;
  return handleOllama;
}

function corsHeaders(req) {
  const origin = req.headers.origin ?? '';
  const allowed = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ? origin : '';
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '43200',
  };
}

const server = http.createServer(async (req, res) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname.startsWith('/mirofish/')) {
    try {
      if (await handleMiroFishRoute(req, res, url, cors)) return;
    } catch (error) {
      log('mirofish route error:', String(error));
      res.writeHead(500, { 'Content-Type': 'application/json', ...cors });
      return res.end(JSON.stringify({ error: String(error) }));
    }
  }

  if (req.method === 'GET' && url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    return res.end(
      JSON.stringify({
        object: 'list',
        data: [
          { id: 'kimi/kimi-for-coding', object: 'model', owned_by: 'kimi' },
          { id: 'anthropic/claude', object: 'model', owned_by: 'anthropic' },
        ],
      })
    );
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      const started = Date.now();
      try {
        const body = JSON.parse(raw);
        const backend = pickBackend(body.model);
        const result = await backend(body);
        log(`${body.model} → ${backend.name} ${result.status} in ${Date.now() - started}ms`);
        res.writeHead(result.status, { 'Content-Type': 'application/json', ...cors });
        res.end(result.body);
      } catch (error) {
        log('error:', String(error));
        res.writeHead(502, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ error: { message: String(error), type: 'model_proxy_error' } }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json', ...cors });
  res.end(JSON.stringify({ error: { message: `no route for ${req.method} ${url.pathname}` } }));
});

server.listen(PORT, '127.0.0.1', () => log(`listening on http://127.0.0.1:${PORT} (kimi + claude + ollama)`));
