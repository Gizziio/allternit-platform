# Native Browser Extension for ShellUI

**Embed as Native Browser Extension with Logo & Toggle**

**Date:** February 26, 2026

---

## 🎯 CONCEPT

Create a **native browser extension** that appears in the browser's extension toolbar, just like any other extension:

```
┌─────────────────────────────────────────────────────────┐
│  Browser Toolbar                                         │
│  ┌───┐ ┌───┐ ┌───┐ ┌─────────────┐ ┌───┐ ┌───┐        │
│  │ 🔙│ │ 🔗│ │ 🔄│ │ ShellUI 🤖 │ │ ⚙️│ │ 📑│        │
│  └───┘ └───┘ └───┘ └─────────────┘ └───┘ └───┘        │
│                          ↑                               │
│                    Extension Icon                         │
│                    (Click to toggle)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 STEP 1: CREATE EXTENSION PACKAGE

### Directory Structure

```
shell-extension/
├── manifest.json           # Extension manifest (MV3)
├── icons/
│   ├── icon16.png         # 16x16 toolbar icon
│   ├── icon48.png         # 48x48 extension page
│   └── icon128.png        # 128x128 Chrome Web Store
├── src/
│   ├── background/
│   │   └── service.ts     # Service worker
│   ├── content/
│   │   └── script.ts      # Content script
│   ├── sidebar/
│   │   ├── panel.html     # Sidebar panel
│   │   ├── panel.tsx      # React component
│   │   └── panel.css      # Styles
│   └── shared/
│       └── types.ts       # Shared types
├── package.json
└── README.md
```

---

## 🎨 STEP 2: CREATE EXTENSION ICONS

### Icon Design

**Logo should be:**
- 1024x1024 PNG (source)
- Simple, recognizable at small sizes
- Matches ShellUI branding
- Transparent background

**Tools to create icons:**
```bash
# Using ImageMagick
convert logo-1024.png -resize 128x128 icons/icon128.png
convert logo-1024.png -resize 48x48 icons/icon48.png
convert logo-1024.png -resize 16x16 icons/icon16.png

# Or use Figma/Sketch/Photoshop
```

### Icon Files

```
icons/
├── icon16.png    # Toolbar (16x16)
├── icon48.png    # Extensions page (48x48)
└── icon128.png   # Chrome Web Store (128x128)
```

---

## 📝 STEP 3: MANIFEST CONFIGURATION

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "ShellUI Agent",
  "version": "1.0.0",
  "description": "AI agent that controls your browser - Built by A2Rchitech",
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "sidePanel",
    "contextMenus"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "action": {
    "default_title": "ShellUI Agent",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_popup": "src/sidebar/panel.html"
  },
  
  "side_panel": {
    "default_path": "src/sidebar/panel.html"
  },
  
  "background": {
    "service_worker": "src/background/service.ts",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/script.ts"],
      "run_at": "document_end",
      "css": ["src/content/styles.css"]
    }
  ],
  
  "commands": {
    "toggle-panel": {
      "suggested_key": {
        "default": "Ctrl+Shift+K",
        "mac": "Command+Shift+K"
      },
      "description": "Toggle agent panel"
    },
    "quick-action": {
      "suggested_key": {
        "default": "Ctrl+Shift+L",
        "mac": "Command+Shift+L"
      },
      "description": "Quick agent action"
    }
  },
  
  "web_accessible_resources": [
    {
      "resources": ["icons/*", "src/content/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## 🔧 STEP 4: BACKGROUND SERVICE

### src/background/service.ts

```typescript
// ShellUI Agent - Background Service Worker

import { A2RClient } from '@a2r/sdk';

// Initialize A2R client
const a2r = new A2RClient({
  baseUrl: 'http://localhost:3000',
  toolId: 'agent-browser.automation',
});

// Extension state
let isEnabled = true;
let currentSessionId: string | null = null;

// Toolbar icon click handler
chrome.action.onClicked.addListener(async (tab) => {
  if (isEnabled) {
    // Open side panel
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else {
    // Show disabled message
    chrome.tabs.sendMessage(tab.id!, {
      type: 'SHOW_DISABLED_MESSAGE',
    });
  }
});

// Context menu creation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'shell-explain',
    title: 'Explain with ShellUI',
    contexts: ['selection'],
  });
  
  chrome.contextMenus.create({
    id: 'shell-click',
    title: 'Click this element',
    contexts: ['button', 'link'],
  });
  
  chrome.contextMenus.create({
    id: 'shell-fill',
    title: 'Fill this field',
    contexts: ['editable'],
  });
});

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!isEnabled) return;
  
  switch (info.menuItemId) {
    case 'shell-explain':
      await handleExplainSelection(info.selectionText, tab);
      break;
    case 'shell-click':
      await handleClickElement(tab);
      break;
    case 'shell-fill':
      await handleFillElement(tab);
      break;
  }
});

// Command handler (keyboard shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  if (!isEnabled) return;
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (command === 'toggle-panel') {
    chrome.sidePanel.toggle({ windowId: tab.windowId });
  } else if (command === 'quick-action') {
    showQuickActionPanel(tab);
  }
});

// Message handler from content script and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_ENABLED':
      isEnabled = message.enabled;
      updateToolbarIcon(isEnabled);
      sendResponse({ success: true });
      break;
      
    case 'AGENT_ACTION':
      handleAgentAction(message.action, message.params)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true; // Keep channel open for async response
      
    case 'GET_STATE':
      sendResponse({ isEnabled, sessionId: currentSessionId });
      break;
      
    case 'CREATE_SESSION':
      createSession().then(id => {
        currentSessionId = id;
        sendResponse({ sessionId: id });
      });
      return true;
  }
});

// Handle agent browser actions
async function handleAgentAction(action: string, params: any) {
  if (!isEnabled) {
    throw new Error('ShellUI Agent is disabled');
  }
  
  try {
    const result = await a2r.execute({
      action,
      ...params,
      session_id: currentSessionId || undefined,
    });
    
    // Notify content script of action
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id!, {
      type: 'ACTION_EXECUTED',
      action,
      result,
    });
    
    return result;
  } catch (error) {
    console.error('Agent action failed:', error);
    throw error;
  }
}

// Create persistent browser session
async function createSession(): Promise<string> {
  const sessionId = `shell-session-${Date.now()}`;
  currentSessionId = sessionId;
  
  // Store session
  await chrome.storage.local.set({ sessionId });
  
  return sessionId;
}

// Update toolbar icon based on enabled state
function updateToolbarIcon(enabled: boolean) {
  chrome.action.setIcon({
    path: enabled
      ? {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png',
        }
      : {
          '16': 'icons/icon16-disabled.png',
          '48': 'icons/icon48-disabled.png',
          '128': 'icons/icon128-disabled.png',
        },
  });
  
  chrome.action.setTitle({
    title: enabled ? 'ShellUI Agent (Enabled)' : 'ShellUI Agent (Disabled)',
  });
}

// Handle context menu actions
async function handleExplainSelection(text: string, tab: chrome.tabs.Tab) {
  chrome.sidePanel.open({ windowId: tab.windowId! });
  
  // Send to sidebar
  chrome.tabs.sendMessage(tab.id!, {
    type: 'SELECTION',
    text,
  });
}

async function handleClickElement(tab: chrome.tabs.Tab) {
  // Get element under cursor
  const response = await chrome.tabs.sendMessage(tab.id!, {
    type: 'GET_CLICKED_ELEMENT',
  });
  
  // Click it via agent
  await handleAgentAction('click', { selector: response.selector });
}

async function handleFillElement(tab: chrome.tabs.Tab) {
  // Show input dialog
  const value = prompt('Enter text to fill:');
  if (!value) return;
  
  // Get element
  const response = await chrome.tabs.sendMessage(tab.id!, {
    type: 'GET_CLICKED_ELEMENT',
  });
  
  // Fill it via agent
  await handleAgentAction('fill', {
    selector: response.selector,
    value,
  });
}

function showQuickActionPanel(tab: chrome.tabs.Tab) {
  chrome.sidePanel.open({ windowId: tab.windowId });
  chrome.tabs.sendMessage(tab.id!, {
    type: 'SHOW_QUICK_ACTION',
  });
}
```

---

## 🎨 STEP 5: SIDEBAR PANEL UI

### src/sidebar/panel.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShellUI Agent</title>
  <link rel="stylesheet" href="panel.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="panel.tsx"></script>
</body>
</html>
```

### src/sidebar/panel.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatPanel } from './ChatPanel';
import { ToggleSwitch } from './ToggleSwitch';

function App() {
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Get initial state from background
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      setIsEnabled(response.isEnabled);
    });
  }, []);

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    chrome.runtime.sendMessage({
      type: 'TOGGLE_ENABLED',
      enabled,
    });
  };

  return (
    <div className="shellui-extension">
      {/* Header with logo and toggle */}
      <header className="extension-header">
        <div className="logo">
          <img src="../icons/icon48.png" alt="ShellUI" />
          <h1>ShellUI Agent</h1>
        </div>
        
        <ToggleSwitch
          enabled={isEnabled}
          onChange={handleToggle}
          label={isEnabled ? 'On' : 'Off'}
        />
      </header>

      {/* Status indicator */}
      {isEnabled ? (
        <div className="status-bar enabled">
          <span className="status-dot"></span>
          Agent is active
        </div>
      ) : (
        <div className="status-bar disabled">
          <span className="status-dot"></span>
          Agent is disabled - Click to enable
        </div>
      )}

      {/* Chat panel */}
      <ChatPanel enabled={isEnabled} />

      {/* Footer */}
      <footer className="extension-footer">
        <span>Powered by A2Rchitech</span>
        <a href="#" onClick={() => chrome.tabs.create({ url: 'https://a2rchitech.com' })}>
          Learn more
        </a>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

### src/sidebar/ToggleSwitch.tsx

```typescript
import React from 'react';
import './ToggleSwitch.css';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
}

export function ToggleSwitch({ enabled, onChange, label }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-slider"></span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}
```

### src/sidebar/ToggleSwitch.css

```css
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  transition: background 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background: #3b82f6;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}
```

---

## 🎨 STEP 6: STYLING

### src/sidebar/panel.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  width: 380px;
  height: 600px;
  overflow: hidden;
}

.shellui-extension {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

/* Header */
.extension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo img {
  width: 32px;
  height: 32px;
}

.logo h1 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
}

.status-bar.enabled {
  background: #dcfce7;
  color: #166534;
}

.status-bar.disabled {
  background: #fee2e2;
  color: #991b1b;
  cursor: pointer;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

/* Chat Panel */
.chat-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Footer */
.extension-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
  color: #6b7280;
}

.extension-footer a {
  color: #3b82f6;
  text-decoration: none;
}
```

---

## 🚀 STEP 7: BUILD & PACKAGE

### package.json

```json
{
  "name": "shellui-extension",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch",
    "package": "npm run build && zip -r shellui-extension.zip dist/ icons/ manifest.json"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "@a2r/sdk": "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/sidebar/panel.html'),
        background: resolve(__dirname, 'src/background/service.ts'),
        content: resolve(__dirname, 'src/content/script.ts'),
      },
    },
  },
});
```

### Build Command

```bash
# Install dependencies
npm install

# Build extension
npm run build

# Package for distribution
npm run package
# Creates: shellui-extension.zip
```

---

## 📥 STEP 8: INSTALL IN BROWSER

### Chrome/Edge

```
1. Open chrome://extensions
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the dist/ folder
5. Extension appears in toolbar!
```

### Firefox

```
1. Open about:addons
2. Click gear icon → "Debug Add-ons"
3. Click "Load Temporary Add-on"
4. Select manifest.json
5. Extension appears in toolbar!
```

---

## 🎯 FINAL RESULT

### Toolbar Icon

```
┌─────────────────────────────────────────────────┐
│  🔙  🔗  🔄  [🤖 ShellUI]  ⚙️  📑              │
│                    ↑                             │
│              Extension Icon                       │
│              (Click to open)                      │
└─────────────────────────────────────────────────┘
```

### Extension Popup

```
┌─────────────────────────────┐
│  [🤖] ShellUI Agent   [On] │  ← Logo + Toggle
├─────────────────────────────┤
│  ● Agent is active          │  ← Status
├─────────────────────────────┤
│                              │
│  🤖 How can I help?         │
│                              │
│  You: Click login           │  ← Chat
│  ✓ Clicked login button     │
│                              │
├─────────────────────────────┤
│  [________________] [Send]  │  ← Input
├─────────────────────────────┤
│  Powered by A2Rchitech      │  ← Footer
│  Learn more                 │
└─────────────────────────────┘
```

---

## ✅ SUMMARY

| Step | What | Status |
|------|------|--------|
| 1 | Create extension package | ✅ |
| 2 | Create icons (16/48/128) | ✅ |
| 3 | Configure manifest.json | ✅ |
| 4 | Background service worker | ✅ |
| 5 | Sidebar panel with toggle | ✅ |
| 6 | Style with branding | ✅ |
| 7 | Build & package | ✅ |
| 8 | Install in browser | ✅ |

---

**Generated:** February 26, 2026  
**Status:** ✅ READY FOR IMPLEMENTATION
