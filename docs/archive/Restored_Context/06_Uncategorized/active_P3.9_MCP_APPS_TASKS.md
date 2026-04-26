# P3.9: MCP Apps / Interactive Capsules (3 weeks)

**Objective:** Enable tools to return interactive UI surfaces (not just text/JSON) with bidirectional bridge between tool data and UI.

**Status:** 🔴 NOT STARTED  
**Priority:** HIGH  
**Estimated Effort:** 3 weeks

---

## Week 1: Core Protocol & Types

### P3.9.1: Define MCP Apps Protocol (2 days)

**Files to Create:**
```
packages/mcp-apps/
├── package.json
├── tsconfig.json
├── src/
│   ├── types/
│   │   ├── InteractiveCapsule.ts
│   │   ├── ToolUISurface.ts
│   │   ├── MCPBridge.ts
│   │   └── index.ts
│   ├── schema/
│   │   ├── capsule.schema.json
│   │   └── surface.schema.json
│   └── index.ts
└── README.md
```

**Tasks:**
- [ ] Create `packages/mcp-apps/` directory structure
- [ ] Define `InteractiveCapsule` TypeScript interfaces
- [ ] Define `ToolUISurface` schema (JSON Schema)
- [ ] Create `MCPBridge` protocol types
- [ ] Document capsule lifecycle (mount → update → unmount)
- [ ] Define message format for tool ↔ UI communication

**Key Interfaces:**
```typescript
interface InteractiveCapsule {
  id: string;
  type: string;
  state: 'pending' | 'active' | 'closed';
  surface: ToolUISurface;
  toolId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ToolUISurface {
  html: string;
  css?: string;
  js?: string;
  props?: Record<string, unknown>;
  permissions: CapsulePermission[];
}

interface MCPBridgeMessage {
  type: 'tool:data' | 'tool:event' | 'ui:action' | 'ui:event';
  payload: unknown;
  timestamp: number;
}
```

---

### P3.9.2: Runtime Bridge API - API Layer (2 days)

**Files to Modify:**
```
cmd/api/src/
├── state.rs (add McpAppsState)
├── routes/
│   └── mcp_apps_routes.rs (create)
└── lib.rs (add routes)
```

**Tasks:**
- [ ] Add `McpAppsState` to `AppState` in API
- [ ] Create `POST /mcp-apps/capsules` - create capsule
- [ ] Create `GET /mcp-apps/capsules/:id` - get capsule state
- [ ] Create `POST /mcp-apps/capsules/:id/event` - UI → tool event
- [ ] Create `GET /mcp-apps/capsules/:id/stream` - SSE for tool → UI updates
- [ ] Create `DELETE /mcp-apps/capsules/:id` - cleanup

**Route Signatures:**
```rust
async fn create_capsule(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateCapsuleRequest>,
) -> Result<Json<CapsuleResponse>, ApiError>

async fn get_capsule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<CapsuleResponse>, ApiError>

async fn post_event(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(event): Json<CapsuleEvent>,
) -> Result<StatusCode, ApiError>

async fn event_stream(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>>
```

---

### P3.9.3: Capsule Registry (1 day)

**Files to Create:**
```
cmd/api/src/services/
└── capsule_registry.rs
```

**Tasks:**
- [ ] Implement in-memory capsule registry
- [ ] Add capsule state machine (pending → active → closed)
- [ ] Implement event queue per capsule
- [ ] Add cleanup/garbage collection for orphaned capsules

**Registry Methods:**
```rust
impl CapsuleRegistry {
    fn create(&self, spec: CapsuleSpec) -> String;
    fn get(&self, id: &str) -> Option<Capsule>;
    fn update_state(&self, id: &str, state: CapsuleState);
    fn push_event(&self, id: &str, event: CapsuleEvent);
    fn subscribe(&self, id: &str) -> mpsc::Receiver<CapsuleEvent>;
    fn delete(&self, id: &str);
    fn cleanup_orphaned(&self, max_age: Duration);
}
```

---

## Week 2: UI Integration & Sandboxing

### P3.9.4: Hardened Capsule Frame Component (2 days)

**Files to Create:**
```
surfaces/allternit-platform/src/components/
└── CapsuleFrame/
    ├── CapsuleFrame.tsx
    ├── CapsuleFrame.module.css
    ├── useCapsuleBridge.ts
    └── index.ts
```

**Tasks:**
- [ ] Create `CapsuleFrame` React component in ShellUI
- [ ] Implement sandboxed iframe with strict CSP
- [ ] Add postMessage API for parent ↔ iframe communication
- [ ] Create message validation layer (reject invalid origins)
- [ ] Add loading/error states

**Component Props:**
```typescript
interface CapsuleFrameProps {
  capsuleId: string;
  surface: ToolUISurface;
  onEvent?: (event: CapsuleEvent) => void;
  onToolInvoke?: (tool: string, params: unknown) => void;
  className?: string;
}
```

**Security Checklist:**
- [ ] `sandbox="allow-scripts"` (no forms, popups, etc.)
- [ ] `referrerpolicy="no-referrer"`
- [ ] Validate all postMessage origins
- [ ] CSP: `default-src 'none'; script-src 'unsafe-inline'`

---

### P3.9.5: Tool-to-UI Event Pipeline (2 days)

**Files to Modify:**
```
surfaces/allternit-platform/src/
├── store/
│   └── slices/
│       └── mcpAppsSlice.ts (create)
├── hooks/
│   └── useCapsule.ts (create)
└── services/
    └── capsuleApi.ts (create)
```

**Tasks:**
- [ ] Implement event routing from API to ShellUI
- [ ] Add Redux state slice for `mcpApps`
- [ ] Create `useCapsule()` hook for components
- [ ] Implement real-time updates via WebSocket/SSE
- [ ] Add event history/log per capsule

**State Shape:**
```typescript
interface McpAppsState {
  capsules: Record<string, Capsule>;
  activeCapsuleId: string | null;
  events: Record<string, CapsuleEvent[]>;
  loading: boolean;
  error: string | null;
}
```

---

### P3.9.6: UI-to-Tool Invocation (1 day)

**Files to Modify:**
```
surfaces/allternit-platform/src/components/CapsuleFrame/
└── injectCapsuleAPI.ts (create)
```

**Tasks:**
- [ ] Implement `window.allternit` injected API in capsule frame
- [ ] Add `allternit.invokeTool(toolName, params)` method
- [ ] Add `allternit.emitEvent(eventType, payload)` method
- [ ] Create permission validation (which tools can be invoked)
- [ ] Add receipt generation for tool invocations

**Injected API:**
```javascript
window.allternit = {
  version: '1.0.0',
  invokeTool: async (tool, params) => { /* ... */ },
  emitEvent: (type, payload) => { /* ... */ },
  subscribe: (eventType, callback) => { /* ... */ },
  getState: () => { /* ... */ },
};
```

---

## Week 3: Permission Model & Integration

### P3.9.7: Permission Model (2 days)

**Files to Create:**
```
surfaces/allternit-platform/src/policies/
└── mcp-apps.policy.ts

cmd/api/src/services/
└── capsule_permissions.rs
```

**Tasks:**
- [ ] Define `CapsulePermission` types
- [ ] Implement capability-based access control
- [ ] Add tool allowlist per capsule type
- [ ] Create `mcp-apps.policy.ts` with default policies
- [ ] Add audit logging for permission checks

**Permission Types:**
```typescript
interface CapsulePermission {
  type: 'tool:invoke' | 'tool:subscribe' | 'state:read' | 'state:write';
  resource: string; // tool name or state path
  actions: string[];
}

const DEFAULT_CAPSULE_PERMISSIONS: CapsulePermission[] = [
  { type: 'tool:invoke', resource: '*', actions: ['read'] },
  { type: 'state:read', resource: '*', actions: ['read'] },
];
```

---

### P3.9.8: Agent Studio Integration (1 day)

**Files to Modify:**
```
surfaces/allternit-platform/src/views/
└── AgentStudio/
    └── tabs/
        └── InteractiveCapsuleTab.tsx (create)
```

**Tasks:**
- [ ] Add "Interactive Capsule" tab in Agent Studio
- [ ] Implement capsule preview/debug view
- [ ] Add capsule template gallery
- [ ] Create capsule development tools

---

### P3.9.9: Testing & Documentation (2 days)

**Files to Create:**
```
packages/mcp-apps/src/
├── __tests__/
│   ├── capsule.test.ts
│   └── bridge.test.ts
└── examples/
    ├── simple-button/
    ├── data-table/
    └── chart-widget/
```

**Tasks:**
- [ ] Write unit tests for capsule registry
- [ ] Write integration tests for event pipeline
- [ ] Create security test suite (CSP, sandbox escape attempts)
- [ ] Document MCP Apps API
- [ ] Create example capsule implementations

**Security Tests:**
- [ ] XSS attempt via HTML surface
- [ ] postMessage origin spoofing
- [ ] Tool invocation without permission
- [ ] State access escalation
- [ ] iframe sandbox escape attempts

---

## 📋 Dependencies

| Task | Depends On |
|------|-----------|
| P3.9.2 | P3.9.1 |
| P3.9.3 | P3.9.2 |
| P3.9.4 | P3.9.1 |
| P3.9.5 | P3.9.2, P3.9.4 |
| P3.9.6 | P3.9.4, P3.9.5 |
| P3.9.7 | P3.9.3, P3.9.6 |
| P3.9.8 | P3.9.4, P3.9.5 |
| P3.9.9 | All above |

---

## ✅ Definition of Done

- [ ] All API endpoints functional
- [ ] CapsuleFrame renders sandboxed UI
- [ ] Bidirectional communication works
- [ ] Permission model enforced
- [ ] Unit tests > 80% coverage
- [ ] Security tests pass
- [ ] Documentation complete
- [ ] Example capsules working

---

## 🔗 Related

- Parent: [STRUCTURED_DAG_TASKS.md](./STRUCTURED_DAG_TASKS.md)
- Gap Analysis: [COMPREHENSIVE_BRAINSTORM_GAP_ANALYSIS.md](./COMPREHENSIVE_BRAINSTORM_GAP_ANALYSIS.md)
- Source: `mcp-apps.md` (brainstorm file)

---

**Start Date:** TBD  
**End Date:** TBD + 3 weeks
