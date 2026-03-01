# Model Picker Testing Guide

## Prerequisites

Make sure you have these running:
1. **Kernel Service** (port 3004)
2. **Gateway** (port 8013) 
3. **TUI/ChatUI** (port 3000 or 5177)

## Step 1: Start the Services

### Terminal 1: Start Kernel
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
./target/debug/kernel
# Should see: "Kernel Service listening on 127.0.0.1:3004"
```

### Terminal 2: Start Gateway (if using gateway)
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/1-kernel/communication/a2r-gateway
cargo run
# Should see: "Gateway listening on 127.0.0.1:8013"
```

### Terminal 3: Start TUI
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform
npm run dev
# Should see: "Local: http://localhost:5177/"
```

## Step 2: Quick API Test

Before testing the UI, verify the kernel endpoints work:

```bash
# Test auth status
curl -s http://127.0.0.1:3004/v1/providers/auth/status \
  -H "Authorization: Bearer sk-test" | jq .

# Should return providers with auth status
```

Or run the test script:
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
./test-model-discovery.sh
```

## Step 3: Test Model Picker in TUI

### Option A: Direct Component Test

Create a test page to isolate the ModelPicker:

```tsx
// src/app/test-model-picker/page.tsx
"use client";

import { ModelPicker } from "@/components/model-picker";
import { ModelSelectionProvider, useModelSelection } from "@/providers/model-selection-provider";
import { Button } from "@/components/ui/button";

function TestContent() {
  const { selection, getBrainSessionConfig } = useModelSelection();

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Model Picker Test</h1>
      
      <ModelPicker 
        onSelect={(sel) => console.log("Selected:", sel)}
      />
      
      {selection && (
        <div className="p-4 bg-muted rounded-lg">
          <h2 className="font-semibold">Current Selection:</h2>
          <pre className="mt-2 text-sm">
            {JSON.stringify(selection, null, 2)}
          </pre>
          <h3 className="font-semibold mt-4">Session Config:</h3>
          <pre className="mt-2 text-sm">
            {JSON.stringify(getBrainSessionConfig(), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function TestPage() {
  return (
    <ModelSelectionProvider>
      <TestContent />
    </ModelSelectionProvider>
  );
}
```

Navigate to: `http://localhost:5177/test-model-picker`

### Option B: Add to Existing Chat

Find the chat input component (likely in `src/views/chat/` or similar) and add:

```tsx
// In your chat input component
import { ModelPicker } from "@/components/model-picker";
import { useModelSelection } from "@/providers/model-selection-provider";

export function ChatInput() {
  const { selection, clearSelection } = useModelSelection();
  
  return (
    <div className="flex items-center gap-2">
      {/* Show selected model */}
      {selection ? (
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded">
          <span className="text-sm">{selection.modelName}</span>
          <button onClick={clearSelection}>×</button>
        </div>
      ) : (
        <ModelPicker onSelect={(s) => console.log(s)} />
      )}
      
      {/* Your existing input */}
      <input ... />
      <button>Send</button>
    </div>
  );
}
```

## Step 4: Test Scenarios

### Scenario 1: Authenticated Provider (Kimi)
1. Click **"Select Model"** button
2. Should see Step 1 with providers
3. **Kimi** should show as authenticated (✓)
4. Click **Kimi**
5. Should go to Step 2 (freeform mode)
6. Type: `kimi-k2`
7. Should show ✓ "Valid model"
8. Click **Confirm**

### Scenario 2: Unauthenticated Provider (OpenCode)
1. Click **"Select Model"** button
2. OpenCode shows **[Auth]** button
3. Click **OpenCode**
4. Step 2 shows: "Provider 'opencode' is not authenticated"
5. Cannot proceed - need to auth first

### Scenario 3: Validation with Suggestions
1. Select **Claude** (if authenticated)
2. Type invalid model: `claude-invalid`
3. Should show suggestions like:
   - `claude-3-opus-20240229`
   - `claude-3-sonnet-20240229`
   - etc.
4. Click suggestion to auto-fill

### Scenario 4: Create Session
```tsx
// After selecting model, test session creation
const { getBrainSessionConfig } = useModelSelection();

async function testCreateSession() {
  const config = getBrainSessionConfig();
  if (!config) return;
  
  console.log("Creating session with:", config);
  
  const session = await api.createBrainSession(
    config.brain_profile_id,
    config.source,
    config.runtime_overrides
  );
  
  console.log("Session created:", session);
  // Should see session.id, status, etc.
}
```

## Step 5: Debug Checklist

If something doesn't work:

### Kernel Not Responding
```bash
# Check if kernel is running
curl http://127.0.0.1:3004/v1/providers/auth/status

# Should return JSON, not 404 or connection refused
```

### Gateway Not Proxying
Check `src/integration/api-client.ts` base URL:
```typescript
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8013';
// or direct to kernel for testing:
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3004';
```

### CORS Errors
In kernel log, check if requests are arriving:
```
[Kernel] GET /v1/providers/auth/status
```

If not, check gateway is forwarding to kernel correctly.

### Auth Token Issues
The TUI uses Bearer token auth. If getting 401:
```bash
# Test with curl
curl -v http://127.0.0.1:3004/v1/providers/auth/status \
  -H "Authorization: Bearer sk-test-token"
```

### Component Not Rendering
Check browser console for:
- "useModelSelection must be used within a ModelSelectionProvider"
  → Wrap component with `<ModelSelectionProvider>`

## Expected Console Output

When testing, you should see in browser console:

```
[ModelPicker] Fetching providers...
[ModelPicker] Providers loaded: 4
[ModelPicker] Selected profile: kimi-acp
[ModelPicker] Discovering models for: kimi
[ModelPicker] Discovery result: { supported: false, allow_freeform: true }
[ModelPicker] Validating model: kimi-k2
[ModelPicker] Validation result: { valid: true, ... }
[ModelPicker] Selection confirmed: { providerId: "kimi", profileId: "kimi-acp", modelId: "kimi-k2" }
```

## Quick Commands Reference

```bash
# 1. Start kernel
cargo run -p kernel

# 2. Test API directly
curl http://127.0.0.1:3004/v1/providers/auth/status -H "Authorization: Bearer sk-test"

# 3. Start TUI
npm run dev

# 4. Open browser
open http://localhost:5177

# 5. Watch logs
tail -f /tmp/kernel_new.log
```

## Success Criteria

✅ ModelPicker opens when clicking "Select Model"  
✅ Step 1 shows authenticated providers  
✅ Clicking provider goes to Step 2  
✅ Freeform input validates model IDs  
✅ Confirm button creates selection object  
✅ `getBrainSessionConfig()` returns valid config  
✅ Session creation works with selected model  
