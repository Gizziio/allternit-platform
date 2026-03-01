# UI Integration Guide

This document explains how the browser automation backend connects to the UI frontend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER (React)                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    BrowserCapsuleIntegrated                          │   │
│  │  ┌──────────────┬──────────────┬──────────────┐                     │   │
│  │  │   Browser    │   Canvas     │    A2UI      │                     │   │
│  │  │   Panel      │   Panel      │   Panel      │                     │   │
│  │  └──────┬───────┴──────┬───────┴──────┬───────┘                     │   │
│  │         │              │              │                              │   │
│  │         ▼              ▼              ▼                              │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │              browser-client.ts (React Hooks)                  │   │   │
│  │  │  - useBrowserAutomation()                                    │   │   │
│  │  │  - useBrowserStatus()                                        │   │   │
│  │  │  - useBrowserTabs()                                          │   │   │
│  │  │  - BrowserAPIClient                                          │   │   │
│  │  └──────────────────────────────┬───────────────────────────────┘   │   │
│  └─────────────────────────────────┼───────────────────────────────────┘   │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ HTTP/WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY LAYER (Port 8013)                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Gateway Router                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ /v1/browser  │  │ /v1/canvas   │  │ /v1/a2ui     │               │   │
│  │  │   Proxy      │  │   Proxy      │  │   Proxy      │               │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │   │
│  └─────────┼────────────────┼────────────────┼─────────────────────────┘   │
└────────────┼────────────────┼────────────────┼──────────────────────────────┘
             │                │                │
             ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KERNEL LAYER (Port 3004)                           │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   Browser Server     │  │   Canvas Host        │  │   A2UI API       │  │
│  │   (Port 9222)        │  │   (Port 8080)        │  │   (Sessions)     │  │
│  │                      │  │                      │  │                  │  │
│  │  ┌────────────────┐  │  │  ┌────────────────┐  │  │  ┌────────────┐  │  │
│  │  │ Express HTTP   │  │  │  │ HTTP Server    │  │  │  │ Sessions   │  │  │
│  │  │ WebSocket      │──┘  │  │ WebSocket LR   │──┘  │  │ Actions    │──┘  │
│  │  └────────────────┘     │  └────────────────┘     │  │ Events     │     │
│  │         │               │         │               │  └────────────┘     │
│  │         ▼               │         ▼               │                     │
│  │  ┌────────────────┐     │  ┌────────────────┐     │                     │
│  │  │ CDP Client     │     │  │ A2UI Bundle    │     │                     │
│  │  │ Playwright     │     │  │ File Watcher   │     │                     │
│  │  └────────────────┘     │  └────────────────┘     │                     │
│  └─────────────────────────┘─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## How It All Connects

### 1. Frontend → Backend (Browser Automation)

**File**: `src/integration/browser-client.ts`

```typescript
// React hook that connects to browser server
const { status, tabs, openTab, takeSnapshot } = useBrowserAutomation();

// Direct API client
const result = await browserClient.getSnapshot({ format: 'ai' });
```

**Connection Flow**:
1. React component calls `browserClient.getSnapshot()`
2. HTTP request to `http://127.0.0.1:9222/snapshot`
3. Browser Server receives request
4. Playwright/CDP captures page
5. Returns snapshot JSON to UI

### 2. Frontend → Backend (Canvas Host)

**File**: `src/integration/browser-client.ts` → `CanvasHostClient`

```typescript
// Canvas host client
const canvasUrl = canvasClient.getA2UIUrl();
// → http://127.0.0.1:8080/__a2r__/a2ui
```

**Connection Flow**:
1. UI renders iframe with `src={canvasUrl}`
2. Canvas Host Server serves A2UI bundle
3. WebSocket connection for live reload
4. postMessage for action bridge

### 3. A2UI Rendering

**File**: `src/capsules/a2ui/A2UIRenderer.tsx`

```typescript
<A2UIRenderer
  payload={a2uiPayload}
  onAction={(actionId, payload) => {
    // Can trigger browser automation
    browserClient.act({ kind: 'click', ref: 'e12' });
  }}
/>
```

**Components Supported**:
- Container, Stack, Grid (layout)
- Text, Card, Button (content)
- TextField, Badge, Spinner (inputs)
- Tabs, Image, Code (display)
- Alert (feedback)

### 4. Miniapp Rendering

**File**: `src/capsules/browser/BrowserCapsuleEnhanced.tsx`

Miniapps support 3 entry types:

```typescript
// A2UI-based miniapp
manifest.entry.type = 'a2ui';
// → Rendered with A2UIRenderer

// HTML-based miniapp  
manifest.entry.type = 'html';
// → Rendered in webview/iframe

// Component-based miniapp
manifest.entry.type = 'component';
// → Dynamic component import
```

### 5. Component Rendering

**File**: `src/capsules/browser/BrowserCapsuleEnhanced.tsx`

Direct React component rendering:

```typescript
const demoComponents: Record<string, React.ReactNode> = {
  'Chart': <ChartComponent {...props} />,
  'Demo': <DemoComponent {...props} />,
};
```

## Content Types Supported

| Type | Backend | Frontend | Protocol |
|------|---------|----------|----------|
| **Web** | Browser Server + Playwright | WebView/Iframe | `https://` |
| **A2UI** | A2UI Push via Gateway | A2UIRenderer | `a2ui://` |
| **Miniapp** | Capsule Registry | MiniappRenderer | `miniapp://` |
| **Component** | Component Registry | Dynamic Import | `component://` |

## Usage Examples

### Opening a Web Tab with Automation

```typescript
import { useBrowserAutomation } from '@/integration/browser-client';

function MyComponent() {
  const { openTab, takeSnapshot, executeAction } = useBrowserAutomation();

  const automateGoogle = async () => {
    // Open Google
    await openTab('https://google.com');
    
    // Get AI snapshot
    const snapshot = await takeSnapshot({ format: 'ai' });
    console.log(snapshot.snapshot);
    
    // Click on element with ref
    await executeAction({ kind: 'click', ref: 'e12' });
    
    // Type into search box
    await executeAction({ 
      kind: 'type', 
      ref: 'e15', 
      text: 'hello world' 
    });
  };

  return <button onClick={automateGoogle}>Automate</button>;
}
```

### Rendering A2UI from Agent

```typescript
import { A2UIRenderer } from '@/capsules/a2ui/A2UIRenderer';

const payload = {
  version: '1.0.0',
  surfaces: [{
    id: 'main',
    root: {
      type: 'Container',
      props: {
        children: [
          { type: 'Text', props: { content: 'Hello!' } },
          { type: 'Button', props: { 
            label: 'Click Me',
            action: 'button_click' 
          }}
        ]
      }
    }
  }]
};

<A2UIRenderer
  payload={payload}
  onAction={(actionId, payload) => {
    // Send to agent/kernel
    sendToKernel({ action: actionId, payload });
  }}
/>
```

### Loading a Miniapp

```typescript
const miniappTab = {
  contentType: 'miniapp',
  manifest: {
    version: '1.0.0',
    entry: {
      type: 'a2ui',  // or 'html', 'component'
      src: 'miniapp://calculator',
      initialData: { display: '0' }
    },
    surfaces: [...]  // A2UI surfaces if type='a2ui'
  }
};

addCustomTab(miniappTab);
```

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_BROWSER_URL=http://127.0.0.1:9222
NEXT_PUBLIC_CANVAS_URL=http://127.0.0.1:8080
NEXT_PUBLIC_KERNEL_URL=http://127.0.0.1:3004

# Backend
BROWSER_CONTROL_PORT=9222
CANVAS_HOST_PORT=8080
A2UI_BUNDLE_PATH=./dist-a2ui
```

## File Structure

```
5-ui/a2r-platform/src/
├── capsules/
│   ├── browser/
│   │   ├── BrowserCapsuleEnhanced.tsx      # Original (4 modes)
│   │   ├── BrowserCapsuleIntegrated.tsx    # NEW (backend connected)
│   │   ├── browser.store.ts                # Tab management
│   │   └── browser.types.ts                # TypeScript types
│   │
│   └── a2ui/
│       ├── A2UIRenderer.tsx               # Main renderer (868 lines)
│       ├── a2ui.types.ts                  # Component types
│       └── components/                    # Component library
│           ├── Container.tsx
│           ├── Stack.tsx
│           ├── Button.tsx
│           └── ... (30+ components)
│
├── integration/
│   ├── browser-client.ts                  # NEW (backend client)
│   ├── a2ui-client.ts                     # A2UI API client
│   └── api-client.ts                      # Generic API client
│
└── app/api/
    └── a2ui/
        ├── sessions/route.ts              # Sessions CRUD
        ├── actions/route.ts               # Action execution
        └── events/route.ts                # SSE events
```

## Backend Services to Start

```bash
# 1. Browser Control Server
cd 1-kernel/a2r-browser
npm run start:browser
# → http://127.0.0.1:9222

# 2. Canvas Host Server
cd 1-kernel/a2r-browser
npm run start:canvas
# → http://127.0.0.1:8080

# 3. Gateway (routes to kernel)
cd 1-kernel/a2r-gateway
npm start
# → http://127.0.0.1:8013

# 4. Kernel (manages browser/canvas)
cd 1-kernel/a2r-kernel
npm start
# → http://127.0.0.1:3004

# 5. UI (Next.js)
cd 5-ui/a2r-platform
npm run dev
# → http://127.0.0.1:3000
```

## Testing the Integration

1. **Start all services** (see above)

2. **Open UI** → Navigate to Browser view

3. **Start Browser** → Click "Start Browser" button
   - Calls `browserClient.startBrowser()`
   - Backend launches Playwright/Chromium

4. **Open Tab** → Enter URL and click "Open"
   - Calls `browserClient.openTab(url)`
   - Backend creates new browser tab

5. **Take Snapshot** → Click "Snapshot"
   - Calls `browserClient.getSnapshot()`
   - Backend captures AI snapshot
   - UI displays snapshot text

6. **View Canvas** → Switch to Canvas tab
   - Renders iframe to `http://127.0.0.1:8080`
   - Shows A2UI host page

7. **A2UI Panel** → Switch to A2UI tab
   - Renders demo A2UI payload
   - Actions can trigger browser automation

## Summary

✅ **Components Supported**: 30+ A2UI components  
✅ **Miniapps Supported**: A2UI, HTML, Component entry types  
✅ **A2UI Protocol**: Full implementation with action bridge  
✅ **Backend Connected**: Browser automation + Canvas hosting  
✅ **WebSocket Live Reload**: For canvas development  
✅ **TypeScript**: Full type safety

The UI has always supported components, miniapps, and A2UI. What I added is the **backend infrastructure** to make it actually work with real browser automation and canvas hosting.
