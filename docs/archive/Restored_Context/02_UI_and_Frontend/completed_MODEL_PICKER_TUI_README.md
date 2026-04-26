# Model Picker TUI Implementation

## Overview

This implements a **2-layer model picker** for the ChatUI that integrates with the kernel's model discovery API.

**Architecture:**
```
ChatUI (TUI) ←→ Kernel Service (Port 3004)
     │
     ├─ GET /v1/providers/auth/status
     ├─ GET /v1/providers/:provider/models
     ├─ POST /v1/providers/:provider/models/validate
     └─ POST /v1/sessions (with runtime_overrides)
```

## Files Created/Modified

### 1. API Client (`src/integration/api-client.ts`)

Added methods to `AllternitApiClient` class:

```typescript
// List all providers with auth status
api.listProviderAuthStatus()

// Get auth status for specific provider
api.getProviderAuthStatus(providerId: string)

// Discover models for a provider
api.discoverProviderModels(providerId: string)

// Validate a model ID
api.validateProviderModel(providerId: string, modelId: string)

// Create brain session with model override
api.createBrainSession(
  brainProfileId: string,
  source: 'chat' | 'terminal',
  runtimeOverrides?: { model_id?: string }
)
```

Added React hook:

```typescript
const {
  providers,              // All providers with auth status
  authenticatedProviders, // Filtered to authenticated only
  fetchProviders,         // Refresh auth status
  discoverModels,         // Discover available models
  discoveryResult,        // { supported, models, allow_freeform, ... }
  validateModel,          // Validate model ID
  validationResult,       // { valid, model, suggested, message }
} = useModelDiscovery();
```

### 2. Model Picker Component (`src/components/model-picker.tsx`)

**2-Layer Selection Flow:**

```
┌─────────────────────────────────────────────┐
│  Step 1: Select Runtime (Brain Profile)     │
│  ┌─────────────────────────────────────┐   │
│  │  OpenCode                           │   │
│  │  Google Gemini                      │   │
│  │  ✓ Kimi (Authenticated)            │   │
│  │  Claude                             │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 2: Select Model                       │
│                                             │
│  IF discovery supported:                    │
│  ┌─────────────────────────────────────┐   │
│  │  ▼ kimi-k2                          │   │
│  │     kimi-k1.5                       │   │
│  │     kimi-moonshot                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ELSE (freeform):                           │
│  ┌─────────────────────────────────────┐   │
│  │  Model ID: [kimi-k2-latest____]    │   │
│  │  ✓ Valid model                      │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Usage:**

```tsx
import { ModelPicker } from "@/components/model-picker";

<ModelPicker
  onSelect={(selection) => {
    console.log("Selected:", {
      providerId: selection.providerId,  // "kimi"
      profileId: selection.profileId,    // "kimi-acp"
      modelId: selection.modelId,        // "kimi-k2"
      modelName: selection.modelName,    // "kimi-k2"
    });
  }}
  trigger={
    <Button>Select Model</Button>
  }
/>
```

### 3. Model Selection Provider (`src/providers/model-selection-provider.tsx`)

Global state for model selection:

```tsx
import { ModelSelectionProvider, useModelSelection } from "@/providers/model-selection-provider";

// Wrap app with provider
<ModelSelectionProvider>
  <App />
</ModelSelectionProvider>

// Use in components
const { 
  selection,            // Current selection
  selectModel,          // Set selection
  clearSelection,       // Clear selection
  getBrainSessionConfig // Get config for API call
} = useModelSelection();

// Get config for creating session
const config = getBrainSessionConfig();
// → { brain_profile_id: "kimi-acp", source: "chat", runtime_overrides: { model_id: "kimi-k2" } }
```

### 4. Integration Example (`src/components/model-picker-example.tsx`)

Shows complete integration patterns:

```tsx
// Example: Chat input with model selection
<ChatInputWithModel
  onSend={(message, config) => {
    // config = { brain_profile_id, source, runtime_overrides }
    // If config present → create brain session with selected model
    // If null → use default chat
  }}
/>
```

## Integration Guide

### Step 1: Wrap App with Provider

```tsx
// app.tsx or layout.tsx
import { ModelSelectionProvider } from "@/providers/model-selection-provider";

export default function RootLayout({ children }) {
  return (
    <ModelSelectionProvider>
      {children}
    </ModelSelectionProvider>
  );
}
```

### Step 2: Add Model Picker to Chat Input

```tsx
// components/chat-input.tsx
import { useModelSelection } from "@/providers/model-selection-provider";
import { ModelPicker } from "@/components/model-picker";
import { api } from "@/integration/api-client";

export function ChatInput() {
  const { selection, getBrainSessionConfig, clearSelection } = useModelSelection();
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    const config = getBrainSessionConfig();

    if (config) {
      // Create brain session with selected model
      const session = await api.createBrainSession(
        config.brain_profile_id,
        config.source,
        config.runtime_overrides
      );
      
      // Send message
      await api.sendMessage(session.id, message);
      clearSelection();
    } else {
      // Use default chat API
      await api.chat({ message, chatId: "default" });
    }
  };

  return (
    <div>
      {selection && (
        <div className="selected-model">
          Using {selection.modelName}
          <button onClick={clearSelection}>×</button>
        </div>
      )}
      
      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      
      {!selection && (
        <ModelPicker onSelect={(s) => console.log(s)} />
      )}
      
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

### Step 3: Handle Auth Requirements

The ModelPicker automatically:
1. Fetches providers with auth status
2. Shows only authenticated providers in Step 1
3. Shows auth error for unauthenticated providers in Step 2

To authenticate a provider:
```bash
# Launch auth wizard via kernel
POST /v1/sessions
{
  "brain_profile_id": "opencode-auth",
  "source": "terminal"
}
```

## API Contract

### Discovery Response

```typescript
interface ModelDiscoveryResult {
  supported: boolean;           // Does provider have CLI discovery?
  models?: Array<{
    id: string;                 // Opaque model ID
    name: string;               // Display name
    description?: string;
    capabilities?: string[];    // ["code", "vision", "tools"]
    context_window?: number;
  }>;
  default_model_id?: string;
  allow_freeform: boolean;      // Always true as fallback
  freeform_hint?: string;       // e.g., "Enter OpenCode model ID"
  error?: string;               // "Not authenticated" etc.
}
```

### Validation Response

```typescript
interface ModelValidationResult {
  valid: boolean;
  model?: {
    id: string;
    name: string;
    description?: string;
    capabilities?: string[];
    context_window?: number;
  };
  suggested?: string[];         // Alternative model IDs
  message?: string;             // Error or info message
}
```

### Session Creation

```typescript
POST /api/v1/sessions
{
  "brain_profile_id": "kimi-acp",
  "source": "chat",
  "runtime_overrides": {
    "model_id": "kimi-k2"
  }
}
```

**Important:**
- `source` MUST be `"chat"` for chat sessions
- `source: "chat"` requires ACP/JSONL event mode (not Terminal)
- `runtime_overrides.model_id` is passed opaquely to the runtime

## Testing

```bash
# Start kernel
cargo run -p kernel

# Test discovery
curl http://127.0.0.1:3004/v1/providers/kimi/models \
  -H "Authorization: Bearer sk-test"

# Test validation
curl -X POST http://127.0.0.1:3004/v1/providers/kimi/models/validate \
  -H "Authorization: Bearer sk-test" \
  -H "Content-Type: application/json" \
  -d '{"model_id": "kimi-k2"}'

# Test full script
./test-model-discovery.sh
```

## Provider Status

| Provider | Discovery | Mode | Notes |
|----------|-----------|------|-------|
| OpenCode | Freeform | ACP | Placeholder for CLI discovery |
| Gemini | Freeform | ACP | No CLI models command yet |
| Claude | Freeform | ACP | Suggests known models |
| Kimi | Freeform | ACP | No auth required |
| Codex | Freeform | ACP | Basic validation |

When providers add CLI model discovery, update `kernel-service/src/brain/providers/models.rs` to enable `supports_discovery: true`.
