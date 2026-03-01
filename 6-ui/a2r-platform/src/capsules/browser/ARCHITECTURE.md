# Capsule Browser Architecture

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
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  CONTENT DISPATCHER                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │   WEB    │  │  A2UI    │  │ MINIAPP  │  │COMPONENT│ │   │
│  │  │  View    │  │ Renderer │  │  Loader  │  │  View   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Browser Store (`browser.store.ts`)

**Purpose:** Central state management for all browser tabs

**Key Features:**
- Multi-type tab support (Web, A2UI, Miniapp, Component)
- URL protocol detection and parsing
- Tab lifecycle management (add, close, activate, duplicate)
- Per-tab data model isolation

**State Structure:**
```typescript
interface BrowserStore {
  tabs: BrowserTab[];           // All open tabs
  activeTabId: string | null;   // Currently active
  consoleOpen: boolean;         // DevTools console
  consoleHeight: number;        // Console panel size
}

type BrowserTab = 
  | WebTab      // { contentType: 'web', url: string }
  | A2UITab     // { contentType: 'a2ui', payload: A2UIPayload }
  | MiniappTab  // { contentType: 'miniapp', manifest: MiniappManifest }
  | ComponentTab;// { contentType: 'component', componentId: string }
```

**Actions:**
```typescript
addTab(url: string, title?: string): string
addA2UITab(payload: A2UIPayload, title?: string, source?: string): string
addMiniappTab(manifest: MiniappManifest, capsuleId: string): string
addComponentTab(componentId: string, title?: string, props?: object): string
closeTab(id: string): void
setActiveTab(id: string): void
updateTab(id: string, updates: Partial<BrowserTab>): void
```

---

### 2. Protocol Parser (`browser.store.ts`)

**Purpose:** Detect content type from URL/input strings

**Supported Protocols:**

| Input | Detected Type | Resource |
|-------|--------------|----------|
| `https://google.com` | `web` | `https://google.com` |
| `a2ui://agent-123/payload` | `a2ui` | `agent-123/payload` |
| `miniapp://calculator` | `miniapp` | `calculator` |
| `capsule://todo-app` | `miniapp` | `todo-app` |
| `component://data-table` | `component` | `data-table` |
| `google.com` (no protocol) | `web` | `https://google.com` |
| `search term` | `web` | Google search URL |

**Implementation:**
```typescript
function parseBrowserInput(input: string): ProtocolParseResult {
  // 1. Check for explicit protocol (xxx://)
  // 2. Check for domain-like strings (contains . )
  // 3. Default to web search
}
```

---

### 3. A2UI Renderer (`../a2ui/A2UIRenderer.tsx`)

**Purpose:** Convert JSON UI schemas into React components

**Architecture:**
```
A2UIPayload (JSON)
    │
    ▼
┌─────────────────┐
│  A2UIRenderer   │
│  ┌───────────┐  │
│  │ Security  │  │ → Whitelist check
│  │  Check    │  │
│  └─────┬─────┘  │
│        ▼        │
│  ┌───────────┐  │
│  │ Component │  │ → Dispatch by type
│  │ Dispatch  │  │
│  └─────┬─────┘  │
│        ▼        │
│  ┌───────────┐  │
│  │  Render   │  │ → React + Radix UI
│  │ Component │  │
│  └─────┬─────┘  │
│        ▼        │
│  ┌───────────┐  │
│  │  Action   │  │ → onAction callback
│  │  Handler  │  │
│  └───────────┘  │
└─────────────────┘
    │
    ▼
React DOM
```

**Render Context:**
```typescript
interface RenderContext {
  dataModel: Record<string, unknown>;      // Current state
  updateDataModel: (path: string, value: unknown) => void;
  onAction: (actionId: string, payload?: Record<string, unknown>) => void;
  whitelist: string[];                      // Allowed components
}
```

**Data Binding:**
```typescript
// Two-way binding via valuePath
{
  type: 'TextField',
  props: {
    label: 'Name',
    valuePath: 'user.name'  // Binds to dataModel.user.name
  }
}

// On change: updateDataModel('user.name', newValue)
```

**Action Flow:**
```
User clicks button
    │
    ▼
Component calls context.onAction('submit', payload)
    │
    ▼
A2UIRenderer props.onAction(actionId, payload)
    │
    ▼
BrowserCapsule handles action
    │
    ├─► type: 'ui' → Handle locally (close dialog, show spinner)
    ├─► type: 'api' → POST to agent API
    ├─► type: 'navigate' → Open new tab
    └─► type: 'emit' → Broadcast to chat
```

---

### 4. Content Renderers

#### Web Renderer

**Technology:** Electron `webview` tag

**Features:**
- Full browser capabilities (JS, CSS, cookies)
- Sandboxed (contextIsolation, nodeIntegration disabled)
- Navigation controls (back, forward, refresh)
- Bypasses X-Frame-Options (unlike iframe)

**Security:**
```html
<webview
  src="https://example.com"
  sandbox="allow-scripts allow-same-origin allow-forms"
  webpreferences="contextIsolation=yes,nodeIntegration=no"
/>
```

#### A2UI Renderer

See section 3 above.

#### Miniapp Loader

**Flow:**
```
Miniapp Manifest
    │
    ▼
Parse entry.type
    │
    ├─► 'a2ui' → Render A2UI surfaces
    ├─► 'html' → Load in webview
    └─► 'component' → Lookup in registry
```

**Runtime State:**
```typescript
interface MiniappRuntime {
  capsuleId: string;
  dataModel: Record<string, unknown>;
  history: ActionHistory[];
  capabilities: string[];  // Granted permissions
}
```

---

## Security Model

### 1. Component Whitelist

```typescript
const COMPONENT_WHITELIST = [
  'Container', 'Stack', 'Grid',  // Layout
  'Text', 'Card', 'Image',      // Content
  'Button', 'TextField',        // Input
  // ... NO 'Script', NO 'IFrame', NO raw HTML
];
```

**Enforcement:**
```typescript
function A2UIComponent({ node, context }) {
  if (!context.whitelist.includes(node.type)) {
    console.warn(`[Security] "${node.type}" not in whitelist`);
    return null;  // Silent fail
  }
  // Render component
}
```

### 2. Action Isolation

Each tab has isolated action namespace:
```typescript
// Tab A actions
actions: [{ id: 'submit', type: 'api' }]

// Tab B actions  
actions: [{ id: 'submit', type: 'ui' }]

// Same ID, different handlers - no collision
```

### 3. Data Model Sandboxing

```typescript
// Each A2UI tab has isolated data model
const [dataModel, setDataModel] = useState({
  ...payload.dataModel  // Only payload data
});

// No access to:
// - window object
// - document object
// - Other tabs' data models
// - LocalStorage (unless explicitly granted)
```

### 4. Miniapp Capabilities

```typescript
interface MiniappManifest {
  capabilities: ['file-read', 'network', 'clipboard'];
  csp: {
    allowedOrigins: ['https://api.example.com'];
    allowInlineScripts: false;
  };
}
```

---

## Agent Integration

### Agent Render API

Agents communicate with browser via structured responses:

```typescript
interface AgentResponse {
  // Text response (always present)
  text: string;
  
  // Optional A2UI payload
  a2ui?: A2UIPayload;
  
  // Optional miniapp reference
  miniapp?: {
    capsuleId: string;
    entryPoint?: string;
  };
  
  // Optional actions for chat integration
  actions?: Array<{
    label: string;
    action: string;
    payload?: unknown;
  }>;
}
```

### Communication Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    User     │────────►│    Chat     │────────►│    Agent    │
│             │         │   Interface │         │   (LLM)     │
└─────────────┘         └─────────────┘         └──────┬──────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Generate A2UI  │
                                              │    Payload      │
                                              └────────┬────────┘
                                                       │
                                                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    User     │◄────────│   Browser   │◄────────│   Gateway   │
│  Interacts  │         │   (A2UI)    │         │   (API)     │
└─────────────┘         └──────┬──────┘         └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Action    │
                        │  Triggered  │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   POST to   │
                        │    Agent    │
                        └─────────────┘
```

### Example Agent Implementation

```typescript
// Agent receives: "Show me a task form"

// Agent generates response:
const response = {
  text: "I've created a task form for you:",
  
  a2ui: {
    version: '1.0.0',
    surfaces: [{
      id: 'task-form',
      root: {
        type: 'Card',
        props: {
          title: 'New Task',
          children: [
            {
              type: 'TextField',
              props: {
                label: 'Task Name',
                valuePath: 'task.name'
              }
            },
            {
              type: 'Select',
              props: {
                label: 'Priority',
                valuePath: 'task.priority',
                options: [
                  { label: 'Low', value: 'low' },
                  { label: 'High', value: 'high' }
                ]
              }
            },
            {
              type: 'Button',
              props: {
                label: 'Create Task',
                variant: 'primary',
                action: 'create-task'
              }
            }
          ]
        }
      }
    }],
    
    dataModel: {
      task: { name: '', priority: 'medium' }
    },
    
    actions: [
      { id: 'create-task', type: 'api', handler: 'handleCreateTask' }
    ]
  }
};

// User fills form, clicks "Create Task"
// Browser sends: POST /api/agent/action
// Body: { action: 'create-task', payload: { task: { name: 'My Task', priority: 'high' } } }

// Agent responds with confirmation:
const confirmation = {
  text: "Task 'My Task' created successfully!",
  a2ui: {
    version: '1.0.0',
    surfaces: [{
      id: 'success',
      root: {
        type: 'Alert',
        props: {
          variant: 'success',
          message: 'Task created successfully!'
        }
      }
    }]
  }
};
```

---

## State Management

### Tab State Isolation

```typescript
// Each tab maintains its own state
interface TabState {
  // WebTab
  webviewState?: {
    canGoBack: boolean;
    canGoForward: boolean;
    isLoading: boolean;
    title: string;
    url: string;
  };
  
  // A2UITab
  a2uiState?: {
    dataModel: Record<string, unknown>;
    actionHistory: string[];
    pendingActions: string[];
  };
  
  // MiniappTab
  miniappState?: {
    runtime: CapsuleRuntimeState;
    grantedCapabilities: string[];
  };
}
```

### Data Model Updates

```typescript
// Immutable updates with path resolution
function updateDataModel(path: string, value: unknown) {
  // path: 'user.profile.name'
  // Updates: dataModel.user.profile.name = value
  
  const parts = path.split('.');
  setDataModel(prev => {
    const next = { ...prev };
    let current = next;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = { ...current[parts[i]] };
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
    return next;
  });
}
```

---

## Event System

### Action Events

```typescript
// Tab-scoped actions
type ActionEvent = {
  tabId: string;
  actionId: string;
  payload: Record<string, unknown>;
  timestamp: number;
};

// Global action bus (for cross-tab communication)
const actionBus = new EventEmitter();

actionBus.on('action', (event: ActionEvent) => {
  // Route to appropriate handler
});
```

### Lifecycle Events

```typescript
// Tab lifecycle
type TabEvent = 
  | { type: 'tab:created'; tabId: string; tabType: BrowserContentType }
  | { type: 'tab:activated'; tabId: string }
  | { type: 'tab:closed'; tabId: string }
  | { type: 'tab:updated'; tabId: string; updates: Partial<BrowserTab> };
```

---

## Extension Points

### 1. Custom Component Registry

```typescript
// Register custom components
const customComponents = {
  'CustomChart': CustomChartRenderer,
  'MapView': MapRenderer,
};

<A2UIRenderer
  payload={payload}
  customComponents={customComponents}
/>
```

### 2. Action Handlers

```typescript
// Register custom action handlers
const actionHandlers = {
  'download': (payload) => downloadFile(payload.url),
  'share': (payload) => shareContent(payload),
};

<A2UIRenderer
  payload={payload}
  actionHandlers={actionHandlers}
/>
```

### 3. Data Providers

```typescript
// Async data fetching
const dataProviders = {
  'user': async () => fetchUser(),
  'projects': async () => fetchProjects(),
};

<A2UIRenderer
  payload={payload}
  dataProviders={dataProviders}
/>
```

---

## Performance Considerations

### 1. Virtualization

Large lists use virtual rendering:
```typescript
{
  type: 'List',
  props: {
    items: [/* 10000 items */],
    virtualize: true,
    itemHeight: 50,
    overscan: 5
  }
}
```

### 2. Memoization

Components memoize expensive computations:
```typescript
const resolvedValue = useMemo(
  () => resolvePath(dataModel, props.valuePath),
  [dataModel, props.valuePath]
);
```

### 3. Lazy Loading

Heavy components loaded on demand:
```typescript
const ChartRenderer = lazy(() => import('./components/ChartRenderer'));
```

### 4. Data Polling

Auto-refresh with configurable intervals:
```typescript
{
  type: 'DataTable',
  props: {
    rowsPath: 'data.rows',
    dataSource: {
      pollInterval: 5000,  // Refresh every 5s
      onError: 'handle-load-error'
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test component rendering
test('Button renders with correct label', () => {
  const node = {
    type: 'Button',
    props: { label: 'Click Me', action: 'click' }
  };
  
  const { getByText } = render(
    <A2UIComponent node={node} context={mockContext} />
  );
  
  expect(getByText('Click Me')).toBeInTheDocument();
});

// Test data binding
test('TextField binds to data model', () => {
  const node = {
    type: 'TextField',
    props: { label: 'Name', valuePath: 'user.name' }
  };
  
  const context = {
    dataModel: { user: { name: 'Alice' } },
    updateDataModel: jest.fn()
  };
  
  const { getByDisplayValue } = render(
    <A2UIComponent node={node} context={context} />
  );
  
  expect(getByDisplayValue('Alice')).toBeInTheDocument();
});
```

### Integration Tests

```typescript
// Test full A2UI rendering
test('A2UIRenderer renders complete payload', () => {
  const payload = {
    version: '1.0.0',
    surfaces: [{
      id: 'test',
      root: {
        type: 'Container',
        props: {
          children: [
            { type: 'Text', props: { content: 'Hello' } },
            { type: 'Button', props: { label: 'Click', action: 'test' } }
          ]
        }
      }
    }]
  };
  
  const onAction = jest.fn();
  
  const { getByText } = render(
    <A2UIRenderer payload={payload} onAction={onAction} />
  );
  
  expect(getByText('Hello')).toBeInTheDocument();
  expect(getByText('Click')).toBeInTheDocument();
  
  fireEvent.click(getByText('Click'));
  expect(onAction).toHaveBeenCalledWith('test', expect.any(Object));
});
```

---

## Future Architecture

### 1. Plugin System

```typescript
interface BrowserPlugin {
  id: string;
  name: string;
  version: string;
  
  // Register new content types
  registerContentTypes?: () => ContentTypeDefinition[];
  
  // Register new A2UI components
  registerComponents?: () => ComponentDefinition[];
  
  // Hook into lifecycle
  onTabCreated?: (tab: BrowserTab) => void;
  onTabClosed?: (tab: BrowserTab) => void;
}
```

### 2. Workspace Sessions

```typescript
interface WorkspaceSession {
  id: string;
  name: string;
  tabs: BrowserTab[];
  activeTabId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Save/restore sessions
saveSession('Project Alpha');
restoreSession('Project Alpha');
```

### 3. Collaborative Tabs

```typescript
interface CollaborativeTab {
  id: string;
  type: 'collab';
  sessionId: string;
  participants: string[];
  permissions: Record<string, 'read' | 'write'>;
}
```

---

## Related Documentation

- `README.md` - Usage guide and API reference
- `ROADMAP.md` - Component roadmap and implementation details
- `../a2ui/a2ui.types.ts` - Complete type definitions
- `../a2ui/A2UIRenderer.tsx` - Renderer implementation
