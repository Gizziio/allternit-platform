# HTML→Figma Integration in A2R Extension

## Overview
The HTML→Figma functionality has been fully integrated into the existing A2R Extension (`@allternit/extension`). It is NOT a separate extension - it's a module within the main A2R extension.

## File Structure

```
src/html-to-figma/
├── index.ts                    # Main exports
├── types.ts                    # TypeScript types
├── capture.ts                  # DOM capture service
├── background.ts               # Background script handlers
├── agents/
│   └── structure.ts            # Structure cleanup agent
└── ui/
    ├── CaptureButton.tsx       # Capture button component
    └── HTMLToFigmaPanel.tsx    # Main panel UI
```

## Integration Points

### 1. Background Script (src/entrypoints/background.ts)
- Added HTML→Figma message handlers
- Context menu integration
- Capture service initialization

```typescript
import { 
  handleHTMLToFigmaMessage, 
  setupHTMLToFigmaContextMenus,
  handleContextMenuClick 
} from '@/html-to-figma'

// Setup context menus
setupHTMLToFigmaContextMenus()

// Handle messages
if (message.type?.startsWith('HTML_TO_FIGMA')) {
  return handleHTMLToFigmaMessage(message, sender, sendResponse)
}
```

### 2. Sidepanel (src/entrypoints/sidepanel/App.tsx)
- Added HTML→Figma panel as a sub-view in Settings
- Navigation between Config and HTML→Figma panels

```typescript
import { HTMLToFigmaPanel } from '@/html-to-figma/ui/HTMLToFigmaPanel'

// Toggle between config and HTML→Figma
const [showHTMLToFigma, setShowHTMLToFigma] = useState(false)
```

### 3. Config Panel (src/entrypoints/sidepanel/components/ConfigPanel.tsx)
- Added "HTML to Figma" section with entry button
- Gradient styling for visual distinction

## User Flow

### Access via Settings:
1. Open A2R Extension sidepanel
2. Click gear icon (Settings)
3. Click "Open Capture Tool" in HTML to Figma section

### Access via Context Menu:
1. Right-click on any webpage
2. Select "🎨 Capture to Figma"
3. Choose "⚡ Quick Capture" or "🔍 Deep Capture"

### Capture Process:
1. Click Quick Capture (fast, structure only) or Deep Capture (with all agents)
2. Extension captures DOM from current tab
3. Structure Agent cleans up empty nodes and flattens containers
4. Result is copied to clipboard as Figma-compatible JSON
5. User pastes into Figma using JSON-to-Figma plugin

## Features

### Capture Service
- Extracts DOM structure from any webpage
- Computes styles for each element
- Generates Figma-compatible layer tree
- Filters invisible elements

### Structure Agent
- Removes empty frames/containers
- Flattens redundant single-child groups
- Optimizes layer hierarchy

### UI Components
- Quick Capture button (fast, minimal processing)
- Deep Capture button (full agent pipeline)
- Capture history
- Copy to clipboard
- Direct link to Figma

### Context Menus
- Quick Capture (page context)
- Deep Capture (page context)  
- Capture Selection (selection context)

## Message Types

```typescript
// Capture request
{
  type: 'HTML_TO_FIGMA_CAPTURE',
  payload: {
    options: {
      selector?: string
      fullPage?: boolean
      agents?: { structure?, style?, layout? }
    }
  }
}

// Export request
{
  type: 'HTML_TO_FIGMA_EXPORT',
  payload: { layers }
}
```

## Building

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/surfaces/a2r-extension

# Install dependencies
npm install

# Build extension
npm run build

# Or dev mode
npm run dev
```

## Usage

### From Sidepanel:
1. Open extension sidepanel (Ctrl+Shift+A or click icon)
2. Click settings gear
3. Click "Open Capture Tool"
4. Click Quick or Deep Capture
5. Paste JSON into Figma

### From Context Menu:
1. Right-click on page
2. Hover "🎨 Capture to Figma"
3. Select capture type

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    A2R Extension                        │
├─────────────────────────────────────────────────────────┤
│  Sidepanel │  Background  │  Content Script            │
├────────────┼──────────────┼────────────────────────────┤
│  ConfigPanel│ Message     │ DOM Capture                │
│     ↓      │   Router     │   (executeScript)          │
│  HTMLToFigma│     ↓       │      ↓                     │
│    Panel   │  Capture     │  Element Data              │
│     ↓      │   Service    │      ↓                     │
│ CaptureBtn │     ↓       │  Convert to Layers         │
│     ↓      │  Structure   │      ↓                     │
│  Capture   │   Agent      │  Structure Agent           │
│            │     ↓       │      ↓                     │
│            │  Clipboard   │  Figma JSON → Clipboard    │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

- No new dependencies added
- Uses existing extension infrastructure
- Leverages chrome.scripting API for DOM extraction
- Uses chrome.contextMenus for right-click actions

## Notes

- Fully integrated - not a separate extension
- Works within existing A2R Extension sidepanel
- Shares extension permissions (activeTab, scripting, etc.)
- No additional manifest changes needed
- Uses WXT build system (same as rest of extension)
