# Mode-Specific Sessions Migration Plan

## Current State (Unified)

```
spec/session-unification.md
  └─ "One session ID to rule them all"

surfaces/platform/src/
  ├─ lib/agents/native-agent.store.ts  ← Canonical truth
  ├─ views/chat/ChatStore.ts           ← Projects from native
  ├─ views/cowork/CoworkStore.ts       ← Projects from native  
  └─ views/code/CodeModeStore.ts       ← Projects from native
```

## Target State (Mode-Specific)

```
spec/mode-specific-sessions.md
  └─ "Separate session lists per mode"

surfaces/platform/src/
  ├─ lib/sessions/
  │   ├─ chat-session.store.ts         ← Chat sessions
  │   ├─ cowork-session.store.ts       ← Cowork sessions
  │   └─ code-session.store.ts         ← Code sessions
  ├─ views/chat/ChatStore.ts           ← Uses chat-session.store
  ├─ views/cowork/CoworkStore.ts       ← Uses cowork-session.store
  └─ views/code/CodeModeStore.ts       ← Uses code-session.store
```

## Phase 1: Create Mode-Specific Stores (Week 1)

### 1.1 Chat Session Store
```typescript
// lib/sessions/chat-session.store.ts
export const useChatSessionStore = create<ChatSessionState>({
  sessions: [],
  activeSessionId: null,
  
  createSession: async (title) => {
    const session = await api.chat.sessions.create({ title });
    set(state => ({ sessions: [...state.sessions, session] }));
    return session.id;
  },
  
  deleteSession: (id) => {
    api.chat.sessions.delete(id);
    set(state => ({ 
      sessions: state.sessions.filter(s => s.id !== id) 
    }));
  },
  
  setActiveSession: (id) => set({ activeSessionId: id }),
});

// Chat session type
interface ChatSession {
  id: string;           // chat_* prefix
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
```

### 1.2 Cowork Session Store
```typescript
// lib/sessions/cowork-session.store.ts
export const useCoworkSessionStore = create<CoworkSessionState>({
  sessions: [],
  activeSessionId: null,
  
  createSession: async (task, viewportType) => {
    const session = await api.cowork.sessions.create({ task, viewportType });
    set(state => ({ sessions: [...state.sessions, session] }));
    return session.id;
  },
  
  deleteSession: (id) => {
    api.cowork.sessions.delete(id);
    set(state => ({ 
      sessions: state.sessions.filter(s => s.id !== id) 
    }));
  },
  
  setActiveSession: (id) => set({ activeSessionId: id }),
});

// Cowork session type
interface CoworkSession {
  id: string;           // cowork_* prefix
  task: string;
  viewportType: string;
  events: CoworkEvent[];
  runs: Run[];
  createdAt: string;
}
```

### 1.3 Code Session Store
```typescript
// lib/sessions/code-session.store.ts
export const useCodeSessionStore = create<CodeSessionState>({
  sessions: [],
  activeSessionId: null,
  
  createSession: async (workspaceId) => {
    const session = await api.code.sessions.create({ workspaceId });
    set(state => ({ sessions: [...state.sessions, session] }));
    return session.id;
  },
  
  deleteSession: (id) => {
    api.code.sessions.delete(id);
    set(state => ({ 
      sessions: state.sessions.filter(s => s.id !== id) 
    }));
  },
  
  setActiveSession: (id) => set({ activeSessionId: id }),
});

// Code session type
interface CodeSession {
  id: string;           // code_* prefix
  workspaceId: string;
  files: File[];
  edits: Edit[];
  createdAt: string;
}
```

## Phase 2: Update Component Imports (Week 1-2)

### 2.1 Update Chat Components
```typescript
// BEFORE
import { useNativeAgentStore } from '@/lib/agents/native-agent.store';

// AFTER
import { useChatSessionStore } from '@/lib/sessions/chat-session.store';

// ChatRail.tsx
const { sessions, activeSessionId, setActiveSession } = useChatSessionStore();
```

### 2.2 Update Cowork Components
```typescript
// BEFORE
import { useCoworkStore } from './CoworkStore';

// AFTER
import { useCoworkSessionStore } from '@/lib/sessions/cowork-session.store';

// CoworkRail.tsx
const { sessions, activeSessionId, setActiveSession } = useCoworkSessionStore();
```

### 2.3 Update Code Components
```typescript
// BEFORE
import { useCodeModeStore } from './CodeModeStore';

// AFTER
import { useCodeSessionStore } from '@/lib/sessions/code-session.store';

// CodeRail.tsx
const { sessions, activeSessionId, setActiveSession } = useCodeSessionStore();
```

## Phase 3: Backend API (Week 2-3)

### 3.1 Separate Endpoints
```typescript
// api/chat/sessions/route.ts
export async function GET() {
  const sessions = await db.chatSessions.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });
  return Response.json(sessions);
}

export async function POST(req: Request) {
  const { title } = await req.json();
  const session = await db.chatSessions.create({
    data: { 
      id: `chat_${generateId()}`,
      title,
      userId 
    }
  });
  return Response.json(session);
}

// api/cowork/sessions/route.ts (similar)
// api/code/sessions/route.ts (similar)
```

### 3.2 Database Schema
```sql
-- chat_sessions table
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,  -- chat_*
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- cowork_sessions table
CREATE TABLE cowork_sessions (
  id TEXT PRIMARY KEY,  -- cowork_*
  user_id TEXT NOT NULL,
  task TEXT NOT NULL,
  viewport_type TEXT,
  events JSONB DEFAULT '[]',
  runs JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- code_sessions table
CREATE TABLE code_sessions (
  id TEXT PRIMARY KEY,  -- code_*
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  files JSONB DEFAULT '[]',
  edits JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- session_links table (for cross-mode references)
CREATE TABLE session_links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_mode TEXT NOT NULL,  -- 'chat' | 'cowork' | 'code'
  target_id TEXT NOT NULL,
  target_mode TEXT NOT NULL,
  link_type TEXT NOT NULL,    -- 'spawned_from' | 'related_to'
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Phase 4: Add Session Linking (Week 3)

### 4.1 Link Store
```typescript
// lib/sessions/session-link.store.ts
export const useSessionLinkStore = create<SessionLinkState>({
  links: [],
  
  createLink: (source, target, linkType) => {
    const link = {
      id: generateId(),
      sourceId: source.id,
      sourceMode: source.mode,
      targetId: target.id,
      targetMode: target.mode,
      linkType,
      createdAt: new Date().toISOString(),
    };
    set(state => ({ links: [...state.links, link] }));
    api.sessionLinks.create(link);
  },
  
  getRelatedSessions: (sessionId) => {
    return get().links.filter(
      l => l.sourceId === sessionId || l.targetId === sessionId
    );
  },
});
```

### 4.2 UI for Linking
```typescript
// In CoworkLaunchpad - "Start from Chat"
function StartFromChatButton() {
  const { sessions: chatSessions } = useChatSessionStore();
  const { createSession } = useCoworkSessionStore();
  const { createLink } = useSessionLinkStore();
  
  const startFromChat = async (chatSessionId: string) => {
    const coworkSession = await createSession('Task from chat');
    createLink(
      { id: chatSessionId, mode: 'chat' },
      { id: coworkSession.id, mode: 'cowork' },
      'spawned_from'
    );
  };
  
  return (
    <Dropdown>
      {chatSessions.map(s => (
        <Item onClick={() => startFromChat(s.id)}>{s.title}</Item>
      ))}
    </Dropdown>
  );
}
```

## Phase 5: Cleanup (Week 4)

### 5.1 Remove Unified Store
```bash
# Delete files
rm lib/agents/native-agent.store.ts
rm views/cowork/CoworkStore.ts  # Old unified version
rm spec/session-unification.md
```

### 5.2 Update Spec
```bash
# Rename new spec to canonical
mv spec/MODE_SPECIFIC_SESSIONS_SPEC.md spec/SESSION_ARCHITECTURE.md
```

## Testing Checklist

- [ ] Create chat session → only appears in Chat
- [ ] Create cowork session → only appears in Cowork
- [ ] Create code session → only appears in Code
- [ ] Delete chat session → Cowork/Code unaffected
- [ ] Link chat to cowork → shows in both with badge
- [ ] Switch surfaces → each maintains own active session

## Rollback Plan

If migration fails:
1. Keep `native-agent.store.ts` as backup during migration
2. Feature flag: `useModeSpecificSessions`
3. Can toggle back to unified model

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1 | Week 1 | Mode-specific stores |
| 2 | Week 1-2 | Updated components |
| 3 | Week 2-3 | Backend APIs |
| 4 | Week 3 | Session linking |
| 5 | Week 4 | Cleanup |

**Total: 4 weeks**
