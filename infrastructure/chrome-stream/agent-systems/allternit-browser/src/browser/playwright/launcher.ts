/**
 * Playwright Browser Launcher
 * Ported from OpenClaw dist/browser/pw-session.js
 */

import type { BrowserProfile } from '../../types/index.js';

export interface LaunchOptions {
  profile: BrowserProfile;
  headless?: boolean;
  noSandbox?: boolean;
  executablePath?: string;
}

export interface LaunchResult {
  pid: number;
  exe: { kind: string; path: string };
  userDataDir: string;
}

export async function launchBrowser(options: LaunchOptions): Promise<LaunchResult> {
  const { chromium } = await import('playwright');
  
  const browser = await chromium.launch({
    headless: options.headless ?? false,
    executablePath: options.executablePath,
    args: [
      '--remote-debugging-port=' + options.profile.cdpPort,
      ...(options.noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  
  // Get process info if available (only on launched instances)
  const pid = (browser as any).process?.()?.pid ?? 0;
  
  return {
    pid,
    exe: {
      kind: 'chromium',
      path: options.executablePath || 'chromium',
    },
    userDataDir: options.profile.userDataDir || '',
  };
}

export async function connectViaCDP(cdpUrl: string, contextTimeoutMs = 5_000) {
  const { chromium } = await import('playwright');

  const browser = await chromium.connectOverCDP(cdpUrl);
  // A fresh CDP connection can report no contexts until target discovery
  // completes. Creating a new context in that window strands the action on an
  // empty incognito context (observed as waitForSelector timeouts against a
  // page that is actually open). Wait briefly for the real context first.
  const deadline = Date.now() + contextTimeoutMs;
  let context = browser.contexts()[0];
  while (!context && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    context = browser.contexts()[0];
  }
  if (!context) context = await browser.newContext();
  // When a Playwright-created side context exists (e.g. a video-recorded
  // session), the profile's default context can be present but page-less —
  // prefer a context that actually has pages.
  const withPages = browser.contexts().find((candidate) => candidate.pages().length > 0);
  if (withPages) context = withPages;

  return { browser, context };
}
