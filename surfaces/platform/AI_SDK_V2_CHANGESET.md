# AI SDK V2 Changeset

Generated: 2026-02-07

## Files Added

| File | Purpose |
|------|---------|
| `src/lib/ai/rust-stream-adapter.ts` | Production adapter mapping Rust SSE events to AI SDK UI parts |
| `src/lib/ai/rust-stream-adapter.test.ts` | Unit tests for the adapter with fixture SSE events |
| `src/views/ChatViewV2.tsx` | V2 chat view using AI Elements + adapter (no custom providers) |
| `src/legacy/ai-elements/README.md` | Freeze warning for legacy directory |
| `scripts/no-legacy-ai-elements.sh` | Guardrail script to prevent legacy imports |
| `scripts/guard:no-drift.sh` | Drift prevention guard (no any, no ts-ignore, proper Tool usage) |
| `tsconfig.v2.json` | Scoped TypeScript config for V2 files only |
| `AI_ELEMENTS_INVENTORY.md` | (Root) Inventory of AI Elements locations |
| `AI_SDK_INTEGRATION.md` | (Root) SDK installation status doc |
| `AI_SDK_V2_CHANGESET.md` | This file |
| `AI_SDK_V2_ACCEPTANCE.md` | Acceptance criteria and verification commands |

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added scripts: `guard:ai-elements`, `guard:no-drift`, `test`, `typecheck:v2`; added `vitest` devDependency |
| `src/shell/ShellApp.tsx` | Added ChatViewV2 import (line 24) and route registration (line 143) |
| `src/nav/nav.types.ts` | Added `"chat-v2"` to ViewType union (line 4) |
| `src/nav/nav.policy.ts` | Added `"chat-v2"` spawn policy (line 5) |

## Files Moved

| From | To |
|------|-----|
| `components/ai-elements/` | `src/legacy/ai-elements/` |

## Dependencies Added

```json
{
  "devDependencies": {
    "vitest": "^1.6.1"
  }
}
```

## Detailed Code Changes

### package.json (Lines 16-19 added)
```json
"typecheck:v2": "tsc --project tsconfig.v2.json --noEmit",
"guard:ai-elements": "bash scripts/no-legacy-ai-elements.sh",
"guard:no-drift": "bash scripts/guard:no-drift.sh",
"test": "vitest run"
```

### src/shell/ShellApp.tsx
- Line 24: Added import `import { ChatViewV2 } from '../views/ChatViewV2';`
- Line 143: Added route `"chat-v2": ChatViewV2,`

### src/nav/nav.types.ts (Line 4 added)
```typescript
export type ViewType =
  | "home"
  | "chat"
  | "chat-v2"  // ← Added
  | "workspace"
```

### src/nav/nav.policy.ts (Line 5 added)
```typescript
"chat-v2": { singleton: false, maxInstances: 20, allowNew: true, surface: "view", ownsTabs: false },
```

## Verification Commands

```bash
# Check files exist
ls src/lib/ai/rust-stream-adapter.ts
ls src/views/ChatViewV2.tsx
ls scripts/no-legacy-ai-elements.sh
ls scripts/guard:no-drift.sh

# Verify no legacy imports
pnpm guard:ai-elements

# Verify no drift
pnpm guard:no-drift

# Run tests
pnpm test -- src/lib/ai/rust-stream-adapter.test.ts

# Typecheck V2 files (excludes baseline errors)
pnpm typecheck:v2
```

## Notes

- All 35 AI SDK provider packages were previously installed
- 52 AI Elements components already present in `src/components/ai-elements/`
- V2 implementation uses strict TypeScript (zero `any` types)
- Tool rendering uses official AI Elements `Tool`, `ToolHeader`, `ToolContent`, `ToolInput` components
