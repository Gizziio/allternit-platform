# Input Area V2 - Changes Summary

## 1. Gizzi Mascot Now Sits ON the Toolbar Row

**Before:**
- Gizzi floated above the input bar in a separate absolute-positioned container
- Appeared to "float" with a thought bubble

**After:**
- Gizzi sits inline with the Agent toggle button on the toolbar row
- Small inline version (36px) with simplified animations
- Appears with spring animation when Agent Mode is toggled ON
- Positioned to the left of the "Agent On" toggle text

```
Toolbar Row:
┌─────────────────────────────────────────────────────┐
│  🎭 [Agent On]              [Kimi K2.5 ▼]          │
│  ^ Gizzi inline             Model selector          │
└─────────────────────────────────────────────────────┘
```

## 2. Real Models from API (Not Hardcoded)

**Before:**
```typescript
const MODELS = [
  { id: 'kimi', name: 'Kimi K2.5', provider: 'Moonshot', color: '#6b4c9a' },
  { id: 'gpt4o', name: 'GPT-4o', provider: 'OpenAI', color: '#10a37f' },
  // ... hardcoded
];
```

**After:**
- New `modelStore.ts` fetches from `/api/v1/providers` endpoint
- Same API pattern as A2R Platform
- Returns provider info with nested models array
- Auto-selects first model on load
- Shows provider name as badge in dropdown
- Loading state while fetching

```typescript
// API: GET /api/v1/providers
interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}
```

## 3. Input Bar Closer to Bottom

**Before:**
```css
.thin-client-app.compact {
  padding-bottom: 40px;
}
```

**After:**
```css
.thin-client-app.compact .input-area {
  padding-bottom: 8px;
}
```

Input bar now sits much closer to bottom edge of window.

## 4. Header Always Visible (Settings Icon, etc.)

**Before:**
- Header was hidden in compact mode (`!isCompact` condition)
- No access to settings/clear chat/close buttons when no messages

**After:**
- Header ALWAYS visible with logo, backend badge, settings, clear, close buttons
- In compact mode: header has transparent background, floats at top
- In expanded mode: header has solid background with border

```
Compact Mode:
┌─────────────────────────────────────────────────────┐
│  A2R [Desktop]          [⚙] [🗑] [✕]               │  ← Header (always visible)
│                                                     │
│                                                     │
│            Welcome to A2R                           │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🎭 Agent On          [Kimi K2.5 ▼]           │ │  ← Toolbar with Gizzi
│  │ [+] What's brewing today?              [↑]   │ │  ← Input
│  │ [Choose Agent ▼]            [Build]          │ │  ← Actions
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Files Changed

| File | Changes |
|------|---------|
| `InputArea.tsx` | Inline Gizzi component, real model store integration, 3-row layout |
| `modelStore.ts` | **NEW** - Zustand store for fetching real models from API |
| `ThinClientApp.tsx` | Header always visible, compact padding reduced to 8px |
| `agentStore.ts` | (No changes - already existed) |

## Build Status

```
✓ TypeScript check: Pass
✓ Production build: Pass (1.07MB bundle)
```

## API Endpoints

The thin client now fetches from:
- **Agents**: `GET /api/agents` → `agentStore.ts`
- **Models**: `GET /api/v1/providers` → `modelStore.ts`

Both endpoints match the A2R Platform API structure.
