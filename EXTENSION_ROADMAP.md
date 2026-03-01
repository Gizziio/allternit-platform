# Browser Extension - Development Roadmap & Technical Spec

**When to Build It & Exactly What's Inside**

**Date:** February 26, 2026

---

## 📅 WHEN TO CREATE THE EXTENSION

### Development Phases

```
Phase 1: Core Platform (NOW)
├── TUI CLI ✅
├── API Backend ✅
├── Agent Sessions ✅
├── Tool Registry ✅
└── GUI Hooks ✅

Phase 2: GUI Platform (NEXT)
├── Dashboard UI
├── Agent Session Manager
├── Workflow Designer
├── ChangeSet Viewer
└── Mode Switcher

Phase 3: Browser Extension (AFTER GUI)
├── Extension Package
├── Sidebar Panel
├── Content Scripts
└── Toolbar Integration

Phase 4: Production (FINAL)
├── Chrome Web Store
├── Firefox Add-ons
├── Documentation
└── Marketing
```

---

## 🎯 RECOMMENDED TIMELINE

### Create Extension WHEN:

| Milestone | Status | Extension Ready? |
|-----------|--------|-----------------|
| **TUI Complete** | ✅ Done | ❌ No - too early |
| **API Complete** | ✅ Done | ❌ No - API still evolving |
| **GUI Basic** | ⏳ Next | ❌ No - wait for GUI stability |
| **GUI Stable** | ⏳ Future | ✅ YES - perfect time |
| **Production** | ⏳ Future | ✅ Must have |

---

## ✅ BEST TIME TO BUILD

**Build the extension AFTER:**

1. ✅ GUI platform is stable (not changing daily)
2. ✅ Agent-browser tool is production-ready
3. ✅ A2R SDK is packaged and versioned
4. ✅ API endpoints are finalized

**Why wait?**
- Extension requires stable APIs
- Don't want to update extension weekly
- Users expect extensions to "just work"

---

## 📦 EXACTLY WHAT'S PACKAGED

### Extension Package Contents

```
shell-extension-v1.0.0.zip
├── manifest.json              # Extension metadata
├── icons/
│   ├── icon16.png            # 1KB - Toolbar icon
│   ├── icon48.png            # 3KB - Extensions page
│   └── icon128.png           # 8KB - Store listing
├── src/
│   ├── background/
│   │   └── service.js        # 15KB - Service worker
│   ├── content/
│   │   ├── script.js         # 10KB - Content script
│   │   └── styles.css        # 2KB - Highlight styles
│   ├── sidebar/
│   │   ├── panel.html        # 1KB - Panel entry
│   │   ├── panel.js          # 25KB - React app
│   │   ├── panel.css         # 5KB - Styles
│   │   ├── ChatPanel.tsx     # Bundled in panel.js
│   │   └── ToggleSwitch.tsx  # Bundled in panel.js
│   └── shared/
│       └── types.js          # 2KB - Shared types
├── vendor/
│   └── @a2r/
│       └── sdk/
│           └── index.js      # 50KB - A2R SDK
└── README.md                 # 5KB - Instructions

TOTAL: ~120KB (uncompressed)
       ~40KB (compressed .zip)
```

---

## 🔧 TECHNICAL ARCHITECTURE

### How It Works - Step by Step

```
┌─────────────────────────────────────────────────────────┐
│  User Action: Clicks extension icon                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  1. Sidebar Panel Opens (panel.html)                    │
│     - React app loads                                   │
│     - Connects to background service                    │
│     - Shows chat interface                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. User Types: "Click the login button"                │
│     - Message sent to background service                │
│     - Background analyzes intent                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. Background Service Calls A2R API                    │
│     POST http://localhost:3000/api/v1/tools/execute     │
│     {                                                    │
│       "tool_name": "agent-browser.automation",          │
│       "parameters": {                                    │
│         "action": "click",                               │
│         "selector": "role=button[name='Login']"         │
│       }                                                  │
│     }                                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. A2R API Executes Tool                               │
│     - Spawns agent-browser CLI                          │
│     - agent-browser clicks element                      │
│     - Returns result                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  5. Background Receives Result                          │
│     - Notifies content script                           │
│     - Content script highlights clicked element         │
│     - Updates sidebar with response                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  6. Sidebar Shows: "✓ Clicked login button"             │
│     - User sees confirmation                            │
│     - Can continue with next action                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📡 COMMUNICATION FLOW

### Message Passing Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Sidebar    │ ←─────→ │  Background  │ ←─────→ │   Content    │
│    Panel     │  JSON   │   Service    │  JSON   │   Script     │
└──────────────┘         └──────────────┘         └──────────────┘
       ↓                        ↓                        ↓
  React UI               Service Worker              DOM Access
  Chat interface         Tool execution              Highlight
  User input             A2R API calls               Click/Fill
```

### Example Messages

**Sidebar → Background:**
```json
{
  "type": "AGENT_ACTION",
  "action": "click",
  "params": {
    "selector": "@e5"
  }
}
```

**Background → Content:**
```json
{
  "type": "HIGHLIGHT_ELEMENT",
  "selector": "@e5"
}
```

**Content → Background:**
```json
{
  "type": "ELEMENT_CLICKED",
  "selector": "@e5",
  "success": true
}
```

**Background → Sidebar:**
```json
{
  "type": "ACTION_RESULT",
  "action": "click",
  "result": {
    "success": true,
    "execution_time_ms": 234
  }
}
```

---

## 🔐 PERMISSIONS REQUIRED

### manifest.json Permissions

```json
{
  "permissions": [
    "activeTab",        // Access current tab
    "scripting",        // Inject content scripts
    "storage",          // Store session state
    "tabs",             // Tab management
    "sidePanel",        // Sidebar panel
    "contextMenus"      // Right-click menu
  ],
  
  "host_permissions": [
    "<all_urls>"        // Work on any website
  ]
}
```

### Why Each Permission?

| Permission | Why Needed |
|------------|-----------|
| `activeTab` | Know which tab to control |
| `scripting` | Inject highlight overlay |
| `storage` | Save session between uses |
| `tabs` | Navigate between tabs |
| `sidePanel` | Show sidebar chat |
| `contextMenus` | Right-click actions |
| `<all_urls>` | Work on any website |

---

## 🎯 FEATURE BREAKDOWN

### What the Extension Does

#### 1. Browser Control (Core)

```typescript
// User says: "Go to github.com"
await execute({ action: 'open', url: 'https://github.com' });

// User says: "Click login"
await execute({ action: 'click', selector: 'role=button[name=Login]' });

// User says: "Fill my email"
await execute({ action: 'fill', selector: 'label=Email', value: 'user@example.com' });

// User says: "Take a screenshot"
await execute({ action: 'screenshot', path: '/tmp/screen.png' });
```

#### 2. Context Menu Actions

```
Right-click on page:
├─ "Explain with ShellUI" → Opens sidebar with selection
├─ "Click this element" → Agent clicks element
└─ "Fill this field" → Agent fills field
```

#### 3. Keyboard Shortcuts

```
Ctrl+Shift+K → Toggle sidebar
Ctrl+Shift+L → Quick action panel
```

#### 4. Element Highlighting

```typescript
// Shows @e1, @e2 refs on page
// User can say "click @e5"
// Agent knows exactly which element
```

#### 5. Session Persistence

```typescript
// Remembers browser session
// Cookies, login state preserved
// Can resume where left off
```

---

## 📊 INTEGRATION POINTS

### With Main Platform

```
┌─────────────────────────────────────────────────────────┐
│  Extension                        A2R Platform          │
├─────────────────────────────────────────────────────────┤
│  Sidebar Panel  ←────HTTP────→    API Server           │
│  Background     ←────WebSocket─→  Agent Service        │
│  Content Script ←────Direct────→  Browser (Playwright) │
└─────────────────────────────────────────────────────────┘
```

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/tools/execute` | POST | Execute browser actions |
| `/api/v1/agent-sessions` | GET/POST | Manage sessions |
| `/api/v1/agent-sessions/:id/messages` | GET/POST | Session messages |
| `/ws/extension` | WebSocket | Real-time updates |

---

## 🚀 BUILD PROCESS

### Step-by-Step Build

```bash
# 1. Navigate to extension directory
cd shell-extension

# 2. Install dependencies
npm install

# 3. Build (creates dist/)
npm run build

# 4. Package (creates .zip)
npm run package

# 5. Result: shell-extension-v1.0.0.zip
```

### What Gets Bundled

```
Source Files          →  Bundled Output
─────────────────────────────────────────────
panel.tsx (React)     →  panel.js (25KB)
service.ts            →  service.js (15KB)
script.ts             →  script.js (10KB)
@a2r/sdk (node_modules) → vendor/@a2r/sdk/index.js (50KB)
─────────────────────────────────────────────
Total Source: ~500KB  →  Total Bundle: ~120KB
```

---

## 📥 DISTRIBUTION

### Option 1: Chrome Web Store

```
1. Create Chrome Web Store developer account ($5 one-time)
2. Upload shell-extension-v1.0.0.zip
3. Fill out store listing (description, screenshots)
4. Submit for review (1-3 days)
5. Users can install from Chrome Web Store
```

### Option 2: Firefox Add-ons

```
1. Create Firefox Add-ons developer account (free)
2. Upload extension
3. Submit for review
4. Users can install from Firefox Add-ons
```

### Option 3: Sideloading (Development)

```
1. chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select dist/ folder
5. Extension installed locally
```

---

## 🎯 DEVELOPMENT CHECKLIST

### Before Building Extension

- [ ] GUI platform is stable
- [ ] Agent-browser tool is production-ready
- [ ] A2R SDK is packaged
- [ ] API endpoints are finalized
- [ ] Icons are designed (16/48/128px)
- [ ] Privacy policy is written
- [ ] Terms of service are ready

### Extension Development

- [ ] Create manifest.json
- [ ] Create icons
- [ ] Implement background service
- [ ] Implement content script
- [ ] Implement sidebar panel
- [ ] Add toggle switch
- [ ] Add keyboard shortcuts
- [ ] Add context menus
- [ ] Test on multiple sites
- [ ] Write documentation

### Before Release

- [ ] Security audit
- [ ] Performance testing
- [ ] Cross-browser testing (Chrome, Firefox, Edge)
- [ ] Privacy compliance check
- [ ] Store listing created
- [ ] Support channel ready

---

## 📊 TIMELINE ESTIMATE

| Phase | Duration | When |
|-------|----------|------|
| **Core Platform** | 2-3 weeks | NOW |
| **GUI Platform** | 2-3 weeks | After core |
| **Extension Dev** | 1-2 weeks | After GUI stable |
| **Testing** | 1 week | After extension |
| **Store Submission** | 3-5 days | After testing |

**Total: 6-10 weeks from now to extension in store**

---

## ✅ SUMMARY

| Question | Answer |
|----------|--------|
| **When to build?** | After GUI platform is stable |
| **What's packaged?** | manifest.json, icons, background, content, sidebar (~120KB) |
| **How does it work?** | Sidebar chat → Background service → A2R API → Browser control |
| **What permissions?** | activeTab, scripting, storage, tabs, sidePanel, contextMenus |
| **How to distribute?** | Chrome Web Store, Firefox Add-ons, or sideload |
| **Timeline?** | 6-10 weeks from now |

---

**Generated:** February 26, 2026  
**Status:** ✅ READY FOR PLANNING
