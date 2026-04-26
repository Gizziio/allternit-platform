# N20 Research: Native OpenClaw in ShellUI

## Executive Summary

**Current State:** OpenClaw runs in an isolated iframe at port 18789 via `openclaw-bridge.html`
**Goal:** Bring OpenClaw's agent functionality NATIVE to ShellUI with new UX
**Scope:** N5 from Parity Plan (chat + stream + abort + inject)

---

## Current Architecture

### Quarantine Mode (Active)
```
ShellUI (surfaces/allternit-platform)
├── views/openclaw/
│   ├── OpenClawControlUI.tsx  # 122KB native UI (iframe fallback)
│   ├── gateway-client.ts      # WebSocket client
│   ├── session-api.ts         # Session management API
│   └── PARITY_PLAN.md         # N0-N3 complete, N4-N12 pending
└── openclaw-bridge.html       # Iframe wrapper (port 18789)
```

**Iframe Flow:**
1. User clicks "OpenClaw" tab in ShellUI
2. Loads `openclaw-bridge.html` 
3. Iframe loads OpenClaw from `localhost:18789`
4. Footer says: "Running in QUARANTINE mode"

### Native Implementation (Backend Ready)
```
domains/kernel/infrastructure/allternit-openclaw-host/src/
├── native_canvas_a2ui.rs          # Canvas/A2UI system ✅
├── native_session_manager.rs      # Session management ✅
├── native_skill_execution.rs      # Skill execution ✅
├── native_tool_registry.rs        # Tool registry ✅
├── native_tool_executor.rs        # Tool execution ✅
├── native_tool_streaming.rs       # Tool streaming ✅
├── native_vector_memory.rs        # Vector memory ✅
├── native_channel_abstraction.rs  # Channels ✅
├── native_cron_system.rs          # Cron jobs ✅
├── native_gateway_ws_handlers.rs  # Gateway WS ✅
└── lib.rs                         # All re-exported
```

**Status:** Backend native implementations exist but are NOT integrated into ShellUI

---

## What OpenClaw Provides (via iframe currently)

### Tab Structure (from OpenClawControlUI.tsx)
| Tab | Description | Native Equivalent |
|-----|-------------|-------------------|
| `chat` | Operator chat stream + abort + inject | **N20 Target** |
| `overview` | Gateway, events, system summary | Gateway API |
| `channels` | Channel status + WhatsApp QR/login | native_channel_abstraction |
| `instances` | Presence list and active clients | Session manager |
| `sessions` | Session list, patch, delete | native_session_manager |
| `cron` | Scheduler status, jobs, history | native_cron_system |
| `skills` | Skill status, toggle, install | native_skill_execution |
| `nodes` | Node list + exec approval | Tool registry |
| `config` | Get/set/apply config + schema | Config API |
| `debug` | status/health/models + RPC | Health checks |
| `logs` | Live logs.tail with filter | Log streaming |

### Key Capabilities Needed for N20 (chat tab)
1. **Streaming chat** - Token-by-token response streaming
2. **Abort/Cancel** - Stop button to halt generation
3. **Message injection** - Tool results, system events
4. **Session management** - Create, list, patch sessions
5. **Tool execution** - Run skills/tools with streaming
6. **A2UI canvas** - Visual workspace for agent outputs

---

## ShellUI Current State

### Chat Views (Basic)
```
surfaces/allternit-platform/src/views/chat/
├── ChatComposer.tsx      # Input UI (glass morphism)
├── ChatMessageParts.tsx  # Message rendering
├── ChatStore.ts          # Zustand state
├── ChatView.tsx          # Main view (157KB)
└── ChatA2UI.tsx          # A2UI integration
```

**Current ChatStore Capabilities:**
- Create/delete threads
- Add messages
- Link to OpenClaw sessions (`agentSessions` Map)
- Basic kernel integration

**Missing for Agent Mode:**
- Streaming support
- Abort controller
- Message injection
- Tool execution UI
- Session patching
- Canvas/A2UI workspace

---

## Integration Architecture

### Option 1: Extend Existing Chat (Recommended)
**Location:** `views/chat/` enhanced + `views/agent/` new

```
surfaces/allternit-platform/src/
├── views/
│   ├── chat/                    # [EXISTING] Basic chat
│   └── agent/                   # [NEW] OpenClaw agent mode
│       ├── AgentView.tsx        # Main container
│       ├── AgentStore.ts        # Zustand state
│       ├── AgentComposer.tsx    # Enhanced composer
│       ├── AgentMessageStream.tsx # Streaming display
│       ├── ToolCallPanel.tsx    # Tool execution UI
│       ├── CanvasWorkspace.tsx  # A2UI canvas
│       └── SessionManager.tsx   # Session controls
├── integration/openclaw/        # [NEW] Native integration
│   ├── gateway.ts               # Gateway client
│   ├── session.ts               # Session API
│   ├── streaming.ts             # Stream handling
│   ├── tools.ts                 # Tool execution
│   └── canvas.ts                # Canvas/A2UI
└── lib/agent/                   # [NEW] Agent utilities
    ├── abortController.ts
    ├── messageInjector.ts
    └── streamProcessor.ts
```

**Backend Bridge:**
```rust
// New API routes in kernel
/v1/agent/sessions          # CRUD sessions
/v1/agent/sessions/{id}/chat/stream  # Streaming chat
/v1/agent/sessions/{id}/abort        # Cancel generation
/v1/agent/tools/execute      # Tool execution
/v1/agent/canvas             # Canvas operations
```

### Option 2: Separate Agent View
Create completely new view alongside existing chat

**Pros:** Clean separation, no breaking changes
**Cons:** Duplicate UI components, confusion between chat vs agent

### Option 3: Unified Mode Switch
Add "Agent Mode" toggle to existing chat

**Pros:** Single entry point, familiar UI
**Cons:** Complexity, mode switching confusion

---

## Detailed N20 Implementation Plan

### Phase 1: Backend API (2 days)
Create Rust API layer in `domains/kernel/infrastructure/allternit-openclaw-host`

```rust
// src/gateway/native_api.rs
pub struct NativeAgentApi {
    session_manager: SessionManagerService,
    skill_executor: SkillExecutionService,
    canvas: CanvasService,
    tool_registry: ToolRegistry,
}

impl NativeAgentApi {
    // Streaming chat endpoint
    pub async fn chat_stream(
        &self,
        session_id: &str,
        message: &str,
    ) -> impl Stream<Item = Result<ChatChunk>>;
    
    // Abort generation
    pub async fn abort(&self, session_id: &str) -> Result<()>;
    
    // Inject message (tool result, etc.)
    pub async fn inject_message(
        &self,
        session_id: &str,
        message: InjectedMessage,
    ) -> Result<()>;
    
    // Execute tool
    pub async fn execute_tool(
        &self,
        session_id: &str,
        tool: ToolCall,
    ) -> impl Stream<Item = Result<ToolOutput>>;
}
```

### Phase 2: Frontend Core (3 days)

**AgentStore.ts** - State management
```typescript
interface AgentState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  
  // Streaming state
  isStreaming: boolean;
  partialMessage: string;
  abortController: AbortController | null;
  
  // Tool execution
  pendingTools: ToolCall[];
  toolResults: Map<string, ToolResult>;
  
  // Canvas
  canvasState: CanvasState | null;
  
  // Actions
  createSession: () => Promise<string>;
  sendMessage: (text: string) => Promise<void>;
  abortStream: () => void;
  injectToolResult: (toolCallId: string, result: any) => void;
  executeTool: (tool: ToolCall) => Promise<void>;
}
```

**AgentMessageStream.tsx** - Streaming UI
```tsx
export function AgentMessageStream({ sessionId }: Props) {
  const { isStreaming, partialMessage, messages } = useAgentStore();
  
  return (
    <div className="message-stream">
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
      {isStreaming && (
        <StreamingMessage text={partialMessage} />
      )}
    </div>
  );
}
```

**ToolCallPanel.tsx** - Tool execution UI
```tsx
export function ToolCallPanel() {
  const { pendingTools, executeTool } = useAgentStore();
  
  return (
    <div className="tool-panel">
      {pendingTools.map(tool => (
        <ToolCard
          key={tool.id}
          tool={tool}
          onExecute={() => executeTool(tool)}
        />
      ))}
    </div>
  );
}
```

### Phase 3: Canvas Integration (2 days)
Integrate A2UI canvas for visual workspace

```tsx
// CanvasWorkspace.tsx
export function CanvasWorkspace() {
  const { canvasState, pushComponent } = useCanvasStore();
  
  return (
    <div className="canvas-workspace">
      {canvasState?.components.map(comp => (
        <CanvasComponent key={comp.id} {...comp} />
      ))}
    </div>
  );
}
```

### Phase 4: Integration & Testing (1 day)
- Connect to native backend
- Feature flag (`openclaw_native_ui`)
- A/B testing setup
- Gradual rollout

---

## UI/UX Design Direction

### Different from OpenClaw
| Aspect | OpenClaw | ShellUI Native (Proposed) |
|--------|----------|---------------------------|
| **Layout** | Tabbed interface | Split-pane (chat + canvas) |
| **Styling** | Basic/dark | Glass morphism (match ShellUI) |
| **Tools** | Dropdown menu | Inline cards with preview |
| **Streaming** | Text only | Text + live component preview |
| **Canvas** | Separate tab | Side-by-side with chat |
| **Mobile** | Responsive | Bottom sheet for tools |

### Key Differentiators
1. **Unified Workspace** - Chat and canvas side-by-side
2. **Inline Tool UI** - Tools render as interactive cards
3. **Glass Morphism** - Match ShellUI design system
4. **Project Context** - Integrate with ShellUI projects
5. **Smart Streaming** - Components appear as they're generated

---

## File Structure Summary

### New Files (Frontend)
```
surfaces/allternit-platform/src/
├── views/agent/
│   ├── AgentView.tsx              # Main container
│   ├── AgentStore.ts              # State management
│   ├── AgentComposer.tsx          # Input + stop button
│   ├── AgentMessageStream.tsx     # Streaming messages
│   ├── ToolCallPanel.tsx          # Tool execution
│   ├── CanvasWorkspace.tsx        # A2UI canvas
│   ├── SessionPanel.tsx           # Session selector
│   └── index.ts
├── integration/agent/
│   ├── index.ts
│   ├── sessions.ts                # Session API
│   ├── streaming.ts               # Stream handling
│   ├── tools.ts                   # Tool execution
│   └── canvas.ts                  # Canvas operations
└── lib/agent/
    ├── abortController.ts
    ├── messageInjector.ts
    └── streamProcessor.ts
```

### New Files (Backend)
```
domains/kernel/infrastructure/allternit-openclaw-host/src/
├── api/
│   ├── mod.rs
│   ├── sessions.rs                # REST endpoints
│   ├── chat.rs                    # Streaming chat
│   ├── tools.rs                   # Tool execution
│   └── canvas.rs                  # Canvas operations
└── gateway/
    └── native_handlers.rs         # WebSocket handlers
```

---

## Estimated Effort

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Backend API | 2 days | Rust endpoints, streaming support |
| Frontend Core | 3 days | AgentStore, streaming UI, tools |
| Canvas Integration | 2 days | A2UI workspace, component rendering |
| Integration | 1 day | Feature flag, testing, rollout |
| **Total** | **8 days** | **Full N20 implementation** |

---

## Decision Required

**Option A: Full N20 Implementation (8 days)**
- Complete native OpenClaw agent mode in ShellUI
- Streaming chat with abort/inject
- Tool execution with UI
- Canvas workspace integration
- Feature flag for gradual rollout

**Option B: Minimal N20 (3 days)**
- Streaming chat only
- Basic abort functionality
- Reuse existing chat UI
- No canvas/tool UI yet

**Option C: Pause for Other Priorities**
- Document current state
- Create detailed RFC
- Return to other tasks (MCP, browser, etc.)

**Which option should I proceed with?**
