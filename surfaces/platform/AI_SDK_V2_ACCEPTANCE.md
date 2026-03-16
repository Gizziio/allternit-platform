# AI SDK V2 Acceptance Criteria

Generated: 2026-02-07
Updated: 2026-02-07 (Final)

## Release Gates (ALL MUST PASS)

```bash
# Critical path - zero errors
pnpm typecheck
pnpm guard:ai-elements
pnpm guard:no-drift
pnpm test -- rust-stream-adapter.test.ts
```

## Verification Commands & Expected Output

### 1. Typecheck
```bash
pnpm typecheck
```

**Expected Output:**
```
> @a2r/platform@1.0.0 typecheck /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/5-ui/a2r-platform
> tsc --noEmit

EXIT: 0
```

**Status**: ✅ **ZERO ERRORS**

---

### 2. Guard: AI Elements
```bash
pnpm guard:ai-elements
```

**Expected Output:**
```
> @a2r/platform@1.0.0 guard:ai-elements
> bash scripts/no-legacy-ai-elements.sh

Checking for legacy ai-elements imports...
✅ OK: No legacy ai-elements imports found
EXIT: 0
```

**Status**: ✅ PASS

---

### 3. Guard: No Drift
```bash
pnpm guard:no-drift
```

**Expected Output:**
```
> @a2r/platform@1.0.0 guard:no-drift
> bash scripts/guard:no-drift.sh

Running drift guard checks...
→ Checking for legacy imports...
→ Checking for deprecated 'tool-invocation' type...
→ Checking for 'as any' in V2 files...
→ Checking for @ts-ignore in V2 files...
→ Checking for @eslint-disable in V2 files...
→ Checking for div-based tool rendering...
→ Verifying Tool component imports...

✅ All drift guard checks passed!
EXIT: 0
```

**Status**: ✅ PASS

---

### 4. Unit Tests
```bash
pnpm test -- src/lib/ai/rust-stream-adapter.test.ts
```

**Expected Output:**
```
✓ src/lib/ai/rust-stream-adapter.test.ts (15 tests)
✓ src/lib/sandbox/smart-sandbox.test.ts (32 tests)
✓ src/lib/ai/text-splitter.test.ts (4 tests)
✓ src/lib/ai/token-utils.test.ts (19 tests)

Test Files  4 passed (4)
Tests  70 passed (70)
EXIT: 0
```

**Status**: ✅ PASS

---

## Baseline Error History

**Pre-existing errors (NOW FIXED):**

| File | Line | Error | Fix Applied |
|------|------|-------|-------------|
| `src/components/ai-elements/message.tsx` | 91, 269, 292 | Type '"icon-sm"' not assignable | Changed to "icon" |
| `src/lib/ai/app-models.ts` | 19,23,24,26,28,29,30,33,35 | Property 'tags' does not exist | Proper type assertion |

**Current State**: All type errors resolved.

---

## Route Registration

```bash
rg "chat-v2" src/shell/ShellApp.tsx src/nav/nav.types.ts src/nav/nav.policy.ts
```

**Output:**
```
src/shell/ShellApp.tsx:24:import { ChatViewV2 } from '../views/ChatViewV2';
src/shell/ShellApp.tsx:143:"chat-v2": ChatViewV2,
src/nav/nav.types.ts:4:  | "chat-v2"
src/nav/nav.policy.ts:5:  "chat-v2": { singleton: false, maxInstances: 20, allowNew: true, surface: "view", ownsTabs: false },
```

---

## Files Modified Summary

| File | Purpose |
|------|---------|
| `src/lib/ai/rust-stream-adapter.ts` | Production adapter (NEW) |
| `src/lib/ai/rust-stream-adapter.test.ts` | Unit tests (NEW) |
| `src/views/ChatViewV2.tsx` | V2 chat view (NEW) |
| `src/components/ai-elements/message.tsx` | Fixed Button size (MODIFIED) |
| `src/lib/ai/app-models.ts` | Fixed tags access (MODIFIED) |
| `src/shell/ShellApp.tsx` | Added V2 route (MODIFIED) |
| `src/nav/nav.types.ts` | Added chat-v2 ViewType (MODIFIED) |
| `src/nav/nav.policy.ts` | Added chat-v2 policy (MODIFIED) |

---

## Migration Path to Default

To make ChatViewV2 the default:

```bash
# Option A: Route swap (recommended)
# In src/shell/ShellApp.tsx:
# Change: "chat": ChatViewWrapper
# To:     "chat": ChatViewV2

# Option B: Keep old for rollback
# "chat": ChatViewV2,
# "chat-legacy": ChatViewWrapper,  // For emergency
```

See `AI_SDK_FULL_MANIFEST.md` for complete adoption status.
