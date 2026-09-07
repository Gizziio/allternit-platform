# Gizzi-Code TypeScript Scaling Game Plan (CORRECTED)

**Authority:** SYSTEM_LAW.md Part XV (TypeScript & Scaling Law)  
**Target:** `cmd/gizzi-code`  
**Date:** 2026-03-31  
**Status:** Exhaustive Analysis Complete

---

## 1. CORRECTED CODEBASE METRICS

| Metric | Initial Report | **Actual (Exhaustive)** | LAW Limit | Status |
|--------|---------------|-------------------------|-----------|--------|
| TypeScript files | ~27,579 ❌ | **540** ✅ | N/A | ✅ Manageable |
| Barrel files (index.ts) | 166+ ❌ | **53** ✅ | 0 in src/ | ❌ VIOLATION |
| Files per tsconfig | Unknown | **540** | 500 | ❌ VIOLATION (-40 over) |
| `composite: true` configs | 0 | **0** | 5+ required | ❌ VIOLATION |
| @ai-sdk type leaks | Unknown | **6+ files** | 1 file | ❌ VIOLATION |

### Actual Directory Structure (540 files total)

```
src/ (540 .ts files)
├── runtime/          341 files (63.1%) - Core runtime engine
│   ├── plugins/builtin/    ~100 files (11 domain plugins)
│   ├── server/routes/       20 files
│   ├── verification/        50+ files
│   ├── session/             15 files
│   ├── providers/           15 files
│   ├── tools/               30 files
│   ├── context/             20 files
│   ├── integrations/        25 files
│   └── skills/              10 files
├── cli/              112 files (20.7%) - CLI and TUI
├── shared/            52 files (9.6%)  - Shared utilities
├── continuity/         5 files (0.9%)  - Session continuity
├── util/               4 files (0.7%)  - Utilities
├── tool/               4 files (0.7%)  - Tool definitions
├── session/            3 files (0.6%)  - Session management
├── file/               3 files (0.6%)  - File operations
└── (10 other dirs)    16 files (2.9%)
```

---

## 2. ACTUAL CLAUDE CODE INTEGRATION (Verified)

### 2.1 Session Continuity System

**File:** `/src/runtime/session/continuity/index.ts`

```typescript
const TOOL_PATHS: Record<ToolType, string[]> = {
  claude_code: [
    "~/.claude/projects",
    "~/.claude-code/sessions",
  ],
}

// parseSessionPath() calls ToolParsers.parseClaudeCode()
```

### 2.2 Claude Code Session Parser

**File:** `/src/runtime/session/continuity/parsers/index.ts` (lines 52-115)

**Functionality:**
- Reads `messages.jsonl` from Claude Code sessions
- Parses `project.json` for workspace info
- Extracts conversation title from first user message
- Counts messages for metadata

### 2.3 Type Definitions

**File:** `/src/runtime/session/continuity/types.ts`

```typescript
export type ToolType =
  | "gizzi"
  | "claude_code"      // ✅ Supported
  | "codex"
  | "copilot"
  | "cursor"
  | "gemini_cli"
  | "droid"
  | "gizzi_shell"
  | "qwen"
  | "kimi"
  | "minimax"
  | "glm"
  | "unknown"
```

### 2.4 Feature Flags

**File:** `/src/runtime/context/flag/flag.ts`

```typescript
export const GIZZI_DISABLE_CLAUDE_CODE = truthy("GIZZI_DISABLE_CLAUDE_CODE")
export const GIZZI_DISABLE_CLAUDE_CODE_PROMPT =
  GIZZI_DISABLE_CLAUDE_CODE || truthy("GIZZI_DISABLE_CLAUDE_CODE_PROMPT")
export const GIZZI_DISABLE_CLAUDE_CODE_SKILLS =
  GIZZI_DISABLE_CLAUDE_CODE || truthy("GIZZI_DISABLE_CLAUDE_CODE_SKILLS")
```

### 2.5 Instruction File Loading

**File:** `/src/runtime/session/instruction.ts` (lines 17, 124-125)

```typescript
const INSTRUCTION_FILES = [
  "CLAUDE.md",  // ✅ Loads CLAUDE.md from project root
  // ...
]

if (!Flag.GIZZI_DISABLE_CLAUDE_CODE_PROMPT) {
  files.push(path.join(os.homedir(), ".claude", "CLAUDE.md"))  // Global CLAUDE.md
}
```

### 2.6 Skill Discovery

**File:** `/src/runtime/skills/skill.ts` (lines 46-47, 104)

```typescript
const EXTERNAL_DIRS = [".claude", ".agents", ".openclaw"]

// Scan .claude/skills/, .agents/skills/, etc.
```

### 2.7 Built-in Skills

**File:** `/src/runtime/skills/builtin.ts` (lines 5-6)

```typescript
/**
 * Built-in Skills - Copied from Claude Code's builtin plugins
 * — these are the real Anthropic & Partners plugin skills copied from Claude Code
 */
```

### 2.8 Model-Specific Handling

**File:** `/src/runtime/session/system.ts` (line 38)

```typescript
if (model.api.id.includes("claude")) basePrompts.push(PROMPT_ANTHROPIC)
```

**File:** `/src/runtime/session/message-v2.ts` (line 607)

```typescript
// Anthropic/Claude APIs require every tool_use to have a corresponding tool_result
```

### 2.9 OAuth Integration

**File:** `/src/runtime/providers/oauth/index.ts`

```typescript
export { anthropicOAuth, refreshAnthropicToken } from "./anthropic"
export { openaiOAuth, refreshOpenAIToken } from "./openai"
export { googleOAuth, refreshGoogleToken } from "./google"

export const BUILTIN_OAUTH: Record<string, OAuthFlow> = {
  anthropic: anthropicOAuth,
  openai: openaiOAuth,
  google: googleOAuth,
}
```

### 2.10 AI SDK Integration

**File:** `/package.json`

```json
{
  "@ai-sdk/anthropic": "2.0.65",
  "@ai-sdk/google": "2.0.54",
  "@ai-sdk/mistral": "2.0.27",
  "@ai-sdk/openai": "2.0.89",
  "@ai-sdk/provider": "2.0.1",
  "ai": "5.0.124"
}
```

---

## 3. ACTUAL BARREL FILES (53 Total)

### Critical Barrel Files (HIGH Impact)

| Path | Exports | Severity |
|------|---------|----------|
| `/src/runtime/session/index.ts` | 30+ exports | **CRITICAL** |
| `/src/runtime/verification/index.ts` | 50+ exports | **CRITICAL** |
| `/src/runtime/verification/types/index.ts` | 30+ exports | **CRITICAL** |
| `/src/runtime/tools/mcp/index.ts` | 20+ exports | **HIGH** |
| `/src/runtime/sidecar/index.ts` | 10+ exports | **HIGH** |
| `/src/runtime/integrations/pty/index.ts` | 15+ exports | **HIGH** |
| `/src/runtime/context/worktree/index.ts` | 20+ exports | **HIGH** |
| `/src/cli/ui/components/gizzi/index.ts` | 12 exports | **HIGH** |
| `/src/cli/ui/components/animation/index.ts` | 15+ exports | **HIGH** |
| `/src/cli/sessions/index.ts` | 10+ exports | **HIGH** |

### Example Barrel File Contents

**`/src/session/index.ts`** (3 lines):
```typescript
export * from "../runtime/session"
```

**`/src/agent-workspace/index.ts`** (4 lines):
```typescript
export * from "../runtime/memory/memory"
export * from "../runtime/loop/boot"
export * from "../runtime/session/resume"
export * from "../runtime/session/checkpoint"
```

**`/src/runtime/providers/oauth/index.ts`**:
```typescript
export { anthropicOAuth, refreshAnthropicToken } from "./anthropic"
export { githubCopilotOAuth } from "./github-copilot"
export { openaiOAuth, refreshOpenAIToken } from "./openai"
export { googleOAuth, refreshGoogleToken } from "./google"
```

---

## 4. ACTUAL SYSTEM_LAW VIOLATIONS

### 4.1 LAW-TSC-001: Project References

**Rule:** No single tsconfig.json may include more than 500 files.

**Current tsconfig.json:**
```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "include": [
    "src/**/*",      // 540 files ❌
    "test/**/*",
    "github/**/*",
    "packages/**/*",
    "sdks/**/*",
    "shared/**/*",
    "script/**/*"
  ]
}
```

**Violation:** 540 files > 500 limit (40 files over)

**Missing:** `composite: true` (0 configs have it)

### 4.2 LAW-TSC-002: Type Boundary Erasing

**Rule:** Third-party "heavy" types MUST NOT leak past their service layer.

**Leak Locations (6 files):**

1. **`/src/runtime/session/index.ts`** (line 29):
   ```typescript
   import type { LanguageModelV2Usage } from "@ai-sdk/provider"
   ```

2. **`/src/runtime/providers/adapters/bundled.ts`** (lines 13-19):
   ```typescript
   import { createAnthropic } from "@ai-sdk/anthropic"
   import { createGoogleGenerativeAI } from "@ai-sdk/google"
   import { createOpenAI } from "@ai-sdk/openai"
   import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
   import { createMistral } from "@ai-sdk/mistral"
   
   export type { LanguageModelV2 } from "@ai-sdk/provider"  // ❌ LEAKS
   ```

3. **`/src/runtime/providers/adapters/transform.ts`** (line 4):
   ```typescript
   import type { JSONSchema7 } from "@ai-sdk/provider"
   ```

4. **`/src/runtime/providers/adapters/subprocess-model.ts`** (line 23):
   ```typescript
   } from "@ai-sdk/provider"  // Multiple type imports
   ```

5. **`/src/runtime/session/index.ts`** (line 8):
   ```typescript
   import { type ProviderMetadata } from "ai"
   ```

6. **`/src/runtime/tools/mcp/index.ts`** (line 1):
   ```typescript
   import { dynamicTool, type Tool, jsonSchema, type JSONSchema7 } from "ai"
   ```

### 4.3 LAW-TSC-003: Barrel Files

**Rule:** Barrel files (`index.ts` re-exports) are FORBIDDEN in `src/`.

**Violation:** 53 barrel files found (see Section 3 for complete list)

### 4.4 LAW-TSC-004: Isolated Modules

**Rule:** `isolatedModules: true` is mandatory.

**Status:** ✅ Inherited from `@tsconfig/bun/tsconfig.json`

---

## 5. CORRECTED EXECUTION PLAN

### Phase 1: Project References (1-2 days)

**Goal:** Split 540 files into 5 composite projects

#### Task 1.1: Create Sub-Project tsconfigs

```bash
# Create these tsconfig.json files:
src/runtime/tsconfig.json
src/cli/tsconfig.json
src/shared/tsconfig.json
src/continuity/tsconfig.json
src/verification/tsconfig.json
```

**Template:**
```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "../../.build/{name}",
    "rootDir": ".",
    "isolatedModules": true
  },
  "include": ["./**/*"],
  "exclude": ["node_modules", "../../.build"]
}
```

#### Task 1.2: Update Root tsconfig

```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "."
  },
  "references": [
    { "path": "./src/shared" },
    { "path": "./src/runtime" },
    { "path": "./src/cli" },
    { "path": "./src/continuity" },
    { "path": "./src/verification" }
  ],
  "include": [],  // Empty - all via references
  "exclude": ["node_modules", ".build", "test"]
}
```

#### Task 1.3: Create Test tsconfig

```json
// test/tsconfig.json
{
  "extends": "../tsconfig.json",
  "include": ["./**/*"],
  "references": [
    { "path": "../src/shared" },
    { "path": "../src/runtime" },
    { "path": "../src/cli" }
  ]
}
```

### Phase 2: Barrel File Elimination (2-3 days)

**Goal:** Remove all 53 barrel files

#### Task 2.1: Priority Order

| Priority | Barrel Files | Impact |
|----------|-------------|--------|
| **P0** | `/src/session/index.ts`, `/src/mcp/index.ts`, `/src/file/index.ts`, `/src/auth/index.ts` | Quick wins (1-4 exports each) |
| **P1** | `/src/agent-workspace/index.ts`, `/src/cli/sessions/index.ts` | Medium impact |
| **P2** | `/src/runtime/session/index.ts`, `/src/cli/ui/components/gizzi/index.ts` | High impact |
| **P3** | `/src/runtime/verification/index.ts`, `/src/runtime/verification/types/index.ts` | Complex (50+ exports) |

#### Task 2.2: Find Import Sites

```bash
# For each barrel file, find importers
grep -r "from '@/session'" --include="*.ts" src/
grep -r "from '@/runtime/session'" --include="*.ts" src/
grep -r "from '@/cli/sessions'" --include="*.ts" src/
```

#### Task 2.3: Codemod Pattern

**Before:**
```typescript
import { Session, Message, createSession } from '@/session'
import { Tool, Skill, registry } from '@/tool'
```

**After:**
```typescript
import { Session } from '@/runtime/session/session'
import { Message } from '@/runtime/session/message-v2'
import { createSession } from '@/runtime/session/factory'
import { Tool } from '@/runtime/tools/builtins/tool'
import { Skill } from '@/runtime/skills/skill'
import { registry } from '@/runtime/tools/builtins/registry'
```

#### Task 2.4: Delete Barrel Files

```bash
# After all imports are migrated
rm src/session/index.ts
rm src/mcp/index.ts
rm src/file/index.ts
rm src/auth/index.ts
rm src/agent-workspace/index.ts
# ... (53 files total)
```

### Phase 3: Type Boundary Erasure (1-2 days)

**Goal:** Isolate @ai-sdk types to bundled.ts only

#### Task 3.1: Create Local Type Boundaries

```typescript
// src/runtime/types/model.ts
/**
 * Local model interface - erases AI SDK types
 */
export interface AIModel {
  id: string
  provider: string
  complete(prompt: string, options?: ModelOptions): Promise<string>
  stream(prompt: string, options?: ModelOptions): AsyncIterable<string>
}

export interface ModelOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
}
```

#### Task 3.2: Create Adapter Layer

```typescript
// src/runtime/providers/adapters/bundled.ts (MODIFIED)
import { generateText, streamText } from 'ai'
import type { LanguageModelV2 } from '@ai-sdk/provider'  // ✅ ONLY FILE ALLOWED
import type { AIModel } from '../../types/model'

export class BundledAdapter implements AIModel {
  constructor(private model: LanguageModelV2) {}
  
  async complete(prompt: string): Promise<string> {
    const { text } = await generateText({ model: this.model, prompt })
    return text  // Returns string, not AI SDK types
  }
  
  async *stream(prompt: string): AsyncIterable<string> {
    const { textStream } = await streamText({ model: this.model, prompt })
    for await (const chunk of textStream) {
      yield chunk
    }
  }
}

// DO NOT export LanguageModelV2 - export only AIModel
export { BundledAdapter }
```

#### Task 3.3: Update Importers

```typescript
// BEFORE (violates LAW-TSC-002):
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { createAnthropic } from '@ai-sdk/anthropic'

// AFTER (compliant):
import type { AIModel } from '@/runtime/types/model'
import { BundledAdapter } from '@/runtime/providers/adapters/bundled'
```

### Phase 4: Validation (1 day)

#### Task 4.1: Incremental Build Test

```bash
# Build individual projects
bun tsc -b src/shared/tsconfig.json    # Should be <2s
bun tsc -b src/runtime/tsconfig.json   # Should be <5s
bun tsc -b src/cli/tsconfig.json       # Should be <3s

# Total should be <10s vs timeout before
```

#### Task 4.2: Full Build Test

```bash
# Clean build
rm -rf .build && bun tsc -b

# Should complete in <15s
```

#### Task 4.3: Memory Test

```bash
# Typecheck with 4GB limit (was OOM at 16GB)
NODE_OPTIONS="--max-old-space-size=4096" bun tsc --noEmit

# Should pass without OOM
```

#### Task 4.4: Verify SYSTEM_LAW Compliance

```bash
# Check for barrel files (should be 0)
find src -name "index.ts" | wc -l

# Check for composite: true (should be 5+)
grep -r "composite.*true" --include="tsconfig*.json" src/ | wc -l

# Check for @ai-sdk imports (should be 1 file: bundled.ts)
grep -r "@ai-sdk" --include="*.ts" src/ | grep -v bundled.ts | wc -l
```

---

## 6. SUCCESS METRICS

| Metric | Before | Target | After |
|--------|--------|--------|-------|
| Files per tsconfig | 540 | <500 | TBD |
| Barrel files | 53 | 0 | TBD |
| Project references | 0 | 5 | TBD |
| @ai-sdk type leaks | 6 files | 1 file | TBD |
| Typecheck time | Timeout | <15s | TBD |
| Memory usage | Unknown | <4GB | TBD |

---

## 7. CLAUDE CODE INTEGRATION SUMMARY

Gizzi-Code has **deep, production-grade Claude Code integration**:

| Feature | Status |
|---------|--------|
| Session discovery (`~/.claude/`) | ✅ Implemented |
| Session parsing (messages.jsonl) | ✅ Implemented |
| CLAUDE.md instruction loading | ✅ Implemented |
| Skill discovery (`.claude/skills/`) | ✅ Implemented |
| Built-in skills (from Claude Code) | ✅ Implemented |
| OAuth (Anthropic) | ✅ Implemented |
| Model-specific prompts | ✅ Implemented |
| Token pricing (Claude) | ✅ Implemented |
| Feature flags | ✅ Implemented |

**This is NOT superficial integration** - it's a core supported tool alongside Gizzi's native runtime.

---

## 8. COMMAND REFERENCE

### Build Commands
```bash
# Individual project
bun tsc -b src/runtime/tsconfig.json

# Full build
bun tsc -b

# Clean build
rm -rf .build && bun tsc -b --force

# Typecheck only
bun tsc --noEmit
```

### Analysis Commands
```bash
# Find barrel files
find src -name "index.ts"

# Find re-exports
grep -r "export \* from" src/

# Find @ai-sdk imports
grep -r "@ai-sdk" --include="*.ts" src/

# Count files per directory
find src -name "*.ts" | cut -d'/' -f2 | sort | uniq -c
```

---

## 9. NEXT STEPS

1. **Backup current tsconfig.json**
2. **Start Phase 1** - Create 5 sub-project tsconfigs
3. **Daily validation** - Ensure each phase builds
4. **Update this document** with actual metrics after each phase

---

**Document Authority:** This plan derives from SYSTEM_LAW.md Part XV. Any deviation requires explicit LAW amendment.

**Corrections from Initial Analysis:**
- File count: 27,579 → **540** (initial was counting node_modules)
- Barrel files: 166+ → **53** (initial was counting all index.ts including node_modules)
- Claude Code integration: **Much deeper than initially reported** (full session parsing, OAuth, skills, etc.)
