# OpenClaw to A2rchitech: Complete Port Documentation

## Overview

This document describes the complete port of OpenClaw's browser automation and A2UI canvas hosting system to the A2rchitech codebase.

## What Was Ported

### 1. Browser Module (`1-kernel/a2r-browser/`)

**Files Created: 20+**

#### Core Server (`src/browser/`)
- `server.ts` - Express server for browser control (90 lines)
- `server-context.ts` - Profile and tab management context (145 lines)
- `routes/index.ts` - Route registration (15 lines)
- `routes/basic.ts` - Status, start, stop, profiles (125 lines)
- `routes/tabs.ts` - Tab management (82 lines)
- `routes/agent.ts` - Navigate, screenshot, PDF (47 lines)
- `routes/agent.snapshot.ts` - AI/ARIA snapshots (172 lines)
- `routes/agent.act.ts` - Click, type, wait actions (180 lines)

#### CDP Integration (`src/browser/cdp/`)
- `client.ts` - WebSocket CDP client (112 lines)
- `tabs.ts` - Tab management via CDP (57 lines)
- `screenshot.ts` - Screenshot capture (93 lines)
- `snapshot.ts` - ARIA/AI snapshots (80 lines)

#### Playwright Integration (`src/browser/playwright/`)
- `launcher.ts` - Browser launch via Playwright (46 lines)
- `actions.ts` - Click, type, hover, wait (226 lines)
- `snapshot.ts` - AI snapshot via Playwright (148 lines)
- `pdf.ts` - PDF generation (25 lines)

#### Canvas Host (`src/canvas-host/`)
- `a2ui.ts` - A2UI hosting, live reload injection (208 lines)
- `server.ts` - HTTP/WebSocket server (341 lines)

#### Types & Exports
- `types/index.ts` - Type definitions (196 lines)
- `index.ts` - Module exports (62 lines)

### 2. Gateway Commands (`1-kernel/a2r-gateway/src/commands/`)

**Files Created: 2**

- `canvas.ts` - Canvas control commands (156 lines)
  - `canvas.present`
  - `canvas.hide`
  - `canvas.navigate`
  - `canvas.eval`
  - `canvas.snapshot`
  - `canvas.a2ui.push`
  - `canvas.a2ui.reset`

- `browser.ts` - Browser proxy commands (115 lines)
  - `browser.proxy`
  - `browser.status`
  - `browser.start`
  - `browser.stop`

### 3. Agent Tools (`1-kernel/a2r-kernel/src/tools/`)

**Files Created: 3**

- `canvas-tool.ts` - Canvas tool for agents (232 lines)
- `browser-tool.ts` - Browser tool for agents (356 lines)
- `browser-tool.schema.ts` - Browser tool schemas (123 lines)

### 4. A2UI Bundle (`5-ui/a2r-platform/a2ui-bundle/`)

**Files Created: 5**

- `vite.config.ts` - Build configuration (48 lines)
- `src/main.tsx` - Bundle entry point (63 lines)
- `src/A2UIBundleApp.tsx` - Root component (214 lines)
- `src/styles.css` - A2UI styles (315 lines)
- `src/index.html` - Host HTML (31 lines)

### 5. Updated API Routes (`5-ui/a2r-platform/src/app/api/a2ui/`)

**Files Updated/Created: 3**

- `sessions/route.ts` - Forward to kernel (141 lines)
- `actions/route.ts` - Forward to kernel (124 lines)
- `events/route.ts` - SSE event stream (99 lines)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               AGENT LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐                                    │
│  │  Canvas Tool    │  │  Browser Tool   │                                    │
│  │  (7 actions)    │  │  (16 actions)   │                                    │
│  └────────┬────────┘  └────────┬────────┘                                    │
└───────────┼────────────────────┼────────────────────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY LAYER                                   │
│  ┌─────────────────┐  ┌─────────────────┐                                    │
│  │ canvas.present  │  │ browser.proxy   │                                    │
│  │ canvas.hide     │  │ browser.status  │                                    │
│  │ canvas.navigate │  │ browser.start   │                                    │
│  │ canvas.eval     │  │ browser.stop    │                                    │
│  │ canvas.snapshot │  └────────┬────────┘                                    │
│  │ canvas.a2ui.*   │           │                                             │
│  └────────┬────────┘           │                                             │
└───────────┼────────────────────┼─────────────────────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              KERNEL LAYER                                    │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                    │
│  │     CANVAS HOST         │  │    BROWSER SERVER       │                    │
│  │  ┌─────────────────┐    │  │  ┌─────────────────┐    │                    │
│  │  │ HTTP Server     │    │  │  │ Express Server  │    │                    │
│  │  │ WebSocket (WS)  │    │  │  │ REST API        │    │                    │
│  │  │ File Watch      │    │  │  │ CDP/Playwright  │    │                    │
│  │  └─────────────────┘    │  │  └─────────────────┘    │                    │
│  │                         │  │                         │                    │
│  │  Endpoints:             │  │  Endpoints:             │                    │
│  │  GET /__a2r__/a2ui      │  │  GET /                  │                    │
│  │  WS  /__a2r__/ws        │  │  GET /profiles          │                    │
│  │                         │  │  POST /start            │                    │
│  │  Commands:              │  │  POST /stop             │                    │
│  │  canvas.present         │  │  GET /tabs              │                    │
│  │  canvas.hide            │  │  POST /tabs/open        │                    │
│  │  canvas.navigate        │  │  POST /navigate         │                    │
│  │  canvas.eval            │  │  GET /snapshot          │                    │
│  │  canvas.snapshot        │  │  POST /screenshot       │                    │
│  │  canvas.a2ui.pushJSONL  │  │  POST /act              │                    │
│  │  canvas.a2ui.reset      │  │  POST /pdf              │                    │
│  └─────────────────────────┘  └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
1-kernel/
├── a2r-browser/
│   ├── src/
│   │   ├── browser/
│   │   │   ├── cdp/
│   │   │   │   ├── client.ts
│   │   │   │   ├── screenshot.ts
│   │   │   │   ├── snapshot.ts
│   │   │   │   └── tabs.ts
│   │   │   ├── playwright/
│   │   │   │   ├── actions.ts
│   │   │   │   ├── launcher.ts
│   │   │   │   ├── pdf.ts
│   │   │   │   └── snapshot.ts
│   │   │   ├── routes/
│   │   │   │   ├── agent.act.ts
│   │   │   │   ├── agent.snapshot.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── basic.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── tabs.ts
│   │   │   ├── server-context.ts
│   │   │   └── server.ts
│   │   ├── canvas-host/
│   │   │   ├── a2ui.ts
│   │   │   └── server.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── a2r-gateway/
│   └── src/
│       └── commands/
│           ├── browser.ts
│           ├── canvas.ts
│           └── index.ts
│
└── a2r-kernel/
    └── src/
        └── tools/
            ├── browser-tool.schema.ts
            ├── browser-tool.ts
            ├── canvas-tool.ts
            └── index.ts

5-ui/
└── a2r-platform/
    ├── a2ui-bundle/
    │   ├── src/
    │   │   ├── A2UIBundleApp.tsx
    │   │   ├── index.html
    │   │   ├── main.tsx
    │   │   └── styles.css
    │   └── vite.config.ts
    └── src/
        └── app/
            └── api/
                └── a2ui/
                    ├── actions/
                    │   └── route.ts
                    ├── events/
                    │   └── route.ts
                    └── sessions/
                        └── route.ts
```

## Build Instructions

### 1. Build A2UI Bundle

```bash
cd 5-ui/a2r-platform/a2ui-bundle
npm install
npm run build

# Output: 5-ui/a2r-platform/dist-a2ui/
#   - a2ui.bundle.js
#   - index.html
```

### 2. Build Browser Module

```bash
cd 1-kernel/a2r-browser
npm install
npm run build

# Output: 1-kernel/a2r-browser/dist/
```

### 3. Start Services

```bash
# Start Browser Control Server (kernel)
cd 1-kernel/a2r-browser
npm start

# Start Canvas Host Server (kernel)
cd 1-kernel/a2r-browser
npm run canvas

# Start Gateway
cd 1-kernel/a2r-gateway
npm start

# Start UI
cd 5-ui/a2r-platform
npm run dev
```

## API Endpoints

### Browser Control Server (Port configurable, default: dynamic)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Browser status |
| GET | `/profiles` | List profiles |
| POST | `/profiles/create` | Create profile |
| DELETE | `/profiles/:name` | Delete profile |
| POST | `/start` | Start browser |
| POST | `/stop` | Stop browser |
| POST | `/reset-profile` | Reset profile |
| GET | `/tabs` | List tabs |
| POST | `/tabs/open` | Open tab |
| POST | `/tabs/focus` | Focus tab |
| DELETE | `/tabs/:id` | Close tab |
| POST | `/navigate` | Navigate to URL |
| GET | `/snapshot` | Page snapshot |
| POST | `/screenshot` | Take screenshot |
| POST | `/pdf` | Save as PDF |
| POST | `/act` | Perform action |
| POST | `/hooks/file-chooser` | File upload |
| POST | `/hooks/dialog` | Handle dialog |
| GET | `/console` | Console messages |

### Canvas Host Server (Port configurable)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/__a2r__/a2ui` | A2UI host page |
| GET | `/__a2r__/a2ui/*` | A2UI assets |
| WS | `/__a2r__/ws` | Live reload WebSocket |

### Gateway Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `canvas.present` | `url?`, `placement?` | Show canvas |
| `canvas.hide` | - | Hide canvas |
| `canvas.navigate` | `url` | Navigate |
| `canvas.eval` | `javaScript` | Execute JS |
| `canvas.snapshot` | `format?` | Capture screenshot |
| `canvas.a2ui.pushJSONL` | `jsonl` | Push A2UI payload |
| `canvas.a2ui.reset` | - | Reset A2UI |
| `browser.proxy` | `method`, `path`, `body?` | Proxy to browser |
| `browser.status` | `profile?` | Get status |
| `browser.start` | `profile?` | Start browser |
| `browser.stop` | `profile?` | Stop browser |

## Configuration

### Browser Config

```json
{
  "enabled": true,
  "controlPort": 9222,
  "headless": false,
  "noSandbox": false,
  "executablePath": "/path/to/chrome",
  "attachOnly": false,
  "profiles": {
    "default": {
      "name": "default",
      "cdpPort": 9222,
      "cdpUrl": "http://127.0.0.1:9222"
    },
    "chrome": {
      "name": "chrome",
      "driver": "extension",
      "cdpUrl": "ws://localhost:9223"
    }
  }
}
```

### Canvas Host Config

```json
{
  "rootDir": "~/.a2r/canvas",
  "basePath": "/__a2r__/canvas",
  "liveReload": true,
  "port": 0
}
```

## Dependencies Added

### Production
- `express` - Web server
- `ws` - WebSocket server
- `chokidar` - File watching
- `playwright` - Browser automation

### Development
- `typescript` - Type checking
- `@types/express` - Express types
- `@types/ws` - WebSocket types

## Next Steps

1. **Integration Testing** - Test full flow: Agent → Gateway → Kernel → Browser
2. **Chrome Extension** - Implement Chrome extension relay for "chrome" profile
3. **Multi-node** - Support browser proxy across multiple nodes
4. **Security** - Add authentication to browser control endpoints
5. **Monitoring** - Add metrics and health checks
6. **Documentation** - API documentation and usage examples

## Credits

Ported from OpenClaw (v2026.1.29) architecture:
- `dist/browser/` - Browser automation (42 files)
- `dist/canvas-host/` - Canvas/A2UI hosting (5 files)
- `dist/agents/tools/canvas-tool.js` - Canvas tool
- `dist/agents/tools/browser-tool.js` - Browser tool
