# UI Implementation Summary

## Files Created/Modified

### 1. Services

**`/6-ui/a2r-platform/src/services/ProviderAuthService.ts`** (NEW)
- API service for provider authentication and model discovery
- Methods:
  - `getAllAuthStatus()` - Get auth status for all providers
  - `getAuthStatus(providerId)` - Get auth status for specific provider
  - `discoverModels(providerId, profileId)` - Fetch runtime model list
  - `validateModelId(providerId, profileId, modelId)` - Validate custom model ID
  - `createAuthSession(authProfileId)` - Create terminal session for auth

### 2. Hooks

**`/6-ui/a2r-platform/src/hooks/use-toast.ts`** (NEW)
- Simple toast notification hook
- Methods: `toast()`, `dismiss()`, `toasts`

**`/6-ui/a2r-platform/src/hooks/useProviderAuth.ts`** (NEW)
- Manages provider auth state and model discovery
- Features:
  - 24h cache for model lists
  - Auth status tracking
  - Model validation
  - Auth session creation
- Returns:
  - `providers` - Map of auth statuses
  - `isLoading` - Loading state
  - `refreshAuthStatus()` - Refresh all auth states
  - `refreshModels(providerId, profileId)` - Fetch models
  - `validateModelId()` - Validate model IDs
  - `createAuthSession()` - Start auth wizard
  - `isProviderLocked()` - Check if provider needs auth
  - `isCacheStale()` - Check if cache expired

**`/6-ui/a2r-platform/src/hooks/useBrainChat.ts`** (NEW)
- Manages chat sessions with kernel brain runtimes
- Features:
  - Session streaming
  - Tool call tracking
  - Contract validation (session.started, terminal.delta)
  - Error handling
- Returns:
  - `messages` - Chat history
  - `isStreaming` - Streaming state
  - `isLoading` - Loading state
  - `error` - Error message
  - `currentToolCalls` - Active tool calls
  - `sendMessage(content)` - Send message
  - `clearMessages()` - Clear chat

### 3. Components

**`/6-ui/a2r-platform/src/components/ai-elements/ProviderModelSelector.tsx`** (NEW)
- Per-provider model selector with:
  - Auth lock/unlock UI
  - Model dropdown from runtime discovery
  - Cache freshness indicator
  - Freeform model ID input
  - Validation with suggestions
  - Refresh button

**`/6-ui/a2r-platform/src/components/ai-elements/BrainModelSelector.tsx`** (NEW)
- Comprehensive provider + model selector
- Groups providers by status:
  - **Chat Providers** (ACP/JSONL) - Available with auth
  - **Terminal Only** - Blocked for chat
- Features:
  - Provider selection with auth check
  - Auth wizard dialog
  - Model selection per provider
  - Selected model display

### 4. API Client Updates

**`/6-ui/a2r-platform/src/integration/api-client.ts`** (MODIFIED)
- Added `createBrainSession()` method:
  ```typescript
  createBrainSession(
    brainProfileId: string,
    source: 'chat' | 'terminal',
    runtimeOverrides?: { model_id?: string },
    workspaceDir?: string
  )
  ```
- Updated `chat()` method:
  - Added `runtimeModelId` parameter
  - Added contract validation (session.started first)
  - Added terminal.delta rejection
  - Added mode mismatch error handling
  - Added tool event support

## UI Flow

### 1. Model Selection

```
┌─────────────────────────────────────────┐
│ AI Provider                             │
│ [Select a provider... ▼]                │
│                                         │
│ Chat Providers                          │
│   ✅ OpenCode (available)               │
│   🔒 Gemini CLI (locked)                │
│   🔒 Kimi CLI (locked)                  │
│                                         │
│ Terminal Only                           │
│   🖥️ Claude Code TUI (disabled)         │
└─────────────────────────────────────────┘
```

### 2. Auth Flow (when locked provider selected)

```
┌─────────────────────────────────────────┐
│ Authenticate Gemini CLI                 │
│                                         │
│ 🔒 Authentication Required              │
│ Gemini CLI requires authentication.     │
│                                         │
│ [Open Auth Terminal]                    │
│                                         │
│ A terminal will open for you to run:    │
│   gemini login                          │
└─────────────────────────────────────────┘
```

### 3. Model Selection (when unlocked)

```
┌─────────────────────────────────────────┐
│ Model                                   │
│ [Claude 3.7 Sonnet ▼] [↻ Refresh]       │
│                                         │
│ ✓ Updated 2h ago                        │
│                                         │
│ Or enter custom model ID:               │
│ [anthropic:claude-3-opus] [Validate]    │
└─────────────────────────────────────────┘
```

### 4. Chat Interface

```
┌─────────────────────────────────────────┐
│ User: Hello!                            │
│                                         │
│ Assistant: Hello! How can I help?       │
│                                         │
│ ┌─ 🔧 Running: Read ─────────────────┐ │
│ │ src/main.rs                         │ │
│ └────────────────────────────────────┘ │
│                                         │
│ ┌─ ✅ Read completed ────────────────┐ │
│ │ [fn main() {...}]                   │ │
│ └────────────────────────────────────┘ │
│                                         │
│ I can see the code uses tokio...        │
│                                         │
│ [Type message...] [Send]                │
└─────────────────────────────────────────┘
```

## Contract Enforcement

### API Client Validates:
1. **session.started** must be first event
2. **event_mode** cannot be "terminal" for chat
3. **terminal.delta** causes immediate abort

### Error Messages:
- "Kernel mode mismatch: terminal driver used for chat session"
- "Kernel protocol error: session.started not received as first event"
- "Kernel contract violation: terminal output received in chat session"

## Key Features

| Feature | Implementation |
|---------|----------------|
| Runtime model discovery | `GET /v1/providers/:provider/models` |
| Auth status check | `GET /v1/providers/auth/status` |
| Model validation | `POST /v1/providers/:provider/models/validate` |
| 24h cache | LocalStorage with timestamp |
| Freeform model IDs | Input with validation |
| Tool visibility | `tool.call_start` / `tool_call_result` events |
| Terminal separation | Terminal-only providers blocked in chat |

## Next Steps for Integration

1. **Replace existing model selector** in chat composer with `<BrainModelSelector />`
2. **Integrate auth wizard** with terminal view component
3. **Add tool call UI** to message rendering
4. **Test with kernel** running ACP driver
5. **Verify error handling** for mode mismatches

## Dependencies

- React hooks pattern
- Existing UI components (Select, Dialog, Input, Button)
- API client integration
- Toast notifications

All new files follow existing codebase patterns and integrate with the established architecture.