# Mode-Specific Sessions Architecture

## Problem Statement

The unified session model creates cognitive overhead:
- User creates a chat session → it pollutes Cowork history
- User creates a Cowork task → it appears in Chat sidebar
- Different modalities (chat vs automation) get mixed together
- No clear mental model for where things live

## Claude's Hardened Approach

### Core Principle
**Sessions are mode-scoped, not global.**

```
User Mental Model:
- Chat = conversation history (Q&A, brainstorming)
- Cowork = automation sessions (tasks, agents, computer-use)
- Code = coding sessions (editors, file operations)

These are distinct contexts, not views of the same data.
```

### Session Identity

```typescript
// Each mode has its own session ID space
ChatSession    = "chat_abc123"
CoworkSession  = "cowork_def456"  
CodeSession    = "code_ghi789"

// No cross-pollination
ChatStore.getSessions()    → only chat sessions
CoworkStore.getSessions()  → only cowork sessions
CodeStore.getSessions()    → only code sessions
```

### When Cross-Linking IS Needed

Sometimes a Chat conversation spawns a Cowork automation:

```typescript
// Linking pattern (explicit, not implicit)
interface SessionLink {
  sourceId: string;      // e.g., chat_abc123
  sourceMode: 'chat';
  targetId: string;      // e.g., cowork_def456
  targetMode: 'cowork';
  linkType: 'spawned_from' | 'related_to';
  createdAt: string;
}

// User action: "Start Cowork Task from this Chat"
// Creates explicit link, but sessions remain separate
```

## Architecture Changes

### 1. Separate Session Stores

```typescript
// Chat mode - own session list
export const useChatStore = create<ChatState>({
  sessions: ChatSession[];  // Only chat sessions
  activeSessionId: string | null;
  createSession: (title) => createChatSession(title);
});

// Cowork mode - own session list  
export const useCoworkStore = create<CoworkState>({
  sessions: CoworkSession[];  // Only cowork sessions
  activeSessionId: string | null;
  createSession: (task) => createCoworkSession(task);
});

// Code mode - own session list
export const useCodeModeStore = create<CodeState>({
  sessions: CodeSession[];  // Only code sessions
  activeSessionId: string | null;
  createSession: (workspace) => createCodeSession(workspace);
});
```

### 2. Backend API Separation

```typescript
// Separate endpoints per mode
POST /api/chat/sessions      → ChatSession
POST /api/cowork/sessions    → CoworkSession  
POST /api/code/sessions      → CodeSession

GET /api/chat/sessions       → ChatSession[]
GET /api/cowork/sessions     → CoworkSession[]
GET /api/code/sessions       → CodeSession[]
```

### 3. Separate Persistence

```typescript
// chat_sessions table
interface ChatSession {
  id: string;           // chat_*
  title: string;
  messages: Message[];
  createdAt: string;
}

// cowork_sessions table  
interface CoworkSession {
  id: string;           // cowork_*
  task: string;
  events: CoworkEvent[];
  runs: Run[];
  createdAt: string;
}

// code_sessions table
interface CodeSession {
  id: string;           // code_*
  workspaceId: string;
  files: File[];
  edits: Edit[];
  createdAt: string;
}
```

### 4. Surface State (Not Session State)

What goes in the unified ledger is **surface metadata**, not sessions:

```typescript
// What IS unified:
- ui.surface.changed      // User switched to cowork
- ui.view.changed         // User opened a specific view
- presence.updated        // User is active

// What is NOT unified (mode-specific):
- message.created         // Chat message
- cowork.task.created     // Cowork task
- code.file.edited        // Code edit
```

## Migration from Unified Model

### Step 1: Split Session Stores

```typescript
// BEFORE (unified)
useNativeAgentStore.sessions  // All sessions

// AFTER (mode-specific)
useChatStore.sessions         // Chat only
useCoworkStore.sessions       // Cowork only  
useCodeModeStore.sessions     // Code only
```

### Step 2: Add Session Linking

```typescript
// For cross-mode references
interface SessionLinkStore {
  links: SessionLink[];
  createLink: (source: SessionRef, target: SessionRef) => void;
  getRelatedSessions: (sessionId: string) => SessionLink[];
}

// Usage: "This Cowork session started from Chat session X"
```

### Step 3: Update Components

```typescript
// CoworkRoot.tsx - only sees cowork sessions
const { sessions, activeSession } = useCoworkStore();

// ChatView.tsx - only sees chat sessions
const { threads, activeThread } = useChatStore();

// CodeRoot.tsx - only sees code sessions
const { sessions, activeSession } = useCodeModeStore();
```

## UX Implications

### Before (Unified)
```
Sidebar:
├─ Chat Session A
├─ Cowork Session B  ← Mixed together
├─ Chat Session C
└─ Code Session D
```

### After (Mode-Specific)
```
Chat Mode Sidebar:
├─ Chat Session A
├─ Chat Session C
└─ [Related Cowork Task →]  (explicit link)

Cowork Mode Sidebar:
├─ Cowork Session B
├─ Cowork Session E
└─ [Started from Chat A →]  (explicit link)

Code Mode Sidebar:
├─ Code Session D
└─ Code Session F
```

## Benefits

1. **Clear Mental Model** - User knows where things live
2. **No Pollution** - Chat history doesn't get cluttered with automations
3. **Mode-Appropriate UX** - Different modes can have different session metadata
4. **Scalability** - Can have 1000 chat sessions without affecting Cowork
5. **Industry Standard** - Matches Claude, GitHub Copilot, etc.

## Trade-offs

1. **No Implicit Cross-Continuity** - Must explicitly link sessions
2. **More Complex Backend** - Multiple session tables/endpoints
3. **Migration Effort** - Need to split unified data

## Decision

**Recommend: Claude-style mode-specific sessions.**

The unified model is technically elegant but product-wise confusing. Mode-specific sessions match user mental models and industry best practices.
