# Allternit: Implementation Plan for Production Features

## Overview

This plan outlines the steps needed to bridge the gap between the current demo implementation and the full production system based on OpenClaw's architecture.

---

## Phase 1: Canvas Host Server (Critical)

### Goal
Implement an HTTP/WebSocket server that hosts the A2UI application, similar to OpenClaw's `dist/canvas-host/`.

### Files to Create

#### 1. `domains/kernel/allternit-browser/src/canvas-host/server.ts`
```typescript
// Express HTTP server + WebSocket server
// - Serve A2UI bundle at /__allternit__/a2ui
// - WebSocket at /__allternit__/ws for live reload
// - File watching for development
// - Action bridge for UI interactions
```

#### 2. `domains/kernel/allternit-browser/src/canvas-host/a2ui.ts`
```typescript
// A2UI hosting logic
// - Resolve A2UI bundle path
// - Inject live reload script
// - Handle HTTP requests
// - Security (path traversal protection)
```

#### 3. `domains/kernel/allternit-browser/src/canvas-host/index.html`
```html
<!-- A2UI host page -->
<!-- - Load a2ui.bundle.js -->
<!-- - Setup action bridge -->
<!-- - Platform detection (iOS/Android/Web) -->
```

### Key Features
- [ ] HTTP server on configurable port (default: 0 = auto)
- [ ] WebSocket server for live reload
- [ ] File watching with chokidar
- [ ] Action bridge (postMessage for Web, native handlers for mobile)
- [ ] Path traversal protection
- [ ] Secure file serving

### Commands to Implement
```
canvas.present    - Show canvas, optionally with URL
canvas.hide       - Hide canvas
canvas.navigate   - Navigate to URL
canvas.eval       - Execute JavaScript
canvas.snapshot   - Capture screenshot
canvas.a2ui.pushJSONL  - Push A2UI payload
canvas.a2ui.reset      - Reset A2UI state
```

---

## Phase 2: Browser Control Server (Critical)

### Goal
Implement a full browser automation server using CDP and Playwright, similar to OpenClaw's `dist/browser/`.

### Files to Create

#### 1. `domains/kernel/allternit-browser/src/browser/server.ts`
```typescript
// Express server for browser control
// - Port binding (127.0.0.1 for security)
// - Profile management
// - Route registration
```

#### 2. `domains/kernel/allternit-browser/src/browser/routes/index.ts`
```typescript
// Route registration
// - Basic routes (status, start, stop, profiles)
// - Tab routes (list, open, focus, close)
// - Agent routes (snapshot, act, navigate, etc.)
```

#### 3. `domains/kernel/allternit-browser/src/browser/routes/basic.ts`
```typescript
// GET /           - Status with profile info
// GET /profiles   - List profiles
// POST /start     - Start browser
// POST /stop      - Stop browser
// POST /profiles/create  - Create profile
// DELETE /profiles/:name - Delete profile
```

#### 4. `domains/kernel/allternit-browser/src/browser/routes/tabs.ts`
```typescript
// GET /tabs           - List tabs
// POST /tabs/open     - Open tab
// POST /tabs/focus    - Focus tab
// DELETE /tabs/:id    - Close tab
// POST /tabs/action   - Tab actions (back, forward, reload)
```

#### 5. `domains/kernel/allternit-browser/src/browser/routes/agent.ts`
```typescript
// GET /snapshot       - Page snapshot (AI/ARIA format)
// POST /screenshot    - Take screenshot
// POST /navigate      - Navigate to URL
// POST /pdf          - Save as PDF
// POST /act          - Perform action
// POST /hooks/file-chooser  - File upload
// POST /hooks/dialog        - Handle dialog
// GET /console       - Console messages
```

#### 6. `domains/kernel/allternit-browser/src/browser/cdp.ts`
```typescript
// Chrome DevTools Protocol client
// - Connect to browser
// - Execute CDP commands
// - Handle events
```

#### 7. `domains/kernel/allternit-browser/src/browser/pw-ai.ts`
```typescript
// Playwright integration
// - Launch browser via Playwright
// - AI snapshot (_snapshotForAI)
// - ARIA snapshot
// - Screenshot with labels
// - Actions (click, type, etc.)
```

#### 8. `domains/kernel/allternit-browser/src/browser/server-context.ts`
```typescript
// Server context management
// - Profile context
// - Browser state
// - Tab management
```

### Key Features
- [ ] Profile management (chrome, openclaw, custom)
- [ ] Chrome extension relay support
- [ ] Playwright integration
- [ ] CDP direct connection
- [ ] Screenshot (full page, element, labeled)
- [ ] Snapshot (AI format with refs, ARIA format)
- [ ] Actions: click, type, press, hover, scroll, drag, select, fill, wait, evaluate

### API Endpoints
```
GET    /                    - Browser status
GET    /profiles            - List profiles
POST   /profiles/create     - Create profile
DELETE /profiles/:name      - Delete profile
POST   /start               - Start browser
POST   /stop                - Stop browser
GET    /tabs                - List tabs
POST   /tabs/open           - Open tab
POST   /tabs/focus          - Focus tab
DELETE /tabs/:id            - Close tab
POST   /navigate            - Navigate to URL
GET    /snapshot            - Page snapshot
POST   /screenshot          - Take screenshot
POST   /pdf                 - Save as PDF
POST   /act                 - Perform action
POST   /hooks/file-chooser  - File upload
POST   /hooks/dialog        - Handle dialog
GET    /console             - Console messages
```

---

## Phase 3: Gateway Commands (Critical)

### Goal
Implement Gateway commands that agents can use to control canvas and browser.

### Files to Modify/Created

#### 1. `domains/kernel/allternit-gateway/src/commands/canvas.ts`
```typescript
// Gateway commands for canvas control
// - canvas.present
// - canvas.hide
// - canvas.navigate
// - canvas.eval
// - canvas.snapshot
// - canvas.a2ui.pushJSONL
// - canvas.a2ui.reset
```

#### 2. `domains/kernel/allternit-gateway/src/commands/browser.ts`
```typescript
// Gateway commands for browser control
// - browser.proxy (for node routing)
// Direct passthrough to browser server
```

#### 3. `domains/kernel/allternit-gateway/src/registry.ts`
```typescript
// Register commands
// - node.invoke: canvas.*
// - node.invoke: browser.proxy
```

### Command Flow
```
Agent → canvas_tool → Gateway → node.invoke → Canvas/Browser Server
```

---

## Phase 4: Agent Tools (Critical)

### Goal
Implement agent-facing tools that use the Gateway commands.

### Files to Create

#### 1. `domains/kernel/allternit-kernel/src/tools/canvas-tool.ts`
```typescript
// Canvas tool for agents
// - present: Show canvas
// - hide: Hide canvas
// - navigate: Navigate to URL
// - eval: Execute JavaScript
// - snapshot: Capture screenshot
// - a2ui_push: Push A2UI JSONL
// - a2ui_reset: Reset A2UI
```

#### 2. `domains/kernel/allternit-kernel/src/tools/browser-tool.ts`
```typescript
// Browser tool for agents
// - status: Check browser status
// - start: Start browser
// - stop: Stop browser
// - profiles: List profiles
// - tabs: List tabs
// - open: Open tab
// - focus: Focus tab
// - close: Close tab
// - snapshot: Page snapshot
// - screenshot: Take screenshot
// - navigate: Navigate to URL
// - console: Get console messages
// - pdf: Save as PDF
// - upload: Upload file
// - dialog: Handle dialog
// - act: Perform action (click, type, etc.)
```

#### 3. `domains/kernel/allternit-kernel/src/tools/browser-tool.schema.ts`
```typescript
// TypeBox schemas for browser tool
// - Action enum
// - Request schemas per action
// - Response schemas
```

---

## Phase 5: A2UI Bundle (Critical)

### Goal
Compile the A2UI React components into a standalone bundle that can be hosted.

### Build Configuration

#### 1. `5-ui/allternit-platform/a2ui-bundle/vite.config.ts`
```typescript
// Vite config for A2UI bundle
// - Library mode
// - React plugin
// - Radix UI externals
// - Output: a2ui.bundle.js
```

#### 2. Build Process
```bash
# Build A2UI bundle
cd 5-ui/allternit-platform
npm run build:a2ui-bundle

# Output:
# - dist-a2ui/index.html
# - dist-a2ui/a2ui.bundle.js
```

### A2UI Bundle Features
- [ ] Mount on global object (window.Allternit)
- [ ] Accept initial payload
- [ ] Action callback registration
- [ ] Surface management
- [ ] Component rendering
- [ ] Data model state management

---

## Phase 6: Kernel Integration (High)

### Goal
Connect the API routes to the real kernel instead of mock responses.

### Changes

#### 1. `5-ui/allternit-platform/src/app/api/a2ui/sessions/route.ts`
```typescript
// Forward to kernel port 3004
// POST /v1/a2ui/sessions
// GET /v1/a2ui/sessions?chat_id=xxx
```

#### 2. `5-ui/allternit-platform/src/app/api/a2ui/actions/route.ts`
```typescript
// Forward to kernel port 3004
// POST /v1/a2ui/action
```

#### 3. Kernel Endpoints to Implement
```
POST /v1/a2ui/sessions      - Create session
GET  /v1/a2ui/sessions      - List sessions
POST /v1/a2ui/action        - Execute action
POST /v1/a2ui/capsules      - Create capsule
GET  /v1/a2ui/capsules      - List capsules
GET  /v1/a2ui/sessions/:id/events - Event stream
```

---

## Phase 7: UI Integration (Medium)

### Goal
Integrate A2UI rendering into the Chat view and enable saving sessions as Miniapps.

### Changes

#### 1. `5-ui/allternit-platform/src/capsules/chat/ChatView.tsx`
```typescript
// Render A2UI inline in chat messages
// "Open in Browser" button
// Session management
```

#### 2. `5-ui/allternit-platform/src/capsules/a2ui/MiniappManager.tsx`
```typescript
// Save A2UI session as Miniapp
// List saved Miniapps
// Launch Miniapps in browser
```

#### 3. `5-ui/allternit-platform/src/capsules/browser/BrowserCapsuleEnhanced.tsx`
```typescript
// Connect to real browser server
// Remove hardcoded demos
// Load real Miniapps from database
```

---

## Implementation Priority

### Week 1: Canvas Host
- [ ] Canvas host server
- [ ] A2UI bundle build
- [ ] Gateway canvas commands

### Week 2: Browser Server Core
- [ ] Browser server
- [ ] Basic routes (status, start, stop)
- [ ] Tab routes

### Week 3: Browser Automation
- [ ] CDP integration
- [ ] Playwright integration
- [ ] Snapshot routes
- [ ] Action routes

### Week 4: Agent Tools & Integration
- [ ] Canvas tool
- [ ] Browser tool
- [ ] Kernel API routes
- [ ] UI integration

---

## Dependencies to Add

```json
{
  "dependencies": {
    "express": "^4.x",
    "ws": "^8.x",
    "chokidar": "^3.x",
    "playwright": "^1.x",
    "chrome-launcher": "^1.x",
    "puppeteer-core": "^21.x"
  }
}
```

---

## Testing Strategy

1. **Unit Tests**: Individual route handlers
2. **Integration Tests**: Full request/response flow
3. **E2E Tests**: Browser automation with real sites
4. **Performance Tests**: Snapshot performance

---

## Success Criteria

- [ ] Agent can create A2UI session via tool call
- [ ] A2UI renders in browser capsule
- [ ] Agent can control browser via tool call
- [ ] Browser automation works on real sites
- [ ] Sessions can be saved as Miniapps
- [ ] All features work end-to-end
