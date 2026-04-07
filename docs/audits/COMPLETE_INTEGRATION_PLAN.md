# Complete Claude Code → Gizzi Code Integration Plan

## Core Principle

**Claude Code is the mature core.** All 1,962 files must be integrated. Gizzi Code's runtime-first architecture wins for primitive infrastructure.

**Architecture Decision: RUNTIME-FIRST WINS**
- Runtime layer provides primitives
- Interaction layer (CLI/TUI) consumes runtime
- This enables headless mode, testing, modularity

---

## File Structure Decision Matrix

### Philosophy
| Layer | Responsibility | Wins? |
|-------|---------------|-------|
| **Runtime** (`src/runtime/`) | Primitives, tools, context, providers | ✅ **WINS** |
| **CLI** (`src/cli/`) | Commands, TUI, interaction | Merges with Claude CLI |
| **Shared** (`src/shared/`) | Utilities, types, constants | Keeps Gizzi structure |

### Integration Rule
```
Claude Code file → Gizzi Code location
```

---

## Complete File Mapping

### 1. Core Runtime Files

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/assistant/*` | `src/runtime/assistant/*` | Session discovery, history |
| `src/bootstrap/*` | `src/runtime/bootstrap/*` | Bootstrap state |
| `src/bridge/*` | `src/runtime/bridge/*` | Complete bridge system |
| `src/buddy/*` | `src/runtime/buddy/*` | Companion system |
| `src/QueryEngine.ts` | `src/runtime/query/QueryEngine.ts` | Query engine |
| `src/Tool.ts` | `src/runtime/tools/base/Tool.ts` | Base tool class |

### 2. CLI Layer

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/cli/handlers/*` | `src/cli/handlers/claude/*` | Command handlers |
| `src/cli/exit.ts` | `src/cli/utils/exit.ts` | Exit utilities |
| `src/cli/ndjsonSafeStringify.ts` | `src/cli/utils/ndjson.ts` | NDJSON utils |
| `src/main.tsx` | `src/cli/main-claude.tsx` | Entry point (merge) |
| `src/commands.ts` | `src/cli/commands-claude.ts` | Commands (merge) |

### 3. Components (TUI)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/components/*` | `src/cli/ui/components/claude/*` | Claude components |
| `src/screens/*` | `src/cli/ui/screens/*` | Screens |
| `src/hooks/*` | `src/cli/ui/hooks/claude/*` | React hooks |

### 4. Services (Move to Runtime)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/services/api/*` | `src/runtime/services/api/*` | API services |
| `src/services/compact/*` | `src/runtime/context/compact/*` | Context compaction |
| `src/services/mcp/*` | `src/runtime/tools/mcp/services/*` | MCP services |
| `src/services/permissions/*` | `src/runtime/permissions/services/*` | Permission services |
| `src/services/platform/*` | `src/runtime/platform/*` | Platform detection |
| `src/services/skillSearch/*` | `src/runtime/skills/search/*` | Skill search |

### 5. Tools (Merge with existing)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/tools/AgentTool/*` | `src/runtime/tools/claude/AgentTool/*` | Agent tool |
| `src/tools/AskUserQuestionTool/*` | `src/runtime/tools/claude/AskUserQuestionTool/*` | Question tool |
| `src/tools/BashTool/*` | `src/runtime/tools/claude/BashTool/*` | Bash tool (compare) |
| `src/tools/FileReadTool/*` | `src/runtime/tools/claude/FileReadTool/*` | File read |
| `src/tools/FileWriteTool/*` | `src/runtime/tools/claude/FileWriteTool/*` | File write |
| `src/tools/WebSearchTool/*` | `src/runtime/tools/claude/WebSearchTool/*` | Web search |
| (all other tools) | `src/runtime/tools/claude/{name}/*` | Preserve all |

### 6. Types (Centralize)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/types/*` | `src/runtime/types/claude/*` | Claude types |
| `src/entrypoints/sdk/*` | `src/runtime/sdk/entrypoints/*` | SDK entrypoints |

### 7. Utils (Merge carefully)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/utils/*` | `src/runtime/utils/claude/*` | Utilities |
| `src/remote/*` | `src/runtime/remote/*` | Remote session |
| `src/upstreamproxy/*` | `src/runtime/proxy/upstream/*` | Upstream proxy |

### 8. Skills (Preserve)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/skills/*` | `src/runtime/skills/claude/*` | Claude skills |

### 9. Built-in SDKs (Already Working)

| Claude Code Path | Gizzi Integration Path | Notes |
|-----------------|----------------------|-------|
| `src/sdk/allternit-api/*` | `src/runtime/sdk/allternit-api/*` | Allternit API |
| `src/sdk/computer-use/*` | `src/runtime/sdk/computer-use/*` | Computer Use |
| `src/sdk/mcpb/*` | `src/runtime/sdk/mcpb/*` | MCPB |
| `src/sdk/chrome-mcp/*` | `src/runtime/sdk/chrome-mcp/*` | Chrome MCP |
| `src/sdk/sandbox-runtime/*` | `src/runtime/sdk/sandbox-runtime/*` | Sandbox |
| `src/sdk/image-processor/*` | `src/runtime/sdk/image-processor/*` | Image |
| `src/sdk/audio-capture/*` | `src/runtime/sdk/audio-capture/*` | Audio |

---

## Critical Integration Points

### 1. Tool System Merge
**Gizzi has:** `src/runtime/tools/builtins/*` (30+ tools)
**Claude has:** `src/tools/*` (20+ tools)

**Resolution:**
- Gizzi tools → `src/runtime/tools/gizzi/*`
- Claude tools → `src/runtime/tools/claude/*`
- Unified registry → `src/runtime/tools/registry.ts`

### 2. CLI Entry Point Merge
**Gizzi has:** `src/cli/main.ts`
**Claude has:** `src/main.tsx`

**Resolution:**
- Create unified entry: `src/cli/main-unified.tsx`
- Runtime detection: Use Claude's bootstrap with Gizzi's TUI

### 3. Type System Alignment
**Issue:** ContentBlock vs ContentBlockParam mismatches

**Resolution:**
- Use Claude's type hierarchy (more complete)
- Map Gizzi types to Claude types
- Single source of truth in `src/runtime/types/`

### 4. Provider System
**Gizzi has:** Multi-provider (Anthropic, OpenAI, Google, Copilot)
**Claude has:** Anthropic-focused

**Resolution:**
- Keep Gizzi's provider abstraction
- Use Claude's Anthropic implementation as reference
- Merge in `src/runtime/providers/`

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Move complete directory structures**

```bash
# Create target directories
mkdir -p src/runtime/{assistant,bootstrap,bridge,buddy,query,tools/claude}
mkdir -p src/cli/{handlers/claude,ui/components/claude,ui/screens,ui/hooks/claude}
mkdir -p src/runtime/{services,skills/claude,utils/claude,remote,proxy/upstream}
mkdir -p src/runtime/types/claude

# Move all Claude files preserving structure
cp -r gizzi-code-claude/src/assistant/* src/runtime/assistant/
cp -r gizzi-code-claude/src/bootstrap/* src/runtime/bootstrap/
cp -r gizzi-code-claude/src/bridge/* src/runtime/bridge/
# ... (all 1962 files)
```

### Phase 2: Path Updates (Week 2)
**Update all import paths**

```typescript
// Before (Claude)
import { Bridge } from '../bridge/bridgeMain'
import { Tool } from '../Tool'

// After (Integrated)
import { Bridge } from '../../bridge/bridgeMain'
import { Tool } from '../../tools/base/Tool'
```

**Automation:**
- Use codemod for path updates
- 1962 files × avg 10 imports = ~20,000 path updates

### Phase 3: Type Alignment (Week 3)
**Fix type mismatches**

1. ContentBlock alignment
2. Message type unification
3. Settings type merge
4. Tool type consolidation

### Phase 4: Integration Points (Week 4)
**Merge at architectural boundaries**

1. Tool registry unification
2. CLI command merging
3. Provider system alignment
4. Event bus integration

### Phase 5: Testing (Week 5-6)
**Full test suite**

1. Unit tests for all tools
2. Integration tests for bridge
3. E2E tests for CLI
4. Type checking (0 errors target)

---

## Session/Identity Fix Strategy

### The Problem
Gizzi Code had session/identity issues (as you mentioned) because:
1. Forked from OpenCode (different architecture)
2. Drift over time
3. Session management not unified

### The Solution
**Use Claude Code's session system as the core:**

| Component | Claude Implementation | Integration |
|-----------|---------------------|-------------|
| Session ID | `src/bridge/sessionIdCompat.ts` | Use directly |
| Session Storage | `src/services/compact/*` | Port to runtime |
| Session Continuity | `src/assistant/sessionHistory.ts` | Merge with Gizzi |
| Identity | `src/bootstrap/state.ts` | Use Claude's |

### Session Flow (Post-Integration)
```
User → CLI Entry → Bootstrap → Session Init → Bridge Connect → Runtime
                ↓
        Session Continuity (Claude system)
                ↓
        Tool Execution → Context Management
```

---

## Identity Resolution

### Current State
- **Gizzi Code:** Identity scattered (config, auth, user modules)
- **Claude Code:** Centralized in bootstrap/state

### Integration
```typescript
// src/runtime/identity/index.ts
// Merged identity system

export interface Identity {
  // From Claude (mature)
  sessionId: string;
  userId: string;
  organizationId?: string;
  
  // From Gizzi (preserve)
  workspace: Workspace;
  preferences: UserPreferences;
}
```

---

## OpenCode Drift Mitigation

### What Happened
1. Gizzi Code forked from OpenCode
2. Both evolved independently
3. Architecture diverged

### How Claude Code Helps
Claude Code is a **clean, mature reference implementation** from Anthropic:
- Not based on OpenCode
- Production-tested
- Clean architecture

### Integration Approach
**Replace OpenCode-influenced parts with Claude Code:**

| Gizzi (OpenCode DNA) | Replace With | Location |
|---------------------|--------------|----------|
| Session management | Claude session system | `src/runtime/session/` |
| Context handling | Claude context system | `src/runtime/context/` |
| Tool dispatch | Claude tool system | `src/runtime/tools/` |
| Bridge/Remote | Claude bridge | `src/runtime/bridge/` |

**Preserve Gizzi additions:**
- Plugin system
- Provider abstraction
- Verification system
- Skill system

---

## Final Structure (Post-Integration)

```
gizzi-code/src/
├── cli/                          # CLI layer (merged)
│   ├── main.ts                   # Unified entry
│   ├── commands.ts               # Unified commands
│   ├── handlers/
│   │   ├── gizzi/               # Original handlers
│   │   └── claude/              # Claude handlers
│   └── ui/
│       ├── components/
│       │   ├── gizzi/          # Gizzi components
│       │   └── claude/         # Claude components
│       └── screens/             # Claude screens
├── runtime/                      # RUNTIME-FIRST (core)
│   ├── assistant/               # Claude assistant
│   ├── bootstrap/               # Claude bootstrap
│   ├── bridge/                  # Claude bridge
│   ├── buddy/                   # Claude buddy
│   ├── context/                 # Context (merged)
│   ├── identity/                # Identity (merged)
│   ├── memory/                  # Memory (Gizzi + Claude)
│   ├── providers/               # Providers (Gizzi wins)
│   ├── proxy/                   # Proxy (Claude upstream)
│   ├── query/                   # Query engine
│   ├── remote/                  # Remote session
│   ├── sdk/                     # SDKs (working)
│   ├── services/                # Services (Claude)
│   ├── session/                 # Session (Claude core)
│   ├── skills/                  # Skills (merged)
│   ├── tools/                   # TOOLS (merged)
│   │   ├── base/               # Base tool
│   │   ├── gizzi/              # Gizzi tools
│   │   ├── claude/             # Claude tools
│   │   ├── mcp/                # MCP
│   │   └── registry.ts         # Unified registry
│   ├── types/                   # TYPES (unified)
│   └── utils/                   # Utilities
└── shared/                      # Shared utilities
```

---

## Success Criteria

1. **All 1,962 Claude files integrated**
2. **0 TypeScript errors**
3. **Working TUI** (Gizzi's superior TUI)
4. **Working Bridge** (Claude's mature bridge)
5. **Unified tool system**
6. **Session issues resolved**
7. **Clean identity system**

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1: Foundation | Week 1 | All files moved |
| 2: Path Updates | Week 2 | All imports fixed |
| 3: Type Alignment | Week 3 | 0 type errors |
| 4: Integration | Week 4 | Systems merged |
| 5: Testing | Weeks 5-6 | Production ready |

**Total: 6 weeks**

---

## First Action Items

1. **Create integration branch:** `git checkout -b claude-integration`
2. **Create directory structure** (see above)
3. **Copy all 1,962 files** preserving relative paths
4. **Start path update codemod**

**Ready to proceed?**