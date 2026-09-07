# Phase 3: Reconstruction Planning
## Building Missing Dependencies

### Current State
- 1,884 Claude files landed ✅
- ~23 files confirmed missing (1.2%)
- 4 critical type files blocking build
- Heavy dependency on `@anthropic-ai/sdk`

---

## Missing Dependencies by Category

### 1. Critical Type Files (4 files) - BLOCKING

| File | Used By | Imports From | Reconstruction Source |
|------|---------|--------------|---------------------|
| `types/message.ts` | Tool.ts, QueryEngine.ts, utils/messages.ts | `@anthropic-ai/sdk` | Allternit SDK + Gizzi types |
| `types/tools.ts` | Tool.ts, command handlers | `@anthropic-ai/sdk` | Allternit SDK |
| `types/utils.ts` | Various | - | Fresh implementation |
| `constants/querySource.ts` | QueryEngine.ts | - | Fresh implementation |

### 2. Command Index Files (18 files) - NON-BLOCKING

Directories have `index.js` but TypeScript imports expect `index.ts`:
- Solution A: Rename `index.js` → `index.ts`
- Solution B: Update imports to use `.js` extension
- Solution C: Generate TypeScript wrappers

### 3. External Dependencies - PROPRIETARY

| Package | Usage | Replacement |
|---------|-------|-------------|
| `@anthropic-ai/sdk` | 200+ imports | `allternit-api` SDK (forked) |
| `@anthropic-ai/sdk/resources` | 50+ imports | `allternit-api/resources` |

---

## Reconstruction Strategy

### Strategy A: Allternit SDK Bridge (Recommended)

Use our forked SDK to provide compatible types:

```typescript
// types/message.ts - Bridge to Allternit SDK
export type { 
  Message,
  UserMessage,
  AssistantMessage,
  SystemMessage 
} from '../sdk/allternit-api/resources/messages.js'
```

**Pros:**
- Already have working SDK
- Maintains Claude semantics
- Type-safe

**Cons:**
- Need to ensure API compatibility
- May need type adapters

### Strategy B: Gizzi Type Port

Port types from working Gizzi Code:

```typescript
// types/message.ts - Ported from Gizzi
export interface Message {
  type: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
  // ... Gizzi's structure
}
```

**Pros:**
- Production-tested in Gizzi
- No external deps

**Cons:**
- May not match Claude's expectations
- Requires property mapping

### Strategy C: Minimal Shims (Quick Start)

Create minimal type shims to get building:

```typescript
// types/message.ts - Minimal shim
export interface Message {
  [key: string]: unknown
}
```

**Pros:**
- Fastest to implement
- Unblocks build quickly

**Cons:**
- Not type-safe
- Needs replacement later

---

## Recommended Approach: Hybrid

### Phase 3A: Critical Path (Week 1)
1. **Create type shims** for 4 critical files
2. **Fix command indices** (rename .js → .ts)
3. **Run tsc --noEmit** to find all errors
4. **Create error inventory**

### Phase 3B: SDK Integration (Week 2)
1. **Map `@anthropic-ai/sdk` imports** to `allternit-api`
2. **Create type bridges** where APIs differ
3. **Update import paths** throughout codebase
4. **Verify types align**

### Phase 3C: Deep Dependencies (Week 3)
1. **Resolve all tsc errors**
2. **Build dependency graph** for missing pieces
3. **Implement or stub** remaining missing files
4. **Get to compile state**

---

## Implementation: Type Shims (Phase 3A)

### types/message.ts (Minimal)
```typescript
// src/types/message.ts
// TEMPORARY SHIM - Replace with proper Allternit SDK types

export interface Message {
  type: 'user' | 'assistant' | 'system' | 'progress'
  message?: {
    content: string | unknown[]
    role?: string
    stop_reason?: string | null
  }
  content?: string | unknown[]
  session_id?: string
  parent_tool_use_id?: string | null
  isCompactSummary?: boolean
  uuid?: string
  [key: string]: unknown
}

export interface UserMessage extends Message {
  type: 'user'
}

export interface AssistantMessage extends Message {
  type: 'assistant'
}

export interface SystemMessage extends Message {
  type: 'system'
}
```

### types/tools.ts (Minimal)
```typescript
// src/types/tools.ts
// TEMPORARY SHIM

export interface Tool {
  name: string
  description?: string
  input_schema?: unknown
}

export interface ToolUse {
  id: string
  name: string
  input: unknown
}

export interface ToolResult {
  tool_use_id: string
  content: string | unknown[]
  is_error?: boolean
}
```

### types/utils.ts (Minimal)
```typescript
// src/types/utils.ts
// TEMPORARY SHIM

export type DeepImmutable<T> = {
  readonly [K in keyof T]: DeepImmutable<T[K]>
}

export type Nullable<T> = T | null | undefined
```

### constants/querySource.ts (Minimal)
```typescript
// src/constants/querySource.ts
// TEMPORARY SHIM

export type QuerySource = 
  | 'user_input'
  | 'tool_result'
  | 'system_prompt'
  | 'compact_summary'

export const QUERY_SOURCES = {
  USER_INPUT: 'user_input' as const,
  TOOL_RESULT: 'tool_result' as const,
  SYSTEM_PROMPT: 'system_prompt' as const,
  COMPACT_SUMMARY: 'compact_summary' as const,
}
```

---

## SDK Migration: @anthropic-ai/sdk → allternit-api

### Import Mapping

| From | To |
|------|-----|
| `@anthropic-ai/sdk` | `../sdk/allternit-api/index.js` |
| `@anthropic-ai/sdk/resources` | `../sdk/allternit-api/resources/index.js` |
| `@anthropic-ai/sdk/resources/messages.mjs` | `../sdk/allternit-api/resources/messages.js` |

### Type Mapping

| Anthropic Type | Allternit Equivalent |
|----------------|---------------------|
| `Anthropic` | `AllternitAPI` |
| `Anthropic.Messages` | `AllternitAPI.Messages` |
| `Message` | `Message` (same structure) |
| `ContentBlock` | `ContentBlock` (same structure) |
| `Tool` | `Tool` (same structure) |

### Automation Script
```bash
# Replace all @anthropic-ai/sdk imports
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  's|@anthropic-ai/sdk|../sdk/allternit-api|g'
```

---

## Success Criteria for Phase 3

| Phase | Criteria | Verification |
|-------|----------|--------------|
| 3A | Type shims created | `test -f src/types/message.ts` |
| 3A | Command indices fixed | `find src/commands -name "index.ts" \| wc -l` = 70+ |
| 3B | SDK imports mapped | `grep -r "@anthropic-ai/sdk" src \| wc -l` = 0 |
| 3C | tsc --noEmit passes | `bun tsc --noEmit` returns 0 |

---

## Immediate Next Actions

1. **Create type shims** (4 files)
2. **Fix command indices** (rename 18 files)
3. **Run full type check** to find all errors
4. **Create comprehensive error inventory**

**Ready to execute Phase 3A?**
