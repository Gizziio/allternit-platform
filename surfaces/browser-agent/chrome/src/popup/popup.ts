/**
 * Popup Script
 * 
 * Manages the extension popup UI for connection mode selection
 * and status display.
 */

import { ConnectionMode, ConnectionState } from '../background/connection-manager';

interface PopupState {
  mode: ConnectionMode;
  state: ConnectionState;
  backendName: string;
}

// UI Elements
const elements = {
  statusIndicator: document.getElementById('statusIndicator')!,
  statusIcon: document.getElementById('statusIcon')!,
  statusTitle: document.getElementById('statusTitle')!,
  statusDesc: document.getElementById('statusDesc')!,
  btnCloud: document.getElementById('btnCloud')!,
  btnLocal: document.getElementById('btnLocal')!,
  btnCowork: document.getElementById('btnCowork')!,
  btnReconnect: document.getElementById('btnReconnect')!,
  btnSettings: document.getElementById('btnSettings')!,
  linkOptions: document.getElementById('linkOptions')!,
  cloudInfo: document.getElementById('cloudInfo')!,
  localInfo: document.getElementById('localInfo')!,
  coworkInfo: document.getElementById('coworkInfo')!,
};

// State
let currentState: PopupState = {
  mode: 'cloud',
  state: 'disconnected',
  backendName: '',
};

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  setupEventListeners();
  await loadState();
  updateUI();
});

function setupEventListeners(): void {
  // Mode buttons
  elements.btnCloud.addEventListener('click', () => switchMode('cloud'));
  elements.btnLocal.addEventListener('click', () => switchMode('local'));
  elements.btnCowork.addEventListener('click', () => switchMode('cowork'));
  
  // Action buttons
  elements.btnReconnect.addEventListener('click', reconnect);
  elements.btnSettings.addEventListener('click', openSettings);
  elements.linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    openOptionsPage();
  });
}

// ============================================================================
// State Management
// ============================================================================

async function loadState(): Promise<void> {
  try {
    // Get connection state from background script
    const response = await sendMessageToBackground({ type: 'getConnectionState' });
    
    if (response) {
      currentState = {
        mode: response.mode || 'cloud',
        state: response.state || 'disconnected',
        backendName: response.backendName || '',
      };
    }
  } catch (error) {
    console.error('[Popup] Failed to load state:', error);
  }
}

async function switchMode(mode: ConnectionMode): Promise<void> {
  console.log(`[Popup] Switching to ${mode} mode`);
  
  // Update UI immediately for feedback
  currentState.mode = mode;
  currentState.state = 'connecting';
  updateUI();
  
  // Send to background script
  try {
    const response = await sendMessageToBackground({ 
      type: 'switchMode', 
      mode 
    });
    
    if (response?.success) {
      currentState.state = response.state || 'connecting';
    } else {
      currentState.state = 'error';
    }
  } catch (error) {
    console.error('[Popup] Mode switch failed:', error);
    currentState.state = 'error';
  }
  
  updateUI();
}

async function reconnect(): Promise<void> {
  console.log('[Popup] Reconnecting...');
  
  currentState.state = 'connecting';
  updateUI();
  
  try {
    const response = await sendMessageToBackground({ 
      type: 'reconnect' 
    });
    
    currentState.state = response?.state || 'disconnected';
  } catch (error) {
    console.error('[Popup] Reconnect failed:', error);
    currentState.state = 'error';
  }
  
  updateUI();
}

// ============================================================================
// UI Updates
// ============================================================================

function updateUI(): void {
  // Update mode buttons
  elements.btnCloud.classList.toggle('active', currentState.mode === 'cloud');
  elements.btnLocal.classList.toggle('active', currentState.mode === 'local');
  elements.btnCowork.classList.toggle('active', currentState.mode === 'cowork');
  
  // Update status indicator
  elements.statusIndicator.className = 'status-indicator';
  elements.statusIndicator.classList.add(currentState.state);
  
  // Update status icon and text
  const statusConfig = {
    disconnected: {
      icon: '⚠️',
      title: 'Disconnected',
      desc: 'Not connected to any backend',
    },
    connecting: {
      icon: '⏳',
      title: 'Connecting...',
      desc: `Connecting to ${currentState.mode} backend`,
    },
    authenticating: {
      icon: '🔐',
      title: 'Authenticating...',
      desc: 'Verifying credentials',
    },
    connected: {
      icon: '✅',
      title: 'Connected',
      desc: `Active ${currentState.mode} connection`,
    },
    error: {
      icon: '❌',
      title: 'Connection Error',
      desc: 'Failed to connect. Try reconnecting.',
    },
  };
  
  const status = statusConfig[currentState.state];
  elements.statusIcon.textContent = status.icon;
  elements.statusTitle.textContent = status.title;
  elements.statusDesc.textContent = status.desc;
  
  elements.statusIcon.className = 'status-icon';
  elements.statusIcon.classList.add(currentState.state);
  
  // Show/hide mode-specific info
  elements.cloudInfo.classList.toggle('hidden', currentState.mode !== 'cloud');
  elements.localInfo.classList.toggle('hidden', currentState.mode !== 'local');
  elements.coworkInfo.classList.toggle('hidden', currentState.mode !== 'cowork');
  
  // Update button states
  elements.btnReconnect.disabled = currentState.state === 'connecting';
}

function openSettings(): void {
  // Toggle settings view or open options
  openOptionsPage();
}

function openOptionsPage(): void {
  chrome.runtime.openOptionsPage();
}

// ============================================================================
// Messaging
// ============================================================================

function sendMessageToBackground(message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Listen for state updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'connectionStateChanged') {
    currentState = {
      mode: message.mode || currentState.mode,
      state: message.state || currentState.state,
      backendName: message.backendName || currentState.backendName,
    };
    updateUI();
  }
  sendResponse({ received: true });
  return true;
});

console.log('[Popup] Script loaded');
