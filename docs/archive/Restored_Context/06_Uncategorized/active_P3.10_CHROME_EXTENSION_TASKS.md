# P3.10: Chrome Extension / Browser Capsule (4 weeks)

**Objective:** Build MV3 Chrome extension as "Browser Capsule" edge executor with Allternit-native tool contracts.

**Status:** 🟡 PARTIAL (basic MV3 in vendor assets)  
**Priority:** HIGH  
**Estimated Effort:** 4 weeks

---

## Current State

**Existing:**
- Basic MV3 extension in `services/vendor-integration/vendor/openclaw/assets/chrome-extension/`
- CDP Bridge at `packages/allternit-browser/src/cdp-bridge.ts`
- Native messaging foundation exists

**Missing:**
- Allternit-native Browser Capsule implementation
- BROWSER.* tool contracts
- Full safety model
- Receipt integration

---

## Week 1: Extension Architecture

### P3.10.1: MV3 Extension Foundation (2 days)

**Files to Create:**
```
packages/chrome-extension/
├── manifest.json
├── package.json
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   └── content-script.ts
│   ├── options/
│   │   ├── options.html
│   │   └── options.tsx
│   └── types/
│       └── index.ts
├── public/
│   └── icons/
└── vite.config.ts
```

**Tasks:**
- [ ] Create `packages/chrome-extension/` directory
- [ ] Set up manifest.json (MV3)
  ```json
  {
    "manifest_version": 3,
    "name": "Allternit Browser Capsule",
    "version": "1.0.0",
    "permissions": ["activeTab", "scripting", "storage", "nativeMessaging"],
    "host_permissions": ["http://*/", "https://*/"],
    "background": { "service_worker": "background.js" },
    "content_scripts": [{
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }]
  }
  ```
- [ ] Create service worker skeleton
- [ ] Set up content script injection
- [ ] Create options page structure
- [ ] Set up build pipeline (vite)

---

### P3.10.2: Native Messaging Host (2 days)

**Files to Create:**
```
cmd/api/src/
├── native_messaging/
│   ├── mod.rs
│   ├── host.rs
│   └── protocol.rs
└── bin/
    └── allternit-native-host.rs
```

**Tasks:**
- [ ] Implement native messaging host in Rust
- [ ] Add host manifest registration (Chrome/Edge/Firefox)
- [ ] Create message protocol (extension ↔ native host)
  ```rust
  struct NativeMessage {
      id: String,
      method: String,
      params: Value,
  }
  
  struct NativeResponse {
      id: String,
      result: Option<Value>,
      error: Option<String>,
  }
  ```
- [ ] Implement heartbeat/ping mechanism
- [ ] Add connection state management

**Host Manifest (macOS):**
```json
{
  "name": "com.allternit.native_host",
  "description": "Allternit Native Messaging Host",
  "path": "/usr/local/bin/allternit-native-host",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://*/"]
}
```

---

### P3.10.3: WebSocket Transport (1 day)

**Files to Modify:**
```
packages/chrome-extension/src/background/
├── websocket-client.ts
└── connection-manager.ts
```

**Tasks:**
- [ ] Add WebSocket client in service worker
- [ ] Implement reconnection logic (exponential backoff)
- [ ] Add message queuing for offline state
- [ ] Create connection status indicator

---

## Week 2: Tool Contracts & CDP

### P3.10.4: BROWSER.* Tool Contracts (2 days)

**Files to Create:**
```
cmd/api/src/tools/
└── browser/
    ├── mod.rs
    ├── get_context.rs
    ├── act.rs
    ├── nav.rs
    ├── extract.rs
    ├── screenshot.rs
    └── wait.rs
```

**Tasks:**
- [ ] Define `BROWSER.GET_CONTEXT` tool
  ```rust
  struct GetContextParams {
      tab_id: Option<String>,
      include_dom: bool,
      include_accessibility: bool,
      include_network_log: bool,
  }
  ```
- [ ] Define `BROWSER.ACT` tool (click, type, scroll)
  ```rust
  enum BrowserAction {
      Click { target: Target, options: ActionOptions },
      Type { target: Target, text: String, options: ActionOptions },
      Scroll { direction: Direction, amount: u32 },
      Hover { target: Target },
      Focus { target: Target },
  }
  ```
- [ ] Define `BROWSER.NAV` tool (navigate, back, forward, reload)
- [ ] Define `BROWSER.EXTRACT` tool (DOM extraction)
  ```rust
  enum ExtractQuery {
      Selector(String),
      Text(String),
      Role(String),
      XPath(String),
  }
  ```
- [ ] Define `BROWSER.SCREENSHOT` tool (full page, viewport, element)
- [ ] Define `BROWSER.WAIT` tool (time, element, navigation, condition)
- [ ] Create tool schema validation

---

### P3.10.5: CDP Integration (1 day)

**Tasks:**
- [ ] Integrate existing CDP bridge from `allternit-browser`
- [ ] Add CDP session management per tab
- [ ] Implement DOM snapshot capture
- [ ] Add network monitoring
- [ ] Create accessibility tree extraction

---

### P3.10.6: Content Script Actions (2 days)

**Files to Create:**
```
packages/chrome-extension/src/content/
├── action-executor.ts
├── element-resolver.ts
├── highlighter.ts
└── action-queue.ts
```

**Tasks:**
- [ ] Implement action executor in content script
- [ ] Add element resolution strategies:
  - Selector (CSS selector)
  - Text (contains text)
  - Role (ARIA role)
  - Coordinates (x, y)
  - XPath
- [ ] Implement click action with visual feedback (highlight)
- [ ] Implement type action with validation
- [ ] Add scroll action
- [ ] Create action queue system (for batched actions)

**Element Resolver:**
```typescript
interface Target {
  type: 'selector' | 'text' | 'role' | 'coordinates' | 'xpath';
  value: string;
  timeout?: number;
}

async function resolveElement(target: Target): Promise<Element> {
  // Implementation with retry logic
}
```

---

## Week 3: Safety Model & UI

### P3.10.7: Safety Model Implementation (2 days)

**Files to Create:**
```
packages/chrome-extension/src/background/
├── safety/
│   ├── host-allowlist.ts
│   ├── action-classifier.ts
│   ├── circuit-breaker.ts
│   └── data-minimizer.ts
└── policies/
    └── default-safety.json
```

**Tasks:**
- [ ] Implement host allowlist (default deny)
  - Default: deny all
  - User can add allowed hosts
  - Wildcard support (*.example.com)
- [ ] Add human-in-loop gates for high-risk actions
  - Form submission
  - Navigation away from page
  - Download initiation
  - Payment-related elements
- [ ] Create circuit breaker (action rate limiting)
  - Max 10 actions per minute
  - Cooldown after rapid actions
- [ ] Add data minimization (block password/2FA fields)
  - Detect password inputs
  - Detect 2FA fields
  - Detect credit card fields
  - Block extraction of sensitive data
- [ ] Implement visual confirmation overlays

---

### P3.10.8: Approval UI (1 day)

**Files to Create:**
```
packages/chrome-extension/src/
├── popup/
│   ├── popup.html
│   ├── popup.tsx
│   └── ActionPreview.tsx
└── options/
    └── SafetySettings.tsx
```

**Tasks:**
- [ ] Create approval popup component
- [ ] Design action preview (what will happen)
- [ ] Add "Allow once / Always / Deny" options
- [ ] Create action history view
- [ ] Add permission management UI

**Action Preview:**
```typescript
interface ActionPreview {
  type: 'click' | 'type' | 'navigate' | 'extract';
  description: string;
  target?: string;
  value?: string;
  risk_level: 'low' | 'medium' | 'high';
}
```

---

### P3.10.9: ShellUI Browser Capsule View (2 days)

**Files to Create:**
```
surfaces/allternit-platform/src/views/
└── BrowserCapsule/
    ├── BrowserCapsule.tsx
    ├── BrowserSessionList.tsx
    ├── LiveBrowserView.tsx
    └── BrowserTimeline.tsx
```

**Tasks:**
- [ ] Add "Browser Capsule" view type to nav
- [ ] Create browser session list
- [ ] Implement live browser view (screenshot stream)
- [ ] Add browser action panel
- [ ] Create browser timeline visualization

---

## Week 4: Receipts & Observability

### P3.10.10: Receipt Integration (2 days)

**Files to Modify:**
```
cmd/api/src/receipts/
└── browser_action.rs
```

**Tasks:**
- [ ] Extend receipt schema for browser actions
- [ ] Create `BrowserActionReceipt` type
  ```rust
  struct BrowserActionReceipt {
      action: BrowserAction,
      target_url: String,
      before_screenshot: Option<Bytes>,
      after_screenshot: Option<Bytes>,
      dom_diff: Option<DomDiff>,
      network_log: Vec<NetworkEvent>,
      timestamp: DateTime<Utc>,
      duration_ms: u64,
  }
  ```
- [ ] Add before/after screenshot to receipts
- [ ] Implement DOM diff in receipts
- [ ] Add network log to receipts

---

### P3.10.11: Observability Timeline (1 day)

**Files to Create:**
```
surfaces/allternit-platform/src/components/
└── BrowserTimeline/
    ├── BrowserTimeline.tsx
    ├── TimelineEvent.tsx
    └── TimelineReplay.tsx
```

**Tasks:**
- [ ] Create browser event stream
- [ ] Add events: navigation, click, type, extract, screenshot, error
- [ ] Implement timeline renderer in A2UI
- [ ] Add search/filter on browser events
- [ ] Create browser session replay

---

### P3.10.12: Testing & Distribution (2 days)

**Tasks:**
- [ ] Write unit tests for service worker
- [ ] Test content script on major sites:
  - [ ] Google (SPA)
  - [ ] GitHub (complex DOM)
  - [ ] Amazon (forms)
  - [ ] YouTube (dynamic content)
- [ ] Security audit (CSP, XSS prevention)
- [ ] Prepare Chrome Web Store package
  - Screenshots
  - Description
  - Privacy policy
- [ ] Create installation documentation

---

## 📋 Dependencies

| Task | Depends On | Notes |
|------|-----------|-------|
| P3.10.2 | P3.10.1 | Native host needs extension |
| P3.10.3 | P3.10.1 | WebSocket needs service worker |
| P3.10.5 | P3.10.4 | CDP implements tools |
| P3.10.6 | P3.10.5 | Content script uses CDP |
| P3.10.7 | P3.10.4 | Safety wraps tools |
| P3.10.8 | P3.10.7 | UI shows safety decisions |
| P3.10.9 | P3.10.3 | ShellUI needs connection |
| P3.10.10 | P3.10.6 | Receipts capture actions |
| P3.10.11 | P3.10.10 | Timeline shows receipts |
| P3.10.12 | All | Final testing |

---

## 🔗 Related Work

- P3.12: Browser-use Tools - shares tool contracts
- P3.9: MCP Apps - extension could host interactive capsules

---

## ✅ Definition of Done

- [ ] Extension installs in Chrome/Edge
- [ ] Native messaging connects to API
- [ ] All BROWSER.* tools functional
- [ ] Safety model enforced
- [ ] Approval UI works
- [ ] ShellUI browser view renders
- [ ] Receipts generated for actions
- [ ] Tests pass on major sites
- [ ] Chrome Web Store ready

---

**Start Date:** TBD  
**End Date:** TBD + 4 weeks
