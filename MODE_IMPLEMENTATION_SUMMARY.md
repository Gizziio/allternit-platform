# Mode System Prompt Implementation - Summary

## ✅ Completed

### 1. Mode Toggle UI (Frontend)
- **Location:** ChatComposer.tsx, left side after + button
- **Design:** 28x28px icon button (Compass for Plan, Hammer for Build)
- **Functionality:** Connected to `useRuntimeExecutionMode()` hook
- **Backend Integration:** Mode field added to ChatRequest, passed to kernel

### 2. Provider Logos Downloaded
All logos now in `/6-ui/a2r-platform/public/assets/runtime-logos/`:
- ✅ anthropic-logo.svg (downloaded from Wikipedia)
- ✅ openai-logo.svg (downloaded from Wikipedia)
- ✅ google-logo.svg (downloaded from Wikipedia)
- ✅ gemini-logo.svg (downloaded from Wikipedia)
- ✅ ollama-logo.svg (existing)
- ✅ qwen-logo.svg (existing)
- ✅ zai-logo.svg (Kimi, existing)
- ✅ open-code-logo.svg (existing)
- ✅ claude-logo.svg (existing)

### 3. Mode System Prompt Files Created
**Location:** `/1-kernel/rust/openclaw-host/src/prompt/`
- ✅ `plan-mode.txt` - Plan mode system reminder
- ✅ `build-mode.txt` - Build mode system reminder

## ⏳ Remaining Backend Work

### Kernel Session Creation - System Prompt Injection

**File to Modify:** `1-kernel/rust/openclaw-host/src/native_api_gateway_router.rs`

**Function:** `handle_create_session` or `api_create_session`

**Logic Needed:**
```rust
// In session creation, check for mode field
let mode = session_request.mode.unwrap_or_else(|| "build".to_string());

// Load appropriate system prompt
let mode_prompt_path = if mode == "plan" {
    "src/prompt/plan-mode.txt"
} else {
    "src/prompt/build-mode.txt"
};

let mode_prompt = std::fs::read_to_string(mode_prompt_path)
    .unwrap_or_else(|_| String::new());

// Prepend mode prompt to system messages
if !mode_prompt.is_empty() {
    session_config.system_prompt = format!("{}\n\n{}", mode_prompt, session_config.system_prompt);
}
```

### Gizzi Code Reference

**File:** `cmd/gizzi-code/src/runtime/session/system.ts`
```typescript
export function provider(model: Provider.Model) {
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  // ...
}
```

**Plan Mode Prompt:** `cmd/gizzi-code/src/runtime/session/prompt/plan-reminder-anthropic.txt`
- Contains detailed plan mode instructions
- Specifies allowed/forbidden actions
- Defines 5-phase planning workflow

## 📋 Implementation Steps

1. **Update Kernel Session Creation** (Rust)
   - Add mode field parsing in `native_api_gateway_router.rs`
   - Load mode prompt file based on mode value
   - Prepend to existing system prompt

2. **Update Provider Registry** (TypeScript)
   - Remove fallback logic in `getProviderMeta()`
   - Ensure all provider IDs map to real logo files

3. **Update Model Selector** (TypeScript)
   - Remove "+ Connect" button approach
   - Load providers from existing Gizzi code provider list
   - Show connection status from `authenticatedProviders`

## 🎯 Key Requirements

1. **Mode toggle must change system prompt** - not just UI
2. **Provider logos must be real SVGs** - no fallback letters
3. **Model selector must match Gizzi implementation** - reuse existing provider infrastructure
