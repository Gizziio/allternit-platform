/**
 * mirofish-server-runs — server-side simulation execution + persisted run
 * store for the model-proxy sidecar.
 *
 * Requires Bun (the engine is TypeScript with `@/` tsconfig paths; Bun
 * resolves both natively and auto-loads .env.local). Under plain Node the
 * sidecar still serves /v1 model routing — these routes just report 501.
 *
 * Runs are persisted one-JSON-per-run under ~/.allternit/mirofish-runs/,
 * always scoped by userId (multi-tenant by default: the platform rule).
 * Closing the browser tab does not kill a run — progress streams over SSE
 * and the finished world is fetchable afterwards.
 */

import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RUNS_DIR = path.join(os.homedir(), '.allternit/mirofish-runs');
const IS_BUN = typeof globalThis.Bun !== 'undefined';
const MAX_LISTED_RUNS = 20;

const log = (...args) => process.stderr.write(`[mirofish-runs] ${args.join(' ')}\n`);

/** In-memory state for currently-executing runs. */
const active = new Map(); // id → { controller, listeners:Set<fn>, record }

let runtimePromise = null;
function loadRuntime() {
  // The plugin module is the same entry the browser uses — one code path.
  runtimePromise ??= import('../src/plugins/built-in/mirofish/plugin.ts');
  return runtimePromise;
}

function runPath(id) {
  // ids are generated here (run-<ts>-<rand>) — keep the guard anyway.
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`invalid run id: ${id}`);
  return path.join(RUNS_DIR, `${id}.json`);
}

async function persist(record) {
  await mkdir(RUNS_DIR, { recursive: true });
  const target = runPath(record.id);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(record));
  await rename(tmp, target);
}

async function readRun(id) {
  const inMemory = active.get(id);
  if (inMemory) return inMemory.record;
  try {
    return JSON.parse(await readFile(runPath(id), 'utf8'));
  } catch {
    return null;
  }
}

function notify(id, event) {
  const entry = active.get(id);
  if (!entry) return;
  for (const listener of entry.listeners) listener(event);
}

async function executeRun(record, options) {
  const entry = active.get(record.id);
  try {
    const runtime = await loadRuntime();
    const result = await runtime.runMiroFishFromPrompt(record.prompt, {
      modelId: options.modelId,
      overrides: options.overrides,
      signal: entry.controller.signal,
      onProgress: (progress) => {
        record.progress = progress;
        notify(record.id, { type: 'progress', progress });
      },
    });
    record.status = 'done';
    record.world = result.world;
    record.resolved = result.resolved;
    record.finishedAt = Date.now();
    notify(record.id, { type: 'done' });
  } catch (error) {
    const aborted = entry.controller.signal.aborted;
    record.status = aborted ? 'cancelled' : 'error';
    record.error = aborted ? 'cancelled' : String(error?.message ?? error);
    record.finishedAt = Date.now();
    notify(record.id, { type: record.status === 'cancelled' ? 'cancelled' : 'error', error: record.error });
    if (!aborted) log(`run ${record.id} failed:`, record.error);
  } finally {
    delete record.progress;
    await persist(record).catch((e) => log('persist failed:', String(e)));
    active.delete(record.id);
  }
}

function summarize(record) {
  return {
    id: record.id,
    userId: record.userId,
    status: record.status,
    createdAt: record.createdAt,
    finishedAt: record.finishedAt ?? null,
    seedPreview: (record.world?.seed.text ?? record.prompt).slice(0, 80),
    personas: record.world?.personas.length ?? null,
    rounds: record.world?.currentRound ?? null,
    error: record.error ?? null,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function userIdFrom(req) {
  // Dev-tier tenancy: honor the header when the shell sends one. The rule
  // stands regardless of auth maturity — every record and every query is
  // user-scoped so the DB-backed version inherits correct semantics.
  const raw = req.headers['x-allternit-user'];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value && /^[\w.@-]{1,64}$/.test(value) ? value : 'local-dev';
}

/**
 * Route handler. Returns true when the request was handled.
 * Mounted by model-proxy.mjs for any path under /mirofish/.
 */
export async function handleMiroFishRoute(req, res, url, cors) {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(body));
  };

  if (!url.pathname.startsWith('/mirofish/')) return false;

  if (!IS_BUN) {
    send(501, { error: 'server-side runs need the sidecar running under bun: `bun scripts/model-proxy.mjs`' });
    return true;
  }

  const userId = userIdFrom(req);
  const parts = url.pathname.split('/').filter(Boolean); // ['mirofish','runs',id?,'events'?]

  // POST /mirofish/runs
  if (req.method === 'POST' && parts.length === 2 && parts[1] === 'runs') {
    const body = await readJsonBody(req).catch(() => null);
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      send(400, { error: 'prompt (string) is required' });
      return true;
    }
    const id = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id,
      userId,
      status: 'running',
      createdAt: Date.now(),
      prompt: body.prompt.trim(),
      modelId: body.modelId ?? null,
    };
    active.set(id, { controller: new AbortController(), listeners: new Set(), record });
    await persist(record);
    void executeRun(record, { modelId: body.modelId ?? undefined, overrides: body.overrides ?? undefined });
    log(`run ${id} started (user=${userId})`);
    send(202, { id });
    return true;
  }

  // GET /mirofish/runs
  if (req.method === 'GET' && parts.length === 2 && parts[1] === 'runs') {
    let records = [...active.values()].map((e) => e.record);
    try {
      const files = await readdir(RUNS_DIR);
      const seen = new Set(records.map((r) => r.id));
      for (const file of files.filter((f) => f.endsWith('.json'))) {
        const id = file.slice(0, -5);
        if (seen.has(id)) continue;
        const record = await readRun(id);
        if (record) records.push(record);
      }
    } catch {
      /* no runs dir yet */
    }
    records = records
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_LISTED_RUNS);
    send(200, { runs: records.map(summarize) });
    return true;
  }

  // Routes with an id
  if (parts.length >= 3 && parts[1] === 'runs') {
    const id = parts[2];
    const record = await readRun(id);
    if (!record || record.userId !== userId) {
      send(404, { error: 'run not found' });
      return true;
    }

    // GET /mirofish/runs/:id/events — SSE progress until terminal state.
    if (req.method === 'GET' && parts[3] === 'events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        ...cors,
      });
      const write = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (record.progress) write({ type: 'progress', progress: record.progress });
      if (record.status !== 'running') {
        write({ type: record.status === 'done' ? 'done' : record.status, error: record.error ?? undefined });
        res.end();
        return true;
      }
      const entry = active.get(id);
      const listener = (event) => {
        write(event);
        if (event.type !== 'progress') res.end();
      };
      entry?.listeners.add(listener);
      req.on('close', () => entry?.listeners.delete(listener));
      return true;
    }

    // GET /mirofish/runs/:id — full record (world included when finished).
    if (req.method === 'GET' && parts.length === 3) {
      send(200, record);
      return true;
    }

    // DELETE /mirofish/runs/:id — cancel a running run.
    if (req.method === 'DELETE' && parts.length === 3) {
      const entry = active.get(id);
      if (entry) entry.controller.abort();
      send(202, { id, status: entry ? 'cancelling' : record.status });
      return true;
    }
  }

  send(404, { error: `no mirofish route for ${req.method} ${url.pathname}` });
  return true;
}
