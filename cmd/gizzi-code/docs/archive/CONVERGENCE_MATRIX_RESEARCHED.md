# Evidence-Based Convergence Matrix

**Date**: 2026-04-04  
**Method**: Comprehensive source code analysis  
**Scope**: ~661 Gizzi files, ~2001 Claude files

---

## Research Methodology

1. **Gizzi Runtime**: Analyzed 35 modules across session, tools, bus, server, auth, agent, provider, context, skills
2. **Gizzi CLI**: Analyzed command structure, TUI architecture, session management, daemon client
3. **Claude Tools**: Analyzed Tool.ts, tools.ts, 54 tool implementations (Bash, FileRead, FileEdit, Glob, WebSearch, etc.)
4. **Claude Session/State**: Analyzed store.ts, AppStateStore.ts, AppState.tsx, history.ts, context.ts, types/message.ts
5. **Claude Commands**: Analyzed commands.ts (754 lines), main.tsx (808KB), command types, execution flow
6. **Claude Components**: Analyzed 149 components across messages, permissions, prompt input, ink renderer

---

## Subsystem Comparison Matrix

### 1. TOOL SYSTEM

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Tool Count** | 15 built-in | 54 built-in + MCP | G: `builtins/*.ts` (15 files) vs C: `tools/*` (54 dirs) |
| **Tool Definition** | `Tool.define(id, init)` | `buildTool({...})` | G: Class-based with namespace; C: Factory with defaults |
| **Input Validation** | Zod schemas | Zod schemas | Both use Zod v4 |
| **UI Components** | Minimal (output only) | Rich per-tool UI | G: Basic output display; C: `UI.tsx` per tool with React components |
| **Permission Model** | Basic allow/deny/ask | Sophisticated classifier | G: Pattern matching; C: Auto-classifier + pattern + interactive |
| **Progress Streaming** | Event-based | Callback-based | G: Bus events; C: `onProgress` callback with JSX updates |
| **MCP Integration** | Runtime-level | Tool-level | G: `mcp/mcp.ts` client; C: `MCPTool` with UI |
| **File Operations** | Read, Write, Edit, MultiEdit | Read, Write, Edit, Glob, Grep, List | C has more file tools |
| **Execution Context** | `ToolExecutionContext` | `ToolUseContext` | Both provide session/tool state |

**Overlap Analysis**:
- **Bash execution**: Both have it - Gizzi simpler, Claude has sandbox support
- **File operations**: Claude has richer set (Glob, Grep, List)
- **Web tools**: Both have fetch/search
- **Memory tools**: Gizzi has memory_read/write/recall - Claude doesn't
- **Notebook**: Both have notebook edit
- **Browser/Computer Use**: Gizzi has both - Claude only mentions ComputerUse

**Decision**: **MERGE - Claude UX on Gizzi runtime**
- Keep Claude's rich tool UI components (every tool has UI.tsx)
- Keep Claude's sophisticated permission model (classifier + patterns)
- Port Gizzi's unique tools (memory, maybe better browser/computer-use)
- Use Gizzi's tool dispatch and execution infrastructure (production-proven)
- Unified tool registry combining both

---

### 2. SESSION SYSTEM

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Storage** | SQLite (Drizzle ORM) | JSONL files | G: `storage/db.ts`, `session.sql.ts`; C: `sessionStorage.ts` append-only JSONL |
| **State Management** | Event bus (pub/sub) | React useSyncExternalStore | G: `bus.ts` with `BusEvent`; C: `store.ts` + `AppState.tsx` |
| **Persistence Model** | Relational CRUD | Append-only with tombstones | G: Full SQL; C: JSONL with `removeMessageByUuid` (tombstone) |
| **Message Format** | Simpler (text-based) | Rich content blocks | G: `MessageV2` with `Part[]`; C: 1000+ line `types/message.ts` with unions |
| **Content Types** | text, reasoning, tool, file, step, compaction, subtask, patch, agent | text, tool_use, tool_result, thinking, redacted_thinking, image | C has thinking/redacted_thinking, images |
| **Optimistic Updates** | No | Yes (SpeculationState) | C: `SpeculationState` with mutable refs for streaming UI |
| **Session Recovery** | Database replay | JSONL transcript replay | G: Query replay; C: `sessionRestore.ts` |
| **Multi-Agent** | Database records | Separate JSONL files | G: `agent_id` column; C: Subagent JSONL files |

**Evidence - Gizzi Message Structure**:
```typescript
// Gizzi: src/runtime/session/message-v2.ts
export interface MessageV2 {
  parts: Part[]  // text, reasoning, tool, file, etc.
}
```

**Evidence - Claude Message Structure**:
```typescript
// Claude: src/claude/types/message.ts (1000+ lines)
type ContentBlock = 
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ThinkingContentBlock
  | RedactedThinkingContentBlock
  | ImageContentBlock
```

**Decision**: **GIZZI WINS - Port Claude patterns to Gizzi session**
- Gizzi's SQLite backend is production-proven with migrations, transactions
- Claude's JSONL is simpler but lacks querying, relational features
- Port Claude's rich message types (thinking, images) to Gizzi's Part system
- Port Claude's optimistic UI patterns as optional layer
- Keep Gizzi's event bus - more decoupled than React state

---

### 3. COMMAND SYSTEM

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Count** | ~40 commands | 108+ commands | G: `commands/*.ts` (40 files); C: `commands.ts` imports 100+ |
| **CLI Framework** | yargs | Commander.js | G: `main.ts` uses yargs; C: `main.tsx` uses Commander |
| **Command Types** | Single (handler function) | 3 types (prompt, local, local-jsx) | C: `types/command.ts` defines union |
| **UI Pattern** | Simple output | Rich interactive React/Ink | G: Direct output; C: `local-jsx` commands render components |
| **Lazy Loading** | Static imports | Dynamic `load()` | C: Commands have `load: () => import(...)` |
| **Permission Integration** | Basic | Deep tool permission merging | C: Commands can specify `allowedTools` |
| **Sub-agent Support** | Limited | Native fork/inline | C: `processSlashCommand.tsx` handles forked commands |
| **Plugin System** | Basic | Complex (marketplace) | C: `plugin/ManagePlugins.tsx` (322KB!) |

**Evidence - Claude Command Types**:
```typescript
// src/claude/types/command.ts
type Command = CommandBase & (PromptCommand | LocalCommand | LocalJSXCommand)

// Prompt: Expands to text sent to model
type PromptCommand = { type: 'prompt', getPromptForCommand: ... }

// Local: Executes function, returns text
type LocalCommand = { type: 'local', call: ... }

// Local-JSX: Renders React/Ink UI
type LocalJSXCommand = { type: 'local-jsx', load: () => import(...), call: ... }
```

**Evidence - Gizzi Command Structure**:
```typescript
// src/cli/commands/cmd.ts
export const Command = cmd({
  command: "name [arg]",
  describe: "description",
  builder: (yargs) => yargs.option(...),
  handler: async (args) => { ... }
})
```

**Decision**: **CLAUDE WINS - Port commands to Gizzi entrypoint**
- Claude has significantly more commands (108 vs 40)
- Claude's command UX is more mature (interactive UIs, progress tracking)
- Claude's 3-type system (prompt/local/local-jsx) is more flexible
- Gizzi's yargs is simpler but less powerful
- Port high-value Claude commands first: commit, review, mcp, config, compact

---

### 4. UI COMPONENT SYSTEM

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Framework** | SolidJS + OpenTUI | React + Ink | G: `ui/tui/` uses Solid; C: `components/`, `ink/` use React |
| **Renderer** | OpenTUI | Custom Ink reconciler | C: `ink.tsx` (252KB) custom reconciler, `reconciler.ts` |
| **Component Count** | ~68 | 149+ | G: 47 dirs in `ui/`; C: 149 dirs in `components/` |
| **Layout Engine** | OpenTUI | Yoga (Flexbox) | C: `dom.ts` uses Yoga layout |
| **State Management** | Solid Stores | React Context + AppStateStore | G: `createStore`; C: `useAppState()` with selectors |
| **Input Handling** | TextareaRenderable | Custom useInput hook | C: `ink/hooks/use-input.ts` |
| **Features** | Basic | Advanced (mouse, selection) | C: Mouse tracking, text selection, search highlights |
| **Bundle Size** | Smaller | Larger (355KB PromptInput) | C: `PromptInput.tsx` alone is 355KB |

**Evidence - Claude Ink Architecture**:
```typescript
// src/claude/ink/dom.ts
export type DOMElement = {
  nodeName: ElementNames
  attributes: Record<string, DOMNodeAttribute>
  childNodes: DOMNode[]
  yogaNode?: LayoutNode  // Yoga flexbox
  // ... scroll, focus, dirty flags
}
```

**Evidence - Claude Component Pattern**:
```typescript
// React-based with Box/Text components
<Box flexDirection="column" gap={1}>
  <Text bold color={theme.error}>Error</Text>
</Box>
```

**Decision**: **CLAUDE WINS - Adapt to Gizzi branding**
- Claude's component system is significantly more mature (149 vs 68 components)
- Custom Ink reconciler provides browser-like capabilities
- Yoga flexbox layout is more powerful than OpenTUI
- Port React/Ink components to replace Gizzi's Solid/OpenTUI
- Rebrand (remove "Claude" references) but keep architecture

---

### 5. MCP (Model Context Protocol)

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Architecture** | Runtime-level | Tool-level | G: `runtime/tools/mcp/`; C: `services/mcp/`, `tools/MCPTool/` |
| **Client** | stdio/sse | stdio | G: `mcp.ts` with transport abstraction |
| **Server Management** | Basic | Rich UI | C: `commands/mcp/` with full management UI |
| **Elicitation** | No | Yes | C: `ElicitationDialog.tsx` for OAuth/config |
| **Registry** | Official registry | Official + custom | C: `officialRegistry.ts` |

**Decision**: **MERGE - Claude UX on Gizzi MCP runtime**
- Gizzi's MCP runtime is solid (transport abstraction)
- Claude's MCP UI is much richer (server management, elicitation)
- Port Claude's MCP commands and UI to use Gizzi's MCP client

---

### 6. STATE MANAGEMENT

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Architecture** | Event bus | Custom store + React | G: `bus.ts` pub/sub; C: `store.ts` + `AppStateStore.ts` |
| **Reactivity** | Events | React useSyncExternalStore | C: `useAppState()` with optimized selectors |
| **State Shape** | Flat (per-instance) | Hierarchical (AppState) | C: 450+ line `AppState` type |
| **Persistence** | SQLite | JSONL + memory | G: Full persistence; C: Session storage only |
| **Optimistic Updates** | No | Yes | C: `SpeculationState` for streaming |

**Decision**: **MERGE - Use both patterns**
- Keep Gizzi's event bus for cross-module communication
- Port Claude's AppState pattern for UI state
- Use Gizzi's SQLite for persistence
- Port Claude's optimistic update patterns

---

### 7. REMOTE/BRIDGE

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Architecture** | packages/remote-control, cloud-relay | bridge/, remote/ | G: Separate packages; C: In-tree |
| **Transport** | WebSocket/SSE | WebSocket/SSE | Both similar |
| **IDE Integration** | None | VS Code, JetBrains | C: `bridge/` has IDE-specific code |
| **Session Sync** | Yes | Yes | G: `cowork-controller`; C: CCR |

**Decision**: **GIZZI WINS - Port IDE bridge UX**
- Gizzi's remote packages are production-ready
- Claude has better IDE integration - port those components
- Rebuild IDE bridge on Gizzi's transport layer

---

### 8. VERIFICATION/REVIEW

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Engine** | Comprehensive | Commands only | G: `runtime/verification/` (13 modules) |
| **Review UX** | Limited | Rich | C: `commands/review/` |
| **Security** | Full checks | Basic | G: Multiple verification types |

**Decision**: **GIZZI WINS - Adapt review commands to use Gizzi engine**
- Gizzi's verification engine is more comprehensive
- Port Claude's review command UX to call Gizzi verification

---

### 9. CONFIG/AUTH

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Config System** | Config loading | Settings JSON | G: `context/config/`; C: `utils/config.ts` (64KB) |
| **Auth** | Provider-based | OAuth + API keys | G: `runtime/auth/`; C: `utils/auth.ts` (65KB) |
| **Feature Flags** | Direct | GrowthBook | C: Analytics integration |
| **Settings UI** | Limited | Rich | C: `commands/config/` (9KB) |

**Decision**: **MERGE - Unified config system**
- Gizzi's provider-based auth is more flexible
- Claude's settings UI is richer - port it
- Remove GrowthBook dependency, use direct config

---

### 10. TYPE SYSTEM

| Aspect | Gizzi | Claude | Evidence |
|--------|-------|--------|----------|
| **Size** | Moderate | Extensive | G: Shared types; C: `types/` (21 files, 130KB global.d.ts) |
| **Richness** | Functional | Very rich | C: Complex unions, discriminated types |
| **Message Types** | Simpler | Very detailed | C: 1000+ line `types/message.ts` |
| **Tool Types** | Basic | Sophisticated | C: Full `Tool<>` generic with progress |

**Decision**: **MERGE - Unified type hierarchy**
- Port Claude's type richness
- Integrate with Gizzi's runtime types
- Single source of truth

---

## Final Convergence Decisions

| Subsystem | Winner | Integration Strategy |
|-----------|--------|---------------------|
| **Tools** | Merge | Claude UX + Gizzi runtime |
| **Session** | Gizzi | Port Claude message types to Gizzi |
| **Commands** | Claude | Port to Gizzi entrypoint |
| **UI Components** | Claude | Port React/Ink, rebrand |
| **MCP** | Merge | Claude UX + Gizzi runtime |
| **State** | Merge | Event bus + AppState patterns |
| **Remote/Bridge** | Gizzi | Port IDE bridge UX |
| **Verification** | Gizzi | Adapt review commands |
| **Config/Auth** | Merge | Unified system |
| **Types** | Merge | Unified hierarchy |

---

## Implementation Priority

### Phase 1: Foundation (Types, State, Session)
1. Merge type systems (start with `types/message.ts`)
2. Port AppState patterns to Gizzi
3. Add Claude message types to Gizzi session

### Phase 2: Core Runtime (Tools, MCP)
1. Port Claude tool UIs to Gizzi tool system
2. Integrate Claude tools with Gizzi dispatch
3. Merge MCP systems

### Phase 3: User Surface (Commands, UI)
1. Port high-value Claude commands
2. Replace Gizzi UI with Claude components
3. Rebrand components

### Phase 4: Polish (Config, Remote)
1. Merge config systems
2. Port IDE bridge
3. Final integration testing

---

## Files to Delete Post-Migration

After each subsystem converges:
- `src/claude/` - entire tree when empty
- `src/runtime/tools/builtins/` - replaced by Claude tools
- `src/cli/ui/` - replaced by Claude components
- Duplicate command implementations

---

## Evidence Quality Notes

- **High confidence**: Tool counts, command counts, component counts (direct file enumeration)
- **High confidence**: Architecture patterns (direct source code reading)
- **Medium confidence**: Feature comparisons (some features inferred from file structure)
- **Low confidence**: Performance characteristics (would need benchmarking)

All decisions are based on actual source code analysis, not assumptions from planning documents.
