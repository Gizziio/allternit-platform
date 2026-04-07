# Corrected Integration Architecture

**Canonical Base:** Claude Code (Anthropic's codebase)  
**Integration Target:** Gizzi primitives INTO Claude Code  
**TUI Framework:** Claude's React + Ink (production-tested)  
**Branding:** Gizzi identity applied to Claude Code base

---

## Correct Mental Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED PLATFORM (GIZZI-branded)                      │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLAUDE CODE FOUNDATION (Keep Everything)                        │   │
│  │                                                                  │   │
│  │  ├── TUI: React + Ink (production-tested)                       │   │
│  │  ├── Tools: 40+ mature implementations                          │   │
│  │  ├── Bridge: IDE integration (VS Code, JetBrains)               │   │
│  │  ├── QueryEngine: Streaming, tool calls, retries                │   │
│  │  ├── Permission: Interactive permission system                  │   │
│  │  ├── Session: Linear session model                              │   │
│  │  ├── Commands: 50+ slash commands                               │   │
│  │  └── Components: 140+ UI components                             │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  GIZZI PRIMITIVES (Port INTO Claude Code)                        │   │
│  │                                                                  │   │
│  │  ├── Bus: Event-driven architecture                             │   │
│  │  ├── Continuity: Cross-tool session handoff                     │   │
│  │  ├── Session V2: Parent-child relationships                     │   │
│  │  ├── PermissionNext: Ruleset-based permissions                  │   │
│  │  ├── Skills: Markdown-based skill system                        │   │
│  │  ├── Brand: GIZZI identity (name, copy, visuals)                │   │
│  │  └── Cowork: Persistent remote sessions (v2)                    │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## What Stays from Claude Code

### 1. TUI Framework (React + Ink)

**Why:** Production-tested, better streaming tool calls, mature component library

```typescript
// KEEP: Claude's Ink-based components
src/components/
  permissions/           // Permission dialogs
  messages/              // Message rendering
  PromptInput/           // Input handling
  design-system/         // UI primitives
  spinner/               // Loading states
  // ... all 140+ components
```

### 2. Tool System

**Why:** More mature implementations, better tested

```typescript
// KEEP: Claude's tool implementations
src/tools/
  BashTool/
  FileReadTool/
  FileEditTool/
  MCPTool/               // MCP support
  LSPTool/               # LSP support
  WebSearchTool/
  WebFetchTool/
  AgentTool/             # Subagent spawning
  // ... all 40+ tools
```

### 3. Bridge System

**Why:** Gizzi doesn't have IDE integration

```typescript
// KEEP: Claude's bridge
src/bridge/
  bridgeMain.ts
  bridgeMessaging.ts
  replBridge.ts
  sessionRunner.ts
```

### 4. Query Engine

**Why:** Production-tested streaming, retry logic, context management

```typescript
// KEEP: Claude's QueryEngine.ts
// Handles streaming responses, tool-call loops, thinking mode
```

### 5. Commands

**Why:** Comprehensive command set

```typescript
// KEEP: Claude's 50+ commands
src/commands/
  cost/                  // Cost tracking
  doctor/                // Environment diagnostics
  plan/                  // Plan mode
  review/                // Code review
  vim/                   // Vim mode
  voice/                 // Voice input
  // ... etc
```

---

## What to Port from Gizzi

### 1. Bus Event System

**Gap in Claude:** No centralized event bus

```typescript
// NEW: Add to Claude Code
src/bus/
  index.ts               // Event bus implementation
  
// Usage:
Bus.publish(SessionEvent.Created, { id, directory })
Bus.subscribe(PermissionEvent.Updated, handler)
Bus.subscribeAll(event => telemetry.log(event))
```

### 2. Continuity/Handoff System

**Gap in Claude:** No cross-tool session transfer

```typescript
// NEW: Add to Claude Code
src/continuity/
  types.ts               // SessionContext, DAGTask, etc.
  extract.ts             // Extract context from any tool
  emit.ts                // Create handoff bundle
  parse.ts               // Parse incoming handoff
  gates.ts               // Approval gates

// Types:
type ToolType = "gizzi" | "claude_code" | "copilot" | "cursor" | ...
interface SessionContext {
  source_tool: ToolType
  dag_tasks: DAGTask[]
  gizzi_conventions: GIZZIConventions
  // ...
}
```

### 3. Session Parent-Child

**Gap in Claude:** Linear sessions only

```typescript
// EXTEND: Claude's session system
interface Session {
  id: string
  parentID?: string           // NEW: Parent session
  childIDs?: string[]         // NEW: Child sessions
  continuity?: SessionContext // NEW: Handoff context
}

// Commands to add:
/commands/session/
  fork.ts                    // Fork session
  parent.ts                  // Go to parent
  children.ts                // List children
  tree.ts                    // Visualize tree
```

### 4. PermissionNext Rulesets

**Gap in Claude:** Different permission model

```typescript
// EXTEND: Claude's permission system
src/hooks/toolPermission/
  ruleset.ts                 // PermissionNext implementation
  
// Ruleset format:
const rules: PermissionNext.Ruleset = {
  "*": "allow",
  bash: { "rm -rf /": "deny", "*": "ask" },
  edit: { "*.env": "ask", "*": "allow" },
  doom_loop: "ask"
}
```

### 5. Gizzi Branding

**Apply to Claude Code TUI:**

```typescript
// NEW: Brand layer
src/brand/
  meta.ts                    // GIZZIBrand constants
  copy.ts                    // GIZZICopy strings
  sanitize.ts                // Brand sanitization
  
// Modify Claude components to use Gizzi branding:
// - Replace "Claude" with "GIZZI" in prompts
// - Use Gizzi copy for all user-facing strings
// - Apply Gizzi visual identity (colors, logos)
```

### 6. Skills System

**Gap in Claude:** Different skill approach

```typescript
// NEW: Add to Claude Code
src/skills/
  skill.ts                   // Markdown-based skills
  discovery.ts               // Skill discovery
  creator.ts                 // AI skill generation
  
// Support external skill directories:
EXTERNAL_DIRS = [".claude", ".agents", ".openclaw"]
GIZZI_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
```

### 7. Cowork Mode (v2 - Hold Off Initially)

**Gap in Claude:** No persistent remote sessions

```typescript
// NEW: Add later (per user instruction)
src/cowork/
  // Persistent remote execution
  // Session sharing
  // Approvals system
```

---

## Integration Points

### 1. Session System Integration

```typescript
// Merge Claude's session with Gizzi's features
interface UnifiedSession {
  // From Claude:
  id: string
  messages: Message[]
  cost: CostInfo
  
  // From Gizzi:
  parentID?: string
  childIDs: string[]
  continuity?: SessionContext
  dag_tasks?: DAGTask[]
}
```

### 2. Permission System Integration

```typescript
// Merge Claude's interactive with Gizzi's rulesets
interface UnifiedPermission {
  // Claude: Interactive dialogs
  // Gizzi: Ruleset-based auto-allow/deny
  mode: "interactive" | "ruleset" | "hybrid"
  rules?: PermissionNext.Ruleset
}
```

### 3. Event Integration

```typescript
// Add Bus to Claude's existing hooks
// Bridge Claude's events to Bus:

// Claude event:
onMessageSent(message)

// Bridge to Bus:
Bus.publish(SessionEvent.MessageSent, message)
```

---

## Branding Strategy

### Preserve Gizzi Identity

| Element | Claude Default | Gizzi Override |
|---------|---------------|----------------|
| Product Name | "Claude Code" | **"GIZZI Code"** |
| CLI Command | `claude` | **`gizzi-code`** |
| Boot Message | Claude logo | **ShimmeringBanner** |
| Strings | Hardcoded | **GIZZICopy** |
| Wordmark | "Claude" | **"GIZZI.IO"** |

### Implementation

```typescript
// Replace in Claude components:
// Before:
<Text>Claude Code</Text>

// After:
<Text>{GIZZICopy.productName}</Text>

// Visual components:
// Before:
<ClaudeLogo />

// After:
<ShimmeringBanner />  // Reimplemented in Ink
```

---

## Implementation Priority

### Phase 1: Foundation (Weeks 1-4)
```
- [ ] Add Bus event system
- [ ] Implement Gizzi branding layer
- [ ] Port basic continuity types
- [ ] Reimplement ShimmeringBanner in Ink
```

### Phase 2: Session Enhancement (Weeks 5-8)
```
- [ ] Add parent-child session relationships
- [ ] Implement session tree commands
- [ ] Port continuity extraction
- [ ] Add cross-tool handoff
```

### Phase 3: Permission & Skills (Weeks 9-12)
```
- [ ] Integrate PermissionNext rulesets
- [ ] Add skills system
- [ ] Support external skill directories
- [ ] Port skill creator
```

### Phase 4: Polish (Weeks 13-16)
```
- [ ] UI/UX alignment with Gizzi design
- [ ] Documentation
- [ ] Testing
```

### Phase 5: Cowork (After stability - Weeks 17-20)
```
- [ ] Port cowork mode
- [ ] Persistent remote sessions
- [ ] Session sharing
```

---

## Key Differences from Previous Analysis

| Aspect | Previous (Wrong) | Correct |
|--------|-----------------|---------|
| Base | Gizzi | **Claude Code** |
| TUI | Keep Gizzi's SolidJS | **Use Claude's Ink** |
| Tools | Keep Gizzi's | **Use Claude's** |
| Session | Gizzi's model | **Claude's + Gizzi features** |
| Integration | Gizzi base + Claude add-ons | **Claude base + Gizzi primitives** |
| Cowork | Include initially | **Hold off** |

---

## Summary

**Claude Code** provides the production-tested foundation (TUI, tools, bridge, QueryEngine).

**Gizzi** provides unique primitives to integrate (Bus, continuity, parent-child sessions, branding, skills).

**Result:** A unified platform with Claude's maturity and Gizzi's unique features, branded as **GIZZI Code**.

---

*Architecture corrected. Ready for implementation.*
