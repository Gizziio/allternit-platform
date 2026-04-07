# Subsystem Convergence Analysis

**Date**: 2026-04-04  
**Goal**: Make evidence-based decisions for each subsystem integration

## Decision Framework

### Evaluation Criteria (Score 1-5 each)

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **Completeness** | 25% | Does the implementation actually work? Are there missing pieces? |
| **Feature Coverage** | 20% | Does it support all required features? |
| **Architectural Fit** | 15% | Does it align with target architecture (runtime-first)? |
| **Dependency Health** | 15% | Fewer dependencies = lower integration risk |
| **Maintainability** | 15% | Code quality, testability, documentation |
| **Team Velocity** | 10% | Which can the team modify fastest? |

### Decision Rules

| Score | Decision |
|-------|----------|
| Clear winner (>15% gap) | Winner takes all |
| Close race (<15% gap) | Merge - take best from both |
| Both incomplete | Rebuild - neither is suitable |

## Subsystem Analysis

### 1. Tool System

**Claude** (`src/claude/tools/`, `Tool.ts`)
- 54 tool implementations
- Rich UI components per tool
- Mature permission integration
- **Score**: Completeness(5), Features(5), Arch(3), Deps(3), Maint(4), Velocity(4) = **4.1**

**Gizzi** (`src/runtime/tools/builtins/`)
- 15 tool implementations
- Clean runtime integration
- Less UI depth
- **Score**: Completeness(3), Features(3), Arch(5), Deps(5), Maint(4), Velocity(5) = **3.9**

**Overlap Areas**:
- Bash execution
- File read/write/edit
- Glob/grep
- Web fetch/search

**Decision**: MERGE - Claude UX on Gizzi runtime substrate
- Keep Claude tool definitions, UI components, permission model
- Use Gizzi dispatch, execution, guard systems
- Unified tool registry

---

### 2. Session System

**Claude** (`src/claude/state/`, `history.ts`)
- React-based state management
- Optimistic updates
- Local-first with sync
- **Score**: Completeness(4), Features(4), Arch(3), Deps(3), Maint(3), Velocity(3) = **3.5**

**Gizzi** (`src/runtime/session/`)
- 30 modules, database-backed
- Production persistence layer
- Server integration
- **Score**: Completeness(5), Features(4), Arch(5), Deps(4), Maint(4), Velocity(4) = **4.4**

**Overlap**: Both have session/message/prompt concepts but different shapes

**Decision**: GIZZI WINS - port Claude UX patterns to Gizzi session
- Gizzi session persistence is production-grade
- Port Claude's optimistic UI patterns as layer on top
- Map Claude message types to Gizzi prompt/message types

---

### 3. Command System

**Claude** (`src/claude/commands/`, `commands.ts`)
- 108 commands
- Rich interactive UIs
- Mature slash command patterns
- **Score**: Completeness(5), Features(5), Arch(3), Deps(4), Maint(3), Velocity(3) = **4.0**

**Gizzi** (`src/cli/commands/`)
- 40+ commands
- Simpler UIs
- Direct runtime integration
- **Score**: Completeness(3), Features(3), Arch(4), Deps(5), Maint(4), Velocity(4) = **3.7**

**Decision**: CLAUDE WINS - port commands to Gizzi entrypoint
- Commands are the primary UX differentiator
- Gizzi runtime can power Claude commands
- Gradual port: high-value commands first

---

### 4. UI Component System

**Claude** (`src/claude/components/`, `ink/`)
- 149 components
- React/Ink expertise
- Rich interactive surfaces
- **Score**: Completeness(5), Features(5), Arch(3), Deps(3), Maint(4), Velocity(3) = **4.0**

**Gizzi** (`src/cli/ui/`)
- TUI components
- Gizzi-brand specific
- Less mature
- **Score**: Completeness(3), Features(2), Arch(4), Deps(5), Maint(3), Velocity(4) = **3.3**

**Decision**: CLAUDE WINS - adapt to Gizzi branding
- Component quality gap is significant
- Rebrand Claude components (remove "Claude" naming)
- Merge with Gizzi brand-specific components

---

### 5. MCP Integration

**Claude** (`src/claude/services/mcp/`)
- Full MCP SDK integration
- Server management UI
- Elicitation dialogs
- **Score**: Completeness(4), Features(5), Arch(3), Deps(3), Maint(3), Velocity(3) = **3.7**

**Gizzi** (`src/runtime/tools/mcp/`)
- Runtime MCP support
- Less UI depth
- **Score**: Completeness(3), Features(3), Arch(5), Deps(4), Maint(4), Velocity(4) = **3.9**

**Decision**: MERGE - Claude UX on Gizzi MCP runtime
- Keep Claude's MCP UI and server management
- Use Gizzi's MCP client/execution
- Unified server registry

---

### 6. Remote Control / Bridge

**Claude** (`src/claude/bridge/`, `remote/`)
- IDE bridge (VS Code, JetBrains)
- Remote session sync
- WebSocket/SSE transport
- **Score**: Completeness(3), Features(4), Arch(3), Deps(2), Maint(2), Velocity(2) = **2.9**

**Gizzi** (`packages/remote-control/`, `packages/cloud-relay/`)
- Production remote control
- Cowork controller
- Direct stream
- **Score**: Completeness(4), Features(4), Arch(5), Deps(4), Maint(3), Velocity(3) = **4.0**

**Decision**: GIZZI WINS - port IDE bridge UX
- Gizzi has production transport layer
- Claude has better IDE integration UX
- Rebuild IDE bridge on Gizzi transport

---

### 7. Verification / Review

**Claude** (`src/claude/commands/review/`)
- Review commands
- Security review
- **Score**: Completeness(2), Features(3), Arch(3), Deps(3), Maint(2), Velocity(2) = **2.6**

**Gizzi** (`src/runtime/verification/`)
- Production verification engine
- Comprehensive checks
- **Score**: Completeness(4), Features(4), Arch(5), Deps(4), Maint(3), Velocity(3) = **4.0**

**Decision**: GIZZI WINS - adapt review commands to use Gizzi engine

---

### 8. Config / Auth / Settings

**Claude** (`src/claude/utils/config.ts`, `auth.ts`)
- OAuth integration
- Settings management
- Feature flags (GrowthBook)
- **Score**: Completeness(4), Features(5), Arch(3), Deps(2), Maint(3), Velocity(3) = **3.5**

**Gizzi** (`src/config/`, `src/runtime/auth/`)
- Config system
- Provider-based auth
- **Score**: Completeness(3), Features(3), Arch(4), Deps(4), Maint(4), Velocity(4) = **3.7**

**Decision**: MERGE - unified config system
- Take Claude's settings UX patterns
- Use Gizzi's config storage
- Remove Anthropic-specific dependencies (GrowthBook)

---

### 9. Type System

**Claude** (`src/claude/types/`)
- Rich message types
- 130KB global.d.ts
- **Score**: Completeness(5), Features(5), Arch(3), Deps(3), Maint(3), Velocity(3) = **3.9**

**Gizzi** (`src/shared/`, runtime types)
- Runtime-integrated types
- Less comprehensive
- **Score**: Completeness(3), Features(3), Arch(5), Deps(5), Maint(4), Velocity(4) = **4.0**

**Decision**: MERGE - unified type hierarchy
- Port Claude's type richness
- Integrate with Gizzi's runtime types
- Single source of truth for message/tool types

---

### 10. State Management

**Claude** (`src/claude/state/`, `bootstrap/`)
- React-based stores
- Complex selectors
- **Score**: Completeness(4), Features(4), Arch(3), Deps(3), Maint(3), Velocity(3) = **3.5**

**Gizzi** (scattered, less centralized)
- Bus-based events
- Direct persistence
- **Score**: Completeness(3), Features(2), Arch(4), Deps(4), Maint(3), Velocity(4) = **3.3**

**Decision**: CLAUDE WINS - port state system
- Better abstraction for UI state
- Gizzi persistence as backend

---

## Summary Decisions

| Subsystem | Winner | Notes |
|-----------|--------|-------|
| Tool System | Merge | Claude UX + Gizzi runtime |
| Session System | Gizzi | Port Claude patterns |
| Commands | Claude | Port to Gizzi entrypoint |
| UI Components | Claude | Rebrand |
| MCP | Merge | Claude UX + Gizzi runtime |
| Remote/Bridge | Gizzi | Rebuild IDE UX |
| Verification | Gizzi | Adapt commands |
| Config/Auth | Merge | Unified system |
| Types | Merge | Unified hierarchy |
| State | Claude | Gizzi persistence backend |

## Resolution Strategy for Overlaps

For merged subsystems, use this precedence:

1. **API/Interface**: Use Claude's (richer, more mature)
2. **Implementation**: Use Gizzi's where production-proven
3. **UI/UX**: Use Claude's (significantly more mature)
4. **Persistence**: Use Gizzi's (database-backed, proven)
5. **Tests**: Port from both, supplement as needed

## Migration Order

1. **Types** (foundation for everything else)
2. **State** (needed by UI)
3. **Session** (core runtime)
4. **Tools** (with runtime integration)
5. **Commands** (user-facing)
6. **UI Components** (depend on above)
7. **Config/Auth** (cross-cutting)
8. **MCP** (tool extension)
9. **Remote/Bridge** (advanced features)
10. **Verification** (quality features)

## Files to Delete (After Migration)

After each subsystem converges:
- `src/claude/` (entire tree when empty)
- `src/runtime/tools/builtins/` (replaced by Claude tools)
- `src/cli/ui/` (replaced by Claude components)
- Duplicate command implementations

## Success Metrics

- [ ] All `src/claude/` files moved or deleted
- [ ] No `@anthropic-ai/sdk` imports remain
- [ ] No "Claude" naming in source files
- [ ] Unified type system builds without errors
- [ ] Single entrypoint (`src/cli/main.ts` or new unified entry)
