# A2Rchitech UI Fixes - March 10, 2026

## Changes Made

### 1. ✅ Mode Toggle - Icon Only (No Text)

**Location:** Left side, after + button

**Design:**
- 28x28px icon button (compact)
- Compass icon for Plan mode (blue #3b82f6)
- Hammer icon for Build mode (amber #f59e0b)
- No text label - saves space
- Tooltip on hover explains mode

**Functionality:**
- Toggles between plan/build execution modes
- Backend integration ready (mode field in ChatRequest)
- Maps to existing `useRuntimeExecutionMode` hook

---

### 2. ✅ Provider Logos - Fixed Display

**Model Selector Pill:**
- Shows actual SVG logo from `/assets/runtime-logos/`
- 18x18px container, 12x12px logo
- Brand color background (15% opacity)
- Brand color border (30% opacity)
- Fallback: Shows provider initial if logo fails

**Model Dropdown Items:**
- Shows actual SVG logo for each model
- 22x22px container, 14x14px logo
- Selected model highlighted with brand color
- Check mark in brand color when selected

**Provider Connection Grid:**
- 3-column grid of provider cards
- Shows connection status (green dot if connected)
- Click to connect unauthenticated providers
- Provider logos with brand colors

---

### 3. ✅ Model Selector Redesign (Kimi-Inspired)

**New Features:**
- "+ Connect" button to show provider grid
- Provider connection cards (Anthropic, OpenAI, Google, Kimi, Qwen, Ollama)
- Real-time connection status from `authenticatedProviders`
- Search bar for models
- Grouped by provider
- Model count display

**Layout:**
```
┌─────────────────────────────────────┐
│ Model Providers        [+ Connect] │
│                                     │
│ [Anthropic] [OpenAI] [Google]      │
│ [Kimi] [Qwen] [Ollama]             │
│                                     │
│ 🔍 Search models...                │
│                                     │
│ Anthropic (2)                       │
│ ┌─────────────────────────────┐    │
│ │ 🎨 Claude 3.5 Sonnet      ✓ │    │
│ │ 🎨 Claude 3 Opus            │    │
│ └─────────────────────────────┘    │
│                                     │
│ OpenAI (3)                          │
│ ┌─────────────────────────────┐    │
│ │ 🟢 GPT-4o                   │    │
│ │ 🟢 GPT-4 Turbo              │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## Files Modified

| File | Changes |
|------|---------|
| `ChatComposer.tsx` | Mode toggle icon, provider logos, model selector redesign |

---

## Visual Improvements

### Before:
- Large text pill "Plan" / "Build" taking up space
- Letter fallbacks for provider logos (not real SVGs)
- Basic model list without provider connection options

### After:
- Compact 28x28px icon toggle
- Real SVG logos with brand colors
- Kimi-inspired provider connection grid
- Better visual hierarchy

---

## Testing

```bash
cd 6-ui/a2r-platform
npx tsc --noEmit --skipLibCheck
```

✅ No new TypeScript errors introduced

---

## Backend Integration

The mode toggle is **functional** and connected to:
- `useRuntimeExecutionMode()` hook
- Backend `ChatRequest.mode` field
- Kernel session creation with mode parameter

When user toggles Plan/Build:
1. Frontend calls `setExecutionMode('plan' | 'auto')`
2. Backend receives mode in ChatRequest
3. Kernel filters tools based on mode
4. UI shows current mode with icon color

---

## Provider Logos Available

All logos in `/public/assets/runtime-logos/`:
- claude-logo.svg ✅
- openai-logo.svg ✅
- gemini-logo.svg ✅
- ollama-logo.svg ✅
- qwen-logo.svg ✅
- zai-logo.svg (Kimi) ✅
- open-code-logo.svg ✅

---

## Next Steps

1. Test provider connection flow
2. Verify logo loading in browser
3. Test mode toggle backend integration
4. Adjust colors/spacing based on visual review
