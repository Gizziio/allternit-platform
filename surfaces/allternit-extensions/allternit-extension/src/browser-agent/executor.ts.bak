/**
 * Browser Action Executor
 *
 * Extracted from browser-agent service-worker.ts.
 * Provides executeBrowserAction() used by the ConnectionManager cowork path
 * and by the merged extension background message router.
 */

import type { BrowserAction } from './browser-actions';
import { HostAllowlist } from './safety/host-allowlist';
import { CircuitBreaker } from './safety/circuit-breaker';

const allowlist = new HostAllowlist();
const circuitBreaker = new CircuitBreaker();

// Track connection manager reference so results can be sent back
let _sendResult: ((action: string, tabId: number, result: unknown) => void) | null = null;

export function setResultSender(
  fn: (action: string, tabId: number, result: unknown) => void
): void {
  _sendResult = fn;
}

function sendResult(action: string, tabId: number, result: unknown): void {
  _sendResult?.(action, tabId, result);
}

export async function executeBrowserAction(action: BrowserAction): Promise<void> {
  const typedAction = action as { type: string; tabId?: number; params?: Record<string, unknown> };
  const tabId = typedAction.tabId ?? 0;

  if (circuitBreaker.canExecute().allowed === false) {
    throw new Error('Circuit breaker open — too many failed actions');
  }

  try {
    switch (typedAction.type) {
      case 'BROWSER.NAV':
        await handleNavigate(tabId, typedAction.params as { url: string });
        break;
      case 'BROWSER.GET_CONTEXT':
        await handleGetContext(
          tabId,
          typedAction.params as { includeDom?: boolean; includeAccessibility?: boolean }
        );
        break;
      case 'BROWSER.ACT':
        await handleAct(
          tabId,
          typedAction.params as { action: string; target: unknown; options?: unknown }
        );
        break;
      case 'BROWSER.EXTRACT':
        await handleExtract(tabId, typedAction.params as { query: unknown });
        break;
      case 'BROWSER.SCREENSHOT':
        await handleScreenshot(tabId, typedAction.params as { fullPage?: boolean });
        break;
      case 'BROWSER.WAIT':
        await handleWait(
          tabId,
          typedAction.params as { condition: string; timeout?: number }
        );
        break;
      default:
        throw new Error(`Unknown action type: ${typedAction.type}`);
    }

    circuitBreaker.recordAction(typedAction.type, true);
  } catch (error) {
    circuitBreaker.recordAction(typedAction.type, false);
    throw error;
  }
}

async function handleNavigate(tabId: number, params: { url: string }): Promise<void> {
  const { url } = params;

  if (!allowlist.isAllowed(url)) {
    throw new Error(`URL not in allowlist: ${url}`);
  }

  await chrome.tabs.update(tabId, { url });

  await new Promise<void>((resolve) => {
    const listener = (
      details: chrome.webNavigation.WebNavigationFramedCallbackDetails
    ) => {
      if (details.tabId === tabId && details.frameId === 0) {
        chrome.webNavigation.onCompleted.removeListener(listener);
        resolve();
      }
    };
    chrome.webNavigation.onCompleted.addListener(listener);
  });

  sendResult('BROWSER.NAV', tabId, { success: true });
}

async function handleGetContext(
  tabId: number,
  params: { includeDom?: boolean; includeAccessibility?: boolean }
): Promise<void> {
  const { includeDom = true, includeAccessibility = false } = params;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (dom: boolean, a11y: boolean) => {
      const ctx: Record<string, unknown> = {
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
      if (dom) {
        ctx.domSnapshot = {
          html: document.documentElement.outerHTML.slice(0, 50000),
          text: document.body.innerText.slice(0, 10000),
        };
      }
      if (a11y) {
        ctx.accessibility = (document as any).accessibilityTree;
      }
      return ctx;
    },
    args: [includeDom, includeAccessibility],
  });

  sendResult('BROWSER.GET_CONTEXT', tabId, results[0]?.result);
}

async function handleAct(
  tabId: number,
  params: { action: string; target: unknown; options?: unknown }
): Promise<void> {
  const { action, target, options } = params;
  await chrome.tabs.sendMessage(tabId, { type: 'BROWSER.ACT', action, target, options });
}

async function handleExtract(tabId: number, params: { query: unknown }): Promise<void> {
  const { query } = params;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (queryData: string) => {
      const q = JSON.parse(queryData);
      switch (q.type) {
        case 'selector':
          return Array.from(document.querySelectorAll(q.value)).map((el) => ({
            text: el.textContent,
            html: el.outerHTML.slice(0, 1000),
          }));
        case 'links':
          return Array.from(document.links).map((a) => ({
            href: a.href,
            text: a.textContent,
          }));
        default:
          return null;
      }
    },
    args: [JSON.stringify(query)],
  });

  sendResult('BROWSER.EXTRACT', tabId, results[0]?.result);
}

async function handleScreenshot(
  tabId: number,
  _params: { fullPage?: boolean }
): Promise<void> {
  const screenshot = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
  sendResult('BROWSER.SCREENSHOT', tabId, { screenshot });
}

async function handleWait(
  tabId: number,
  params: { condition: string; timeout?: number }
): Promise<void> {
  const { condition, timeout } = params;
  await chrome.tabs.sendMessage(tabId, { type: 'BROWSER.WAIT', condition, timeout });
}
