# Capsule/MiniApp Browser System

A comprehensive browser system that supports multiple content types including traditional web browsing, A2UI (Agent-generated UI), miniapps, and direct component rendering.

## Overview

The Capsule Browser System transforms the traditional browser from a simple webview into a multi-purpose content renderer that supports:

- **Web Content**: Traditional URL-based browsing via Electron webview
- **A2UI Payloads**: Agent-generated dynamic UIs via JSON schemas
- **Miniapps**: Self-contained capsule applications with manifests
- **Components**: Direct React component rendering

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BrowserCapsule                           │
├─────────────────────────────────────────────────────────────┤
│  TabBar │ NavigationBar │ Content Area                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │   Web    │  A2UI    │ Miniapp  │ Component│             │
│  │  View    │ Renderer │ Loader   │  View    │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
capsules/
├── index.ts                    # Main exports
├── capsule.types.ts            # Core capsule types
├── capsule.registry.ts         # View type mapping
├── CapsuleHost.tsx            # Capsule container component
├──
├── browser/                   # Browser module
│   ├── index.ts              # Browser exports
│   ├── browser.types.ts      # Tab types, miniapp manifest
│   ├── browser.store.ts      # Zustand store for tabs
│   ├── BrowserCapsule.tsx    # Main browser component
│   └── README.md             # This file
│
└── a2ui/                     # A2UI Renderer module
    ├── index.ts              # A2UI exports
    ├── a2ui.types.ts         # Component type definitions
    └── A2UIRenderer.tsx      # React-based A2UI renderer
```

## Usage

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
    <button onClick={() => addA2UITab(payload, 'My App')}>
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

## A2UI Components

The A2UI renderer supports the following component types:

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

## Security

- **Component Whitelist**: Only whitelisted component types can be rendered
- **Action Registry**: Actions must be registered before they can be triggered
- **Data Model Isolation**: Each tab has its own isolated data model
- **CSP Support**: Content Security Policy for miniapps

## Store API

```typescript
interface BrowserStore {
  // State
  tabs: BrowserTab[];
  activeTabId: string | null;
  
  // Tab Management
  addTab: (url: string, title?: string) => void;
  addA2UITab: (payload: A2UIPayload, title?: string, source?: string) => void;
  addMiniappTab: (manifest: MiniappManifest, capsuleId: string, entryPoint?: string) => void;
  addComponentTab: (componentId: string, title?: string, props?: Record<string, unknown>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<BrowserTab>) => void;
  
  // Bulk Operations
  closeAllTabs: () => void;
  closeOtherTabs: (keepId: string) => void;
  duplicateTab: (id: string) => void;
}
```

## Testing

Open a sample A2UI tab:

```tsx
import { openSampleA2UITab } from '@a2r/platform';

// Opens a demo A2UI tab
openSampleA2UITab();
```

## Future Enhancements

- [ ] Component registry for dynamic component loading
- [ ] Miniapp marketplace integration
- [ ] Capsule signing and verification
- [ ] Offline miniapp caching
- [ ] Cross-tab state sharing
- [ ] A2UI form validation
- [ ] Canvas protocol support for complex visualizations
