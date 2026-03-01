# Model Discovery TUI Flow

## Overview

The kernel implements a **runtime-owned model discovery** pattern. Model IDs are opaque strings that only the runtime (OpenCode, Gemini, etc.) understands. The kernel never parses, validates format, or hardcodes model lists.

## Two-Layer Selection

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Select Runtime (Brain Profile)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ opencode-acp│  │ gemini-acp  │  │ claude-acp  │  ...     │
│  │  [Auth ✓]   │  │ [Auth ✗]    │  │ [Auth ✓]    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Filter: Only show authenticated profiles                   │
│  Action: Click auth-required → launch auth wizard          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Select Model                                       │
│                                                             │
│  IF provider supports discovery:                            │
│  ┌─────────────────────────────────────────┐               │
│  │ Dropdown:                               │               │
│  │ ▼ anthropic:claude-3-7-sonnet          │               │
│  │    anthropic:claude-3-5-sonnet         │               │
│  │    openai:gpt-4o                       │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  ELSE (freeform):                                           │
│  ┌─────────────────────────────────────────┐               │
│  │ Model ID: [____________________]       │               │
│  │ Hint: Enter OpenCode model ID          │               │
│  │       (e.g., anthropic:claude-3-7)     │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  [Optional] [Validate] button → POST /validate             │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. List Providers (with Auth Status)
```http
GET /v1/providers/auth/status

Response:
{
  "providers": [
    {
      "provider_id": "opencode",
      "status": "ok",
      "authenticated": true,
      "auth_profile_id": "opencode-auth",
      "chat_profile_ids": ["opencode-acp"]
    },
    {
      "provider_id": "gemini", 
      "status": "missing",
      "authenticated": false,
      "auth_profile_id": "gemini-auth",
      "chat_profile_ids": ["gemini-acp", "gemini-cli"]
    }
  ]
}
```

### 2. Discover Models for Provider
```http
GET /v1/providers/:provider/models

# Example: GET /v1/providers/opencode/models
Response (when discovery not supported):
{
  "supported": false,
  "models": null,
  "default_model_id": null,
  "allow_freeform": true,
  "freeform_hint": "Enter OpenCode model ID (e.g., anthropic:claude-3-7-sonnet)",
  "error": null
}

Response (when discovery supported - future):
{
  "supported": true,
  "models": [
    {
      "id": "anthropic:claude-3-7-sonnet",
      "name": "Claude 3.7 Sonnet",
      "capabilities": ["code", "tools", "vision"],
      "context_window": 200000
    }
  ],
  "default_model_id": "anthropic:claude-3-7-sonnet",
  "allow_freeform": true,
  "freeform_hint": null,
  "error": null
}
```

### 3. Validate Model ID
```http
POST /v1/providers/:provider/models/validate
{
  "model_id": "anthropic:claude-3-7-sonnet"
}

Response:
{
  "valid": true,
  "model": {
    "id": "anthropic:claude-3-7-sonnet",
    "name": "anthropic:claude-3-7-sonnet",
    "description": "OpenCode model: anthropic:claude-3-7-sonnet",
    "capabilities": ["code", "tools"],
    "context_window": null
  },
  "suggested": null,
  "message": null
}
```

### 4. Create Session with Model
```http
POST /v1/sessions
{
  "config": {
    "id": "opencode-acp",
    "name": "OpenCode (ACP Native)",
    "brain_type": "cli",
    "event_mode": "acp"
  },
  "source": "chat",
  "runtime_overrides": {
    "model_id": "anthropic:claude-3-7-sonnet"
  }
}
```

## TUI Implementation Guide

### State Machine

```rust
enum ModelPickerState {
    /// Step 1: Select runtime profile
    SelectProfile {
        profiles: Vec<BrainProfile>,
        auth_status: HashMap<String, AuthStatus>,
    },
    
    /// Step 2a: Discovery supported - show dropdown
    SelectFromDiscovery {
        profile_id: String,
        provider_id: String,
        models: Vec<ProviderModel>,
        selected: Option<String>,
    },
    
    /// Step 2b: Discovery not supported - freeform entry
    EnterFreeform {
        profile_id: String,
        provider_id: String,
        hint: String,
        input: String,
        validation: Option<ValidationResult>,
    },
    
    /// Ready to create session
    Ready {
        profile_id: String,
        model_id: String,
    },
}
```

### Key UI Behaviors

#### 1. Auth Gating
```rust
// Filter profiles based on auth status
let available_profiles: Vec<_> = profiles
    .iter()
    .filter(|p| {
        let provider = profile_to_provider_id(&p.config.id);
        provider.map_or(false, |pid| {
            auth_status.get(&pid)
                .map(|s| s.is_authenticated())
                .unwrap_or(false)
        })
    })
    .collect();

// Show auth button for unauthenticated providers
for profile in &profiles {
    if !is_authenticated(&profile.config.id) {
        ui.show_auth_button(&profile.config.id, || {
            // Launch auth wizard
            create_session("opencode-auth", source: "terminal");
        });
    }
}
```

#### 2. Discovery vs Freeform
```rust
async fn show_model_picker(provider_id: &str) {
    let discovery = get(&format!("/v1/providers/{}/models", provider_id)).await;
    
    if discovery.supported && discovery.models.is_some() {
        // Show dropdown with models
        show_dropdown(discovery.models.unwrap());
    } else {
        // Show freeform input with hint
        show_text_input(
            placeholder: discovery.freeform_hint.unwrap_or_default(),
            on_change: |input| validate_model(provider_id, input),
        );
    }
}
```

#### 3. Validation Feedback
```rust
async fn validate_model(provider_id: &str, model_id: &str) {
    let result = post(
        &format!("/v1/providers/{}/models/validate", provider_id),
        json!({ "model_id": model_id })
    ).await;
    
    if result.valid {
        ui.show_checkmark();
        ui.enable_send_button();
    } else {
        ui.show_error(&result.message.unwrap_or_default());
        if let Some(suggested) = result.suggested {
            ui.show_suggestions(suggested);
        }
    }
}
```

#### 4. Caching
```rust
// Cache model lists for 24h
const CACHE_TTL: Duration = Duration::from_secs(86400);

struct ModelCache {
    provider_id: String,
    models: Vec<ProviderModel>,
    cached_at: Instant,
}

async fn get_cached_models(provider_id: &str) -> Option<Vec<ProviderModel>> {
    if let Some(cached) = cache.get(provider_id) {
        if cached.cached_at.elapsed() < CACHE_TTL {
            return Some(cached.models.clone());
        }
    }
    None
}
```

### Error Handling

| Error | UI Action |
|-------|-----------|
| Provider not authenticated | Show "Authenticate" button → launch auth wizard |
| Discovery failed | Fall back to freeform with warning |
| Validation failed | Show error + suggestions |
| Empty model ID | Disable send button |
| Unknown provider | Accept freeform with warning |

### Complete Flow Example

```
1. User opens ChatUI
   ↓
2. UI fetches GET /v1/providers/auth/status
   → Shows: opencode [✓], gemini [✗], claude [✓]
   ↓
3. User clicks on opencode (authenticated)
   ↓
4. UI fetches GET /v1/providers/opencode/models
   → Returns: { supported: false, allow_freeform: true }
   ↓
5. UI shows freeform input:
   "Enter OpenCode model ID (e.g., anthropic:claude-3-7-sonnet)"
   [____________________] [Validate]
   ↓
6. User types: "anthropic:claude-3-7-sonnet"
   Clicks [Validate]
   ↓
7. UI POST /v1/providers/opencode/models/validate
   → Returns: { valid: true }
   ↓
8. UI enables [Start Session] button
   ↓
9. User clicks [Start Session]
   ↓
10. UI POST /v1/sessions
    {
      "config": { "id": "opencode-acp", ... },
      "source": "chat",
      "runtime_overrides": {
        "model_id": "anthropic:claude-3-7-sonnet"
      }
    }
    ↓
11. Kernel spawns opencode with ACP protocol
    Sends model_id via runtime_overrides
    ↓
12. OpenCode uses the specified model for the session
```

## Critical Invariants

1. **Model IDs are opaque**: Never parse `anthropic:claude-3-7` into provider/model parts
2. **Auth gating**: Only show authenticated profiles in model picker
3. **Source enforcement**: Chat sessions MUST use `source: "chat"` with ACP/JSONL modes
4. **Freeform fallback**: Always allow manual entry when discovery unavailable
5. **Validation is advisory**: Accept model IDs even if validation fails (runtime will reject if truly invalid)

## Wire Format Summary

```
Runtime Selection:
  GET /v1/providers/auth/status → List with auth state

Model Selection:
  GET /v1/providers/:p/models → Discovery response
  POST /v1/providers/:p/models/validate → Validation result

Session Creation:
  POST /v1/sessions with runtime_overrides.model_id
```
