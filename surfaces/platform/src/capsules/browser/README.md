# Capsule/MiniApp Browser System

A comprehensive browser system that supports multiple content types including traditional web browsing, A2UI (Agent-generated UI), miniapps, and direct component rendering.

## Overview

The Capsule Browser is a multi-modal content rendering system that supports:
- **Web Content**: Traditional URL-based browsing via Electron webview
- **A2UI (Agent UI)**: JSON-schema generated dynamic interfaces
- **Miniapps**: Self-contained capsule applications with manifests
- **Components**: Direct React component rendering

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER CAPSULE                             │
├─────────────────────────────────────────────────────────────────┤
│  TabBar │ NavigationBar │ Content Area                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬──────────┐                 │
│  │   WEB    │  A2UI    │ MINIAPP  │COMPONENT│                 │
│  │  View    │ Renderer │  Loader  │  View   │                 │
│  └──────────┴──────────┴──────────┴──────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Web Browsing

```tsx
import { useBrowserStore } from '@a2r/platform';

function MyComponent() {
  const { addTab } = useBrowserStore();
  
  // Open a web page
  const openGoogle = () => addTab('https://www.google.com', 'Google');
  
  return <button onClick={openGoogle}>Open Google</button>;
}
```

### Opening A2UI Tabs

```tsx
import { useBrowserStore, A2UIPayload } from '@a2r/platform';

const payload: A2UIPayload = {
  version: '1.0.0',
  surfaces: [{
    id: 'main',
    name: 'Dashboard',
    root: {
      type: 'Container',
      props: {
        direction: 'column',
        children: [
          { type: 'Text', props: { content: 'Hello World' } }
        ]
      }
    }
  }],
  dataModel: { name: 'User' },
  actions: [{ id: 'submit', type: 'ui', handler: 'handleSubmit' }]
};

function MyComponent() {
  const { addA2UITab } = useBrowserStore();
  
  return (
    <button onClick={() => addA2UITab(payload, 'My Agent App')}>
      Open A2UI App
    </button>
  );
}
```

### URL Protocols

The browser automatically detects content types from URL protocols:

| Protocol | Type | Example |
|----------|------|---------|
| `http://` / `https://` | Web | `https://google.com` |
| `a2ui://` | A2UI | `a2ui://agent-123/payload-456` |
| `miniapp://` | Miniapp | `miniapp://calculator-app` |
| `component://` | Component | `component://data-table` |

---

## A2UI Components

The A2UI renderer supports 30+ component types:

### Layout
- **Container**: Flexbox container with direction, justify, align
- **Stack**: Simplified flex container (horizontal/vertical)
- **Grid**: CSS Grid layout

### Content
- **Text**: Typography with variants (heading, body, caption, code)
- **Card**: Card container with header/footer
- **Image**: Image display with object-fit options
- **Code**: Code block with syntax highlighting

### Interactive
- **Button**: Clickable buttons with variants
- **TextField**: Input fields with two-way data binding
- **Select**: Dropdown selection
- **Switch**: Toggle switch
- **Checkbox**: Checkbox input
- **RadioGroup**: Radio button group
- **Slider**: Range slider

### Data Display
- **List**: List rendering with item templates
- **DataTable**: Table with sorting, pagination
- **Badge**: Status badges
- **Progress**: Progress bar/circle
- **Spinner**: Loading indicator

### Navigation
- **Tabs**: Tab navigation
- **Accordion**: Collapsible sections
- **Breadcrumbs**: Navigation breadcrumbs
- **Pagination**: Page navigation
- **Menu**: Dropdown menu

### Feedback
- **Alert**: Alert messages (info, success, warning, error)
- **Dialog**: Modal dialogs
- **Tooltip**: Hover tooltips
- **Popover**: Popover panels

---

## Chat Integration

The browser integrates with the chat system in two ways:

### Option A: Inline A2UI in Chat (Default)

Render A2UI components directly within chat messages:

```tsx
import { RichMessageParts, MessageA2UI } from '@/views/chat';

// Agent response with A2UI
const message = {
  id: 'msg-001',
  role: 'assistant',
  content: [
    { type: 'text', text: 'Here is a form for you:' },
    { 
      type: 'a2ui', 
      title: 'Task Form',
      payload: { /* A2UIPayload */ }
    }
  ]
};

// Render in chat
<RichMessageParts 
  parts={message.content} 
  messageId={message.id}
  onAction={(msgId, actionId, payload) => {
    // Send action to agent
    sendToAgent(msgId, actionId, payload);
  }}
/>
```

**Features:**
- Collapsible/expandable UI cards
- Actions sent back to agent
- Data model persists within message
- Pop-out to browser option

### Option B: Open A2UI in Browser

Open chat A2UI content in browser tabs:

```tsx
import { OpenInBrowserButton, useChatBrowserActions } from '@/views/chat';

// Method 1: Button component
<OpenInBrowserButton 
  payload={a2uiPayload}
  title="Task Manager"
  source="chat-session-123"
/>

// Method 2: Hook
const { openA2UI, openWeb } = useChatBrowserActions();

// Open in browser
const tabId = openA2UI(payload, 'My App', 'chat-123');

// Open web link
const tabId = openWeb('https://example.com', 'Example');

// Switch to browser view
switchToBrowser(tabId);
```

**Features:**
- Keep chat context clean
- Full-size app experience
- Multiple apps side-by-side
- Persistent state in browser tabs

### Combined Usage

```tsx
import { 
  MessageA2UI, 
  OpenInBrowserButton,
  ChatBrowserBridge 
} from '@/views/chat';

// Message with both inline and browser options
function ChatMessage({ message }) {
  const a2uiParts = getA2UIParts(message.content);
  
  return (
    <div className="message">
      <Markdown content={message.text} />
      
      {/* Inline A2UI with pop-out button */}
      {a2uiParts.map((part, idx) => (
        <MessageA2UI 
          key={idx}
          part={part}
          messageId={message.id}
          onAction={handleAction}
        />
      ))}
      
      {/* Browser bridge for all A2UI parts */}
      <ChatBrowserBridge
        chatId={chatId}
        messageId={message.id}
        payloads={a2uiParts.map(p => ({ 
          payload: p.payload, 
          title: p.title 
        }))}
      />
    </div>
  );
}
```

---

## Miniapp Manifest

Miniapps are defined via a manifest:

```typescript
interface MiniappManifest {
  version: '1.0.0';
  meta: {
    id: string;
    name: string;
    description?: string;
    version: string;
    author?: string;
    icon?: string;
    keywords?: string[];
  };
  entry: {
    type: 'a2ui' | 'html' | 'component';
    src: string;
    initialData?: Record<string, unknown>;
  };
  surfaces?: A2UISurface[];
  actions?: A2UIAction[];
  capabilities?: string[];
}
```

---

## Security

- **Component Whitelist**: Only whitelisted component types can be rendered
- **Action Registry**: Actions must be registered before they can be triggered
- **Data Model Isolation**: Each tab has its own isolated data model
- **CSP Support**: Content Security Policy for miniapps

---

## Store API

```typescript
interface BrowserStore {
  // State
  tabs: BrowserTab[];
  activeTabId: string | null;
  consoleOpen: boolean;
  consoleHeight: number;

  // Tab Management
  addTab: (url: string, title?: string) => string;
  addA2UITab: (payload: A2UIPayload, title?: string, source?: string) => string;
  addMiniappTab: (manifest: MiniappManifest, capsuleId: string, entryPoint?: string) => string;
  addComponentTab: (componentId: string, title?: string, props?: Record<string, unknown>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<BrowserTab>) => void;

  // Bulk Operations
  closeAllTabs: () => void;
  closeOtherTabs: (keepId: string) => void;
  duplicateTab: (id: string) => void;
}
```

---

## Testing

Open a sample A2UI tab for testing:

```tsx
import { openSampleA2UITab } from '@a2r/platform';

// Opens a demo A2UI tab
openSampleA2UITab();
```

---

## Documentation

- `ROADMAP.md` - Component roadmap and implementation details
- `ARCHITECTURE.md` - Detailed architecture documentation
- `../a2ui/a2ui.types.ts` - Complete type definitions
- `../a2ui/A2UIRenderer.tsx` - Renderer implementation
- `../../views/chat/` - Chat integration components
