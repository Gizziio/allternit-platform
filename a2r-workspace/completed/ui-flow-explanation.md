# ChatUI Flow Explanation

## Overview

The ChatUI now operates in a **protocol-separated architecture**:
- **Chat** → Uses ACP/JSONL drivers (clean text, no ANSI)
- **Terminal** → Uses PTY driver (interactive TUI, ANSI allowed)
- **Never mixed** → Kernel enforces separation, API validates, UI renders accordingly

---

## 1. Model Picker UI

### Initial Load

```
┌─────────────────────────────────────────┐
│  🤖 Select AI Model                     │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ OpenCode (opencode-acp) ─────────┐ │
│  │  ✅ Authenticated                 │ │
│  │  Model: [Claude 3.7 Sonnet ▼]    │ │
│  │  [Refresh models] Updated 2h ago │ │
│  └──────────────────────────────────┘ │
│                                         │
│  ┌─ Gemini CLI (gemini-acp) ────────┐ │
│  │  🔒 Authentication required      │ │
│  │  [Authenticate]                  │ │
│  └──────────────────────────────────┘ │
│                                         │
│  ┌─ Claude Code TUI ────────────────┐ │
│  │  🖥️ Terminal only                │ │
│  │  [Open in Terminal]              │ │
│  └──────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### What Happens

1. **UI calls**: `GET /v1/providers/auth/status`
2. **For each provider**:
   - `status: "ok"` → Show model dropdown
   - `status: "missing"` → Show "Authenticate" button
   - `event_mode: "terminal"` → Show "Terminal only" label

---

## 2. Auth Wizard Flow

### User Clicks "Authenticate"

```
Chat UI                          API                    Kernel
   │                               │                       │
   │  POST /v1/sessions            │                       │
   │  {                            │                       │
   │    "brain_profile_id":        │                       │
   │      "opencode-auth",         │                       │
   │    "source": "terminal"       │                       │
   │  }                            │                       │
   │──────────────────────────────>│                       │
   │                               │  POST /v1/sessions    │
   │                               │  (same payload)       │
   │                               │──────────────────────>│
   │                               │                       │
   │                               │                       │ Creates PTY
   │                               │                       │ session
   │                               │                       │
   │                               │  {session_id: "s1"}   │
   │                               │<──────────────────────│
   │                               │                       │
   │  {session_id: "s1"}           │                       │
   │<──────────────────────────────│                       │
   │                               │                       │
   │                               │                       │
   │  Open Terminal View           │                       │
   │  attached to session s1       │                       │
   │                               │                       │
   │  User runs: opencode login    │                       │
   │                               │                       │
   │  [Done] button clicked        │                       │
   │                               │                       │
   │  GET /v1/providers/opencode/  │                       │
   │  auth/status                  │                       │
   │──────────────────────────────>│                       │
   │                               │                       │
   │  {status: "ok"}               │                       │
   │<──────────────────────────────│                       │
   │                               │                       │
   │  ✅ Provider unlocked!        │                       │
   │  Model dropdown now active    │                       │
```

### What User Sees

1. Click "Authenticate" on locked provider
2. Terminal panel opens with auth CLI running
3. User completes login in terminal
4. Returns to chat → provider now unlocked
5. Can select models and chat

---

## 3. Starting a Chat Session

### User Sends Message

```
Chat UI                          API                    Kernel
   │                               │                       │
   │  User selected:               │                       │
   │  - Provider: opencode-acp     │                       │
   │  - Model: anthropic:claude-3-7│                       │
   │                               │                       │
   │  POST /chat                   │                       │
   │  {                            │                       │
   │    "chatId": "c1",            │                       │
   │    "message": "Hello!",       │                       │
   │    "modelId": "opencode-acp"  │                       │
   │  }                            │                       │
   │──────────────────────────────>│                       │
   │                               │                       │
   │                               │  POST /v1/sessions    │
   │                               │  {                    │
   │                               │    "config": {        │
   │                               │      "brain_type":    │
   │                               │        "cli",         │
   │                               │      "event_mode":    │
   │                               │        "acp",         │
   │                               │      ...              │
   │                               │    },                 │
   │                               │    "source": "chat",  │ ← CRITICAL
   │                               │    "runtime_overrides":│
   │                               │      {"model_id":     │
   │                               │       "anthropic:cl-  │
   │                               │       aude-3-7"}      │
   │                               │  }                    │
   │                               │──────────────────────>│
   │                               │                       │
   │                               │                       │ Checks:
   │                               │                       │ source=chat
   │                               │                       │ event_mode=acp ✓
   │                               │                       │ NOT terminal ✓
   │                               │                       │
   │                               │                       │ Creates
   │                               │                       │ AcpProtocolDriver
   │                               │                       │ (pipes, no PTY)
   │                               │                       │
   │                               │  {id: "s1", ...}      │
   │                               │<──────────────────────│
   │                               │                       │
   │  [SSE stream opens]           │                       │
   │<──────────────────────────────│                       │
```

---

## 4. Event Stream Rendering

### SSE Events Flow

```
Kernel → API → ChatUI

Event 1: session.started
{
  "type": "session.started",
  "payload": {
    "session_id": "s1",
    "event_mode": "acp",      ← UI checks this
    "source": "chat",
    "brain_profile_id": "opencode-acp"
  }
}
↓
API validates: event_mode != "terminal" ✓
UI: [Don't render, just validate]

Event 2: chat.delta
{
  "type": "chat.delta",
  "payload": {"text": "Hello"}
}
↓
UI renders: "Hello" (streaming)

Event 3: chat.delta
{
  "type": "chat.delta", 
  "payload": {"text": "! How can"}
}
↓
UI renders: "! How can" (appends)

Event 4: tool.call
{
  "type": "tool.call",
  "payload": {
    "tool_id": "Read",
    "call_id": "t1",
    "args": "{\"file\": \"src/main.rs\"}"
  }
}
↓
UI renders:
┌─────────────────────┐
│ 🔧 Running: Read    │
│ src/main.rs         │
└─────────────────────┘

Event 5: tool.result
{
  "type": "tool.result",
  "payload": {
    "call_id": "t1",
    "result": "fn main() {...}"
  }
}
↓
UI updates:
┌─────────────────────┐
│ ✅ Read completed   │
│ [Show result]       │
└─────────────────────┘

Event 6: chat.delta
{
  "type": "chat.delta",
  "payload": {"text": "I can see the code..."}
}
↓
UI continues assistant message

Event 7: chat.message.completed
{
  "type": "chat.message.completed",
  "payload": {"text": "...", "stop_reason": "end_turn"}
}
↓
UI: Message complete, show input field
```

### What User Sees

```
┌─────────────────────────────────────────┐
│ User: Hello!                            │
│                                         │
│ Assistant: Hello! How can I help you    │
│ today?                                  │
│                                         │
│ 🔧 Running: Read(src/main.rs)           │
│ ✅ Read completed                       │
│                                         │
│ I can see the code uses tokio for       │
│ async runtime. Would you like me to     │
│ explain the architecture?               │
│                                         │
│ [Type message...] [Send]                │
└─────────────────────────────────────────┘
```

---

## 5. Error Handling

### Scenario A: Terminal Brain Selected for Chat

```
User selects "claude-code-tui" (event_mode=terminal)
  ↓
API sends: source="chat", config with event_mode="terminal"
  ↓
Kernel rejects: 409 Conflict
  "Chat sessions cannot use Terminal event mode"
  ↓
UI shows:
┌─────────────────────────────────────────┐
│ ❌ Mode Mismatch                        │
│                                         │
│ This brain is terminal-only and cannot  │
│ be used in chat.                        │
│                                         │
│ [Open in Terminal] [Choose ACP Brain]   │
└─────────────────────────────────────────┘
```

### Scenario B: Contract Violation (Should Never Happen)

```
Kernel bug: emits terminal.delta in chat stream
  ↓
API detects terminal.delta
  ↓
API aborts stream immediately
  ↓
UI shows:
┌─────────────────────────────────────────┐
│ ❌ Kernel Mode Mismatch                 │
│                                         │
│ Terminal output received in chat        │
│ session. This is a protocol violation.  │
│                                         │
│ Session ID: s1                          │
│ [Report Issue]                          │
└─────────────────────────────────────────┘
```

---

## 6. Model Discovery Flow

### Dropdown Population

```
User opens model picker for OpenCode
  ↓
UI calls: GET /v1/providers/opencode/models?profile_id=opencode-acp
  ↓
Kernel queries runtime: opencode acp --list-models (or ACP method)
  ↓
Response:
{
  "models": [
    {"id": "anthropic:claude-3-7-sonnet", "label": "Claude 3.7 Sonnet"},
    {"id": "anthropic:claude-3-5-haiku", "label": "Claude 3.5 Haiku"},
    {"id": "openai:gpt-4o", "label": "GPT-4o"}
  ],
  "fetched_at": "2026-02-14T10:00:00Z"
}
  ↓
UI renders dropdown with these options
  ↓
User selects "Claude 3.7 Sonnet"
  ↓
UI stores: runtimeModelId = "anthropic:claude-3-7-sonnet"
```

### Cache Handling

```
If cache is fresh (< 24h):
  Show dropdown immediately
  Show: "Updated 2 hours ago"

If cache is stale (> 24h):
  Show dropdown with warning
  Show: "⚠️ Last updated 2 days ago [Refresh]"

If user clicks Refresh:
  Show spinner
  Fetch from kernel
  Update cache
  Refresh dropdown
```

---

## 7. Complete User Journey

### First-Time Setup

1. User opens ChatUI
2. Sees provider list with lock icons
3. Clicks "Authenticate" on OpenCode
4. Terminal opens, runs `opencode login`
5. User logs in, closes terminal
6. UI refreshes, shows OpenCode unlocked
7. User selects model from dropdown
8. Starts chatting

### Regular Chat

1. User types message
2. Clicks send
3. Sees streaming response
4. Tool calls appear as badges
5. Tool results expand inline
6. Assistant continues after tool
7. Message completes

### Switching Models

1. User clicks model picker
2. Selects different provider
3. If locked → auth wizard
4. If unlocked → model dropdown
5. New chat uses selected model

---

## 8. Key UI Invariants

| Invariant | Enforcement |
|-----------|-------------|
| No ANSI in chat | Kernel + API reject terminal mode for chat |
| No TUI garbage | API aborts on terminal.delta |
| Auth before chat | UI locks models, requires auth wizard |
| Model freshness | Cache with TTL, refresh button |
| Tool visibility | Tool calls/results render in UI |
| Mode separation | Terminal brains show "Terminal only" label |

---

## 9. State Management

```typescript
interface ChatState {
  // Provider auth status
  providers: {
    [providerId: string]: {
      status: 'ok' | 'missing' | 'expired';
      authProfileId: string;
      chatProfileIds: string[];
    }
  };
  
  // Model cache per provider
  modelCache: {
    [providerId: string]: {
      models: Array<{id: string, label: string}>;
      fetchedAt: Date;
      ttl: number; // 24h
    }
  };
  
  // Current selection
  selectedProvider: string;
  selectedProfile: string;
  runtimeModelId: string; // opaque, from runtime
  
  // Session
  sessionId: string | null;
  isStreaming: boolean;
  messages: Message[];
}
```

---

**Result**: Clean chat experience with protocol separation, auth wizard integration, runtime model discovery, and tool visibility.