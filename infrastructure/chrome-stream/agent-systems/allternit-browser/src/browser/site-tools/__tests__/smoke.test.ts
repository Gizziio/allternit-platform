/**
 * Live smoke test for the site-tools layer.
 *
 * Launches headless Chromium with a CDP port (the same attachment pattern the
 * production path uses), serves a fixture page that mimics a GitHub PR review
 * surface, injects a fake navigator.modelContext (WebMCP capability probe —
 * the code must treat it as optional) plus the site-tools bridge, then drives
 * the REAL github.review_pr adapter handler through the existing
 * browser/playwright/actions.ts primitives against the fixture. No network
 * access to github.com occurs: the fixture is served from 127.0.0.1.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  BrowserEventSchema,
  BrowserObservationSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  type ActionIntent,
  type BrowserProvider,
} from '@allternit/computer-use-protocol';
import { BrowserRunController } from '../../../protocol/run-controller.js';
import { loadGitHubSiteTools } from '../adapters/github.js';
import { SiteToolRegistry } from '../registry.js';
import { SITE_TOOLS_BRIDGE_SOURCE } from '../bridge.js';

const FIXTURE_HTML = `<!doctype html>
<html>
<head><title>acme/app PR #1</title></head>
<body>
  <span class="js-issue-title">Fix login redirect</span>
  <nav class="tabnav-tabs">
    <a data-tab-item="files-tab">Files <span class="Counter">1</span></a>
  </nav>
  <div class="js-diff-progressive-container"><div class="file js-file">diff content</div></div>
  <div id="files_bucket"><div class="file-header" data-path="src/app.ts">src/app.ts</div></div>
  <button data-hotkey="p">Review changes</button>
  <div class="pull-request-review-menu" style="display:block">menu</div>
  <form id="review-form">
    <textarea id="pull_request_review_body"></textarea>
    <input type="radio" name="review_type" value="COMMENT" />
    <button class="btn-primary" type="submit">Submit review</button>
  </form>
  <div class="js-timeline-item"></div>
  <script>
    document.getElementById('review-form').addEventListener('submit', (event) => {
      event.preventDefault();
      window.__submitted = true;
    });
  </script>
</body>
</html>`;

const FAKE_MODEL_CONTEXT_SOURCE = String.raw`
Object.defineProperty(navigator, 'modelContext', { value: { tools: [] }, configurable: true });
`;

/**
 * Resolve the Chromium binary to spawn. Preference:
 *   1. ALLTERNIT_CHROMIUM_PATH env override (explicit control)
 *   2. The build pinned by the installed Playwright version
 *   3. Newest complete chromium-* build already in the ms-playwright cache
 *      (CDN copies of pinned-but-pulled builds can 404; cached builds are fine)
 */
function resolveChromiumExecutable(): string {
  const override = process.env.ALLTERNIT_CHROMIUM_PATH;
  if (override) {
    if (!existsSync(override)) throw new Error(`ALLTERNIT_CHROMIUM_PATH does not exist: ${override}`);
    return override;
  }
  const pinned = chromium.executablePath();
  if (existsSync(pinned)) return pinned;
  const cacheRoot = join(process.env.HOME ?? '', 'Library/Caches/ms-playwright');
  const candidates = readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const entry of candidates) {
    const binary = join(
      cacheRoot,
      entry,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents/MacOS/Google Chrome for Testing',
    );
    if (existsSync(binary)) return binary;
  }
  throw new Error(`No Chromium binary found (pinned build missing: ${pinned})`);
}

async function waitForDevToolsPort(proc: ChildProcess, timeoutMs = 20_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for DevTools listening line')), timeoutMs);
    let buffered = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      const match = buffered.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited early with code ${code}: ${buffered.slice(-500)}`));
    });
  });
}

describe('site-tools live smoke (headless Chromium + fixture page)', () => {
  let server: Server;
  let fixtureUrl: string;
  let chromeProc: ChildProcess;
  let cdpPort: number;
  let cdpUrl: string;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let userDataDir: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(FIXTURE_HTML);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server failed to bind');
    fixtureUrl = `http://127.0.0.1:${address.port}/pr/1`;

    userDataDir = mkdtempSync(join(tmpdir(), 'allternit-site-tools-'));
    chromeProc = spawn(resolveChromiumExecutable(), [
      '--headless',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    cdpPort = await waitForDevToolsPort(chromeProc);
    cdpUrl = `http://127.0.0.1:${cdpPort}`;

    browser = await chromium.connectOverCDP(cdpUrl);
    context = browser.contexts()[0] ?? await browser.newContext();
    for (const existing of context.pages()) await existing.close();
    // Capability probe is optional-only: fake a native WebMCP surface, then
    // install the bridge. Order matters — both are init scripts.
    await context.addInitScript(FAKE_MODEL_CONTEXT_SOURCE);
    await context.addInitScript(SITE_TOOLS_BRIDGE_SOURCE);
    page = await context.newPage();
    await page.goto(fixtureUrl, { waitUntil: 'load' });
  }, 60_000);

  afterAll(async () => {
    try { await browser?.close(); } catch { /* already disconnected */ }
    try { chromeProc?.kill('SIGKILL'); } catch { /* already exited */ }
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
  });

  it('bridge installs with listTools/invokeTool and probes navigator.modelContext', async () => {
    const probe = await page.evaluate(() => {
      const bridge = (window as any).__allternitSiteTools;
      return {
        installed: typeof bridge === 'object' && bridge !== null,
        modelContextAvailable: bridge?.modelContextAvailable?.(),
        listTools: typeof bridge?.listTools === 'function',
        invokeTool: typeof bridge?.invokeTool === 'function',
      };
    });
    expect(probe.installed).toBe(true);
    expect(probe.modelContextAvailable).toBe(true);
    expect(probe.listTools).toBe(true);
    expect(probe.invokeTool).toBe(true);
  });

  it('github adapter descriptor round-trips through the page bridge', async () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());
    const registered = await page.evaluate((tools) => {
      return (window as any).__allternitSiteTools.registerTools(tools);
    }, registry.descriptors());
    expect(registered).toEqual(expect.arrayContaining(['github.review_pr', 'github.triage_issue']));

    const listed = await page.evaluate(() => (window as any).__allternitSiteTools.listTools());
    const review = listed.find((tool: { name: string }) => tool.name === 'github.review_pr');
    expect(review.description.length).toBeGreaterThan(0);
    expect(review.inputSchema.required).toEqual(['prUrl', 'reviewText']);
  });

  it('real handler drives actions.ts primitives against the fixture; call lands in the event stream', async () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());

    const provider: BrowserProvider = {
      capabilities: {
        provider: 'local-playwright',
        capabilities: ['navigate', 'observe.accessibility'],
        local: true,
        attachedToUserSession: false,
        supportsPrivateNetwork: true,
        supportsPersistentProfile: true,
      },
      observe: async (sessionId: string) => BrowserObservationSchema.parse({
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        observationId: 'obs-smoke',
        sessionId,
        url: fixtureUrl,
        title: 'acme/app PR #1',
        capturedAt: new Date().toISOString(),
        format: 'accessibility',
        text: 'fixture',
        refs: [],
        artifacts: [],
        truncated: false,
        redactions: [],
      }),
      execute: async (action: ActionIntent) => ([BrowserEventSchema.parse({
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        eventId: crypto.randomUUID(),
        runId: action.runId,
        sessionId: action.sessionId,
        sequence: 1,
        emittedAt: new Date().toISOString(),
        type: 'action.state_changed',
        payload: { actionId: action.actionId, state: 'committed' },
      })]),
      close: async () => {},
    };

    const controller = new BrowserRunController({
      providers: [provider],
      sourceSurface: 'api',
      siteTools: registry,
      resolveToolContext: () => ({ cdpUrl: cdpUrl, targetId: fixtureUrl }),
    });
    const { run, lease } = controller.startRun({
      accountId: 'acct-smoke',
      conversationId: 'conv-smoke',
      objective: 'Review PR #1 via site tool',
      provider: 'local-playwright',
      startedBy: 'api',
      sessionId: 'session-smoke',
      runId: 'run-smoke',
    });

    const result = await controller.executeTool({
      lease,
      toolName: 'github.review_pr',
      args: { prUrl: fixtureUrl, reviewText: 'Looks good — ship it.' },
    });

    expect(result.toolCall.error).toBeUndefined();
    expect(result.toolCall.latencyMs).toBeGreaterThan(0);
    expect(result.toolCall.resultSummary).toContain('Review comment posted');

    // The handler really drove the browser: the fixture form was submitted
    // with the review text typed by typeViaPlaywright.
    const submitted = await page.evaluate(() => ({
      submitted: Boolean((window as any).__submitted),
      typed: (document.getElementById('pull_request_review_body') as HTMLTextAreaElement)?.value,
    }));
    expect(submitted.submitted).toBe(true);
    expect(submitted.typed).toBe('Looks good — ship it.');

    // The invocation is visible on the run's event stream as a tool.called event.
    const events = controller.eventsAfter(run.runId);
    const toolEvent = events.find((event) => event.type === 'tool.called');
    expect(toolEvent).toBeDefined();
    const emittedCall = toolEvent?.payload.toolCall as { toolName?: string; runId?: string; latencyMs?: number } | undefined;
    expect(emittedCall).toMatchObject({
      toolName: 'github.review_pr',
      runId: run.runId,
    });
    expect(typeof emittedCall?.latencyMs).toBe('number');

    // …and in the trajectory as a tool_call step.
    const trajectory = controller.toTrajectory(run.runId);
    expect(trajectory.steps).toHaveLength(1);
    expect(trajectory.steps[0].kind).toBe('tool_call');
  }, 60_000);
});
