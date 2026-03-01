/**
 * Background Service Worker (MV3)
 * 
 * Core extension background script handling:
 * - Native messaging host communication
 * - WebSocket connection to A2R API
 * - Tab management and CDP session routing
 * - Message routing between content scripts and native host
 */

import { BrowserAction, BrowserActionSchema } from '../types/browser-actions';
import { MessageRouter } from './message-router';
import { NativeMessagingHost } from './native-messaging';
import { WebSocketClient } from './websocket-client';
import { TabManager } from './tab-manager';
import { HostAllowlist } from './safety/host-allowlist';
import { CircuitBreaker } from './safety/circuit-breaker';

// ============================================================================
// Global State
// ============================================================================

const router = new MessageRouter();
const nativeHost = new NativeMessagingHost();
const wsClient = new WebSocketClient();
const tabManager = new TabManager();
const allowlist = new HostAllowlist();
const circuitBreaker = new CircuitBreaker();

// Extension configuration
let config = {
  apiUrl: 'ws://localhost:3000/ws/extension',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
};

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
  
  // Load configuration
  const stored = await chrome.storage.local.get(['a2rConfig']);
  if (stored.a2rConfig) {
    config = { ...config, ...stored.a2rConfig };
  }
  
  // Initialize components
  await allowlist.load();
  await tabManager.initialize();
  
  // Connect to A2R backend
  connectWebSocket();
  
  // Setup native messaging
  setupNativeMessaging();
  
  console.log('[A2R Extension] Initialized');
}

// ============================================================================
// WebSocket Connection
// ============================================================================

function connectWebSocket() {
  wsClient.connect(config.apiUrl, {
    onOpen: () => {
      console.log('[A2R Extension] WebSocket connected');
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      chrome.action.setBadgeText({ text: '●' });
    },
    onMessage: handleWebSocketMessage,
    onClose: () => {
      console.log('[A2R Extension] WebSocket disconnected');
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      chrome.action.setBadgeText({ text: '●' });
      
      // Attempt reconnect
      setTimeout(connectWebSocket, config.reconnectInterval);
    },
    onError: (error) => {
      console.error('[A2R Extension] WebSocket error:', error);
    },
  });
}

async function handleWebSocketMessage(message: unknown) {
  try {
    const action = BrowserActionSchema.parse(message);
    await executeBrowserAction(action);
  } catch (err) {
    console.error('[A2R Extension] Invalid message:', err);
    wsClient.send({
      type: 'error',
      error: 'Invalid action format',
      originalMessage: message,
    });
  }
}

// ============================================================================
// Native Messaging
// ============================================================================

function setupNativeMessaging() {
  nativeHost.connect({
    onMessage: (message) => {
      // Forward native host messages to WebSocket
      wsClient.send(message);
    },
    onDisconnect: () => {
      console.log('[A2R Extension] Native host disconnected');
    },
  });
}

// ============================================================================
// Browser Action Execution
// ============================================================================

async function executeBrowserAction(action: BrowserAction): Promise<void> {
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
  
  wsClient.send({
    type: 'action:complete',
    action: 'BROWSER.NAV',
    tabId,
    result: { success: true },
  });
}

async function handleGetContext(tabId: number, params: { includeDom?: boolean; includeAccessibility?: boolean }) {
  const { includeDom = true, includeAccessibility = false } = params;
  
  // Execute in content script
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
          html: document.documentElement.outerHTML.slice(0, 50000), // Limit size
          text: document.body.innerText.slice(0, 10000),
        };
      }
      
      if (includeAccessibility) {
        // Get accessibility tree if available
        // @ts-ignore
        const tree = document.accessibilityTree;
        context.accessibility = tree;
      }
      
      return context;
    },
    args: [includeDom, includeAccessibility],
  });
  
  wsClient.send({
    type: 'action:complete',
    action: 'BROWSER.GET_CONTEXT',
    tabId,
    result: results[0]?.result,
  });
}

async function handleAct(tabId: number, params: { action: string; target: unknown; options?: unknown }) {
  const { action, target, options } = params;
  
  // Send to content script for execution
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
  
  wsClient.send({
    type: 'action:complete',
    action: 'BROWSER.EXTRACT',
    tabId,
    result: results[0]?.result,
  });
}

async function handleScreenshot(tabId: number, params: { fullPage?: boolean }) {
  const { fullPage = false } = params;
  
  const screenshot = await chrome.tabs.captureVisibleTab(undefined, {
    format: 'png',
  });
  
  wsClient.send({
    type: 'action:complete',
    action: 'BROWSER.SCREENSHOT',
    tabId,
    result: { screenshot },
  });
}

async function handleWait(tabId: number, params: { condition: string; timeout?: number }) {
  const { condition, timeout = 5000 } = params;
  
  // Implement wait logic in content script
  await chrome.tabs.sendMessage(tabId, {
    type: 'BROWSER.WAIT',
    condition,
    timeout,
  });
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'getStatus':
          sendResponse({
            connected: wsClient.isConnected(),
            nativeHostConnected: nativeHost.isConnected(),
          });
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
      sendResponse({ error: (error as Error).message });
    }
  })();
  
  return true; // Keep channel open for async
});

// ============================================================================
// Tab Management
// ============================================================================

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Notify backend of tab change
  wsClient.send({
    type: 'tab:activated',
    tabId: activeInfo.tabId,
    windowId: activeInfo.windowId,
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    wsClient.send({
      type: 'tab:updated',
      tabId,
      url: tab.url,
      title: tab.title,
    });
  }
});

console.log('[A2R Extension] Service worker loaded');
