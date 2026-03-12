# A2Rchitech UI Evolution - Phase 2 & 3 Implementation Complete

**Date:** March 10, 2026  
**Status:** ✅ All Tasks Completed  
**Design Inspiration:** Kimi AI Interface

---

## Executive Summary

Successfully implemented the Status Control Bar and Brand Identity systems for A2Rchitech, following the Kimi-inspired design pattern where mode selectors and model pickers are **integrated directly into the chat input bar** (not as separate floating elements).

---

## Implementation Overview

### ✅ Backend Changes

**File:** `7-apps/api/src/main.rs`

1. **Added `mode` field to ChatRequest struct**
   ```rust
   struct ChatRequest {
       chat_id: String,
       message: String,
       model_id: Option<String>,
       runtime_model_id: Option<String>,
       attachments: Option<Vec<serde_json::Value>>,
       web_search: Option<bool>,
       mode: Option<String>,  // NEW: "plan" or "build"
   }
   ```

2. **Updated chat handler** to pass mode to kernel session creation
   - Mode is sent in both new session and session reuse paths
   - Kernel can filter tools based on mode ("plan" = read-only, "build" = full access)

---

### ✅ Frontend Changes

#### 1. Provider Branding System

**File:** `6-ui/a2r-platform/src/views/chat/ChatComposer.tsx`

**Model Selector Pill Enhancement:**
- Added provider logo icon (16x16px) with brand color background
- Logo shows first letter fallback if image fails to load
- Brand colors from `getProviderMeta()` helper

**Model Selector Dropdown Enhancement:**
- Each model item now shows provider logo
- Grouped by provider with visual branding
- Consistent 18x18px logo containers with brand colors

#### 2. Plan/Build Mode Toggle

**New Feature:** Mode toggle pill (left side, after + button)

- **Plan Mode:** 
  - Compass icon
  - Blue color (#3b82f6)
  - Maps to `executionMode: "plan"`
  - Read-only operations

- **Build Mode:**
  - Hammer icon  
  - Amber color (#f59e0b)
  - Maps to `executionMode: "auto"`
  - Full tool access

**Implementation:**
```typescript
const { executionMode, isLoading: isLoadingExecMode, 
        isSaving: isSavingExecMode, setMode: setExecutionMode } 
  = useRuntimeExecutionMode();

const uiMode = executionMode?.mode === 'plan' ? 'plan' : 'build';
```

#### 3. Provider Gallery Persistence

**File:** `6-ui/a2r-platform/src/components/chat/ProviderGallery.tsx`

- Updated `handleConnect()` to call real API endpoint
- Uses existing `A2RApiClient` (exported as `api`)
- Endpoint: `POST /api/v1/providers/{id}/auth`

#### 4. Icon Assets

**Location:** `6-ui/a2r-platform/public/assets/runtime-logos/`

Copied 13 provider logos:
- claude-logo.svg (Anthropic)
- openai-logo.svg (OpenAI)
- gemini-logo.svg (Google)
- ollama-logo.svg (Ollama)
- qwen-logo.svg (Qwen)
- zai-logo.svg (Kimi/ZAI)
- open-code-logo.svg (OpenCode)
- And 6 more...

#### 5. Settings Integration

**File:** `7-apps/shell/web/src/components/SettingsOverlay.tsx`

- Fixed Sparkles icon import
- "AI Providers" section now functional
- Opens Provider Gallery for API key management

---

## UI Layout (Kimi-Inspired Design)

```
┌─────────────────────────────────────────────────────────────┐
│  [+] [Plan/Build] [Agent|Mode]        [Model ▾] [Send]     │
│                                                              │
│  Type your message...                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Left Side (after + button):**
1. Plan/Build mode toggle (Compass/Hammer icon)
2. Agent selector pill (when agent mode enabled)

**Right Side (before Send button):**
1. Model selector with provider logo
2. Send button

---

## Files Modified

| File | Changes |
|------|---------|
| `7-apps/api/src/main.rs` | Added mode field to ChatRequest |
| `6-ui/a2r-platform/src/views/chat/ChatComposer.tsx` | Provider branding, mode toggle |
| `6-ui/a2r-platform/src/components/chat/ProviderGallery.tsx` | API persistence |
| `7-apps/shell/web/src/components/SettingsOverlay.tsx` | Fixed imports |
| `6-ui/a2r-platform/public/assets/runtime-logos/*.svg` | 13 logo files |

**Files Removed:**
- `FloatingStatusBar.tsx` (wrong approach - deleted)

---

## Technical Architecture

### Mode System Mapping

```
UI Concept     →  Backend Execution Mode
─────────────────────────────────────────
"Plan" mode    →  executionMode: "plan"
                 (read-only, no write/execute tools)

"Build" mode   →  executionMode: "auto"  
                 (full tool access)
```

### Provider Registry Integration

All branding uses the existing `provider-registry.ts`:
```typescript
const providerMeta = getProviderMeta(providerId);
// Returns: { id, name, color, icon, textColor }
```

### API Client

Uses existing robust `A2RApiClient`:
- Located at: `integration/api-client.ts`
- Features: Retry logic, fallback URLs, interceptors
- Exported as: `export const api = new A2RApiClient()`

---

## Testing

### TypeScript Compilation
```bash
cd 6-ui/a2r-platform
npx tsc --noEmit --skipLibCheck
```
✅ No errors in new code

### Backend Compilation
```bash
cd 7-apps/api
cargo check
```
✅ Compiles successfully

---

## Visual Design Details

### Mode Toggle Pill
- **Size:** ~32px height, auto width
- **Border radius:** 999px (full pill)
- **Plan mode:** Blue (#3b82f6) with 15% bg, 40% border
- **Build mode:** Amber (#f59e0b) with 15% bg, 40% border
- **Icons:** Compass (Plan), Hammer (Build) - 14px

### Model Selector Pill
- **Provider logo:** 16x16px container, 10x10px actual logo
- **Background:** Brand color at 20% opacity
- **Border:** Brand color at 40% opacity
- **Border radius:** 4px (slightly rounded square)

### Model Dropdown Items
- **Provider logo:** 18x18px container, 12x12px actual logo
- **Layout:** Logo | Model Name | Check (if selected)
- **Hover:** Subtle background change
- **Selected:** Brand accent color

---

## Next Steps (Optional Enhancements)

1. **Send Button Branding:** Color the Send button based on selected provider
2. **Mode Tooltips:** Add hover hints explaining Plan vs Build
3. **Animation:** Smooth transitions when switching modes
4. **Keyboard Shortcuts:** Ctrl+M to toggle mode

---

## Success Criteria Met

✅ Backend receives and forwards mode to kernel  
✅ Provider credentials persist via API  
✅ Model selector shows provider logo + brand colors  
✅ Plan/Build mode toggle integrated into input bar  
✅ Dropdown shows provider logos for all models  
✅ Provider logos available (13 SVGs)  
✅ Settings integration complete  
✅ Kimi-inspired design pattern followed  
✅ No floating status bar (removed)  

---

**Implementation completed by:** AI Assistant  
**Review status:** Ready for testing  
**Documentation:** Complete  
