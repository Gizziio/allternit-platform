# Additional Gizzi Gaps for Claude Code Integration

**Research Date:** 2026-03-31  
**Purpose:** Identify all additional Gizzi primitives to port into Claude Code

---

## Summary of New Gaps Found

| Category | Feature | Claude Status | Gizzi Status | Action |
|----------|---------|---------------|--------------|--------|
| **Verification** | Semi-formal verification | ❌ None | ✅ Advanced | **Port** |
| **Worktree Mgmt** | Git worktree operations | ❌ None | ✅ Built-in | **Port** |
| **Workspace** | .gizzi/ identity system | ❌ None | ✅ Rich | **Port** |
| **Config** | Layered config loading | ⚠️ Basic | ✅ Advanced | **Port** |
| **Instructions** | Auto-loading AGENTS.md | ⚠️ Basic | ✅ Advanced | **Port** |
| **Model Resolution** | Multi-provider fallback | ⚠️ Basic | ✅ Smart | **Port** |
| **Env Isolation** | Per-instance env vars | ❌ None | ✅ Yes | **Port** |

---

## 1. Advanced Verification System

### Gizzi's Implementation
```typescript
// From: src/runtime/loop/verification-orchestrator.ts
// From: src/runtime/loop/semi-formal-verifier.ts

class VerificationOrchestrator {
  // Dual-mode verification:
  // 1. Empirical: Run tests, execute code
  // 2. Semi-formal: Reasoning-based (Meta's Agentic Code Reasoning paper)
  
  async verify(plan, receipts, strategy): Promise<{
    passed: boolean
    confidence: "high" | "medium" | "low"
    methodsUsed: ("empirical" | "semi-formal")[]
    consensus: boolean  // Did methods agree?
    certificate?: VerificationCertificate  // Structured proof
    visualEvidence?: {  // Screenshots, coverage
      artifacts: Array<{
        type: "ui-state" | "coverage-map" | "console-output"
        imagePath?: string
        confidence: number
      }>
    }
  }>
}

// Semi-formal verification (from Meta's paper)
interface VerificationCertificate {
  version: "1.0"
  task: { type: "patch_equivalence" | "fault_localization" | "code_qa" }
  definitions: Definition[]
  premises: Premise[]  // Explicit premises with evidence
  executionTraces: ExecutionTrace[]  // Traced code paths
  edgeCases: EdgeCaseAnalysis[]
  conclusion: Conclusion  // Formal conclusion
  counterexample?: Counterexample  // If proof fails
}
```

### Gap in Claude
Claude has `/review` but NO structured verification system with:
- Execution-free verification (semi-formal)
- Confidence scoring
- Method consensus
- Visual evidence capture
- Structured certificates

### Action: **PORT**
Port Gizzi's verification orchestrator to Claude Code.

---

## 2. Git Worktree Management

### Gizzi's Implementation
```typescript
// From: src/runtime/context/worktree/index.ts

namespace Worktree {
  // Create isolated git worktree with random name
  export async function create(input: {
    name?: string  // Auto-generated if not provided
    startCommand?: string  // Startup script
  }): Promise<WorktreeInfo>
  
  // Auto-generated names:
  // "brave-cabin", "cosmic-cactus", "mighty-river", etc.
  const ADJECTIVES = ["brave", "calm", "clever", "cosmic", ...]
  const NOUNS = ["cabin", "cactus", "canyon", "castle", ...]
  
  export async function remove(directory: string): Promise<void>
  export async function reset(directory: string): Promise<void>
}
```

### Features
- Isolated git worktrees for parallel work
- Human-readable random names
- Event-driven (Worktree.Ready, Worktree.Failed)
- Per-worktree state

### Gap in Claude
Claude has `EnterWorktreeTool` but limited worktree MANAGEMENT:
- No worktree creation
- No random name generation
- No worktree listing

### Action: **PORT**
Add worktree management commands to Claude.

---

## 3. Workspace Identity System (.gizzi/)

### Gizzi's Implementation
```typescript
// From: src/runtime/workspace/workspace.ts

namespace Workspace {
  // Initialize .gizzi/ directory with identity files
  export async function init(path, opts: {
    name?: string
    emoji?: string
    vibe?: string
  })
  
  // Creates:
  // .gizzi/
  //   ├── IDENTITY.md   # Name, emoji, description
  //   ├── SOUL.md       # Personality, behavioral guidelines
  //   ├── USER.md       # About the user
  //   ├── MEMORY.md     # Long-term memory
  //   └── AGENTS.md     # Workspace instructions
  
  // Also supports 5-layer format:
  // L1-COGNITIVE/   # Working memory
  // L2-IDENTITY/    # Agent identity
  // L3-GOVERNANCE/  # Rules/policies
  // L4-SKILLS/      # Available skills
}
```

### Key Features
- Markdown-based agent identity
- Persistent across sessions
- Auto-loaded into context
- User + agent editable
- Two formats: flat (.gizzi/) or layered (L1-L4)

### Gap in Claude
Claude has `.claude/` but NO structured identity system:
- No SOUL.md for personality
- No USER.md for user context
- No automatic loading into prompts

### Action: **PORT**
Port Gizzi's workspace system to Claude.

---

## 4. Layered Configuration System

### Gizzi's Implementation
```typescript
// From: src/runtime/context/config/config.ts

namespace Config {
  // Loading order (low → high precedence):
  // 1) Remote .well-known/gizzi (org defaults)
  // 2) Global config (~/.config/gizzi/gizzi.json{,c})
  // 3) Custom config (GIZZI_CONFIG env)
  // 4) Project config (gizzi.json{,c})
  // 5) .gizzi directories (.gizzi/gizzi.json{,c})
  // 6) Inline config (GIZZI_CONFIG_CONTENT env)
  // +) Managed config (enterprise, overrides all)
  
  export async function get(): Promise<ConfigInfo>
  
  // Supports JSONC (JSON with comments)
  // Array merging (concatenates, not replaces)
}
```

### Key Features
- Remote config via .well-known/gizzi
- JSONC support
- Smart merging (arrays concatenate)
- Multiple config sources

### Gap in Claude
Claude's config is simpler:
- No remote .well-known loading
- No JSONC support
- Less sophisticated merging

### Action: **PORT**
Port Gizzi's config system to Claude.

---

## 5. Auto-Loading Instructions

### Gizzi's Implementation
```typescript
// From: src/runtime/session/instruction.ts

namespace InstructionPrompt {
  // Auto-loads files in priority order:
  // 1) Global AGENTS.md, CLAUDE.md
  // 2) Project AGENTS.md, CLAUDE.md (up tree)
  // 3) .gizzi/ workspace files (IDENTITY.md, SOUL.md, USER.md, MEMORY.md)
  // 4) Topic memory files (*.md in memory dirs)
  
  // Features:
  // - Relevance scoring (matches session title to topic)
  // - Truncation (max 200 lines per file)
  // - Deduplication
  // - Session working memory (sessions/ subdir)
}
```

### Key Features
- Multiple instruction file types
- Relevance-based filtering
- Automatic truncation
- Topic-based memory files

### Gap in Claude
Claude has instructions but NOT:
- Auto-discovery of topic files
- Relevance scoring
- Session-based memory

### Action: **PORT**
Port Gizzi's instruction loading to Claude.

---

## 6. Smart Model Resolution

### Gizzi's Implementation
```typescript
// From: src/runtime/models/resolve.ts

namespace ModelResolver {
  export async function resolve(
    requestedId?: string,
    context?: { sessionId?: string, projectId?: string }
  ): Promise<ModelDefinition> {
    // 1. Check if requested model is available (has credentials)
    // 2. Check project default
    // 3. Fallback: pick highest-ranked available model
    // Returns best available model based on credentials
  }
}

// Catalog with rankings
const ModelCatalog = [
  { id: "claude-sonnet-4", rank: 100 },
  { id: "gpt-4", rank: 90 },
  { id: "gemini-pro", rank: 80 },
  // ...
]
```

### Key Features
- Multi-provider fallback
- Credential-aware selection
- Project defaults
- Ranked catalog

### Gap in Claude
Claude has model selection but NOT:
- Automatic fallback based on credentials
- Project-level defaults
- Multi-provider catalog

### Action: **PORT**
Port Gizzi's model resolution to Claude.

---

## 7. Environment Variable Isolation

### Gizzi's Implementation
```typescript
// From: src/runtime/context/env/index.ts

namespace Env {
  // Per-instance environment isolation
  const state = Instance.state(() => ({ ...process.env }))
  
  export function get(key: string): string | undefined
  export function set(key: string, value: string): void
  export function remove(key: string): void
  export function all(): Record<string, string>
  
  // Isolates env vars per instance
  // Prevents parallel tests from interfering
}
```

### Key Features
- Instance-scoped environment
- Prevents cross-contamination
- Parallel test safety

### Gap in Claude
Claude uses global `process.env` directly.

### Action: **PORT**
Port Gizzi's env isolation to Claude.

---

## 8. Prompt Template System

### Gizzi's Implementation
```typescript
// From: src/runtime/session/prompt/

// Multiple prompt templates for different modes:
// - anthropic.txt
// - anthropic-20250930.txt
// - plan.txt
// - plan-mode.txt
// - build-mode.txt
// - beast.txt
// - gemini.txt
// - qwen.txt
// - trinity.txt

// Loaded as raw text imports
import PROMPT_PLAN from "@/runtime/session/prompt/plan.txt"
import BUILD_SWITCH from "@/runtime/session/prompt/build-switch.txt"
```

### Key Features
- Mode-specific prompts
- Provider-specific prompts
- Easy customization
- Versioned prompts

### Gap in Claude
Claude has prompts but NOT:
- Externalized template files
- Mode-specific variants
- Provider-specific tuning

### Action: **PORT**
Consider porting Gizzi's prompt template system.

---

## 9. LSP Runtime Integration

### Gizzi's Implementation
```typescript
// From: src/runtime/integrations/lsp/

namespace LSP {
  // LSP server management
  export async function startServer(language: string): Promise<LSPServer>
  export async function getCompletions(file, position): Promise<Completion[]>
  export async function getDiagnostics(file): Promise<Diagnostic[]>
  export async function format(file): Promise<string>
}
```

### Key Features
- Language server protocol support
- Auto-start LSP servers
- Code completions in context
- Diagnostics integration

### Gap in Claude
Claude has LSPTool but basic LSP integration.

### Action: **ENHANCE**
Enhance Claude's LSP with Gizzi's runtime integration.

---

## 10. Shell Integration

### Gizzi's Implementation
```typescript
// From: src/runtime/integrations/shell/

namespace Shell {
  // PTY-based shell integration
  export async function createPTY(): Promise<PTY>
  export async function execute(command, opts): Promise<Output>
  
  // Features:
  // - Pseudo-terminal support
  // - Interactive programs
  // - Terminal emulation
}
```

### Key Features
- PTY support for interactive programs
- Better terminal emulation
- Shell state preservation

### Gap in Claude
Claude's BashTool is basic.

### Action: **ENHANCE**
Enhance Claude's shell with Gizzi's PTY support.

---

## Integration Priority (Revised)

### Phase 1: Core Additions (Weeks 1-4)
```
1. Bus event system
2. Gizzi branding
3. Workspace identity system (.gizzi/)
4. Layered configuration
```

### Phase 2: Session Enhancements (Weeks 5-8)
```
5. Auto-loading instructions
6. Continuity/handoff system
7. Session tree (parent-child) - USE CLAUDE'S FORK
8. Environment isolation
```

### Phase 3: Advanced Features (Weeks 9-14)
```
9. Smart model resolution
10. Advanced verification system
11. Git worktree management
12. Prompt templates
```

### Phase 4: Integrations (Weeks 15-18)
```
13. Enhanced LSP runtime
14. PTY shell integration
15. PermissionNext rulesets
16. Skill system enhancements
```

### Phase 5: Cowork (After stability)
```
17. Cowork persistent sessions
```

---

## Key Decisions Summary

| Decision | Rationale |
|----------|-----------|
| **Use Claude's TUI** | Production-tested, better streaming |
| **Use Claude's session fork** | More mature than Gizzi's |
| **Port Gizzi's workspace** | Unique identity system |
| **Port Gizzi's verification** | Advanced verification gap |
| **Port Gizzi's config** | Layered config is better |
| **Port Gizzi's instructions** | Auto-loading is powerful |
| **Hold off cowork** | Complex, needs stability first |

---

## Files to Port (Additional)

```
src/runtime/loop/verification-orchestrator.ts
src/runtime/loop/semi-formal-verifier.ts
src/runtime/context/worktree/
src/runtime/workspace/
src/runtime/context/config/config.ts  (enhance)
src/runtime/session/instruction.ts
src/runtime/models/resolve.ts
src/runtime/context/env/
src/runtime/session/prompt/*.txt
```

---

*Additional gaps analysis complete.*
