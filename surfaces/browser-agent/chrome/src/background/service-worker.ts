/**
 * Enhanced Background Service Worker (MV3)
 * 
 * Core extension background script with support for:
 * - Cloud Mode: WebSocket to cloud VPS
 * - Local Mode: WebSocket to local Desktop
 * - Cowork Mode: Native messaging with Desktop controlling extension
 */

import { BrowserAction } from '../types/browser-actions';
import { 
  initConnectionManager, 
  getConnectionManager,
  ConnectionManager,
  ConnectionMode,
  ConnectionState 
} from './connection-manager';
import { 
  connectNativeHost, 
  subscribeToEvents,
  NativeMessage,
  ExecuteRequest,
  ExecuteResult 
} from './native-messaging';
import { TabManager } from './tab-manager';
import { HostAllowlist } from './safety/host-allowlist';
import { CircuitBreaker } from './safety/circuit-breaker';

// ============================================================================
// Global State
// ============================================================================

let connectionManager: ConnectionManager | null = null;
const tabManager = new TabManager();
const allowlist = new HostAllowlist();
const circuitBreaker = new CircuitBreaker();

// ============================================================================
// Lifecycle
// ============================================================================

chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[A2R Extension] Installed:', details.reason);
  initialize();
});

async function initialize() {
  console.log('[A2R Extension] Initializing...');
  
  // Initialize components
  await allowlist.load();
  await tabManager.initialize();
  
  // Initialize connection manager
  connectionManager = await initConnectionManager();
  
  // Subscribe to messages from backend
  connectionManager.onMessage((message) => {
    handleBackendMessage(message);
  });
  
  console.log('[A2R Extension] Initialized');
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'getConnectionState':
          sendResponse({
            mode: connectionManager?.getMode() || 'cloud',
            state: connectionManager?.getState() || 'disconnected',
            connected: connectionManager?.isConnected() || false,
          });
          break;
          
        case 'switchMode':
          const success = await connectionManager?.connect(message.mode as ConnectionMode);
          broadcastConnectionState();
          sendResponse({ success, state: connectionManager?.getState() });
          break;
          
        case 'reconnect':
          await connectionManager?.connect(connectionManager.getMode());
          broadcastConnectionState();
          sendResponse({ state: connectionManager?.getState() });
          break;
          
        case 'getConfig':
          sendResponse(connectionManager?.getConfig());
          break;
          
        case 'updateConfig':
          await connectionManager?.updateConfig(message.config);
          sendResponse({ success: true });
          break;
          
        case 'executeAction':
          await executeBrowserAction(message.action);
          sendResponse({ success: true });
          break;
          
        case 'updateAllowlist':
          await allowlist.update(message.hosts);
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[A2R Extension] Message handler error:', error);
      sendResponse({ error: (error as Error).message });
    }
  })();
  
  return true; // Keep channel open for async
});

// ============================================================================
// Backend Message Handling
// ============================================================================

async function handleBackendMessage(message: unknown): Promise<void> {
  try {
    const msg = message as { type: string; [key: string]: unknown };
    
    switch (msg.type) {
      case 'execute':
        // Execute browser action from backend
        const action = msg.payload as BrowserAction;
        await executeBrowserAction(action);
        break;
        
      case 'ping':
        // Respond to keepalive
        connectionManager?.send({ 
          id: generateId(),
          type: 'pong',
          timestamp: Date.now(),
        });
        break;
        
      case 'getTabs':
        // Return list of tabs
        const tabs = await chrome.tabs.query({});
        connectionManager?.send({
          id: generateId(),
          type: 'tabs',
          payload: tabs.map(t => ({
            id: t.id,
            url: t.url,
            title: t.title,
            active: t.active,
          })),
          timestamp: Date.now(),
        });
        break;
        
      default:
        console.log('[A2R Extension] Unknown backend message:', msg.type);
    }
  } catch (error) {
    console.error('[A2R Extension] Failed to handle backend message:', error);
  }
}

// ============================================================================
// Browser Action Execution
// ============================================================================

export async function executeBrowserAction(action: BrowserAction): Promise<void> {
  const { tabId } = action;
  
  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
    throw new Error('Circuit breaker open - too many failed actions');
  }
  
  try {
    switch (action.type) {
      case 'BROWSER.NAV':
        await handleNavigate(tabId, action.params);
        break;
        
      case 'BROWSER.GET_CONTEXT':
        await handleGetContext(tabId, action.params);
        break;
        
      case 'BROWSER.ACT':
        await handleAct(tabId, action.params);
        break;
        
      case 'BROWSER.EXTRACT':
        await handleExtract(tabId, action.params);
        break;
        
      case 'BROWSER.SCREENSHOT':
        await handleScreenshot(tabId, action.params);
        break;
        
      case 'BROWSER.WAIT':
        await handleWait(tabId, action.params);
        break;
        
      default:
        throw new Error(`Unknown action type: ${(action as {type: string}).type}`);
    }
    
    circuitBreaker.recordSuccess();
  } catch (error) {
    circuitBreaker.recordFailure();
    throw error;
  }
}

async function handleNavigate(tabId: number, params: { url: string }) {
  const { url } = params;
  
  // Validate URL against allowlist
  if (!allowlist.isAllowed(url)) {
    throw new Error(`URL not in allowlist: ${url}`);
  }
  
  await chrome.tabs.update(tabId, { url });
  
  // Wait for navigation to complete
  await new Promise<void>((resolve) => {
    const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0) {
        chrome.webNavigation.onCompleted.removeListener(listener);
        resolve();
      }
    };
    chrome.webNavigation.onCompleted.addListener(listener);
  });
  
  sendResult('BROWSER.NAV', tabId, { success: true });
}

async function handleGetContext(tabId: number, params: { includeDom?: boolean; includeAccessibility?: boolean }) {
  const { includeDom = true, includeAccessibility = false } = params;
  
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (includeDom, includeAccessibility) => {
      const context: Record<string, unknown> = {
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
      
      if (includeDom) {
        context.domSnapshot = {
          html: document.documentElement.outerHTML.slice(0, 50000),
          text: document.body.innerText.slice(0, 10000),
        };
      }
      
      if (includeAccessibility) {
        // @ts-ignore
        const tree = document.accessibilityTree;
        context.accessibility = tree;
      }
      
      return context;
    },
    args: [includeDom, includeAccessibility],
  });
  
  sendResult('BROWSER.GET_CONTEXT', tabId, results[0]?.result);
}

async function handleAct(tabId: number, params: { action: string; target: unknown; options?: unknown }) {
  const { action, target, options } = params;
  
  await chrome.tabs.sendMessage(tabId, {
    type: 'BROWSER.ACT',
    action,
    target,
    options,
  });
}

async function handleExtract(tabId: number, params: { query: unknown }) {
  const { query } = params;
  
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (queryData) => {
      const query = JSON.parse(queryData);
      
      switch (query.type) {
        case 'selector':
          return Array.from(document.querySelectorAll(query.value)).map(el => ({
            text: el.textContent,
            html: el.outerHTML.slice(0, 1000),
          }));
          
        case 'text':
          const xpath = `//*[contains(text(), '${query.value}')]`;
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const elements = [];
          for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i)?.textContent);
          }
          return elements;
          
        case 'links':
          return Array.from(document.links).map(a => ({
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

async function handleScreenshot(tabId: number, params: { fullPage?: boolean }) {
  const screenshot = await chrome.tabs.captureVisibleTab(undefined, {
    format: 'png',
  });
  
  sendResult('BROWSER.SCREENSHOT', tabId, { screenshot });
}

async function handleWait(tabId: number, params: { condition: string; timeout?: number }) {
  const { condition, timeout = 5000 } = params;
  
  await chrome.tabs.sendMessage(tabId, {
    type: 'BROWSER.WAIT',
    condition,
    timeout,
  });
}

function sendResult(action: string, tabId: number, result: unknown): void {
  connectionManager?.send({
    id: generateId(),
    type: 'action:complete',
    payload: {
      action,
      tabId,
      result,
    },
    timestamp: Date.now(),
  });
}

// ============================================================================
// Tab Management
// ============================================================================

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  connectionManager?.send({
    id: generateId(),
    type: 'tab:activated',
    payload: {
      tabId: activeInfo.tabId,
      windowId: activeInfo.windowId,
    },
    timestamp: Date.now(),
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    connectionManager?.send({
      id: generateId(),
      type: 'tab:updated',
      payload: {
        tabId,
        url: tab.url,
        title: tab.title,
      },
      timestamp: Date.now(),
    });
  }
});

// ============================================================================
// Utilities
// ============================================================================

function broadcastConnectionState(): void {
  const state = {
    type: 'connectionStateChanged',
    mode: connectionManager?.getMode(),
    state: connectionManager?.getState(),
    connected: connectionManager?.isConnected(),
  };
  
  // Broadcast to all popup windows
  chrome.runtime.sendMessage(state).catch(() => {
    // Popup might not be open, ignore error
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

console.log('[A2R Extension] Service worker loaded');
