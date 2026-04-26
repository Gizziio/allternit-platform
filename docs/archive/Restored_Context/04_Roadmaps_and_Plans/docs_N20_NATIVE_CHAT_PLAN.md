# N20: Native Chat Implementation Plan

## Current State Analysis

### Existing Architecture
```
surfaces/allternit-platform/src/
├── views/chat/
│   ├── ChatComposer.tsx      # Message input UI
│   ├── ChatMessageParts.tsx  # Message rendering
│   ├── ChatStore.ts          # Zustand state management
│   └── ChatA2UI.tsx          # A2UI integration
├── integration/kernel/
│   └── chat.ts               # Kernel API integration
└── app/(chat)/api/chat/      # API routes
```

### Current Flow
1. User types message → `ChatComposer.tsx`
2. Message added to store → `ChatStore.addMessage()`
3. Store calls kernel → `integration/kernel/chat.ts`
4. Kernel API sends message → POST `/api/chat/send`
5. Response returns → No streaming currently

### The "Quarantine Iframe" Problem
The DAG mentions replacing a "quarantine iframe for chat". Looking at the code:
- There's an `openclawConnected` state in ChatStore
- Agent sessions are linked via `agentSessions` Map
- The current implementation likely uses an iframe to isolate OpenClaw chat

**N20 Goal**: Replace iframe isolation with native kernel streaming

---

## Proposed N20 Architecture

### New/Modified Files

```
surfaces/allternit-workspace/allternit/surfaces/allternit-platform/src/
├── views/chat/
│   ├── ChatComposer.tsx              # [MODIFY] Add abort controller
│   ├── ChatMessageStream.tsx         # [NEW] Streaming message display
│   ├── ChatStore.ts                  # [MODIFY] Add streaming state
│   ├── useChatStream.ts              # [NEW] Streaming hook
│   └── ChatContainer.tsx             # [MODIFY] Message injection support
├── integration/kernel/
│   └── chat.ts                       # [MODIFY] Add streaming + abort
├── lib/ai/
│   └── streaming/                    # [NEW]
│       ├── streamProcessor.ts        # Token stream handling
│       ├── abortController.ts        # Cancel operations
│       └── messageInjector.ts        # External message injection
└── app/(chat)/api/chat/
    └── stream/route.ts               # [NEW] SSE streaming endpoint
```

---

## Key Features (from DAG Acceptance Criteria)

### 1. Native Chat UI ✅ (Already exists)
**Location**: `views/chat/ChatComposer.tsx`, `ChatMessageParts.tsx`
- Glass morphism design
- Project/connection selector
- Multi-line input with auto-resize

### 2. Token Streaming 🔄 (NEW)
**Location**: `views/chat/useChatStream.ts`, `lib/ai/streaming/`

```typescript
// useChatStream.ts - New hook
export function useChatStream(threadId: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [partialMessage, setPartialMessage] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = async (message: string) => {
    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ threadId, message }),
      signal: abortControllerRef.current.signal,
    });
    
    const reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      setPartialMessage(prev => prev + decode(value));
    }
    
    setIsStreaming(false);
  };

  const abortStream = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  return { isStreaming, partialMessage, startStream, abortStream };
}
```

### 3. Abort/Cancel Operations 🔄 (NEW)
**Location**: `lib/ai/streaming/abortController.ts`

```typescript
// AbortController manager
export class ChatAbortController {
  private controllers = new Map<string, AbortController>();

  create(threadId: string): AbortController {
    this.cancel(threadId); // Cancel any existing
    const controller = new AbortController();
    this.controllers.set(threadId, controller);
    return controller;
  }

  cancel(threadId: string): void {
    const controller = this.controllers.get(threadId);
    if (controller) {
      controller.abort();
      this.controllers.delete(threadId);
    }
  }

  cancelAll(): void {
    this.controllers.forEach(c => c.abort());
    this.controllers.clear();
  }
}
```

UI Integration:
```tsx
// In ChatComposer.tsx
{isStreaming && (
  <button onClick={abortStream} className="abort-button">
    <StopIcon /> Stop generating
  </button>
)}
```

### 4. Message Injection Capability 🔄 (NEW)
**Location**: `lib/ai/streaming/messageInjector.ts`

Used for:
- System messages
- Tool results
- External events (files uploaded, etc.)
- Agent-initiated messages

```typescript
export class MessageInjector {
  constructor(private store: ChatStore) {}

  inject(threadId: string, message: InjectedMessage) {
    this.store.addMessage(threadId, message.role, message.text, {
      source: message.source, // 'system' | 'tool' | 'agent' | 'external'
      metadata: message.metadata,
      skipKernel: true, // Don't send to kernel (already processed)
    });
  }

  // Inject tool execution result
  injectToolResult(threadId: string, toolCallId: string, result: any) {
    this.inject(threadId, {
      role: 'assistant',
      text: `Tool result: ${JSON.stringify(result)}`,
      source: 'tool',
      metadata: { toolCallId },
    });
  }
}
```

---

## Backend Integration

### New API Route: `/api/chat/stream`

```typescript
// app/(chat)/api/chat/stream/route.ts
export async function POST(req: Request) {
  const { threadId, message } = await req.json();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Connect to kernel streaming endpoint
      const kernelStream = await kernel.chat.streamMessage(threadId, message);
      
      for await (const chunk of kernelStream) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
    cancel() {
      // Handle abort
      kernel.chat.cancelStream(threadId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

### Kernel Bridge Extension

```typescript
// integration/kernel/chat.ts additions
export async function streamMessage(
  threadId: string, 
  text: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
) {
  const response = await fetch(`${KERNEL_URL}/v1/chat/stream`, {
    method: 'POST',
    body: JSON.stringify({ threadId, text }),
    signal,
  });

  const reader = response.body?.getReader();
  while (reader && !signal?.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decode(value));
  }
}

export async function cancelStream(threadId: string) {
  await fetch(`${KERNEL_URL}/v1/chat/${threadId}/cancel`, {
    method: 'POST',
  });
}
```

---

## Migration from Iframe to Native

### Current (Iframe-based)
```
┌─────────────────────────────┐
│  ShellUI Container          │
│  ┌───────────────────────┐  │
│  │ OpenClaw Iframe       │  │
│  │ (isolated chat)       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### After N20 (Native)
```
┌─────────────────────────────┐
│  ShellUI Container          │
│  ┌───────────────────────┐  │
│  │ Native ChatComposer   │  │
│  │ ┌───────────────────┐ │  │
│  │ │ Streaming Display │ │  │
│  │ │ (token-by-token)  │ │  │
│  │ └───────────────────┘ │  │
│  │ [Stop Button]         │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
         │
         ▼ SSE/WebSocket
┌─────────────────────────────┐
│  Kernel (Rust)              │
│  ┌───────────────────────┐  │
│  │ Streaming Response    │  │
│  │ (cancelable)          │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Streaming Infrastructure
1. Create `useChatStream.ts` hook
2. Add SSE endpoint `/api/chat/stream`
3. Update `ChatMessageParts.tsx` for partial messages
4. Add streaming indicator UI

### Phase 2: Abort/Cancel
1. Create `ChatAbortController` manager
2. Add Stop button to ChatComposer
3. Wire up kernel cancel endpoint
4. Handle abort cleanup

### Phase 3: Message Injection
1. Create `MessageInjector` class
2. Add tool result rendering
3. Support system message injection
4. External event integration (files, etc.)

### Phase 4: Iframe Removal
1. Remove OpenClaw iframe references
2. Migrate any iframe-only features
3. Clean up `openclawConnected` state
4. Update ChatStore to remove iframe bridge

---

## Testing Strategy

1. **Unit Tests**
   - `useChatStream` hook behavior
   - `ChatAbortController` cancel logic
   - `MessageInjector` state updates

2. **Integration Tests**
   - Full send → stream → complete flow
   - Abort mid-stream
   - Multiple concurrent streams
   - Message injection during stream

3. **E2E Tests**
   - User sends message
   - Tokens appear one by one
   - User clicks stop
   - External tool result appears

---

## Why This Matters

**Current Iframe Approach:**
- ❌ Isolated from ShellUI design system
- ❌ Limited customization
- ❌ Complex cross-frame messaging
- ❌ Performance overhead

**Native Approach (N20):**
- ✅ Unified design (glass morphism, etc.)
- ✅ Full control over UX
- ✅ Direct kernel integration
- ✅ Better performance (no iframe)
- ✅ Native streaming support
- ✅ Abort capability
- ✅ Message injection for tools/agents

---

## Your Decision

**Option A**: Proceed with N20 Native Chat
- Implement streaming
- Add abort capability
- Build message injection
- Remove iframe dependency
- **Estimate**: 3-4 days

**Option B**: Skip to different task
- N21: Native Channels + QR (Telegram integration)
- Browser Runtime: Real Playwright driver
- Documentation improvements
- Single-binary distribution

**Which would you like me to proceed with?**
