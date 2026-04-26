# Allternit Session Store Architecture

## Overview

Allternit uses **mode-specific session stores** where Chat, Code, and Cowork each have completely isolated session management. Sessions created in one mode do not appear in other modes (similar to Claude Desktop's behavior).

## Architecture Principle

```
┌─────────────────────────────────────────────────────────────────┐
│                      SESSION STORES                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Chat Store    │   Code Store    │       Cowork Store          │
│                 │                 │                             │
│ • Chat sessions │ • Code sessions │ • Cowork sessions           │
│ • Isolated      │ • Isolated      │ • Task-based                │
│ • Own storage   │ • Own storage   │ • Own storage               │
└─────────────────┴─────────────────┴─────────────────────────────┘
         │                  │                   │
         └──────────────────┴───────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Backend API   │
                    │  (REST/SSE)    │
                    └────────────────┘
```

## Why Isolated Stores?

1. **Clear Mental Model**: Users understand that Chat, Code, and Cowork are different contexts
2. **Performance**: Smaller stores = faster updates, less memory usage
3. **Reliability**: Issues in one mode don't affect others
4. **Flexibility**: Each mode can evolve its own session model independently

## Usage

### Chat Mode

```typescript
import { 
  useChatSessionStore, 
  useActiveChatSession,
  useChatSessions 
} from '@/views/chat/ChatSessionStore';

// Get all chat sessions
const sessions = useChatSessions();

// Get active session
const activeSession = useActiveChatSession();

// Create a new session
const sessionId = await useChatSessionStore.getState().createSession({
  name: 'My Chat',
  sessionMode: 'agent', // or 'regular'
  agentId: 'my-agent-id',
});

// Send a message
await useChatSessionStore.getState().sendMessageStream(sessionId, {
  text: 'Hello!',
  callbacks: {
    onChunk: (content) => console.log(content),
    onDone: () => console.log('Done'),
  }
});
```

### Code Mode

```typescript
import { 
  useCodeSessionStore,
  useActiveCodeSession,
  useCodeSessions
} from '@/views/code/CodeSessionStore';

// Same API as ChatSessionStore
const sessions = useCodeSessions();
const activeSession = useActiveCodeSession();
```

### Cowork Mode

```typescript
import { useCoworkStore } from '@/views/cowork/CoworkStore';

// Cowork has a different model focused on tasks
const { session, tasks, createTask } = useCoworkStore();
```

## Migrating from NativeAgentStore

**NativeAgentStore is deprecated.** It was the previous unified store that tried to manage all sessions in one place, causing fragmentation and sync issues.

### Migration Guide

| Old (NativeAgentStore) | New (Mode-Specific) |
|------------------------|---------------------|
| `useNativeAgentStore` | `useChatSessionStore`, `useCodeSessionStore`, or context-specific store |
| `useActiveSession()` | `useActiveChatSession()` or `useActiveCodeSession()` |
| `useActiveMessages()` | `activeSession?.messages` (embedded in session) |
| `state.messages[sessionId]` | `session.messages` (embedded in session) |
| `state.streamingBySession[sessionId]` | `streamingBySession[sessionId]` (same pattern) |
| `fetchMessages(sessionId)` | `fetchMessages(sessionId)` (same API) |
| `sendMessageStream(sessionId, text)` | `sendMessageStream(sessionId, { text, callbacks })` |

### Key Differences

1. **Messages are embedded**: In mode-specific stores, messages are in `session.messages[]`, not a separate map
2. **Streaming uses callbacks**: The new `sendMessageStream` takes a `callbacks` object instead of relying on separate state
3. **AbortController built-in**: Each streaming session has its own AbortController for cancellation

## Store Factory

Both Chat and Code use the same underlying factory:

```typescript
// src/lib/agents/mode-session-store.ts
export function createModeSessionStore(config: {
  name: string;           // Store name for devtools
  storageKey: string;     // localStorage key
  originSurface: 'chat' | 'cowork' | 'code' | 'browser';
})
```

This ensures consistency while maintaining isolation.

## Backend Integration

All stores use the same backend API (`native-agent-api.ts`) but filter by `origin_surface`:

```typescript
// Backend sessions are tagged with their origin
sessionApi.createSession({
  origin_surface: 'chat', // or 'code', 'cowork', etc.
  // ...
});
```

## Future Work

1. **Cowork Migration**: Consider migrating Cowork to use the same `createModeSessionStore` factory for consistency
2. **Session Transfer**: Add ability to "continue in Code mode" from a Chat session (creates new session, copies context)
3. **Unified Search**: Cross-mode session search (read-only aggregation for search purposes)

## Removed Files

- `src/lib/agents/index.ts` - `nativeAgentStore` implementation and `useNativeAgentStore` export **REMOVED**
- `src/lib/agents/native-agent.store.ts` - **DELETED** (was previously a compatibility stub)
- `src/lib/agents/native-agent.store.v1.backup.ts` - **DELETED**
- `src/lib/agents/native-agent.store.test.ts` - **DELETED**

### What happened to NativeAgentStore?

NativeAgentStore has been completely removed. There is no stub, fallback, or compatibility layer remaining.
Any code still referencing `useNativeAgentStore` will fail to compile.

Migrate to mode-specific stores: `useChatSessionStore`, `useCodeSessionStore`, `useCoworkSessionStore`.
