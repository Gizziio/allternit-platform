# NativeAgentStore Removal - Complete

## Summary

The monolithic `NativeAgentStore` has been completely removed from `src/lib/agents/index.ts` and all importing files have been migrated to use the new mode-specific session stores.

**Last updated:** 2026-04-25

## What Was Removed

- `src/lib/agents/index.ts` - The `nativeAgentStore` implementation and `useNativeAgentStore` export removed
- `src/lib/agents/native-agent.store.ts` - Previously a compatibility stub, now fully deleted

## New Architecture

### Mode-Specific Stores

1. **ChatSessionStore** (`src/views/chat/ChatSessionStore.ts`)
   - For Chat mode sessions
   - Exports: `useChatSessionStore`, `useChatSessions`, `useActiveChatSession`, etc.

2. **CodeSessionStore** (`src/views/code/CodeSessionStore.ts`)
   - For Code mode sessions
   - Exports: `useCodeSessionStore`, `useCodeSessions`, `useActiveCodeSession`, etc.

3. **CoworkStore** (`src/views/cowork/CoworkStore.ts`)
   - For Cowork mode with integrated task/project management
   - Now includes `parts` for streaming message compatibility

### Core Store Factory

**mode-session-store.ts** (`src/lib/agents/mode-session-store.ts`)
- Factory function `createModeSessionStore(config)`
- Full-featured: SSE sync, optimistic updates, context packs, heartbeat tasks

## Files Migrated

### 1. AgentContextStrip.tsx
- **Before**: `useNativeAgentStore` for tools
- **After**: `useToolRegistryStore` for tools

### 2. ChatRail.tsx
- **Before**: `getChatSessionsForProject`, `getRootChatSessions` from `@/lib/agents`
- **After**: Same functions now exported from `ChatSessionStore.ts`

### 3. ChatComposer.tsx
- **Before**: `useNativeAgentStore`, `useActiveSessionContextSnapshot`
- **After**: `useActiveChatSessionId`, `useActiveChatSession` from `ChatSessionStore.ts`

### 4. SwarmMonitor.store.ts
- **Before**: All methods used `useNativeAgentStore.getState()`
- **After**: Uses `useChatSessionStore` and `useCodeSessionStore` with helper functions

### 5. SwarmMonitor.tsx
- **Before**: `useNativeAgentStore` for session creation
- **After**: Direct store access with `useCodeSessionStore`

### 6. NativeAgentView.tsx
- **Before**: Multiple deprecated imports
- **After**: `useChatSessionStore` for all session operations

### 7. AgentHub.tsx
- **Before**: `useNativeAgentStore` for sessions
- **After**: `useChatSessions` from `ChatSessionStore.ts`

### 8. CoworkRoot.tsx
- **Before**: Extensive use of `useNativeAgentStore`
- **After**: `useChatSessionStore` for all session operations

### 9. CoworkTranscript.tsx
- **Before**: `useNativeAgentStore` for parts
- **After**: `parts` from `useCoworkStore()` (added to CoworkStore)

## Build Status

✅ **No imports of `useNativeAgentStore` remain in the codebase**

Verified via `grep -rn "useNativeAgentStore" src/ --include="*.ts" --include="*.tsx"` — zero matches.

## Migration Pattern

### Old Code
```typescript
import { useNativeAgentStore, useActiveSession } from '@/lib/agents';

function MyComponent() {
  const { sessions, activeSessionId, createSession } = useNativeAgentStore();
  const activeSession = useActiveSession();
  // ...
}
```

### New Code (Chat Mode)
```typescript
import { 
  useChatSessionStore, 
  useChatSessions, 
  useActiveChatSession 
} from '@/views/chat/ChatSessionStore';

function MyComponent() {
  const sessions = useChatSessions();
  const activeSession = useActiveChatSession();
  const { createSession } = useChatSessionStore();
  // ...
}
```

### New Code (Code Mode)
```typescript
import { 
  useCodeSessionStore, 
  useCodeSessions, 
  useActiveCodeSession 
} from '@/views/code/CodeSessionStore';

function MyComponent() {
  const sessions = useCodeSessions();
  const activeSession = useActiveCodeSession();
  const { createSession } = useCodeSessionStore();
  // ...
}
```

## Key Differences

1. **No more merged sessions**: Chat and Code sessions are completely separate
2. **Messages are embedded**: `session.messages` instead of `state.messages[sessionId]`
3. **Direct store imports**: Import from specific store files, not `@/lib/agents`
4. **Type changes**: `ModeSession` instead of `NativeSession`, `ModeSessionMessage` instead of `NativeMessage`

## Remaining Test Mocks

✅ **All test mocks updated.** Verified via `grep -rn "useNativeAgentStore" src/ --include="*.test.ts" --include="*.test.tsx"` — zero matches.

## Architecture Principle

Sessions are **intentionally isolated** between modes:
- Chat sessions only in Chat mode
- Code sessions only in Code mode
- Cowork sessions only in Cowork mode

This mirrors Claude Desktop's behavior and prevents context bleeding.
