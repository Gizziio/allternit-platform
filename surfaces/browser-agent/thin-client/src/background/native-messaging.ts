/**
 * Native Messaging Host Connection
 * 
 * Manages connection to A2R Desktop via Chrome's native messaging API.
 * This allows bidirectional communication between the extension and Electron app.
 */

const NATIVE_HOST_NAME = 'com.a2r.desktop';

let nativePort: chrome.runtime.Port | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

/**
 * Connect to the native messaging host (A2R Desktop)
 */
export function connectNativeHost(): void {
  try {
    console.log('[A2R Thin Client] Connecting to native host...');
    
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    
    nativePort.onMessage.addListener((message: any) => {
      console.log('[A2R Thin Client] Received from native:', message);
      handleNativeMessage(message);
    });
    
    nativePort.onDisconnect.addListener(() => {
      console.log('[A2R Thin Client] Native host disconnected');
      nativePort = null;
      
      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`[A2R Thin Client] Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connectNativeHost, RECONNECT_DELAY);
      } else {
        console.error('[A2R Thin Client] Max reconnection attempts reached');
      }
    });
    
    // Reset reconnect counter on successful connection
    reconnectAttempts = 0;
    
    // Notify desktop that extension is ready
    sendToNative({
      type: 'EXTENSION_READY',
      version: chrome.runtime.getManifest().version,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[A2R Thin Client] Failed to connect:', error);
  }
}

/**
 * Send message to native host
 */
export function sendToNative(message: any): boolean {
  if (!nativePort) {
    console.warn('[A2R Thin Client] No native connection available');
    return false;
  }
  
  try {
    nativePort.postMessage(message);
    return true;
  } catch (error) {
    console.error('[A2R Thin Client] Failed to send message:', error);
    return false;
  }
}

/**
 * Handle incoming messages from native host
 */
function handleNativeMessage(message: any): void {
  switch (message.type) {
    case 'EXECUTE_SCRIPT':
      // Execute script in active tab
      executeInActiveTab(message.script, message.args);
      break;
      
    case 'GET_PAGE_INFO':
      // Get information about current page
      getPageInfo();
      break;
      
    case 'INJECT_SCRIPT':
      // Inject script into specific tab
      injectScript(message.tabId, message.script);
      break;
      
    case 'QUERY_TABS':
      // Query all tabs and return info
      queryAllTabs();
      break;
      
    default:
      // Forward to content scripts
      broadcastToContentScripts(message);
  }
}

/**
 * Execute script in the active tab
 */
async function executeInActiveTab(script: string, args?: any): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scriptText, scriptArgs) => {
        // Create function from string and execute
        const fn = new Function('args', scriptText);
        return fn(scriptArgs);
      },
      args: [script, args]
    });
    
    sendToNative({
      type: 'SCRIPT_RESULT',
      success: true,
      result: results[0]?.result,
      tabId: tab.id
    });
  } catch (error) {
    sendToNative({
      type: 'SCRIPT_RESULT',
      success: false,
      error: String(error),
      tabId: tab.id
    });
  }
}

/**
 * Get information about the current active page
 */
async function getPageInfo(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        path: window.location.pathname,
        readyState: document.readyState
      })
    });
    
    sendToNative({
      type: 'PAGE_INFO',
      tabId: tab.id,
      info: result?.result
    });
  } catch (error) {
    sendToNative({
      type: 'PAGE_INFO',
      error: String(error)
    });
  }
}

/**
 * Inject script into specific tab
 */
async function injectScript(tabId: number, script: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (scriptText) => {
        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptText;
        scriptEl.setAttribute('data-a2r-injected', 'true');
        (document.head || document.documentElement).appendChild(scriptEl);
        scriptEl.remove();
      },
      args: [script]
    });
    
    sendToNative({
      type: 'INJECT_RESULT',
      success: true,
      tabId
    });
  } catch (error) {
    sendToNative({
      type: 'INJECT_RESULT',
      success: false,
      error: String(error),
      tabId
    });
  }
}

/**
 * Query all tabs and send info to native host
 */
async function queryAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  
  const tabInfo = tabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    active: tab.active,
    windowId: tab.windowId
  }));
  
  sendToNative({
    type: 'TABS_INFO',
    tabs: tabInfo
  });
}

/**
 * Broadcast message to all content scripts
 */
async function broadcastToContentScripts(message: any): Promise<void> {
  const tabs = await chrome.tabs.query({});
  
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab doesn't have content script, ignore
      });
    }
  }
}

/**
 * Check if native host is connected
 */
export function isNativeConnected(): boolean {
  return nativePort !== null;
}

/**
 * Disconnect from native host
 */
export function disconnectNativeHost(): void {
  if (nativePort) {
    nativePort.disconnect();
    nativePort = null;
  }
}

// Initialize connection on startup
connectNativeHost();
