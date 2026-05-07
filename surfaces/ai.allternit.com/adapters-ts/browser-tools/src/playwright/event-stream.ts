/**
 * Unified Event Stream
 * 
 * Real-time browser event streaming for agent monitoring.
 * Captures navigation, DOM changes, clicks, inputs, and screenshots.
 */

import type { Page } from 'playwright';
import type {
  BrowserEvent,
  NavigationEvent,
  DOMChangeEvent,
  BrowserEventType,
} from '../types/index.js';
import { sessionRegistry } from './driver.js';

// ============================================================================
// Event Stream Types
// ============================================================================

export interface EventStreamConfig {
  captureNavigation: boolean;
  captureDOMChanges: boolean;
  captureClicks: boolean;
  captureInputs: boolean;
  captureScrolls: boolean;
  captureScreenshots: boolean;
  screenshotInterval?: number; // ms
  domMutationThrottle?: number; // ms
}

export const DEFAULT_STREAM_CONFIG: EventStreamConfig = {
  captureNavigation: true,
  captureDOMChanges: true,
  captureClicks: true,
  captureInputs: true,
  captureScrolls: false,
  captureScreenshots: false,
  screenshotInterval: 5000,
  domMutationThrottle: 100,
};

export type EventHandler = (event: BrowserEvent) => void;

// ============================================================================
// Event Stream Manager
// ============================================================================

interface StreamSubscription {
  id: string;
  sessionId: string;
  handlers: Set<EventHandler>;
  config: EventStreamConfig;
  cleanup: (() => void)[];
}

class EventStreamManager {
  private streams: Map<string, StreamSubscription> = new Map();
  private screenshotIntervals: Map<string, NodeJS.Timeout> = new Map();

  subscribe(
    sessionId: string,
    handler: EventHandler,
    config: Partial<EventStreamConfig> = {}
  ): string {
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fullConfig = { ...DEFAULT_STREAM_CONFIG, ...config };

    const subscription: StreamSubscription = {
      id: streamId,
      sessionId,
      handlers: new Set([handler]),
      config: fullConfig,
      cleanup: [],
    };

    this.streams.set(streamId, subscription);
    this.setupEventListeners(subscription);

    return streamId;
  }

  addHandler(streamId: string, handler: EventHandler): boolean {
    const subscription = this.streams.get(streamId);
    if (!subscription) return false;
    
    subscription.handlers.add(handler);
    return true;
  }

  removeHandler(streamId: string, handler: EventHandler): boolean {
    const subscription = this.streams.get(streamId);
    if (!subscription) return false;
    
    subscription.handlers.delete(handler);
    
    // Clean up if no handlers
    if (subscription.handlers.size === 0) {
      this.unsubscribe(streamId);
    }
    
    return true;
  }

  unsubscribe(streamId: string): void {
    const subscription = this.streams.get(streamId);
    if (!subscription) return;

    // Run cleanup functions
    subscription.cleanup.forEach(fn => {
      try { fn(); } catch {}
    });

    // Clear screenshot interval
    const interval = this.screenshotIntervals.get(streamId);
    if (interval) {
      clearInterval(interval);
      this.screenshotIntervals.delete(streamId);
    }

    this.streams.delete(streamId);
  }

  private setupEventListeners(subscription: StreamSubscription): void {
    const active = sessionRegistry.get(subscription.sessionId);
    if (!active) return;

    const { page } = active;
    const { config, sessionId } = subscription;

    // Navigation events
    if (config.captureNavigation) {
      this.setupNavigationListener(subscription, page);
    }

    // DOM mutation events
    if (config.captureDOMChanges) {
      this.setupDOMMutationListener(subscription, page);
    }

    // Click events
    if (config.captureClicks) {
      this.setupClickListener(subscription, page);
    }

    // Input events
    if (config.captureInputs) {
      this.setupInputListener(subscription, page);
    }

    // Scroll events
    if (config.captureScrolls) {
      this.setupScrollListener(subscription, page);
    }

    // Screenshot interval
    if (config.captureScreenshots && config.screenshotInterval) {
      this.setupScreenshotInterval(subscription, page);
    }
  }

  private setupNavigationListener(
    subscription: StreamSubscription,
    page: Page
  ): void {
    const handler = (frame: any) => {
      if (frame === page.mainFrame()) {
        const event: BrowserEvent = {
          id: generateEventId(),
          sessionId: subscription.sessionId,
          timestamp: new Date(),
          type: 'navigation',
          payload: {
            from: frame.url(),
            to: page.url(),
            title: frame.title(),
            timestamp: new Date(),
          } as NavigationEvent,
        };
        this.emit(subscription, event);
      }
    };

    page.on('framenavigated', handler);
    subscription.cleanup.push(() => page.off('framenavigated', handler));
  }

  private setupDOMMutationListener(
    subscription: StreamSubscription,
    page: Page
  ): void {
    // Inject mutation observer script
    const script = `
      (() => {
        if (window.__allternitMutationObserver) return;
        
        window.__allternitMutations = [];
        window.__allternitMutationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            const record = {
              type: mutation.type,
              target: mutation.target.tagName,
              selector: getSelector(mutation.target),
              addedNodes: mutation.addedNodes.length,
              removedNodes: mutation.removedNodes.length,
              timestamp: Date.now(),
            };
            window.__allternitMutations.push(record);
          });
        });
        
        window.__allternitMutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
        
        function getSelector(el) {
          if (el.id) return '#' + el.id;
          if (el.className) return '.' + el.className.split(' ').join('.');
          return el.tagName.toLowerCase();
        }
      })();
    `;

    page.evaluateOnNewDocument(script);

    // Poll for mutations
    const pollInterval = setInterval(async () => {
      try {
        const mutations = await page.evaluate(() => {
          const m = (window as any).__allternitMutations || [];
          (window as any).__allternitMutations = [];
          return m;
        });

        for (const mutation of mutations) {
          const event: BrowserEvent = {
            id: generateEventId(),
            sessionId: subscription.sessionId,
            timestamp: new Date(),
            type: 'dom_change',
            payload: {
              selector: mutation.selector,
              changeType: mutation.addedNodes > 0 ? 'added' : mutation.removedNodes > 0 ? 'removed' : 'modified',
            } as DOMChangeEvent,
          };
          this.emit(subscription, event);
        }
      } catch {}
    }, subscription.config.domMutationThrottle || 100);

    subscription.cleanup.push(() => clearInterval(pollInterval));
  }

  private setupClickListener(
    subscription: StreamSubscription,
    page: Page
  ): void {
    const script = `
      document.addEventListener('click', (e) => {
        if (window.__allternitClickHandler) {
          window.__allternitClickHandler({
            tag: e.target.tagName,
            id: e.target.id,
            class: e.target.className,
            text: e.target.textContent?.substring(0, 100),
            x: e.clientX,
            y: e.clientY,
          });
        }
      }, true);
    `;

    page.evaluateOnNewDocument(script);

    // Expose handler function
    const handler = (data: any) => {
      const event: BrowserEvent = {
        id: generateEventId(),
        sessionId: subscription.sessionId,
        timestamp: new Date(),
        type: 'click',
        payload: data,
      };
      this.emit(subscription, event);
    };

    page.exposeFunction('__allternitClickHandler', handler);
  }

  private setupInputListener(
    subscription: StreamSubscription,
    page: Page
  ): void {
    const script = `
      document.addEventListener('input', (e) => {
        if (window.__allternitInputHandler && e.target.tagName === 'INPUT') {
          window.__allternitInputHandler({
            tag: e.target.tagName,
            type: e.target.type,
            name: e.target.name,
            selector: getSelector(e.target),
            value: e.target.value?.substring(0, 100),
          });
        }
      }, true);
      
      function getSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.className) return '.' + el.className.split(' ').join('.');
        return el.tagName.toLowerCase();
      }
    `;

    page.evaluateOnNewDocument(script);

    const handler = (data: any) => {
      const event: BrowserEvent = {
        id: generateEventId(),
        sessionId: subscription.sessionId,
        timestamp: new Date(),
        type: 'input',
        payload: data,
      };
      this.emit(subscription, event);
    };

    page.exposeFunction('__allternitInputHandler', handler);
  }

  private setupScrollListener(
    subscription: StreamSubscription,
    page: Page
  ): void {
    const script = `
      let scrollTimeout;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (window.__allternitScrollHandler) {
            window.__allternitScrollHandler({
              x: window.scrollX,
              y: window.scrollY,
            });
          }
        }, 100);
      }, { passive: true });
    `;

    page.evaluateOnNewDocument(script);

    const handler = (data: any) => {
      const event: BrowserEvent = {
        id: generateEventId(),
        sessionId: subscription.sessionId,
        timestamp: new Date(),
        type: 'scroll',
        payload: data,
      };
      this.emit(subscription, event);
    };

    page.exposeFunction('__allternitScrollHandler', handler);
  }

  private setupScreenshotInterval(
    subscription: StreamSubscription,
    page: Page
  ): void {
    const interval = setInterval(async () => {
      try {
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: 50,
        });

        const event: BrowserEvent = {
          id: generateEventId(),
          sessionId: subscription.sessionId,
          timestamp: new Date(),
          type: 'screenshot',
          payload: {
            base64: screenshot.toString('base64'),
            format: 'jpeg',
          },
        };
        this.emit(subscription, event);
      } catch {}
    }, subscription.config.screenshotInterval);

    this.screenshotIntervals.set(subscription.id, interval);
  }

  private emit(subscription: StreamSubscription, event: BrowserEvent): void {
    for (const handler of subscription.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  getActiveStreams(sessionId?: string): string[] {
    if (!sessionId) {
      return Array.from(this.streams.keys());
    }
    return Array.from(this.streams.entries())
      .filter(([_, sub]) => sub.sessionId === sessionId)
      .map(([id, _]) => id);
  }

  closeAllForSession(sessionId: string): void {
    const streamIds = this.getActiveStreams(sessionId);
    for (const id of streamIds) {
      this.unsubscribe(id);
    }
  }
}

// ============================================================================
// SSE Event Stream (for HTTP APIs)
// ============================================================================

export interface SSEEvent {
  event: string;
  data: string;
  id?: string;
}

export class SSEEventStream {
  private encoder = new TextEncoder();

  format(event: SSEEvent): Uint8Array {
    let output = '';
    if (event.id) output += `id: ${event.id}\n`;
    output += `event: ${event.event}\n`;
    output += `data: ${event.data}\n\n`;
    return this.encoder.encode(output);
  }

  formatBrowserEvent(event: BrowserEvent): Uint8Array {
    return this.format({
      id: event.id,
      event: event.type,
      data: JSON.stringify({
        timestamp: event.timestamp,
        payload: event.payload,
      }),
    });
  }
}

export const sseEventStream = new SSEEventStream();

// ============================================================================
// Utility
// ============================================================================

function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Export
// ============================================================================

export const eventStreamManager = new EventStreamManager();

export default {
  eventStreamManager,
  sseEventStream,
  DEFAULT_STREAM_CONFIG,
};
