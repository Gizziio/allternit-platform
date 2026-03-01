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

export async function connectViaCDP(cdpUrl: string) {
  const { chromium } = await import('playwright');
  
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  
  return { browser, context };
}
