# Gizzi-Code TypeScript Scaling Game Plan

**Authority:** SYSTEM_LAW.md Part XV (TypeScript & Scaling Law)  
**Target:** `cmd/gizzi-code`  
**Date:** 2026-03-31  
**Status:** Analysis Complete - Ready for Execution

---

## 1. Current State Analysis

### 1.1 Codebase Metrics
| Metric | Value | LAW Limit | Status |
|--------|-------|-----------|--------|
| TypeScript files | ~27,579 | N/A | ⚠️ MASSIVE |
| Barrel files (index.ts) | 55+ | 0 in src/ | ❌ VIOLATION |
| tsconfig includes | 7 directories | 500 files | ❌ VIOLATION |
| Re-exports (`export * from`) | 53+ found | 0 in src/ | ❌ VIOLATION |

### 1.2 Current tsconfig.json
```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "include": [
    "src/**/*",      // ❌ Too broad
    "test/**/*",     // ❌ Tests in typecheck
    "github/**/*",   // ❌ CI/CD code
    "packages/**/*", // ❌ Monorepo packages
    "sdks/**/*",     // ❌ SDK code
    "shared/**/*",   // ❌ Shared utilities
    "script/**/*"    // ❌ Build scripts
  ]
}
```

**Problem:** Single monolithic tsconfig loading 27k+ files simultaneously = OOM guaranteed.

---

## 2. SYSTEM_LAW Violations

### LAW-TSC-001: Project References (Structural Segmentation)
**Rule:** No single `tsconfig.json` may include more than 500 files.

**Current Violation:**
- Single tsconfig includes ALL source files (~27k+)
- No `composite: true` anywhere
- No project references structure

**Impact:** TypeScript compiler must load entire codebase into memory for every type check.

### LAW-TSC-002: Type Boundary Erasing (Complexity Isolation)
**Rule:** Third-party "heavy" types MUST NOT leak past their service layer.

**Current Violation:**
- Direct imports from `@ai-sdk/*` throughout codebase
- AI SDK types exposed in session/tool interfaces
- No boundary adapter layer

**Impact:** Type graph explodes with AI SDK's complex inferred types.

### LAW-TSC-003: Barrel File Elimination (Graph Reduction)
**Rule:** "Barrel files" (`index.ts` re-exports) are FORBIDDEN within `src/`.

**Current Violation:**
```
src/session/index.ts          → export * from "../runtime/session"
src/tool/index.ts             → export * from "../runtime/tools/builtins"
src/agent-workspace/index.ts  → 4 re-exports
src/shared/index.ts           → multiple re-exports
... (55+ total barrel files)
```

**Impact:** Importing one file loads entire module trees.

### LAW-TSC-004: Isolated Modules & Fast Transpilation
**Rule:** All code must support per-file transpilation (`isolatedModules: true`).

**Current Status:**
- ✅ Extends `@tsconfig/bun` which has `isolatedModules: true`
- ⚠️ Need to verify no `enum` or `namespace` usage

---

## 3. Target Architecture

### 3.1 Project Reference Graph
```
gizzi-code (root)
├── packages/ (monorepo packages with composite: true)
│   ├── sdk/
│   ├── plugin/
│   ├── script/
│   └── util/
├── sdks/ (external SDK adapters - composite: true)
├── src/ (main application)
│   ├── cli/ (TUI surface - composite: true)
│   ├── runtime/ (core logic - composite: true)
│   ├── session/ (session management - composite: true)
│   ├── agent/ (agent logic - composite: true)
│   ├── tool/ (tool system - composite: true)
│   └── shared/ (utilities - composite: true)
└── test/ (separate typecheck, not in build)
```

### 3.2 Package Structure Example
```json
// src/runtime/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "../../.build/runtime",
    "rootDir": ".",
    "isolatedModules": true
  },
  "include": ["./**/*"],
  "exclude": ["node_modules", "../../.build"]
}
```

---

## 4. Execution Plan

### Phase 1: Foundation (Days 1-2)
**Goal:** Establish project reference infrastructure

#### Task 1.1: Create Package tsconfigs
```bash
# Create tsconfig for each layer
src/cli/tsconfig.json
src/runtime/tsconfig.json
src/session/tsconfig.json
src/agent/tsconfig.json
src/tool/tsconfig.json
src/shared/tsconfig.json
packages/*/tsconfig.json
sdks/*/tsconfig.json
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
    { "path": "./packages/sdk" },
    { "path": "./packages/plugin" },
    { "path": "./packages/script" },
    { "path": "./packages/util" },
    { "path": "./sdks" },
    { "path": "./src/shared" },
    { "path": "./src/runtime" },
    { "path": "./src/session" },
    { "path": "./src/agent" },
    { "path": "./src/tool" },
    { "path": "./src/cli" }
  ],
  "include": [],  // Empty - all via references
  "exclude": ["node_modules", ".build", "test"]
}
```

#### Task 1.3: Create Test-Specific tsconfig
```json
// test/tsconfig.json
{
  "extends": "../tsconfig.json",
  "include": ["./**/*"],
  "references": [
    { "path": "../src/cli" },
    { "path": "../src/runtime" }
  ]
}
```

### Phase 2: Barrel File Elimination (Days 3-5)
**Goal:** Remove all 55+ barrel files from src/

#### Task 2.1: Identify Import Sites
```bash
# Find all barrel imports
grep -r "from '@/session'" --include="*.ts" --include="*.tsx" src/
grep -r "from '@/tool'" --include="*.ts" --include="*.tsx" src/
grep -r "from '@/runtime'" --include="*.ts" --include="*.tsx" src/
```

#### Task 2.2: Codemod - Direct Path Conversion
**Before:**
```typescript
import { Session, Message } from '@/session';
import { Tool, Skill } from '@/tool';
```

**After:**
```typescript
import { Session } from '@/session/session';
import { Message } from '@/session/message-v2';
import { Tool } from '@/tool/tool';
import { Skill } from '@/tool/skill';
```

#### Task 2.3: Delete Barrel Files
```bash
rm src/session/index.ts
rm src/tool/index.ts
rm src/agent-workspace/index.ts
# ... (55+ files)
```

### Phase 3: Type Boundary Erasure (Days 6-8)
**Goal:** Isolate heavy third-party types

#### Task 3.1: Create Type Boundaries
```typescript
// src/runtime/types/ai-provider.ts
// ❌ BAD: Leaking AI SDK types
import { LanguageModelV1 } from '@ai-sdk/provider';
export type { LanguageModelV1 };

// ✅ GOOD: Local boundary type
export interface AIProvider {
  complete(prompt: string): Promise<string>;
  stream(prompt: string): AsyncIterable<string>;
}
```

#### Task 3.2: Adapter Layer
```typescript
// src/runtime/adapters/ai-sdk-adapter.ts
import { generateText } from 'ai';
import type { AIProvider } from '../types/ai-provider';

export class AISDKAdapter implements AIProvider {
  async complete(prompt: string): Promise<string> {
    const { text } = await generateText({ /* ... */ });
    return text; // Return simple string, not AI SDK types
  }
}
```

### Phase 4: Validation (Days 9-10)
**Goal:** Verify compliance with SYSTEM_LAW

#### Task 4.1: Incremental Build Test
```bash
# Build individual packages
bun tsc -b src/runtime/tsconfig.json
bun tsc -b src/session/tsconfig.json

# Should complete in <5 seconds each
```

#### Task 4.2: Full Build Test
```bash
# Build all with project references
bun tsc -b

# Should complete in <30 seconds (vs timeout before)
```

#### Task 4.3: Memory Test
```bash
# Typecheck with memory limit
NODE_OPTIONS="--max-old-space-size=4096" bun tsc --noEmit

# Should pass without OOM (was failing at 16GB before)
```

---

## 5. Risk Mitigation

### Risk 1: Breaking Changes During Refactor
**Mitigation:**
- Keep changes backward-compatible where possible
- Update exports gradually, not all at once
- Maintain old paths with deprecation warnings

### Risk 2: Circular Dependencies
**Mitigation:**
- Use dependency graph visualization
- Enforce layer boundaries (cli → runtime → shared, never reverse)
- Add `madge` to CI for cycle detection

### Risk 3: Build Performance Regression
**Mitigation:**
- Benchmark before/after each phase
- Use `--diagnostics` flag to identify slow files
- Consider SWC for development builds

---

## 6. Success Metrics

| Metric | Before | Target | After |
|--------|--------|--------|-------|
| Typecheck time | Timeout | <30s | TBD |
| Memory usage | 16GB+ OOM | <4GB | TBD |
| Barrel files | 55+ | 0 | TBD |
| Project refs | 0 | 11+ | TBD |

---

## 7. Command Reference

### Build Commands
```bash
# Individual package
bun tsc -b src/runtime/tsconfig.json

# Full build
bun tsc -b

# Clean build
rm -rf .build && bun tsc -b --force

# Typecheck only (no emit)
bun tsc --noEmit
```

### Analysis Commands
```bash
# Find barrel files
find src -name "index.ts" -o -name "index.tsx"

# Find re-exports
grep -r "export \* from" src/

# Count files per directory
find src -name "*.ts" | wc -l
```

---

## 8. Next Steps

1. **Create Phase 1 todos** in task tracker
2. **Backup current tsconfig.json**
3. **Start with packages/** (lowest risk)
4. **Progress inward** to src/shared, src/runtime, src/cli
5. **Daily validation** - ensure each phase builds successfully

---

**Document Authority:** This plan derives from SYSTEM_LAW.md Part XV. Any deviation requires explicit LAW amendment.
