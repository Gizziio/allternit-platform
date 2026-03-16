import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { BrowserConfig, DEFAULT_CONFIG, ConsoleEvent, NetworkEvent } from './types.js';

interface Session {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  config: BrowserConfig;
  eventSubscribers: Set<(event: any) => void>;
  frameInterval: ReturnType<typeof setInterval> | null;
}

export class BrowserManager {
  private sessions: Map<string, Session> = new Map();
  private config: BrowserConfig;

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async createSession(sessionId: string, initialUrl?: string): Promise<Session> {
    const browser = await chromium.launch({
      headless: this.config.headless,
    });

    const context = await browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
    });

    const page = await context.newPage();
    const session: Session = {
      id: sessionId,
      browser,
      context,
      page,
      config: this.config,
      eventSubscribers: new Set(),
      frameInterval: null,
    };

    this.setupEventListeners(session);

    if (initialUrl) {
      await page.goto(initialUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      });
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  private setupEventListeners(session: Session): void {
    const { page, eventSubscribers } = session;

    page.on('console', (msg) => {
      const event: ConsoleEvent = {
        type: msg.type() as ConsoleEvent['type'],
        text: msg.text(),
        location: msg.location(),
      };
      this.broadcastEvent(session, 'console', event);
    });

    page.on('request', (request) => {
      const event: NetworkEvent = {
        id: request.url(),
        type: 'request',
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
      };
      this.broadcastEvent(session, 'network', event);
    });

    page.on('response', (response) => {
      const event: NetworkEvent = {
        id: response.url(),
        type: 'response',
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        timestamp: Date.now(),
      };
      this.broadcastEvent(session, 'network', event);
    });

    page.on('load', () => {
      this.broadcastEvent(session, 'load', { url: page.url() });
    });

    page.on('domcontentloaded', () => {
      this.broadcastEvent(session, 'dom-change', { type: 'loaded' });
    });
  }

  private broadcastEvent(session: Session, type: string, data: any): void {
    const event = {
      type,
      sessionId: session.id,
      data,
      timestamp: Date.now(),
    };
    session.eventSubscribers.forEach((callback) => callback(event));
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.frameInterval) {
        clearInterval(session.frameInterval);
      }
      session.eventSubscribers.clear();
      await session.browser.close();
      this.sessions.delete(sessionId);
    }
  }

  subscribeToEvents(sessionId: string, callback: (event: any) => void): () => void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.eventSubscribers.add(callback);
      return () => session.eventSubscribers.delete(callback);
    }
    return () => {};
  }

  async navigate(sessionId: string, url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    await session.page.goto(url, {
      waitUntil,
      timeout: this.config.timeout,
    });

    return session.page.url();
  }

  async click(sessionId: string, selector?: string, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (selector) {
      await session.page.click(selector, { button });
    } else {
      // No selector - click at center of viewport
      const viewport = session.page.viewportSize();
      if (viewport) {
        await session.page.mouse.click(viewport.width / 2, viewport.height / 2);
      }
    }
  }

  async clickAt(sessionId: string, x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    await session.page.mouse.click(x, y, { button });
  }

  async type(sessionId: string, text: string, selector?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (selector) {
      await session.page.fill(selector, text);
    } else {
      await session.page.keyboard.type(text);
    }
  }

  async scroll(sessionId: string, deltaX: number, deltaY: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    await session.page.evaluate(({ dx, dy }) => {
      window.scrollBy(dx, dy);
    }, { dx: deltaX, dy: deltaY });
  }

  async screenshot(sessionId: string, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    return Buffer.from(await session.page.screenshot({
      type: format,
    }));
  }

  async getDOM(sessionId: string): Promise<{ url: string; title: string; html: string; text: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const [url, title, html, text] = await Promise.all([
      session.page.url(),
      session.page.title(),
      session.page.content(),
      session.page.evaluate(() => document.body.innerText),
    ]);

    return { url, title, html, text };
  }

  async getCurrentURL(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.page.url();
  }

  async goBack(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.goBack();
  }

  async goForward(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.goForward();
  }

  async reload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.reload();
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  async closeAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.closeSession(id)));
  }
}
