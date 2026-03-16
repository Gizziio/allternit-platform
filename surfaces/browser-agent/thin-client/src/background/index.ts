/**
 * Background Service Worker
 * 
 * Main entry point for extension background process.
 * Manages native messaging, tab tracking, and message routing.
 */

import { 
  connectNativeHost, 
  sendToNative, 
  isNativeConnected,
  disconnectNativeHost 
} from './native-messaging';

// Track extension state
let isReady = false;

/**
 * Initialize extension
 */
function initialize(): void {
  console.log('[A2R Thin Client] Background script initializing...');
  
  // Connect to native host
  connectNativeHost();
  
  // Setup event listeners
  setupEventListeners();
  
  isReady = true;
  console.log('[A2R Thin Client] Background script ready');
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
  // Extension icon click
  chrome.action.onClicked.addListener(handleActionClick);
  
  // Tab events
  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  
  // Messages from content scripts
  chrome.runtime.onMessage.addListener(handleContentMessage);
  
  // Install/update events
  chrome.runtime.onInstalled.addListener(handleInstalled);
}

/**
 * Handle extension icon click
 */
function handleActionClick(tab: chrome.tabs.Tab): void {
  // Toggle connection or show status
  if (isNativeConnected()) {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#00C853' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF1744' });
    connectNativeHost();
  }
}

/**
 * Handle tab activation
 */
function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
  // Notify native host of tab change
  sendToNative({
    type: 'TAB_ACTIVATED',
    tabId: activeInfo.tabId,
    windowId: activeInfo.windowId,
    timestamp: Date.now()
  });
  
  // Get tab info and send
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    
    sendToNative({
      type: 'ACTIVE_TAB_INFO',
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
  });
}

/**
 * Handle tab updates (URL changes, etc.)
 */
function handleTabUpdated(
  tabId: number, 
  changeInfo: chrome.tabs.TabChangeInfo, 
  tab: chrome.tabs.Tab
): void {
  if (changeInfo.status === 'complete') {
    sendToNative({
      type: 'TAB_LOADED',
      tabId,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
  }
}

/**
 * Handle messages from content scripts
 */
function handleContentMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  console.log('[A2R Thin Client] Message from content script:', message);
  
  // Forward to native host
  if (isNativeConnected()) {
    const enrichedMessage = {
      ...message,
      source: 'content_script',
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      timestamp: Date.now()
    };
    
    sendToNative(enrichedMessage);
    sendResponse({ success: true, forwarded: true });
  } else {
    sendResponse({ success: false, error: 'Native host not connected' });
  }
  
  return true; // Keep channel open for async
}

/**
 * Handle extension install/update
 */
function handleInstalled(details: chrome.runtime.InstalledDetails): void {
  console.log('[A2R Thin Client] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  }
  
  // Set default badge
  chrome.action.setBadgeText({ text: '' });
}

// Initialize on startup
initialize();

// Cleanup on unload
self.addEventListener('beforeunload', () => {
  disconnectNativeHost();
});
