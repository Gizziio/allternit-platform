/**
 * Native Messaging Protocol
 * 
 * Handles communication between Chrome Extension and A2R native host.
 * Uses Chrome's nativeMessaging API for bi-directional communication.
 */

import type { BrowserAction } from './browser-actions';

// Native messaging host configuration
const NATIVE_HOST_NAME = 'com.a2r.native_host';

// Message types
export type NativeMessageType = 
  | 'ping'
  | 'pong'
  | 'execute'
  | 'result'
  | 'error'
  | 'event'
  | 'register'
  | 'unregister';

export interface NativeMessage {
  id: string;
  type: NativeMessageType;
  payload?: unknown;
  timestamp: number;
}

export interface ExecuteRequest {
  tabId: number;
  url: string;
  actions: BrowserAction[];
  options?: {
    timeout?: number;
    waitForNavigation?: boolean;
  };
}

export interface ExecuteResult {
  success: boolean;
  results: Array<{
    actionIndex: number;
    success: boolean;
    message?: string;
    data?: unknown;
  }>;
  duration: number;
}

// Connection state
interface ConnectionState {
  port: chrome.runtime.Port | null;
  connected: boolean;
  messageQueue: NativeMessage[];
  pendingRequests: Map<string, (response: NativeMessage) => void>;
  eventHandlers: Set<(event: NativeMessage) => void>;
}

const state: ConnectionState = {
  port: null,
  connected: false,
  messageQueue: [],
  pendingRequests: new Map(),
  eventHandlers: new Set(),
};

/**
 * Connect to native messaging host
 */
export async function connectNativeHost(): Promise<boolean> {
  if (state.connected && state.port) {
    return true;
  }

  try {
    state.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    
    state.port.onMessage.addListener(handleNativeMessage);
    state.port.onDisconnect.addListener(handleDisconnect);
    
    state.connected = true;
    
    // Send any queued messages
    flushMessageQueue();
    
    // Send registration
    sendMessage({
      id: generateId(),
      type: 'register',
      payload: {
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
      },
      timestamp: Date.now(),
    });
    
    return true;
  } catch (error) {
    console.error('[NativeMessaging] Failed to connect:', error);
    state.connected = false;
    state.port = null;
    return false;
  }
}

/**
 * Disconnect from native host
 */
export function disconnectNativeHost(): void {
  if (state.port) {
    sendMessage({
      id: generateId(),
      type: 'unregister',
      timestamp: Date.now(),
    });
    
    state.port.disconnect();
    state.port = null;
    state.connected = false;
  }
}

/**
 * Execute browser actions via native host
 */
export async function executeViaNativeHost(
  request: ExecuteRequest
): Promise<ExecuteResult> {
  if (!state.connected) {
    throw new Error('Native host not connected');
  }

  const message: NativeMessage = {
    id: generateId(),
    type: 'execute',
    payload: request,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      state.pendingRequests.delete(message.id);
      reject(new Error('Native host request timeout'));
    }, request.options?.timeout || 30000);

    state.pendingRequests.set(message.id, (response) => {
      clearTimeout(timeout);
      
      if (response.type === 'error') {
        reject(new Error((response.payload as any)?.message || 'Unknown error'));
      } else {
        resolve(response.payload as ExecuteResult);
      }
    });

    sendMessage(message);
  });
}

/**
 * Send ping to check connection
 */
export async function pingNativeHost(): Promise<boolean> {
  if (!state.connected) {
    return false;
  }

  const message: NativeMessage = {
    id: generateId(),
    type: 'ping',
    timestamp: Date.now(),
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      state.pendingRequests.delete(message.id);
      resolve(false);
    }, 5000);

    state.pendingRequests.set(message.id, (response) => {
      clearTimeout(timeout);
      resolve(response.type === 'pong');
    });

    sendMessage(message);
  });
}

/**
 * Subscribe to events from native host
 */
export function subscribeToEvents(handler: (event: NativeMessage) => void): () => void {
  state.eventHandlers.add(handler);
  
  return () => {
    state.eventHandlers.delete(handler);
  };
}

/**
 * Check if connected to native host
 */
export function isNativeHostConnected(): boolean {
  return state.connected;
}

// ============================================================================
// Internal Handlers
// ============================================================================

function handleNativeMessage(message: NativeMessage): void {
  // Handle response to pending request
  if (state.pendingRequests.has(message.id)) {
    const handler = state.pendingRequests.get(message.id)!;
    state.pendingRequests.delete(message.id);
    handler(message);
    return;
  }

  // Handle events
  if (message.type === 'event') {
    state.eventHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[NativeMessaging] Event handler error:', error);
      }
    });
    return;
  }

  // Handle ping/pong
  if (message.type === 'ping') {
    sendMessage({
      id: message.id,
      type: 'pong',
      timestamp: Date.now(),
    });
  }
}

function handleDisconnect(): void {
  console.log('[NativeMessaging] Disconnected from native host');
  state.connected = false;
  state.port = null;
  
  // Reject all pending requests
  state.pendingRequests.forEach((handler, id) => {
    handler({
      id,
      type: 'error',
      payload: { message: 'Disconnected from native host' },
      timestamp: Date.now(),
    });
  });
  state.pendingRequests.clear();
}

function sendMessage(message: NativeMessage): void {
  if (state.connected && state.port) {
    try {
      state.port.postMessage(message);
    } catch (error) {
      console.error('[NativeMessaging] Failed to send message:', error);
      state.messageQueue.push(message);
    }
  } else {
    state.messageQueue.push(message);
  }
}

function flushMessageQueue(): void {
  while (state.messageQueue.length > 0) {
    const message = state.messageQueue.shift()!;
    if (state.connected && state.port) {
      try {
        state.port.postMessage(message);
      } catch (error) {
        state.messageQueue.unshift(message);
        break;
      }
    }
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Background Script Integration
// ============================================================================

/**
 * Initialize native messaging in background script
 */
export function initNativeMessaging(): void {
  // Auto-connect on startup
  connectNativeHost().then(connected => {
    if (connected) {
      console.log('[NativeMessaging] Connected to native host');
    } else {
      console.log('[NativeMessaging] Native host not available');
    }
  });

  // Handle extension lifecycle
  chrome.runtime.onStartup.addListener(() => {
    connectNativeHost();
  });

  chrome.runtime.onInstalled.addListener(() => {
    connectNativeHost();
  });
}
