# Extension Integration Summary

## Overview
Implemented direct Chrome Extension → Desktop App communication via native host protocol on port 3011, removing the dependency on the thin-client middleman (port 3014).

## Architecture Change

### Before (3-tier)
```
Chrome Extension → Thin-Client (3014) → Desktop App (3013)
```

### After (2-tier)
```
Chrome Extension → Native Host (stdio) → TCP (3011) → Desktop App
```

## Files Modified/Created

### 1. Desktop Main Process
**File:** `surfaces/desktop/main/index.cjs`
- Added native host TCP server on port 3011
- Added IPC handlers for extension communication:
  - `extension:send-message` - Send messages to extension
  - `extension:get-status` - Get connection status
  - `extension:page-agent-event` - Forward page-agent events
- Auto-starts when app is ready

### 2. Preload Script
**File:** `surfaces/desktop/preload/index.ts`
- Added `extensionAPI` with methods:
  - `sendMessage()` - Send messages to extension
  - `onMessage()` - Listen for extension messages
  - `onStatusChange()` - Listen for connection changes
  - `getStatus()` - Get current connection status
- Exposed as `window.a2rExtension`
- **Compiled to:** `surfaces/desktop/preload/index.js`

### 3. Extension Bridge Hook (NEW)
**File:** `surfaces/platform/src/capsules/browser/useExtensionBridge.ts`
- Bridges extension IPC to browser agent store
- Handles message types:
  - `page_agent:start` → Calls `runPageAgentGoal()`
  - `page_agent:stop` → Calls `stopPageAgent()`
- Returns `{ isConnected }` state
- Integrated into BrowserCapsuleEnhanced

### 4. Browser Capsule Enhanced
**File:** `surfaces/platform/src/capsules/browser/BrowserCapsuleEnhanced.tsx`
- Added import for `useExtensionBridge`
- Hook called in component to initialize extension listening

### 5. Browser Capsule (Legacy)
**File:** `surfaces/platform/src/capsules/browser/BrowserCapsule.tsx`
- Added import for `useExtensionBridge`
- Hook called in component (for backwards compatibility)

## How It Works

1. **Desktop App Starts**: Initializes TCP server on port 3011
2. **Extension Connects**: Chrome Extension launches native host which connects to port 3011
3. **Message Flow**:
   - Extension sends message via native messaging (stdio)
   - Native host forwards to TCP socket
   - Main process receives and forwards to renderer via IPC
   - `useExtensionBridge` hook receives message and updates store
   - Store actions trigger UI updates

## Extension Message Format

```typescript
// From Extension to Desktop
{
  type: 'page_agent:start',
  payload: {
    task: string,
    config?: object
  },
  id: string
}

{
  type: 'page_agent:stop',
  id: string
}

{
  type: 'page_agent:configure',
  payload: {
    config: object
  },
  id: string
}
```

## Next Steps to Test

1. **Rebuild Desktop App** (if needed):
   ```bash
   cd surfaces/desktop
   npm run build:electron
   ```

2. **Register Native Host** (one-time setup):
   ```bash
   cd surfaces/desktop/native-host
   ./register.sh
   ```

3. **Run Desktop App**:
   ```bash
   cd surfaces/desktop
   npm run dev
   # or
   npm start
   ```

4. **Check Logs**: Look for `[NativeHost]` messages in console

5. **Test Extension**: Open Chrome with A2R extension and try running a page agent task

## Troubleshooting

### Extension not connecting
- Check if port 3011 is available: `lsof -i :3011`
- Verify native host is registered: `cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.allternit.native_host.json`
- Check Chrome extension background page logs

### Messages not received
- Verify `window.a2rExtension` is available in renderer console
- Check main process logs for `[NativeHost]` messages
- Ensure BrowserCapsuleEnhanced is mounted

### TypeScript errors during build
- The preload script has been compiled manually - if changes are needed:
  ```bash
  cd surfaces/desktop
  npx tsc preload/index.ts --outDir preload --target ES2022 --module commonjs --skipLibCheck --esModuleInterop
  ```
