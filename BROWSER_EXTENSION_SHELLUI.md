# Browser Extension Integration for ShellUI

**Claude Code-Style Browser Extension**

**Date:** February 26, 2026

---

## 🎯 CONCEPT

A **browser extension** that integrates agent-browser directly into the browser, just like Claude Code extension:

```
┌─────────────────────────────────────────────────────────┐
│  Browser Window                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Website Content                                   │  │
│  │                                                    │  │
│  │  [Page content here...]                           │  │
│  │                                                    │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ShellUI Chat Panel (Extension Sidebar)           │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 🤖 Agent: I can control this browser        │  │  │
│  │  │                                              │  │  │
│  │  │ You: Click the login button                 │  │  │
│  │  │                                              │  │  │
│  │  │ Agent: ✓ Clicked login button               │  │  │
│  │  │                                              │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 ARCHITECTURE

### Extension Components

```
shell-extension/
├── manifest.json          # Extension manifest (MV3)
├── src/
│   ├── background/
│   │   └── service.ts     # Service worker (agent logic)
│   ├── content/
│   │   └── script.ts      # Content script (DOM access)
│   ├── sidebar/
│   │   ├── panel.html     # Chat panel UI
│   │   └── panel.tsx      # React chat component
│   └── shared/
│       └── types.ts       # Shared types
└── package.json
```

---

## 📦 MANIFEST CONFIGURATION

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "ShellUI Browser Agent",
  "version": "1.0.0",
  "description": "AI agent that controls your browser - Claude Code style",
  
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "sidePanel"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
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
      "run_at": "document_end"
    }
  ],
  
  "action": {
    "default_title": "ShellUI Agent",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "commands": {
    "toggle-panel": {
      "suggested_key": {
        "default": "Ctrl+Shift+K",
        "mac": "Command+Shift+K"
      },
      "description": "Toggle agent panel"
    }
  }
}
```

---

## 🎯 COMPONENTS

### 1. Background Service (Agent Logic)

```typescript
// src/background/service.ts
import { useTool } from '@a2r/sdk';

// Agent browser tool integration
const browserAgent = {
  async execute(action: string, params: any) {
    // Call agent-browser tool via A2R API
    const response = await fetch('http://localhost:3000/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'agent-browser.automation',
        parameters: { action, ...params },
      }),
    });
    return response.json();
  },

  async navigate(url: string) {
    return this.execute('open', { url });
  },

  async click(selector: string) {
    return this.execute('click', { selector });
  },

  async fill(selector: string, value: string) {
    return this.execute('fill', { selector, value });
  },

  async screenshot() {
    return this.execute('screenshot', { path: `/tmp/${Date.now()}.png` });
  },
};

// Message handler from sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AGENT_ACTION') {
    browserAgent.execute(message.action, message.params)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }
});

// Context menu for quick actions
chrome.contextMenus.create({
  id: 'shell-explain',
  title: 'Explain with ShellUI',
  contexts: ['selection'],
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'shell-explain' && info.selectionText) {
    // Open sidebar with selection
    chrome.sidePanel.open({ windowId: tab.windowId });
    chrome.tabs.sendMessage(tab.id!, {
      type: 'SELECTION',
      text: info.selectionText,
    });
  }
});
```

---

### 2. Content Script (DOM Access)

```typescript
// src/content/script.ts
import { generateSnapshot } from '@a2r/browser-snapshot';

// Inject highlight overlay for element refs
function injectHighlightOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'shell-highlight-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
  `;
  document.body.appendChild(overlay);
}

// Listen for agent commands
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'HIGHLIGHT_ELEMENT':
      highlightElement(message.selector);
      sendResponse({ success: true });
      break;

    case 'GET_SNAPSHOT':
      const snapshot = generateSnapshot();
      sendResponse({ snapshot });
      break;

    case 'CLICK_ELEMENT':
      const element = document.querySelector(message.selector);
      element?.click();
      sendResponse({ success: true });
      break;

    case 'FILL_ELEMENT':
      const input = document.querySelector(message.selector) as HTMLInputElement;
      if (input) {
        input.value = message.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sendResponse({ success: true });
      break;
  }
  return true;
});

function highlightElement(selector: string) {
  const element = document.querySelector(selector);
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const overlay = document.getElementById('shell-highlight-overlay');
  
  if (overlay) {
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: absolute;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
    `;
    overlay.appendChild(highlight);
    
    setTimeout(() => highlight.remove(), 2000);
  }
}
```

---

### 3. Sidebar Panel (Chat UI)

```typescript
// src/sidebar/panel.tsx
import React, { useState, useEffect } from 'react';
import { useToolWithRetryAndTimeout } from '@a2r/hooks';

export function SidebarPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { execute } = useToolWithRetryAndTimeout(
    'agent-browser.automation',
    3,
    30000
  );

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send to agent for processing
      const response = await chrome.runtime.sendMessage({
        type: 'USER_MESSAGE',
        text: input,
      });

      const agentMessage: Message = {
        role: 'assistant',
        content: response.text,
        actions: response.actions, // Browser actions taken
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Agent error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowserAction = async (action: any) => {
    // Execute browser action directly
    await execute(action);
  };

  return (
    <div className="sidebar-panel">
      {/* Messages */}
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="content">{msg.content}</div>
            
            {/* Browser action buttons */}
            {msg.actions?.map((action, i) => (
              <button
                key={i}
                onClick={() => handleBrowserAction(action)}
                className="action-button"
              >
                {action.label}
              </button>
            ))}
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant loading">
            <div className="typing-indicator">Agent is typing...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask me to control the browser..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
```

---

## 🎯 INTEGRATION WITH SHELLUI

### Connect to Main ShellUI

```typescript
// src/background/service.ts

// WebSocket connection to main ShellUI
class ShellUIConnector {
  private ws: WebSocket | null = null;

  connect() {
    this.ws = new WebSocket('ws://localhost:3000/extension');
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'BROWSER_CONTROL') {
        // Forward to content script
        chrome.tabs.query({ active: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id!, {
            type: 'AGENT_ACTION',
            action: message.action,
            params: message.params,
          });
        });
      }
    };
  }

  sendSnapshot(snapshot: any) {
    this.ws?.send(JSON.stringify({
      type: 'SNAPSHOT',
      data: snapshot,
    }));
  }

  sendScreenshot(base64: string) {
    this.ws?.send(JSON.stringify({
      type: 'SCREENSHOT',
      data: base64,
    }));
  }
}

const connector = new ShellUIConnector();
connector.connect();
```

---

## 🚀 FEATURES

### 1. Context-Aware Actions

```typescript
// Right-click menu integration
chrome.contextMenus.create({
  id: 'shell-click',
  title: 'Click this',
  contexts: ['button', 'link'],
});

chrome.contextMenus.create({
  id: 'shell-fill',
  title: 'Fill this field',
  contexts: ['editable'],
});

chrome.contextMenus.create({
  id: 'shell-explain',
  title: 'Explain with ShellUI',
  contexts: ['selection'],
});
```

---

### 2. Keyboard Shortcuts

```typescript
// Commands in manifest.json
"commands": {
  "toggle-panel": {
    "suggested_key": {
      "default": "Ctrl+Shift+K",
      "mac": "Command+Shift+K"
    },
    "description": "Toggle agent panel"
  },
  "agent-action": {
    "suggested_key": {
      "default": "Ctrl+Shift+L",
      "mac": "Command+Shift+L"
    },
    "description": "Quick agent action"
  }
}

// Handle shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panel') {
    chrome.sidePanel.toggle();
  } else if (command === 'agent-action') {
    // Quick action panel
    showQuickActionPanel();
  }
});
```

---

### 3. Visual Element Highlighting

```typescript
// Show element refs on page
function showElementRefs() {
  const snapshot = generateSnapshot();
  
  snapshot.elements.forEach(el => {
    const element = document.querySelector(`[${el.ref}]`);
    if (!element) return;

    const badge = document.createElement('div');
    badge.className = 'shell-element-badge';
    badge.textContent = el.ref;
    badge.style.cssText = `
      position: absolute;
      background: #3b82f6;
      color: white;
      font-size: 10px;
      padding: 2px 4px;
      border-radius: 3px;
      z-index: 999999;
    `;

    element.appendChild(badge);
  });
}
```

---

## 📊 WORKFLOW

### User Flow

```
1. User opens browser
   ↓
2. Extension loads (sidebar available)
   ↓
3. User presses Ctrl+Shift+K
   ↓
4. Sidebar opens with chat
   ↓
5. User types: "Click the login button"
   ↓
6. Agent:
   - Analyzes intent
   - Selects agent-browser tool
   - Executes: click(selector)
   ↓
7. Browser clicks button
   ↓
8. Agent reports: "✓ Clicked login button"
```

---

### Agent Flow

```
User Input → Intent Recognition → Tool Selection → Browser Action → Response
     ↓              ↓                   ↓              ↓            ↓
"Click login"  → "click intent"  → agent-browser → click(btn) → "Done!"
```

---

## 🎯 COMPARISON: Extension vs Standalone

| Feature | Extension | Standalone |
|---------|-----------|------------|
| **Integration** | ✅ Native in browser | ⚠️ Separate window |
| **Context** | ✅ Sees current page | ⚠️ Must navigate |
| **Speed** | ✅ Instant | ⚠️ Navigation delay |
| **Setup** | ⚠️ Install extension | ✅ Just run CLI |
| **Privacy** | ⚠️ Extension permissions | ✅ Isolated |
| **Best For** | Daily browsing | Automation tasks |

---

## ✅ SUMMARY

| Question | Answer |
|----------|--------|
| **Can it work as extension?** | ✅ Yes - Full MV3 support |
| **Controls current browser?** | ✅ Yes - Direct DOM access |
| **Sidebar chat?** | ✅ Yes - Side panel API |
| **Keyboard shortcuts?** | ✅ Yes - Ctrl+Shift+K |
| **Context menu?** | ✅ Yes - Right-click actions |
| **Integrates with ShellUI?** | ✅ Yes - WebSocket connection |

---

**Generated:** February 26, 2026  
**Status:** ✅ READY FOR DEVELOPMENT
