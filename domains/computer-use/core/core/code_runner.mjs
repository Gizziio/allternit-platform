#!/usr/bin/env node
// Sandboxed code-mode runner (spec: code-mode-execution, C1).
//
// This process is TRUSTED HARNESS. The grant-bound payload never gets Node's
// real module system, process object, or filesystem — it runs inside a
// `node:vm` context whose entire surface is the scoped handles built here:
//
//   * `page`   — browser bridge. Every op is target-checked against the
//                descriptor's declared targets (fail-closed) and emitted as a
//                `__ACI_OP__` line for the parent to execute against the
//                sidecar-driven browser. With no bridge the parent answers
//                with an explicit "no bridge" error — never silent success.
//   * `sandboxFs` — filesystem handle rooted at the run sandbox dir; any
//                path that resolves outside it throws (escape refusal).
//   * `process.env` — ONLY the sandbox_env allowlisted keys the parent chose
//                to pass through. That is the entire credential surface.
//   * `fetch`  — declared-target-checked wrapper around Node's fetch.
//                Everything else (raw http/net/dgram/WebSocket/Worker) is
//                simply absent from the context.
//
// The payload CANNOT: require() modules, spawn processes, read its own spec,
// touch host paths, reach undeclared hosts, or invoke the code-mode grant
// surface again (nested code mode). Parent-side hard caps (wall clock, kill)
// are defense in depth behind the self-timeout here.
//
// Wire protocol (stdout lines; parent owns stdin responses):
//   __ACI_STDOUT__ <json array of console args>
//   __ACI_OP__     {"id":N,"op":"goto","args":[...]}   → parent replies
//   __ACI_OP_RESP__ {"id":N,"ok":bool,"result":..}      (read from stdin)
//   __ACI_RESULT__  {final envelope}

import { readFileSync } from 'node:fs';
import { writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import readline from 'node:readline';

const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: code_runner.mjs <spec.json>');
  process.exit(64);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const {
  code = '',
  sandboxDir,
  declaredTargets = [],
  timeoutMs = 30000,
  sandboxEnvKeys = [],
} = spec;

const sandboxRoot = path.resolve(sandboxDir);
const startMs = Date.now();
let stdoutLines = [];
let nextOpId = 1;
const pendingOps = new Map();

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('__ACI_OP_RESP__ ')) return;
  try {
    const msg = JSON.parse(trimmed.slice('__ACI_OP_RESP__ '.length));
    const pending = pendingOps.get(msg.id);
    if (pending) {
      pendingOps.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        const err = new Error(msg.error || 'page op failed');
        err.refused = msg.refused === true;
        pending.reject(err);
      }
    }
  } catch { /* malformed parent response: leave the op pending until timeout */ }
});

function emit(line) {
  process.stdout.write(line + '\n');
}

function logArgs(args) {
  const rendered = args.map((a) => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  });
  stdoutLines.push(rendered.join(' '));
  emit('__ACI_STDOUT__ ' + JSON.stringify([rendered.join(' ')]));
}

function targetHost(raw) {
  let t = String(raw || '').trim();
  if (!t) return '';
  t = t.replace(/^https?:\/\//, '');
  t = t.split('/')[0].split(':')[0].replace(/\.$/, '');
  return t.toLowerCase();
}

const declaredHosts = declaredTargets.map(targetHost).filter(Boolean);

function assertDeclaredTarget(raw, what) {
  const host = targetHost(raw);
  if (!host) throw new Error(`${what}: target has no host`);
  const covered = declaredHosts.some(
    (d) => d === host || (d.startsWith('*') && host.endsWith(d.slice(1))),
  );
  if (!covered) {
    throw new Error(
      `${what}: ${host} is outside the declared task targets [${declaredHosts.join(', ')}]`,
    );
  }
  return host;
}

// Browser bridge: ops leave the sandbox only after the declared-target check.
function pageOp(op, args) {
  if (spec.hasBridge === false) {
    // The parent declared no browser bridge: refuse immediately and honestly
    // instead of waiting out the op timeout.
    const err = new Error(`no browser bridge available for page op ${op}`);
    err.refused = true;
    return Promise.reject(err);
  }
  const id = nextOpId++;
  return new Promise((resolve, reject) => {
    pendingOps.set(id, { resolve, reject });
    emit('__ACI_OP__ ' + JSON.stringify({ id, op, args }));
    setTimeout(() => {
      if (pendingOps.delete(id)) {
        reject(new Error(`page op ${op} timed out waiting for the browser bridge`));
      }
    }, timeoutMs);
  });
}

function makePage() {
  return {
    goto: async (url, opts) => {
      assertDeclaredTarget(url, 'page.goto');
      return pageOp('goto', [String(url), opts ?? null]);
    },
    click: (sel) => pageOp('click', [String(sel)]),
    fill: (sel, text) => pageOp('fill', [String(sel), String(text)]),
    type: (sel, text) => pageOp('type', [String(sel), String(text)]),
    press: (key) => pageOp('press', [String(key)]),
    hover: (sel) => pageOp('hover', [String(sel)]),
    selectOption: (sel, val) => pageOp('selectOption', [String(sel), String(val)]),
    scrollTo: (sel) => pageOp('scrollTo', [String(sel)]),
    screenshot: (opts) => pageOp('screenshot', [opts ?? null]),
    textContent: (sel) => pageOp('textContent', [String(sel)]),
    url: () => pageOp('url', []),
  };
}

// Filesystem handle rooted at the run sandbox dir.
function insideSandbox(p) {
  const resolved = path.resolve(sandboxRoot, p);
  if (resolved !== sandboxRoot && !resolved.startsWith(sandboxRoot + path.sep)) {
    throw new Error(`sandboxFs: path ${JSON.stringify(p)} escapes the run sandbox dir`);
  }
  return resolved;
}

const sandboxFs = {
  readFile: (p) => readFile(insideSandbox(p), 'utf8'),
  writeFile: async (p, data) => {
    const target = insideSandbox(p);
    await mkdir(path.dirname(target), { recursive: true });
    return writeFile(target, String(data), 'utf8');
  },
  readdir: (p = '.') => readdir(insideSandbox(p)),
};

// The ONLY credential surface: allowlisted sandbox_env keys.
const scopedEnv = {};
for (const key of sandboxEnvKeys) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && process.env[key] !== undefined) {
    scopedEnv[key] = process.env[key];
  }
}

async function checkedFetch(url, opts) {
  assertDeclaredTarget(url, 'fetch');
  return fetch(url, opts);
}

const harnessConsole = {
  log: (...a) => logArgs(a),
  info: (...a) => logArgs(a),
  warn: (...a) => logArgs(a.map((x) => `warn: ${x}`)),
  error: (...a) => logArgs(a.map((x) => `error: ${x}`)),
};

const context = vm.createContext({
  console: harnessConsole,
  page: makePage(),
  sandboxFs,
  process: { env: scopedEnv },
  fetch: checkedFetch,
  setTimeout,
  clearTimeout,
  URL,
  JSON,
  Math,
  Date,
  Promise,
  Error,
  RegExp,
  Map,
  Set,
  Array,
  Object,
  String,
  Number,
  Boolean,
});

function finish(envelope) {
  envelope.wallClockMs = Date.now() - startMs;
  emit('__ACI_RESULT__ ' + JSON.stringify(envelope));
  // The parent owns teardown; give stdout a beat to flush.
  setTimeout(() => process.exit(0), 25).unref();
  process.exit(0);
}

const wrapped = `(async () => {\n${code}\n})()`;
const script = new vm.Script(wrapped, { filename: 'code-payload.js' });

const timer = setTimeout(() => {
  finish({ stdout: stdoutLines, exitStatus: null, timedOut: true, error: `wall clock cap ${timeoutMs}ms exceeded` });
}, timeoutMs);
timer.unref?.();

(async () => {
  try {
    await script.runInContext(context, { timeout: timeoutMs });
    clearTimeout(timer);
    finish({ stdout: stdoutLines, exitStatus: 0, timedOut: false });
  } catch (err) {
    clearTimeout(timer);
    const message = err && err.message ? err.message : String(err);
    if (err && (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || /timed out/.test(message))) {
      finish({ stdout: stdoutLines, exitStatus: null, timedOut: true, error: `wall clock cap ${timeoutMs}ms exceeded` });
      return;
    }
    const refused = err.refused === true ||
      /outside the declared task targets|escapes the run sandbox|no browser bridge/.test(message);
    finish({
      stdout: stdoutLines,
      exitStatus: refused ? 13 : 1,
      timedOut: false,
      refused,
      error: message,
    });
  }
})();
