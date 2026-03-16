# Chat Setup Guide - Getting Chat Working End-to-End

## Problem Summary

You reported three issues:
1. **Command palette chat** needs ChatViewV2 update
2. **Buttons/icons in chat input** not working
3. **Model selection not wired** - can't get responses

## Root Cause

The **Gateway (port 8013) is not running**. Without the backend, chat calls fail silently.

## What Was Fixed

### 1. Vite Proxy Configuration ✅
**File:** `6-apps/shell-ui/vite.config.ts`

```typescript
// Before (WRONG - pointed to port 3000)
'/api': {
  target: 'http://127.0.0.1:3000',
  changeOrigin: true,
}

// After (CORRECT - points to Gateway on 8013)
'/api': {
  target: 'http://127.0.0.1:8013',
  changeOrigin: true,
}
```

### 2. Cowork View Updated ✅
**File:** `src/views/cowork/CoworkRoot.tsx`

Updated to use `ChatViewV2` with all required providers.

## What Needs to Be Running

### Required Backend Services

| Service | Port | Command | Status |
|---------|------|---------|--------|
| Gateway | 8013 | `cargo run` in `6-apps/api` | ❌ NOT RUNNING |
| Runtime | - | `pnpm --filter @a2r/runtime serve` | Unknown |

### To Start Everything

```bash
# From root of repo:

# Option 1: Use the root dev script (starts everything)
pnpm dev

# Option 2: Start components separately

# Terminal 1: Start API Gateway
cd 6-apps/api && cargo run

# Terminal 2: Start Runtime
pnpm --filter @a2r/runtime serve

# Terminal 3: Start Electron Shell
pnpm shell
```

## Frontend Status

### ✅ Working
- ChatViewV2 UI renders
- Model selector dropdown
- Web search toggle button
- Attachment button
- Mic button (UI only)
- Send button
- Elements Lab (48 components)

### ❌ Not Working (Requires Backend)
- Sending messages (needs Gateway)
- Receiving responses (needs Gateway)
- Chain of thought display (needs AI response)
- Web search functionality (needs AI with tool use)

## How to Verify

### 1. Check Gateway is Running
```bash
curl http://127.0.0.1:8013/health
```
Should return: `{"status":"ok"}`

### 2. Check in Electron DevTools
```javascript
// Open DevTools in Electron (Cmd+Option+I)
// Console should show no CORS errors when sending messages
```

### 3. Test Chat Flow
1. Start backend services (Gateway + Runtime)
2. Click "Chat" in rail
3. Select a model from dropdown
4. Type a message
5. Click Send
6. Should see streaming response

## Missing Buttons/Features to Implement

Based on your feedback, these still need work:

### Chat Input Buttons
| Button | Status | Notes |
|--------|--------|-------|
| Attachment | ✅ | Working (opens file dialog) |
| Microphone | ⚠️ | UI only - needs speech-to-text backend |
| Model Selector | ✅ | UI working - needs backend wiring |
| Web Search Toggle | ✅ | UI working - needs backend wiring |
| Stop | ✅ | Shows during streaming |
| Send | ✅ | Working |

### Command Palette (Cmd+A)
The command palette currently doesn't have chat-specific actions defined. To add:

**File:** `src/shell/ShellApp.tsx`

Add actions array and wrap with A2RCommandProvider:

```tsx
const actions: A2RAction[] = [
  {
    id: 'chat',
    name: 'Open Chat',
    shortcut: ['c'],
    perform: () => open('chat'),
  },
  {
    id: 'cowork',
    name: 'Open Cowork',
    shortcut: ['w'],
    perform: () => open('workspace'),
  },
  // ... more actions
];

// In ShellApp render:
<A2RCommandProvider actions={actions}>
  <ShellAppContent />
  <A2RCommandPalette />
</A2RCommandProvider>
```

## Testing Chain of Thought / Web Search

Once backend is running:

1. **Chain of Thought:**
   - Select a reasoning model (like o1 or Claude)
   - Ask a complex question
   - Should see `reasoning` parts in response

2. **Web Search:**
   - Toggle "Web Search" button ON
   - Ask about current events
   - Should see `tool` parts showing web search calls
   - Should see `source-document` parts with citations

## Troubleshooting

### "Failed to fetch" errors
- Gateway not running → Start it with `cargo run` in `6-apps/api`

### CORS errors
- Vite proxy not configured → Already fixed in vite.config.ts

### Empty responses
- Model not configured → Check Gateway has models configured
- API keys not set → Check environment variables

### Buttons not responding
- Missing providers → Check all ChatViewV2 wrappers have PromptInputProvider

## Next Steps

1. **Start the Gateway:**
   ```bash
   cd 6-apps/api && cargo run
   ```

2. **Restart Electron Shell:**
   ```bash
   pkill -f electron
   pnpm shell
   ```

3. **Test chat** - Should now work end-to-end

4. **Add command palette actions** (optional enhancement)

5. **Add missing icons** to chat input (paperclip, mic, etc.)
