#!/usr/bin/env node
/**
 * Allternit Dev Stack Hot-Reload Watcher
 *
 * Starts the three core local services (API, Gizzi runtime, frontend) and
 * automatically rebuilds + restarts API/Gizzi when their source files change.
 * The frontend Vite server already provides HMR, so this process just keeps
 * it alive and logs its output.
 *
 * Usage:
 *   node scripts/dev-stack-watch.cjs
 *
 * Environment:
 *   ALLTERNIT_API_PORT      - API port (default 8013)
 *   ALLTERNIT_GIZZI_PORT    - Gizzi runtime port (default 4096)
 *   ALLTERNIT_FRONTEND_PORT - Vite dev server port (default 3013)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'cmd', 'allternit-api');
const API_SRC = path.join(API_DIR, 'src');
const GIZZI_DIR = path.join(ROOT, 'cmd', 'gizzi-code');
const GIZZI_SRC = path.join(GIZZI_DIR, 'src');
const FRONTEND_DIR = path.join(ROOT, 'surfaces', 'ai.allternit.com');

const API_PORT = process.env.ALLTERNIT_API_PORT || '8013';
const GIZZI_PORT = process.env.ALLTERNIT_GIZZI_PORT || '4096';
const FRONTEND_PORT = process.env.ALLTERNIT_FRONTEND_PORT || '3013';

const COLORS = {
  api: '\x1b[36m',
  gizzi: '\x1b[35m',
  frontend: '\x1b[34m',
  watcher: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(service, message) {
  const prefix = `${COLORS[service] || ''}[${service.toUpperCase()}]${COLORS.reset}`;
  console.log(`${prefix} ${message}`);
}

function formatLines(service, data) {
  return data
    .toString()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `${COLORS[service] || ''}[${service.toUpperCase()}]${COLORS.reset} ${line}`)
    .join('\n');
}

class ManagedProcess {
  constructor(name, color, cwd, command, args, env = {}, options = {}) {
    this.name = name;
    this.color = color;
    this.cwd = cwd;
    this.command = command;
    this.args = args;
    this.env = { ...process.env, ...env };
    this.process = null;
    this.restarting = false;
    this.startPending = false;
    this.autoRestart = options.autoRestart ?? true;
    this.restartDelayMs = options.restartDelayMs ?? 2000;
    this.maxRestartDelayMs = options.maxRestartDelayMs ?? 30000;
    this.currentRestartDelay = this.restartDelayMs;
    this.restartTimer = null;
  }

  start() {
    if (this.process || this.startPending) return;
    this.startPending = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    log(this.name, `Starting: ${this.command} ${this.args.join(' ')}`);
    this.process = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: 'pipe',
      shell: false,
    });
    this.startPending = false;

    this.process.stdout.on('data', (data) => console.log(formatLines(this.name, data)));
    this.process.stderr.on('data', (data) => console.error(formatLines(this.name, data)));
    this.process.on('exit', (code, signal) => {
      if (!this.restarting) {
        log(this.name, `Exited with code ${code ?? signal ?? 'unknown'}`);
      }
      this.process = null;
      if (this.autoRestart && !this.restarting) {
        this.scheduleRestart();
      }
    });
  }

  scheduleRestart() {
    if (this.restartTimer) return;
    log(this.name, `Auto-restarting in ${this.currentRestartDelay}ms...`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
      // Backoff
      this.currentRestartDelay = Math.min(
        this.currentRestartDelay * 2,
        this.maxRestartDelayMs
      );
    }, this.currentRestartDelay);
  }

  resetBackoff() {
    this.currentRestartDelay = this.restartDelayMs;
  }

  stop() {
    return new Promise((resolve) => {
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
      if (!this.process) {
        resolve();
        return;
      }
      this.restarting = true;
      const pid = this.process.pid;
      this.process.kill('SIGTERM');
      const timeout = setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // already gone
        }
        this.restarting = false;
        resolve();
      }, 3000);
      this.process.on('exit', () => {
        clearTimeout(timeout);
        this.restarting = false;
        resolve();
      });
    });
  }

  async restart() {
    if (this.restarting) return;
    log(this.name, 'Restarting...');
    await this.stop();
    this.resetBackoff();
    this.start();
  }
}

const api = new ManagedProcess(
  'api',
  'api',
  ROOT,
  path.join(ROOT, 'target', 'debug', 'allternit-api'),
  [],
  {
    ALLTERNIT_LOCAL_DEV_BYPASS: 'true',
    RUST_LOG: process.env.RUST_LOG || 'info',
  }
);

const gizzi = new ManagedProcess(
  'gizzi',
  'gizzi',
  GIZZI_DIR,
  path.join(GIZZI_DIR, 'dist', 'gizzi-code'),
  ['serve', '--port', GIZZI_PORT, '--hostname', '127.0.0.1', '--print-logs'],
  {},
  { autoRestart: true, restartDelayMs: 1000 }
);

const frontend = new ManagedProcess(
  'frontend',
  'frontend',
  FRONTEND_DIR,
  'pnpm',
  ['dev', '--port', FRONTEND_PORT]
);

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function ensureApiBuilt() {
  log('watcher', 'Building API...');
  return new Promise((resolve) => {
    const build = spawn('cargo', ['build', '--bin', 'allternit-api'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
    });
    build.on('exit', (code) => {
      if (code === 0) {
        log('watcher', 'API build succeeded');
      } else {
        log('watcher', `API build failed with code ${code}`);
      }
      resolve(code === 0);
    });
  });
}

async function ensureGizziBuilt() {
  log('watcher', 'Building Gizzi...');
  return new Promise((resolve) => {
    const build = spawn('bun', ['run', 'build'], {
      cwd: GIZZI_DIR,
      stdio: 'inherit',
      shell: false,
    });
    build.on('exit', (code) => {
      if (code === 0) {
        log('watcher', 'Gizzi build succeeded');
      } else {
        log('watcher', `Gizzi build failed with code ${code}`);
      }
      resolve(code === 0);
    });
  });
}

async function onApiChange() {
  const ok = await ensureApiBuilt();
  if (ok) await api.restart();
}

async function onGizziChange() {
  const ok = await ensureGizziBuilt();
  if (ok) await gizzi.restart();
}

const debouncedApiChange = debounce(onApiChange, 1500);
const debouncedGizziChange = debounce(onGizziChange, 1500);

function watchRecursive(dir, onChange, extension) {
  if (!fs.existsSync(dir)) return;

  const watchers = new Map();

  function addWatch(target) {
    if (watchers.has(target)) return;
    try {
      const w = fs.watch(target, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const filePath = path.join(target, filename);
        if (filePath.endsWith(extension)) {
          log('watcher', `Source changed: ${path.relative(ROOT, filePath)}`);
          onChange();
        }
      });
      watchers.set(target, w);
    } catch (err) {
      log('watcher', `Failed to watch ${target}: ${err.message}`);
    }
  }

  addWatch(dir);

  // macOS recursive watch covers nested dirs; Linux fs.watch is per-dir.
  // Walk once to add explicit watchers on Linux/non-recursive platforms.
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: false })) {
      if (entry.isDirectory()) {
        addWatch(path.join(dir, entry.name));
      }
    }
  } catch {
    // ignore
  }
}

async function main() {
  log('watcher', 'Allternit dev stack hot-reload starting...');
  log('watcher', `Root: ${ROOT}`);

  // Initial builds
  await ensureApiBuilt();
  await ensureGizziBuilt();

  api.start();
  gizzi.start();
  frontend.start();

  watchRecursive(API_SRC, debouncedApiChange, '.rs');
  watchRecursive(GIZZI_SRC, debouncedGizziChange, '.ts');

  log('watcher', 'Watching for source changes...');

  const shutdown = async (signal) => {
    log('watcher', `Received ${signal}, shutting down...`);
    await frontend.stop();
    await gizzi.stop();
    await api.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
