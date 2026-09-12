#!/usr/bin/env node
/**
 * render-artifact-screenshot.mjs — render an HTML design artifact to a PNG screenshot
 * using the machine's real Chrome via playwright-core.
 *
 * This is the studio "render-and-compare" self-verification primitive: the design agent
 * writes a candidate artifact to a temp file, runs this script through its bash tool,
 * reads the PNG back, and lists visual defects against the brief before finalizing.
 *
 * Usage:
 *   node scripts/render-artifact-screenshot.mjs --html-file <path> [--out <path>]
 *       [--width 1280] [--height 800] [--wait 500]
 *   ... | node scripts/render-artifact-screenshot.mjs [--out <path>]   (HTML on stdin)
 *
 *   --html-file <path>  Artifact HTML file to render. Omit to read HTML from stdin.
 *   --out <path>        PNG destination. Default: alongside the input (<input>.png),
 *                       or ./render.png when reading from stdin.
 *   --width / --height  Viewport size (default 1280x800). fullPage: true, so content
 *                       taller than the viewport is captured — overflow is visible.
 *   --wait <ms>         Extra settle time after load before capture (default 500).
 *
 * Exit codes: 0 = PNG written; 1 = usage error or render failure. When Chrome or
 * playwright-core is unavailable the script exits non-zero with a stderr message —
 * callers must treat that as "verification unavailable", never fake a result.
 *
 * playwright-core is intentionally NOT a package dependency (mirrors
 * ~/.kimi-code/skills/client-report/scripts/screenshot.js, which relies on a plain
 * require("playwright-core") from an ad-hoc install). Resolution order:
 *   1. require.resolve from this script's location (the repo root node_modules —
 *      playwright-core is already hoisted there by the pnpm workspace install);
 *   2. the npm global root (`npm root -g`);
 *   3. ~/node_modules and ~/.kimi-code/node_modules (ad-hoc per-session installs).
 * If none resolve: `npm install playwright-core --prefix <scratch-dir>` once, then
 * pass NODE_PATH or run from that directory. Chrome is the system install
 * ($CHROME_PATH override, then /Applications/Google Chrome.app, then chromium.launch
 * with channel:"chrome" as a last resort) — no browser download.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 800;
export const DEFAULT_WAIT_MS = 500;

// ─── Pure helpers (unit-tested in render-artifact-screenshot.test.mjs) ────────

export function parseArgs(argv) {
  const opts = {
    htmlFile: null,
    out: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    wait: DEFAULT_WAIT_MS,
    help: false,
  };
  const takeValue = (flag, i, inline) => {
    if (inline !== undefined) return [inline, i];
    if (i + 1 >= argv.length) throw new Error(`missing value for ${flag}`);
    return [argv[i + 1], i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, ...rest] = arg.split('=');
    const inline = rest.length ? rest.join('=') : undefined;
    switch (flag) {
      case '--html-file': [opts.htmlFile, i] = takeValue(flag, i, inline); break;
      case '--out': [opts.out, i] = takeValue(flag, i, inline); break;
      case '--width': {
        const [v, ni] = takeValue(flag, i, inline);
        opts.width = toPositiveInt(v, flag); i = ni; break;
      }
      case '--height': {
        const [v, ni] = takeValue(flag, i, inline);
        opts.height = toPositiveInt(v, flag); i = ni; break;
      }
      case '--wait': {
        const [v, ni] = takeValue(flag, i, inline);
        opts.wait = toNonNegativeInt(v, flag); i = ni; break;
      }
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function toPositiveInt(v, flag) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} expects a positive integer, got "${v}"`);
  return n;
}

function toNonNegativeInt(v, flag) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${flag} expects a non-negative integer, got "${v}"`);
  return n;
}

export function resolveOutputPath(htmlFile, out, cwd = process.cwd()) {
  if (out) return path.resolve(cwd, out);
  if (htmlFile) {
    const abs = path.resolve(cwd, htmlFile);
    const ext = path.extname(abs);
    return ext ? abs.slice(0, abs.length - ext.length) + '.png' : abs + '.png';
  }
  return path.join(cwd, 'render.png');
}

/** Chrome executable candidates, most preferred first. Pure — existence is checked by caller. */
export function chromeCandidates(env = process.env, platform = process.platform) {
  if (env.CHROME_PATH) return [env.CHROME_PATH];
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

// ─── Dependency resolution (ad-hoc, mirrors client-report screenshot.js) ─────

function resolvePlaywrightCore() {
  try {
    return require.resolve('playwright-core');
  } catch { /* fall through to ad-hoc locations */ }
  const roots = [];
  try {
    roots.push(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim());
  } catch { /* npm not on PATH */ }
  roots.push(path.join(os.homedir(), 'node_modules'));
  roots.push(path.join(os.homedir(), '.kimi-code', 'node_modules'));
  for (const root of roots) {
    try {
      return require.resolve(path.join(root, 'playwright-core'));
    } catch { /* next candidate */ }
  }
  return null;
}

async function findChromeExecutable(chromium) {
  for (const candidate of chromeCandidates()) {
    try {
      if (fs.existsSync(candidate)) return { executablePath: candidate };
    } catch { /* next candidate */ }
  }
  // Last resort: playwright-core's own channel resolution (finds a Chrome install).
  try {
    const executablePath = chromium.executablePath({ channel: 'chrome' });
    if (executablePath && fs.existsSync(executablePath)) return { executablePath };
  } catch { /* no channel chrome */ }
  return null;
}

// ─── Render ───────────────────────────────────────────────────────────────────

async function render({ html, url, outPath, width, height, wait }) {
  const pwPath = resolvePlaywrightCore();
  if (!pwPath) {
    throw new Error(
      'playwright-core is not resolvable (checked repo root node_modules, npm global root, ~/node_modules, ~/.kimi-code/node_modules). ' +
      'Install it ad-hoc once: npm install playwright-core --prefix <scratch-dir>, then run this script from there or set NODE_PATH.',
    );
  }
  const { chromium } = require(pwPath);
  const launchOpts = await findChromeExecutable(chromium);
  if (!launchOpts) {
    throw new Error(
      'No Chrome/Chromium install found. Set CHROME_PATH to a Chrome executable, or install Google Chrome.',
    );
  }
  const browser = await chromium.launch({ ...launchOpts, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    if (url) await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    else await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: outPath, fullPage: true });
  } finally {
    await browser.close();
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

const USAGE = `Usage: node scripts/render-artifact-screenshot.mjs --html-file <path> [--out <path>] [--width 1280] [--height 800] [--wait 500]
       ... | node scripts/render-artifact-screenshot.mjs [--out <path>]   (HTML on stdin)`;

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`render-artifact-screenshot: ${err.message}\n${USAGE}`);
    process.exit(1);
  }
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  let html;
  let inputDesc;
  if (opts.htmlFile) {
    const abs = path.resolve(opts.htmlFile);
    if (!fs.existsSync(abs)) {
      console.error(`render-artifact-screenshot: --html-file not found: ${abs}`);
      process.exit(1);
    }
    html = fs.readFileSync(abs, 'utf8');
    inputDesc = abs;
  } else {
    html = await readStdin();
    inputDesc = '(stdin)';
    if (!html.trim()) {
      console.error('render-artifact-screenshot: no HTML on stdin and no --html-file given.');
      process.exit(1);
    }
  }
  const outPath = resolveOutputPath(opts.htmlFile, opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    await render({
      html,
      url: opts.htmlFile ? pathToFileURL(path.resolve(opts.htmlFile)).href : null,
      outPath,
      width: opts.width,
      height: opts.height,
      wait: opts.wait,
    });
  } catch (err) {
    console.error(`render-artifact-screenshot: ${err.message}`);
    process.exit(1);
  }
  const bytes = fs.statSync(outPath).size;
  if (bytes === 0) {
    console.error(`render-artifact-screenshot: wrote an empty PNG at ${outPath}`);
    process.exit(1);
  }
  console.log(`render-artifact-screenshot: ${inputDesc} -> ${outPath} (${bytes} bytes, ${opts.width}x${opts.height}, wait ${opts.wait}ms)`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (invokedDirectly) {
  main();
}
