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
 *   ALLTERNIT_API_PORT        - API port (default 8013)
 *   ALLTERNIT_GIZZI_PORT      - Gizzi runtime port (default 4096)
 *   ALLTERNIT_FRONTEND_PORT   - Vite dev server port (default 3013)
 *   ALLTERNIT_CONNECTOR_SIDECAR_PORT - open-connector sidecar port (default 8014)
 *   ENCRYPTION_KEY            - shared credential-encryption secret (generated if unset)
 */

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'cmd', 'allternit-api');
const API_SRC = path.join(API_DIR, 'src');
const GIZZI_DIR = path.join(ROOT, 'cmd', 'gizzi-code');
const GIZZI_SRC = path.join(GIZZI_DIR, 'src');
const FRONTEND_DIR = path.join(ROOT, 'surfaces', 'ai.allternit.com');
const CONNECTORS_DIR = path.join(ROOT, 'services', 'open-connector');
const COMPANY_CONFIG = path.join(ROOT, 'resources', 'company.json');

const API_PORT = process.env.ALLTERNIT_API_PORT || '8013';
const GIZZI_PORT = process.env.ALLTERNIT_GIZZI_PORT || '4096';
const FRONTEND_PORT = process.env.ALLTERNIT_FRONTEND_PORT || '3013';
const CONNECTOR_SIDECAR_PORT = process.env.ALLTERNIT_CONNECTOR_SIDECAR_PORT || '8014';

// Shared secrets between allternit-api and the open-connector sidecar. Reuse
// whatever the operator already set; generate ephemeral per-session values
// otherwise so both processes agree without either depending on OS-keychain
// resolution order (see cmd/allternit-api/src/token_crypto.rs).
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const CONNECTOR_ADMIN_TOKEN =
  process.env.ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN || crypto.randomBytes(24).toString('hex');
const CONNECTOR_RUNTIME_TOKEN =
  process.env.ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN || crypto.randomBytes(24).toString('hex');

const args = process.argv.slice(2);
const API_ONLY = args.includes('--api-only');
const GIZZI_ONLY = args.includes('--gizzi-only');

const COLORS = {
  api: '\x1b[36m',
  gizzi: '\x1b[35m',
  frontend: '\x1b[34m',
  connectors: '\x1b[32m',
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
    ALLTERNIT_SELF_HOSTED: 'true',
    RUST_LOG: process.env.RUST_LOG || 'info',
    ENCRYPTION_KEY,
    ALLTERNIT_CONNECTOR_SIDECAR_URL: `http://127.0.0.1:${CONNECTOR_SIDECAR_PORT}`,
    ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN: CONNECTOR_ADMIN_TOKEN,
    ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN: CONNECTOR_RUNTIME_TOKEN,
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

// Vendored self-hosted connector gateway (services/open-connector, see
// services/open-connector/PROVENANCE.md). Bound to 127.0.0.1 only; never
// exposed externally. All traffic reaches it through the Rust API's proxy
// (cmd/allternit-api/src/open_connector_proxy.rs), never directly.
const connectors = new ManagedProcess(
  'connectors',
  'connectors',
  CONNECTORS_DIR,
  'node',
  ['src/server/index.ts'],
  {
    PORT: CONNECTOR_SIDECAR_PORT,
    HOST: '127.0.0.1',
    OOMOL_CONNECT_ORIGIN: `http://127.0.0.1:${API_PORT}`,
    OOMOL_CONNECT_DATA_DIR: path.join(CONNECTORS_DIR, 'data'),
    OOMOL_CONNECT_ENCRYPTION_KEY: ENCRYPTION_KEY,
    OOMOL_CONNECT_ADMIN_TOKEN: CONNECTOR_ADMIN_TOKEN,
    OOMOL_CONNECT_RUNTIME_TOKEN: CONNECTOR_RUNTIME_TOKEN,
  },
  { autoRestart: true, restartDelayMs: 1500 }
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

async function ensureConnectorsGenerated() {
  log('watcher', 'Generating open-connector catalog/registry...');
  return new Promise((resolve) => {
    const gen = spawn('node', ['scripts/ensure-generated.ts'], {
      cwd: CONNECTORS_DIR,
      stdio: 'inherit',
      shell: false,
    });
    gen.on('exit', (code) => {
      if (code === 0) {
        log('watcher', 'open-connector catalog generation succeeded');
      } else {
        log('watcher', `open-connector catalog generation failed with code ${code}`);
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

async function onCompanyConfigChange() {
  log('watcher', 'Company config changed, restarting API...');
  await api.restart();
}
const debouncedCompanyConfigChange = debounce(onCompanyConfigChange, 500);

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

  if (GIZZI_ONLY) {
    await ensureGizziBuilt();
    gizzi.start();
    watchRecursive(GIZZI_SRC, debouncedGizziChange, '.ts');
    log('watcher', 'Watching Gizzi source changes...');
  } else if (API_ONLY) {
    await ensureApiBuilt();
    api.start();
    watchRecursive(API_SRC, debouncedApiChange, '.rs');
    if (fs.existsSync(COMPANY_CONFIG)) {
      fs.watch(COMPANY_CONFIG, debouncedCompanyConfigChange);
      log('watcher', `Watching company config: ${COMPANY_CONFIG}`);
    }
    log('watcher', 'Watching API source changes...');
  } else {
    // Initial builds
    await ensureApiBuilt();
    await ensureGizziBuilt();
    await ensureConnectorsGenerated();

    api.start();
    gizzi.start();
    frontend.start();
    connectors.start();

    watchRecursive(API_SRC, debouncedApiChange, '.rs');
    watchRecursive(GIZZI_SRC, debouncedGizziChange, '.ts');
    if (fs.existsSync(COMPANY_CONFIG)) {
      fs.watch(COMPANY_CONFIG, debouncedCompanyConfigChange);
      log('watcher', `Watching company config: ${COMPANY_CONFIG}`);
    }

    log('watcher', 'Watching for source changes...');
  }

  const running = [];
  if (!GIZZI_ONLY) running.push(api);
  if (!API_ONLY) running.push(gizzi);
  if (!API_ONLY && !GIZZI_ONLY) running.push(frontend);
  if (!API_ONLY && !GIZZI_ONLY) running.push(connectors);

  const shutdown = async (signal) => {
    log('watcher', `Received ${signal}, shutting down...`);
    await Promise.all(running.map((p) => p.stop()));
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
