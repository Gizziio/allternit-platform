# Thin Client Extension - Architecture

## Overview
Desktop companion extension that creates a bridge between A2R Desktop (Electron) and web applications.

## Communication Flow
```
┌─────────────────┐     Native Messaging      ┌──────────────────┐
│  A2R Desktop    │ ◄───────────────────────► │ Thin Client Ext  │
│  (Electron)     │    (stdio pipe)          │ (Content Script) │
└─────────────────┘                           └──────────────────┘
                                                        │
                                                        │ DOM injection
                                                        ▼
                                               ┌──────────────────┐
                                               │  Web App         │
                                               │  (GitHub, etc.)  │
                                               └──────────────────┘
```

## Components

### 1. Native Messaging Host
- Registers with browser as `com.a2r.desktop`
- Communicates with Electron main process via stdio
- Bidirectional JSON message passing

### 2. Content Script (Injector)
- Injected into specific domains (GitHub, Figma, etc.)
- Creates invisible iframe or shadow DOM overlay
- Receives commands from desktop app

### 3. Background Service Worker
- Manages connection to native host
- Handles extension lifecycle
- Routes messages between content scripts and native host

## Use Cases
1. **GitHub Integration**: A2R agent can read PRs, comment, merge
2. **Figma Integration**: Agent can inspect designs, export assets
3. **Generic Web**: DOM manipulation, form filling, data extraction
4. **Screen Context**: Desktop app knows what user is viewing

## Distribution
- NOT published to Chrome Web Store
- Distributed as `.zip` via:
  - Download from a2r.io/extensions
  - Bundled with A2R Desktop installer
  - Auto-update from A2R update server
