# Session Architecture Documentation

## Overview

Allternit uses a **mode-specific session store architecture** where sessions are completely isolated between different work modes (Chat, Code, Cowork). This design mirrors Claude Desktop's behavior and prevents context bleeding between different work contexts.

## Core Philosophy

> **Sessions in one mode do not appear in another mode.**

- Chat sessions are only visible in Chat mode
- Code sessions are only visible in Code mode  
- Cowork sessions are only visible in Cowork mode

This intentional isolation ensures clean separation of concerns and prevents confusion when switching between different types of work.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Chat Mode  │  │  Code Mode  │  │     Cowork Mode     │ │
│  │             │  │             │  │                     │ │
│  │ ChatView    │  │ CodeView    │  │ CoworkRoot          │ │
│  │ ChatRail    │  │ CodeRail    │  │ CoworkTranscript    │ │
│  │ ChatComposer│  │ CodeComposer│  │ CoworkWorkBlock     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mode-Specific Stores                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │ ChatSessionStore │ │ CodeSessionStore │ │ CoworkStore  │ │
│  │                  │ │                  │ │              │ │
│  │ - Chat sessions  │ │ - Code sessions  │ │ - Sessions   │ │
│  │ - Chat messages  │ │ - Code messages  │ │ - Tasks      │ │
│  │ - Chat unread    │ │ - Code unread    │ │ - Projects   │ │
│  └────────┬─────────┘ └────────┬─────────┘ └──────┬───────┘ │
└───────────┼────────────────────┼──────────────────┼─────────┘
            │                    │                  │
            └────────────────────┼──────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Store Factory (mode-session-store.ts)           │
│                                                              │
│  createModeSessionStore(config: StoreConfig)                 │
│                                                              │
│  Creates isolated stores with:                               │
│  - Session management                                        │
│  - Message streaming                                         │
│  - SSE live sync                                             │
│  - Optimistic updates                                        │
│  - Context pack management                                   │
│  - Heartbeat task execution                                  │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend API Layer                            │
│                                                              │
│  native-agent-api.ts                                         │
│  ├── sessionApi  (CRUD operations)                          │
│  ├── chatApi     (streaming, abort)                         │
│  ├── runtimeApi  (execution mode)                           │
│  └── toolsApi    (tool execution)                           │
└─────────────────────────────────────────────────────────────┘
```

## Store Factory

### `mode-session-store.ts`

The core factory that creates mode-specific stores:

```typescript
export function createModeSessionStore(config: StoreConfig) {
  return create<ModeSessionState>()(
    devtools(
      persist((set, get) => ({
        // State
        sessions: [],
        activeSessionId: null,
        isLoading: false,
        error: null,
        streamingBySession: {},
        unreadCounts: {},
        isSyncConnected: false,
        
        // Actions
        createSession: async (options) => { /* ... */ },
        deleteSession: async (sessionId) => { /* ... */ },
        sendMessageStream: async (sessionId, options) => { /* ... */ },
        abortGeneration: async (sessionId) => { /* ... */ },
        connectSessionSync: () => { /* SSE connection */ },
        // ...
      }))
    )
  );
}
```

### Store Configuration

Each store is configured with:

```typescript
interface StoreConfig {
  name: string;           // Store name (for devtools)
  storageKey: string;     // localStorage key
  originSurface: 'chat' | 'code' | 'cowork' | 'browser';
}
```

## Mode-Specific Stores

### 1. ChatSessionStore

**Location**: `src/views/chat/ChatSessionStore.ts`

**Purpose**: Manages chat-mode sessions

**Exports**:
```typescript
// Main store hook
export const useChatSessionStore = createModeSessionStore({
  name: 'ChatSessionStore',
  storageKey: 'allternit-chat-sessions',
  originSurface: 'chat',
});

// Derived selectors
export function useChatSessions()           // All chat sessions
export function useActiveChatSession()      // Currently active session
export function useActiveChatSessionId()    // Active session ID
export function useChatSessionUnreadCount() // Unread per session
export function useChatTotalUnreadCount()   // Total unread
export function useAgentChatSessions()      // Agent-mode sessions
export function useChatSessionsByProject()  // Filter by project

// Utilities
export function getChatSessionsForProject() // Get sessions for project
export function getRootChatSessions()       // Get sessions without project
```

### 2. CodeSessionStore

**Location**: `src/views/code/CodeSessionStore.ts`

**Purpose**: Manages code-mode sessions

**Exports**:
```typescript
// Main store hook
export const useCodeSessionStore = createModeSessionStore({
  name: 'CodeSessionStore',
  storageKey: 'allternit-code-sessions',
  originSurface: 'code',
});

// Derived selectors (mirrors ChatSessionStore)
export function useCodeSessions()
export function useActiveCodeSession()
export function useActiveCodeSessionId()
export function useCodeSessionUnreadCount()
export function useCodeTotalUnreadCount()
export function useAgentCodeSessions()
export function useCodeSessionsByWorkspace()
```

### 3. CoworkStore

**Location**: `src/views/cowork/CoworkStore.ts`

**Purpose**: Manages cowork-mode sessions with integrated task/project management

**Key Differences**:
- Includes task management
- Includes project management
- Has `parts` for streaming message compatibility
- Different state structure than Chat/Code stores

**Exports**:
```typescript
export const useCoworkStore = create<CoworkState>()(...)

// State includes:
// - session: Current active cowork session
// - sessionHistory: Past sessions
// - parts: Message parts for streaming
// - tasks: Task list
// - projects: Project list
// - activeTaskId / activeProjectId
```

## Data Types

### ModeSession

```typescript
interface ModeSession {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  messages: ModeSessionMessage[];
  metadata: {
    originSurface: 'chat' | 'code' | 'cowork' | 'browser';
    sessionMode?: 'regular' | 'agent';
    agentId?: string;
    agentName?: string;
    projectId?: string;
    taskId?: string;
    workspaceId?: string;
    systemPrompt?: string;
    // ... other metadata
  };
}
```

### ModeSessionMessage

```typescript
interface ModeSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

## Key Features

### 1. SSE Live Sync

Each store connects to the backend via Server-Sent Events for real-time updates:

```typescript
const disconnect = useChatSessionStore.getState().connectSessionSync();
// Returns cleanup function
```

**Events handled**:
- `session.created` - New session created
- `session.updated` - Session metadata updated
- `session.deleted` - Session removed
- `message.added` - New message in session

### 2. Optimistic Updates

UI updates immediately before backend confirmation:

```typescript
// Optimistic session creation
const optimisticId = `temp-${Date.now()}`;
set((state) => ({
  sessions: [optimisticSession, ...state.sessions],
  activeSessionId: optimisticId,
}));

// Then replace with real session after backend response
```

### 3. Unread Counts

Automatic tracking of unread messages:

```typescript
// Increment when new message arrives via SSE
// Clear when session becomes active
setActiveSession: (sessionId) => {
  set((state) => {
    const newUnreadCounts = { ...state.unreadCounts };
    delete newUnreadCounts[sessionId]; // Clear unread
    return { activeSessionId: sessionId, unreadCounts: newUnreadCounts };
  });
}
```

### 4. Context Packs (Agent Mode)

When a session is in agent mode, the store builds a context pack from the agent's workspace:

```typescript
interface AgentContextPack {
  agentId: string;
  agentName?: string;
  systemPrompt: string;
  trustTiers: AgentTrustTiers;
  workspaceFiles: string[];
  hash: string;
  startupTasks: Array<{ id: string; action: string }>;
}
```

Context pack is sent with every message to the backend.

### 5. Heartbeat Tasks

Agent workspaces can define HEARTBEAT.md with startup tasks:

```typescript
// On session creation
if (session.metadata.sessionMode === 'agent') {
  const contextPack = await buildContextPackForSession(session);
  await executeStartupTasks(session, contextPack);
}
```

## Usage Examples

### Creating a Chat Session

```typescript
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';

function MyComponent() {
  const createSession = useChatSessionStore((s) => s.createSession);
  
  const handleCreate = async () => {
    const sessionId = await createSession({
      name: 'New Chat',
      sessionMode: 'regular',
    });
  };
}
```

### Sending a Message

```typescript
const sendMessageStream = useChatSessionStore((s) => s.sendMessageStream);

await sendMessageStream(sessionId, {
  text: 'Hello, AI!',
  callbacks: {
    onChunk: (content) => console.log(content),
    onDone: () => console.log('Done'),
    onError: (error) => console.error(error),
  },
});
```

### Accessing Active Session

```typescript
import { useActiveChatSession } from '@/views/chat/ChatSessionStore';

function MyComponent() {
  const activeSession = useActiveChatSession();
  
  if (activeSession) {
    console.log('Messages:', activeSession.messages);
  }
}
```

### Getting All Sessions

```typescript
import { useChatSessions } from '@/views/chat/ChatSessionStore';

function SessionList() {
  const sessions = useChatSessions();
  return <ul>{sessions.map(s => <li key={s.id}>{s.name}</li>)}</ul>;
}
```

## Migration from Old Architecture

### Before (NativeAgentStore)

```typescript
import { useNativeAgentStore, useActiveSession } from '@/lib/agents';

function Component() {
  const { sessions, createSession } = useNativeAgentStore();
  const activeSession = useActiveSession();
  const messages = useActiveMessages();
}
```

### After (Mode-Specific Stores)

```typescript
import { 
  useChatSessionStore, 
  useChatSessions, 
  useActiveChatSession 
} from '@/views/chat/ChatSessionStore';

function Component() {
  const sessions = useChatSessions();
  const activeSession = useActiveChatSession();
  const messages = activeSession?.messages || [];
  const { createSession } = useChatSessionStore();
}
```

## Best Practices

1. **Use derived selectors** - Import specific selectors instead of whole store
2. **Access messages via session** - `session.messages` not separate lookup
3. **Mode-specific imports** - Import from correct mode store
4. **No cross-mode queries** - Don't try to access chat sessions from code mode
5. **Clean up sync** - Always call disconnect when component unmounts

## Backend Integration

All stores use the same backend API:

- **Base URL**: From `native-agent-api.ts`
- **Endpoints**:
  - `POST /api/v1/a2ui/sessions` - Create session
  - `GET /api/v1/a2ui/sessions` - List sessions (filtered by origin_surface)
  - `POST /api/v1/a2ui/sessions/:id/messages` - Send message
  - `GET /api/v1/a2ui/sessions/:id/stream` - Stream response
  - `POST /api/v1/a2ui/sessions/:id/abort` - Abort generation
  - `GET /api/v1/a2ui/sync` - SSE sync endpoint

## Persistence

Each store persists to localStorage with its own key:
- Chat: `allternit-chat-sessions`
- Code: `allternit-code-sessions`
- Cowork: `allternit-cowork-store`

**Note**: Messages are embedded in sessions (not separate), so full session history is persisted.

## Related Documentation

- `mode-session-store.ts` - Factory implementation
- `native-agent-api.ts` - Backend API layer
- `permission-store.ts` - Global permission/question management
- Component-specific docs in each view directory
