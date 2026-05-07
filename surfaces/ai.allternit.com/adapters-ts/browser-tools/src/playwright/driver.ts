/**
 * Playwright Driver Integration
 * 
 * Concrete implementation of browser control using Playwright.
 * Manages browser instances, contexts, and pages.
 */

import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page, type LaunchOptions } from 'playwright';
import type { BrowserSession, Viewport, NavigationResult, ScreenshotResult } from '../types/index.js';
import { quarantineManager, checkNavigationSafety } from '../safety/quarantine.js';

// ============================================================================
// Types
// ============================================================================

export interface PlaywrightSession extends BrowserSession {
  browserType: 'chromium' | 'firefox' | 'webkit';
  contextId?: string;
}

export interface LaunchConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: Viewport;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  incognito: boolean;
  args?: string[];
}

// ============================================================================
// Session Registry
// ============================================================================

interface ActiveSession {
  session: PlaywrightSession;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  config: LaunchConfig;
}

class SessionRegistry {
  private sessions: Map<string, ActiveSession> = new Map();
  private navigationDepth: Map<string, number> = new Map();

  async create(config: LaunchConfig): Promise<PlaywrightSession> {
    const sessionId = `pw-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Launch browser
    const browser = await this.launchBrowser(config);
    
    // Create context with settings
    const context = await browser.newContext({
      viewport: {
        width: config.viewport.width,
        height: config.viewport.height,
      },
      deviceScaleFactor: config.viewport.deviceScaleFactor,
      userAgent: config.userAgent,
      locale: config.locale,
      timezoneId: config.timezone,
    });

    // Create page
    const page = await context.newPage();

    // Create session record
    const session: PlaywrightSession = {
      id: sessionId,
      status: 'connected',
      browserType: config.browserType,
      viewport: config.viewport,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Store in registry
    this.sessions.set(sessionId, {
      session,
      browser,
      context,
      page,
      config,
    });
    this.navigationDepth.set(sessionId, 0);

    // Set up quarantine
    quarantineManager.createSession(sessionId, config.incognito ? 'incognito' : 'none');

    return session;
  }

  private async launchBrowser(config: LaunchConfig): Promise<Browser> {
    const options: LaunchOptions = {
      headless: config.headless,
      args: config.args || [],
    };

    switch (config.browserType) {
      case 'firefox':
        return firefox.launch(options);
      case 'webkit':
        return webkit.launch(options);
      case 'chromium':
      default:
        return chromium.launch(options);
    }
  }

  get(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  async close(sessionId: string): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) return;

    // Close in reverse order
    await active.page.close().catch(() => {});
    await active.context.close().catch(() => {});
    await active.browser.close().catch(() => {});

    // Clean up
    this.sessions.delete(sessionId);
    this.navigationDepth.delete(sessionId);
    quarantineManager.closeSession(sessionId);
  }

  async closeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map(id => this.close(id)));
  }

  getNavigationDepth(sessionId: string): number {
    return this.navigationDepth.get(sessionId) || 0;
  }

  incrementNavigationDepth(sessionId: string): void {
    const current = this.getNavigationDepth(sessionId);
    this.navigationDepth.set(sessionId, current + 1);
  }

  updateLastActivity(sessionId: string): void {
    const active = this.sessions.get(sessionId);
    if (active) {
      active.session.lastActivity = new Date();
    }
  }

  getAllSessions(): PlaywrightSession[] {
    return Array.from(this.sessions.values()).map(s => s.session);
  }
}

export const sessionRegistry = new SessionRegistry();

// ============================================================================
// Navigation Implementation
// ============================================================================

export async function navigateWithPlaywright(
  sessionId: string,
  url: string,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
    referer?: string;
  } = {}
): Promise<NavigationResult> {
  const active = sessionRegistry.get(sessionId);
  if (!active) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Check safety
  const policy = quarantineManager.getPolicy(sessionId);
  const depth = sessionRegistry.getNavigationDepth(sessionId);
  
  if (policy) {
    const safety = checkNavigationSafety(url, policy, depth);
    if (!safety.allowed) {
      throw new Error(`Navigation blocked: ${safety.reason}`);
    }
    quarantineManager.addAuditEvent(sessionId, safety.auditEvent);
  }

  const startTime = Date.now();
  
  // Navigate
  const response = await active.page.goto(url, {
    waitUntil: options.waitUntil || 'load',
    timeout: options.timeout || 30000,
    referer: options.referer,
  });

  if (!response) {
    throw new Error('Navigation failed: no response');
  }

  // Update tracking
  sessionRegistry.incrementNavigationDepth(sessionId);
  sessionRegistry.updateLastActivity(sessionId);

  // Get page info
  const title = await active.page.title().catch(() => undefined);
  const finalUrl = active.page.url();

  return {
    url: finalUrl,
    title: title || '',
    loadTime: Date.now() - startTime,
    status: response.status(),
  };
}

export async function goBackWithPlaywright(
  sessionId: string
): Promise<NavigationResult> {
  const active = sessionRegistry.get(sessionId);
  if (!active) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const startTime = Date.now();
  await active.page.goBack();

  sessionRegistry.updateLastActivity(sessionId);

  const title = await active.page.title().catch(() => undefined);
  const url = active.page.url();

  return {
    url,
    title: title || '',
    loadTime: Date.now() - startTime,
    status: 200,
  };
}

export async function goForwardWithPlaywright(
  sessionId: string
): Promise<NavigationResult> {
  const active = sessionRegistry.get(sessionId);
  if (!active) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const startTime = Date.now();
  await active.page.goForward();

  sessionRegistry.updateLastActivity(sessionId);

  const title = await active.page.title().catch(() => undefined);
  const url = active.page.url();

  return {
    url,
    title: title || '',
    loadTime: Date.now() - startTime,
    status: 200,
  };
}

export async function reloadWithPlaywright(
  sessionId: string,
  options?: { cache?: boolean }
): Promise<NavigationResult> {
  const active = sessionRegistry.get(sessionId);
  if (!active) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const startTime = Date.now();
  await active.page.reload({
    waitUntil: 'load',
  });

  sessionRegistry.updateLastActivity(sessionId);

  const title = await active.page.title().catch(() => undefined);
  const url = active.page.url();

  return {
    url,
    title: title || '',
    loadTime: Date.now() - startTime,
    status: 200,
  };
}

// ============================================================================
// Screenshot Implementation
// ============================================================================

export async function takeScreenshotWithPlaywright(
  sessionId: string,
  options: {
    fullPage?: boolean;
    selector?: string;
    format?: 'png' | 'jpeg';
    quality?: number;
    omitBackground?: boolean;
  } = {}
): Promise<ScreenshotResult> {
  const active = sessionRegistry.get(sessionId);
  if (!active) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const format = options.format || 'png';
  const type = format === 'jpeg' ? 'jpeg' : 'png';

  let buffer: Buffer;

  if (options.selector) {
    // Screenshot specific element
    const element = await active.page.locator(options.selector).first();
    buffer = await element.screenshot({
      type,
      quality: options.quality,
    });
  } else {
    // Screenshot page
    buffer = await active.page.screenshot({
      fullPage: options.fullPage,
      type,
      quality: options.quality,
      omitBackground: options.omitBackground,
    });
  }

  sessionRegistry.updateLastActivity(sessionId);

  const viewport = active.session.viewport;

  return {
    base64: buffer.toString('base64'),
    format,
    dimensions: {
      width: viewport.width,
      height: options.fullPage ? 0 : viewport.height, // Will be actual height
    },
    fullPage: options.fullPage || false,
  };
}

// ============================================================================
// Viewport Implementation
// ============================================================================

export async function setViewportWithPlaywright(
  sessionId: string,
  viewport: Viewport
): Promise<void> {
  const active = sessionRegistry.get(sessionId);
  if (!active) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  await active.page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });

  // Update session
  active.session.viewport = viewport;
  sessionRegistry.updateLastActivity(sessionId);
}

// ============================================================================
// Export
// ============================================================================

export default {
  sessionRegistry,
  navigateWithPlaywright,
  goBackWithPlaywright,
  goForwardWithPlaywright,
  reloadWithPlaywright,
  takeScreenshotWithPlaywright,
  setViewportWithPlaywright,
};
