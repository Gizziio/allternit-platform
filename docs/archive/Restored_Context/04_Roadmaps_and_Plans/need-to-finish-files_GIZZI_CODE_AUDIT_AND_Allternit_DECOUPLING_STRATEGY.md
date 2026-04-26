# Gizzi-Code Architecture Audit & Allternit Native Decoupling Strategy

**Date:** March 6, 2026  
**Auditor:** AI Architecture Analysis  
**Scope:** Complete audit of gizzi-code, node_modules dependencies, and Allternit integration strategy

---

## Executive Summary

Gizzi-Code is a **Terminal UI (TUI) application** built as part of the Allternit (Agent Runner) ecosystem. It serves as the CLI interface for agent orchestration, skills management, and runtime execution. The codebase is currently structured as a **monolithic workspace package** with tight coupling to multiple AI providers, runtime services, and Allternit infrastructure.

### Key Findings

1. **Node Modules Size:** 560MB of dependencies
2. **Total Dependencies:** 80+ direct dependencies, 258k+ files in gizzi-code ecosystem
3. **Architecture Pattern:** Monorepo with 4 internal workspace packages
4. **Allternit Integration:** Deep coupling with Allternit runtime, governance, and skills systems
5. **Primary Concerns:** Tight coupling, large dependency footprint, unclear separation between TUI and runtime logic

---

## 1. Current Architecture Analysis

### 1.1 Package Structure

```
@allternit/gizzi-code/
├── packages/
│   ├── @allternit/sdk      # SDK for client/server communication
│   ├── @allternit/util     # Utility functions (error, lazy, fn, binary, slug)
│   ├── @allternit/plugin   # Plugin system (depends on @allternit/sdk)
│   └── @allternit/script   # Script execution layer
├── src/
│   ├── cli/          # CLI commands and TUI interface
│   │   ├── commands/ # CLI commands (run, generate, connect, skills, etc.)
│   │   ├── ui/       # TUI components (SolidJS-based)
│   │   ├── bootstrap/# Boot sequence initialization
│   │   └── platform/ # Platform-specific code
│   └── runtime/      # Runtime logic (PROBLEM: Should be separate)
│       ├── auth/
│       ├── automation/
│       ├── context/
│       ├── hooks/
│       ├── integrations/
│       ├── kernel/   # ⚠️ Kernel logic in TUI package
│       ├── loop/
│       ├── memory/
│       ├── models/
│       ├── providers/
│       ├── server/
│       ├── session/
│       ├── sidecar/
│       ├── skills/
│       ├── tools/
│       └── workspace/
└── node_modules/     # 560MB of dependencies
```

### 1.2 Dependency Analysis

#### Core AI/LLM Dependencies (23 packages)
```json
{
  "@ai-sdk/amazon-bedrock": "3.0.82",
  "@ai-sdk/anthropic": "2.0.65",
  "@ai-sdk/azure": "2.0.91",
  "@ai-sdk/cerebras": "1.0.36",
  "@ai-sdk/cohere": "2.0.22",
  "@ai-sdk/deepinfra": "1.0.36",
  "@ai-sdk/gateway": "2.0.30",
  "@ai-sdk/google": "2.0.54",
  "@ai-sdk/google-vertex": "3.0.106",
  "@ai-sdk/groq": "2.0.34",
  "@ai-sdk/mistral": "2.0.27",
  "@ai-sdk/openai": "2.0.89",
  "@ai-sdk/openai-compatible": "1.0.32",
  "@ai-sdk/perplexity": "2.0.23",
  "@ai-sdk/provider": "2.0.1",
  "@ai-sdk/provider-utils": "3.0.21",
  "@ai-sdk/togetherai": "1.0.34",
  "@ai-sdk/vercel": "1.0.33",
  "@ai-sdk/xai": "2.0.51",
  "@gitlab/gitlab-ai-provider": "3.6.0",
  "@openrouter/ai-sdk-provider": "1.5.4",
  "ai": "5.0.124",
  "ai-gateway-provider": "2.3.1"
}
```

**Issue:** TUI package should NOT directly depend on AI providers. This should be in a separate runtime/orchestration layer.

#### Protocol & Integration Dependencies (8 packages)
```json
{
  "@agentclientprotocol/sdk": "0.14.1",
  "@modelcontextprotocol/sdk": "1.25.2",
  "@actions/core": "1.11.1",
  "@actions/github": "6.0.1",
  "@octokit/graphql": "9.0.2",
  "@octokit/rest": "*",
  "@gitlab/opencode-gitlab-auth": "1.3.3",
  "vscode-languageserver-protocol": "^3.17.5"
}
```

#### UI/TUI Dependencies (6 packages)
```json
{
  "@clack/prompts": "1.0.0-alpha.1",
  "@opentui/core": "0.1.79",
  "@opentui/solid": "0.1.79",
  "@solid-primitives/event-bus": "1.1.2",
  "@solid-primitives/scheduled": "1.5.2",
  "solid-js": "*",
  "opentui-spinner": "0.0.6"
}
```

#### Database & State (4 packages)
```json
{
  "drizzle-orm": "1.0.0-beta.12-a5629fb",
  "drizzle-kit": "1.0.0-beta.12-a5629fb",
  "@openauthjs/openauth": "*",
  "better-sqlite3": (implicit via drizzle)
}
```

#### File System & Watchers (7 packages)
```json
{
  "@parcel/watcher": "2.5.1",
  "chokidar": "4.0.3",
  "glob": "13.0.5",
  "ignore": "7.0.5",
  "minimatch": "10.0.3",
  "tree-sitter-bash": "0.25.0",
  "web-tree-sitter": "0.25.10"
}
```

#### Web Framework (3 packages)
```json
{
  "hono": "*",
  "@hono/standard-validator": "0.1.5",
  "@hono/zod-validator": "*",
  "hono-openapi": "*"
}
```

#### Utility Libraries (15+ packages)
```json
{
  "zod": "4.3.6",
  "zod-to-json-schema": "3.24.5",
  "remeda": "*",
  "diff": "*",
  "decimal.js": "10.5.0",
  "fuzzysort": "3.1.0",
  "gray-matter": "4.0.3",
  "jsonc-parser": "3.3.1",
  "mime-types": "3.0.2",
  "partial-json": "0.1.7",
  "strip-ansi": "7.1.2",
  "turndown": "7.2.0",
  "ulid": "*",
  "yargs": "18.0.0",
  "clipboardy": "4.0.0"
}
```

### 1.3 Workspace Package Relationships

```
@allternit/gizzi-code (main)
    ├── @allternit/sdk (workspace:*)
    ├── @allternit/util (workspace:*)
    ├── @allternit/plugin (workspace:*) → @allternit/sdk
    └── @allternit/script (workspace:*)

External Dependencies:
    ├── AI Providers (23 packages) → Should be in @allternit/providers
    ├── Protocols (MCP, ACP) → Should be in @allternit/protocols
    ├── UI/TUI → Should be ONLY in gizzi-code TUI layer
    ├── Database → Should be in @allternit/runtime or separate
    ├── Hono (Web Server) → Should be in @allternit/runtime
    └── File System → Can stay in gizzi-code
```

---

## 2. Allternit Architecture Alignment

### 2.1 Allternit 5-Layer Model (From Architecture Docs)

```
Layer 1: Cognitive Persistence (BRAIN.md, MEMORY.md)
Layer 2: Identity Stabilization (IDENTITY.md, SOUL.md, USER.md)
Layer 3: Governance & Decision (AGENTS.md, POLICY.md, TOOLS.md)
Layer 4: Modular Skills (skills/, contracts/)
Layer 5: Business Topology (clients/, projects/)
```

### 2.2 Current Gizzi-Code Mapping

| Allternit Layer | Gizzi-Code Location | Status |
|-----------|---------------------|--------|
| Layer 1 | `src/runtime/memory/`, `.local/share/gizzi-code/` | ⚠️ Mixed with runtime logic |
| Layer 2 | `src/runtime/context/`, `src/shared/brand/` | ⚠️ Tightly coupled to TUI |
| Layer 3 | `src/runtime/kernel/`, `src/runtime/hooks/` | ❌ In TUI package (should be separate) |
| Layer 4 | `src/runtime/skills/`, `src/cli/commands/skills` | ⚠️ Mixed concerns |
| Layer 5 | Not implemented | ❌ Missing |

### 2.3 Allternit Boot Sequence (21-Phase)

Current gizzi-code boot sequence (from `src/cli/main.ts`):

```typescript
1. Log initialization
2. Database migration
3. CLI command registration
4. TUI attachment
```

**Expected Allternit Boot Sequence:**
```
B0 - Deterministic Boot Order (21 phases)
├── PHASE 1: SYSTEM INITIALIZATION
│   ├── 1. Lock Acquisition
│   ├── 2. Load Manifest
│   └── 3. Crash Recovery
├── PHASE 2: IDENTITY & GOVERNANCE
│   ├── 4. Load IDENTITY.md
│   ├── 5. Load AGENTS.md
│   ├── 6. Load SOUL.md
│   └── 7. Load USER.md
├── PHASE 3: ENVIRONMENT & TOOLS
│   ├── 8. Load TOOLS.md
│   ├── 9. Load SYSTEM.md
│   ├── 10. Load CHANNELS.md
│   └── 11. Load POLICY.md
├── PHASE 4: MEMORY HYDRATION
│   ├── 12-16. Load memory files
├── PHASE 5: CAPABILITIES
│   ├── 17. Index Skills
│   ├── 18. Load Tool Registry
│   └── 19. Load Provider Config
└── PHASE 6: CONTEXT BUILD
    ├── 20. Build Context Pack
    └── 21. Resume Work
```

**Gap:** Current implementation does NOT follow Allternit deterministic boot sequence.

---

## 3. Decoupling Strategy

### 3.1 Option A: Extract Runtime into Separate Package (RECOMMENDED)

**Goal:** Separate TUI (interface) from Runtime (orchestration logic)

```
@allternit/gizzi-code/           # TUI ONLY
├── src/
│   ├── cli/
│   │   ├── commands/     # Thin wrappers calling @allternit/runtime
│   │   └── ui/           # TUI components (SolidJS)
│   └── shared/
├── dependencies:
│   ├── @allternit/runtime      # NEW: Runtime logic
│   ├── @opentui/core
│   ├── @clack/prompts
│   └── Minimal utilities
└── Size: ~50MB (down from 560MB)

@allternit/runtime/              # NEW PACKAGE
├── src/
│   ├── kernel/           # Agent kernel
│   ├── orchestration/    # Workflow engine
│   ├── skills/           # Skills system
│   ├── memory/           # Memory management
│   ├── context/          # Context building
│   ├── providers/        # AI provider abstraction
│   ├── server/           # Hono server
│   └── database/         # Drizzle ORM
├── dependencies:
│   ├── All AI providers
│   ├── Hono
│   ├── Drizzle
│   └── MCP/ACP protocols
└── Size: ~500MB

@allternit/governance/           # FUTURE: Separate governance
├── src/
│   ├── policy/           # Policy engine
│   ├── iam/              # Identity & access
│   ├── audit/            # Audit ledger
│   └── rails/            # Agent rails
└── Integrates with Rust kernel
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ TUI can be replaced (web UI, desktop UI, voice UI)
- ✅ Runtime can run headless (daemon mode)
- ✅ Smaller, focused dependencies per package
- ✅ Better testability
- ✅ Aligns with Allternit architecture

**Migration Steps:**
1. Create `@allternit/runtime` package structure
2. Move `src/runtime/*` from gizzi-code to runtime
3. Update imports in gizzi-code to use `@allternit/runtime`
4. Extract AI providers into runtime
5. Extract database layer into runtime
6. Extract Hono server into runtime
7. Keep only TUI-specific code in gizzi-code
8. Update workspace dependencies
9. Test both packages independently
10. Document API boundaries

---

### 3.2 Option B: Layered Architecture within Gizzi-Code

**Goal:** Maintain single package but enforce strict layering

```
@allternit/gizzi-code/
├── layers/
│   ├── 01-core/          # Pure utilities, no external deps
│   ├── 02-domain/        # Business logic, Allternit contracts
│   ├── 03-runtime/       # Agent runtime, AI providers
│   ├── 04-protocols/     # MCP, ACP, APIs
│   └── 05-ui/            # TUI components (depends on all below)
├── rules:
│   - Lower layers CANNOT import from higher layers
│   - UI layer is the ONLY layer that knows about TUI
│   - Runtime layer is the ONLY layer that knows about AI providers
└── Enforcement:
    - ESLint import rules
    - Build-time validation
    - Architecture tests
```

**Benefits:**
- ✅ No package restructuring
- ✅ Clearer boundaries
- ✅ Easier to extract later
- ✅ Maintains Allternit alignment

**Drawbacks:**
- ❌ Still monolithic
- ❌ Large dependency footprint
- ❌ Cannot run runtime without TUI

---

### 3.3 Option C: Microservices Architecture

**Goal:** Split into independent services

```
@allternit/tui/              # Terminal UI (communicates via RPC)
@allternit/runtime-daemon/   # Headless runtime (JSON-RPC API)
@allternit/governance/       # Policy engine (separate service)
@allternit/skills/           # Skills registry (separate service)
```

**Benefits:**
- ✅ Maximum decoupling
- ✅ Independent scaling
- ✅ Language agnostic (Rust kernel, TS runtime)

**Drawbacks:**
- ❌ High complexity
- ❌ Network overhead
- ❌ Premature optimization for current scale

---

## 4. Allternit Native Implementation Plan

### 4.1 Phase 1: Foundation (Week 1-2)

**Goal:** Establish Allternit boot sequence and directory structure

```bash
# Create Allternit workspace structure
.allternit/
├── manifest.json
├── state/
│   ├── taskgraph.json
│   ├── checkpoints.jsonl
│   └── locks/
├── contracts/
│   ├── tools.registry.json
│   ├── skills.index.json
│   └── schemas/
├── context/
│   └── pack.current.json
└── memory/
    ├── active-tasks.md
    ├── lessons.md
    └── self-review.md

# Root level Allternit files
AGENTS.md          # Constitution
SOUL.md            # Style profile
USER.md            # User preferences
IDENTITY.md        # Agent identity
TOOLS.md           # Environment profile
SYSTEM.md          # System constraints
CHANNELS.md        # Channel config
POLICY.md          # Dynamic policies
HEARTBEAT.md       # Automation spec
MEMORY.md          # Curated memory
skills/            # Skill definitions
```

**Implementation:**
1. Create `.allternit/` directory structure in gizzi-code
2. Implement 21-phase boot sequence
3. Create context pack builder
4. Implement checkpoint system
5. Add crash recovery from checkpoints

### 4.2 Phase 2: Decoupling (Week 3-4)

**Goal:** Extract runtime into separate package

1. Create `@allternit/runtime` package
2. Move runtime logic:
   - `src/runtime/kernel/` → `@allternit/runtime/kernel/`
   - `src/runtime/skills/` → `@allternit/runtime/skills/`
   - `src/runtime/memory/` → `@allternit/runtime/memory/`
   - `src/runtime/providers/` → `@allternit/runtime/providers/`
   - `src/runtime/server/` → `@allternit/runtime/server/`
   - `src/runtime/database/` → `@allternit/runtime/database/`

3. Keep TUI logic in gizzi-code:
   - `src/cli/ui/` stays
   - `src/cli/commands/` becomes thin wrappers
   - `src/cli/bootstrap/` calls runtime boot

4. Update dependencies:
   - Remove AI providers from gizzi-code
   - Remove Hono from gizzi-code
   - Remove Drizzle from gizzi-code
   - Add `@allternit/runtime` as dependency

### 4.3 Phase 3: Allternit Alignment (Week 5-6)

**Goal:** Full Allternit 5-layer compliance

**Layer 1: Cognitive Persistence**
```typescript
// @allternit/runtime/memory/cognitive.ts
export class CognitivePersistence {
  async loadBrain(): Promise<BRAIN>
  async loadMemory(): Promise<MEMORY>
  async appendReceipt(receipt: Receipt): Promise<void>
  async checkpoint(): Promise<Checkpoint>
}
```

**Layer 2: Identity Stabilization**
```typescript
// @allternit/runtime/identity/index.ts
export class IdentityEngine {
  async loadIdentity(): Promise<IDENTITY>
  async loadSoul(): Promise<SOUL>
  async loadUserPrefs(): Promise<USER>
  async applyPolicyOverrides(): Promise<void>
}
```

**Layer 3: Governance & Decision**
```typescript
// @allternit/runtime/governance/index.ts
export class GovernanceEngine {
  async loadConstitution(): Promise<AGENTS>
  async loadPolicy(): Promise<POLICY>
  async validateToolUse(tool: Tool): Promise<Permission>
  async enforceRails(receipt: Receipt): Promise<void>
}
```

**Layer 4: Modular Skills**
```typescript
// @allternit/runtime/skills/registry.ts
export class SkillRegistry {
  async index(): Promise<SkillIndex>
  async load(skill: string): Promise<Skill>
  async invoke(skill: string, input: any): Promise<Output>
  async validate(contract: SkillContract): Promise<boolean>
}
```

**Layer 5: Business Topology**
```typescript
// @allternit/runtime/business/index.ts
export class BusinessTopology {
  async loadClients(): Promise<Client[]>
  async loadProjects(): Promise<Project[]>
  async getTenantContext(tenantId: string): Promise<Context>
}
```

### 4.4 Phase 4: Kernel Sync (Week 7-8)

**Goal:** Integrate with Rust governance kernel

```
┌─────────────────────────────────────────────────────────────┐
│                    Allternit Runtime (TypeScript)                 │
├─────────────────────────────────────────────────────────────┤
│  TUI Layer (gizzi-code)                                     │
│  - Terminal UI (SolidJS + OpenTUI)                         │
│  - CLI Commands                                             │
│  - User Interaction                                         │
├─────────────────────────────────────────────────────────────┤
│  Runtime Layer (@allternit/runtime)                               │
│  - Agent Orchestration                                      │
│  - Skills System                                            │
│  - Memory Management                                        │
│  - Context Building                                         │
│  - AI Provider Routing                                      │
├─────────────────────────────────────────────────────────────┤
│  Governance Bridge                                          │
│  - FFI to Rust Kernel                                       │
│  - Receipt Emission                                         │
│  - Policy Enforcement                                       │
│  - Audit Logging                                            │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Allternit Kernel (Rust)                              │
├─────────────────────────────────────────────────────────────┤
│  Governance Engine                                          │
│  - Deterministic Policy Enforcement                         │
│  - IAM & Tenancy                                            │
│  - Audit Ledger (Tamper-Evident)                           │
│  - Risk Assessment                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Dependency Optimization

### 5.1 Current State (560MB)

```
Total: 560MB
├── AI Providers: ~150MB (23 packages)
├── AWS SDK: ~100MB (multiple packages)
├── Azure SDK: ~80MB (multiple packages)
├── TUI Libraries: ~50MB
├── Database (Drizzle): ~30MB
├── Web Framework (Hono): ~20MB
├── File Watchers: ~40MB
├── Utilities: ~90MB (50+ packages)
```

### 5.2 Target State (After Decoupling)

```
@allternit/gizzi-code (TUI): ~50MB
├── TUI Libraries: ~50MB
├── Utilities: Minimal
└── @allternit/runtime: (peer dependency)

@allternit/runtime: ~500MB
├── AI Providers: ~150MB
├── AWS SDK: ~100MB
├── Azure SDK: ~80MB
├── Database: ~30MB
├── Web Framework: ~20MB
├── File Watchers: ~40MB
├── Protocols (MCP/ACP): ~30MB
└── Utilities: ~50MB
```

### 5.3 Optimization Strategies

1. **Lazy Loading AI Providers**
   ```typescript
   // Instead of importing all providers
   import { createOpenAI } from "@ai-sdk/openai"
   import { createAnthropic } from "@ai-sdk/anthropic"
   
   // Use dynamic imports
   async function getProvider(name: string) {
     switch (name) {
       case "openai":
         const { createOpenAI } = await import("@ai-sdk/openai")
         return createOpenAI()
       case "anthropic":
         const { createAnthropic } = await import("@ai-sdk/anthropic")
         return createAnthropic()
     }
   }
   ```

2. **Tree Shaking Utilities**
   ```typescript
   // Instead of importing entire libraries
   import * as R from "remeda"
   
   // Import only what you need
   import { pipe, map, filter } from "remeda"
   ```

3. **Remove Unused Platform-Specific Dependencies**
   ```json
   {
     "optionalDependencies": {
       "@parcel/watcher-darwin-arm64": "2.5.1",
       "@parcel/watcher-linux-x64-glibc": "2.5.1",
       "@parcel/watcher-win32-x64": "2.5.1"
     }
   }
   ```

4. **Bundle Size Analysis**
   ```bash
   # Install bundle analyzer
   bunx --bun vite-bundle-visualizer
   
   # Or use rollup-plugin-visualizer
   ```

---

## 6. Risk Assessment

### 6.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes during decoupling | High | Medium | Comprehensive test suite, semantic versioning |
| Performance regression | Medium | Low | Benchmark before/after, profile critical paths |
| Allternit boot sequence complexity | Medium | Medium | Incremental implementation, feature flags |
| Rust FFI complexity | High | Medium | Use established FFI patterns (napi-rs) |
| Dependency conflicts | Medium | High | Use workspace resolutions, lock files |

### 6.2 Architectural Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Over-engineering | High | Medium | Start with Option B (layered), evolve to Option A |
| Tight coupling remains | High | High | Enforce import boundaries, architecture tests |
| Allternit alignment drift | Medium | Medium | Regular architecture reviews, documentation |
| Skills system fragmentation | Medium | Low | Clear skill contract schema, versioning |

---

## 7. Implementation Roadmap

### Sprint 1-2: Foundation
- [ ] Create Allternit directory structure
- [ ] Implement 21-phase boot sequence
- [ ] Build context pack system
- [ ] Add checkpoint/recovery
- [ ] Write architecture tests

### Sprint 3-4: Decoupling
- [ ] Create `@allternit/runtime` package
- [ ] Move runtime logic
- [ ] Update dependencies
- [ ] Create thin CLI wrappers
- [ ] Test runtime independently

### Sprint 5-6: Allternit Layers
- [ ] Implement Layer 1 (Cognitive)
- [ ] Implement Layer 2 (Identity)
- [ ] Implement Layer 3 (Governance)
- [ ] Implement Layer 4 (Skills)
- [ ] Implement Layer 5 (Business)

### Sprint 7-8: Kernel Integration
- [ ] Design Rust FFI interface
- [ ] Implement receipt emission
- [ ] Add policy enforcement
- [ ] Build audit ledger
- [ ] End-to-end testing

### Sprint 9-10: Optimization
- [ ] Lazy load AI providers
- [ ] Tree shake utilities
- [ ] Remove unused dependencies
- [ ] Bundle size optimization
- [ ] Performance benchmarking

---

## 8. Success Metrics

### Quantitative
- [ ] TUI package size: <50MB (down from 560MB)
- [ ] Boot time: <2 seconds (from cold start)
- [ ] Memory usage: <200MB (idle runtime)
- [ ] Test coverage: >80%
- [ ] Build time: <30 seconds

### Qualitative
- [ ] Clear separation of concerns
- [ ] Allternit 5-layer compliance
- [ ] Replaceable UI layer
- [ ] Headless runtime mode
- [ ] Rust kernel integration
- [ ] Skills marketplace ready

---

## 9. Recommendations

### Immediate Actions (This Week)

1. **Create Architecture Decision Record (ADR)**
   - Document decision to decouple TUI from Runtime
   - Get team alignment on Option A (Extract Runtime)

2. **Set Up Workspace Structure**
   ```bash
   cmd/
   ├── gizzi-code/          # TUI only
   └── runtime/             # New runtime package
   ```

3. **Implement Allternit Boot Sequence**
   - Start with file loading (AGENTS.md, IDENTITY.md, etc.)
   - Build context pack
   - Add checkpoint system

4. **Add Architecture Tests**
   - Enforce import boundaries
   - Validate layer dependencies
   - Check Allternit file presence

### Medium-Term (Next Month)

1. **Complete Runtime Extraction**
2. **Implement All 5 Allternit Layers**
3. **Add Rust FFI Bridge**
4. **Optimize Dependencies**

### Long-Term (Next Quarter)

1. **Skills Marketplace Integration**
2. **Multi-Tenancy Support**
3. **Advanced Governance Features**
4. **Performance Optimization**

---

## 10. Conclusion

Gizzi-Code is a **well-structured but monolithic** TUI application that needs decoupling to align with Allternit architecture principles. The recommended approach is **Option A: Extract Runtime** into a separate package, which provides:

✅ Clear separation of concerns  
✅ Allternit 5-layer compliance  
✅ Replaceable UI layer  
✅ Headless runtime capability  
✅ Better testability  
✅ Optimized dependencies  

The migration should be **incremental** over 10 sprints, with each phase delivering value independently. The end result will be a **modular, Allternit-native architecture** that supports the long-term vision of deterministic agent orchestration.

---

## Appendix A: File Inventory

### Gizzi-Code Source Files

**CLI Commands (15 files)**
- `src/cli/commands/run.ts`
- `src/cli/commands/generate.ts`
- `src/cli/commands/connect.ts`
- `src/cli/commands/skills.ts`
- `src/cli/commands/upgrade.ts`
- `src/cli/commands/uninstall.ts`
- `src/cli/commands/models.ts`
- `src/cli/commands/serve.ts`
- `src/cli/commands/debug.ts`
- `src/cli/commands/stats.ts`
- `src/cli/commands/mcp.ts`
- `src/cli/commands/github.ts`
- `src/cli/commands/export.ts`
- `src/cli/commands/import.ts`
- `src/cli/commands/acp.ts`

**TUI Components (20+ files)**
- `src/cli/ui/tui/attach.ts`
- `src/cli/ui/tui/thread.ts`
- `src/cli/ui/tui/components/*`
- `src/cli/ui/tui/hooks/*`
- `src/cli/ui/tui/context/*`

**Runtime Modules (30+ files)**
- `src/runtime/kernel/*`
- `src/runtime/skills/*`
- `src/runtime/memory/*`
- `src/runtime/context/*`
- `src/runtime/providers/*`
- `src/runtime/server/*`
- `src/runtime/session/*`
- `src/runtime/tools/*`

**Shared Utilities (25+ files)**
- `src/shared/util/*`
- `src/shared/file/*`
- `src/shared/brand/*`
- `src/shared/installation/*`
- `src/shared/bus/*`

### Allternit Architecture Files (To Create)

**Root Level**
- `AGENTS.md` - Constitution
- `SOUL.md` - Style profile
- `USER.md` - User preferences
- `IDENTITY.md` - Agent identity
- `TOOLS.md` - Environment profile
- `SYSTEM.md` - System constraints
- `CHANNELS.md` - Channel config
- `POLICY.md` - Dynamic policies
- `HEARTBEAT.md` - Automation spec
- `MEMORY.md` - Curated memory

**Workspace Directory (.allternit/)**
- `.allternit/manifest.json`
- `.allternit/state/taskgraph.json`
- `.allternit/state/checkpoints.jsonl`
- `.allternit/contracts/tools.registry.json`
- `.allternit/contracts/skills.index.json`
- `.allternit/context/pack.current.json`
- `.allternit/memory/active-tasks.md`
- `.allternit/memory/lessons.md`
- `.allternit/memory/self-review.md`

---

## Appendix B: Dependency Graph

```mermaid
graph TD
    A[@allternit/gizzi-code TUI] --> B[@allternit/runtime]
    A --> C[@opentui/core]
    A --> D[@clack/prompts]
    A --> E[solid-js]
    
    B --> F[AI Providers 23x]
    B --> G[Hono]
    B --> H[Drizzle ORM]
    B --> I[MCP SDK]
    B --> J[ACP SDK]
    B --> K[AWS SDK]
    B --> L[Azure SDK]
    B --> M[@allternit/sdk]
    B --> N[@allternit/util]
    B --> O[@allternit/plugin]
    
    M --> N
    O --> M
    
    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style F fill:#fbb,stroke:#333
    style G fill:#fbb,stroke:#333
    style H fill:#fbb,stroke:#333
```

---

**Document Version:** 1.0  
**Last Updated:** March 6, 2026  
**Next Review:** After Sprint 2 (Foundation Phase)
