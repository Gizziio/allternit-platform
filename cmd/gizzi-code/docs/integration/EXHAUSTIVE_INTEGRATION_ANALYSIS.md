# Exhaustive Integration Analysis: Claude Code + Gizzi/Allternit

**Date:** 2026-03-31  
**Scope:** Complete primitive-level analysis of both codebases  
**Status:** Gizzi as backbone, Claude Code as extended TUI

---

## Executive Summary

After exhaustive analysis of both codebases, this document identifies **all primitives** that must be preserved in the integration. The key insight:

> **Gizzi is the backbone runtime** with its own TUI, tool system, session management, and brand identity. **Claude Code** provides a more mature alternative TUI implementation and additional tool primitives that can be ported.

**Key Finding:** This is not simply "use Claude Code as base" - it's a **true integration** where Gizzi's native primitives (Bus, Flag, Instance state, Continuity, Agent system, Skills) must be preserved, while Claude Code's superior TUI components and certain tools can enhance the platform.

---

## 1. GIZZI PRIMITIVES (MUST PRESERVE)

### 1.1 Core Runtime Primitives

```typescript
// From: src/shared/bus/index.ts
// Event-driven architecture - CRITICAL
namespace Bus {
  publish<Definition>(def, properties): Promise<void>
  subscribe<Definition>(def, callback): Unsubscribe
  once<Definition>(def, callback): void
  subscribeAll(callback): Unsubscribe
}

// From: src/runtime/context/flag/flag.ts  
// Feature flag system - CRITICAL
namespace Flag {
  GIZZI_DISABLE_EXTERNAL_SKILLS: boolean
  // Extensible flag system for runtime configuration
}

// From: src/runtime/context/project/instance.ts
// Instance-scoped state management - CRITICAL
namespace Instance {
  state<T>(factory, dispose?): T
  directory: string
  worktree: string
  // Project context isolation
}
```

### 1.2 Session & Continuity System

```typescript
// From: src/runtime/session/index.ts
// Session management with parent-child relationships
namespace Session {
  Info: {
    id, slug, projectID, directory, parentID
    title, version, summary, share, revert
    permission: PermissionNext.Ruleset
    time: { created, updated, compacting, archived }
  }
  
  // Bus Events
  Event.Created, Event.Updated, Event.Deleted
  Event.ContinuitySaved, Event.ContinuityRestored
  Event.Error
}

// From: src/runtime/session/continuity/types.ts
// Cross-session context transfer - UNIQUE TO GIZZI
interface SessionContext {
  session_id, source_tool, workspace_path
  objective, progress_summary, decisions
  open_todos: TodoItem[]
  dag_tasks: DAGTask[]
  blockers, files_changed
  commands_executed: CommandsByCategory
  errors_seen: ErrorItem[]
  next_actions: NextAction[]
  gizzi_conventions: GIZZIConventions  // BRANDED
  references, evidence, limits
}

// Tool-agnostic session types - CRITICAL FOR INTEROPERABILITY
type ToolType = "gizzi" | "claude_code" | "codex" | "copilot" | "cursor" | "gemini_cli" | ...
```

### 1.3 Agent System

```typescript
// From: src/runtime/loop/agent.ts
// Multi-agent with permission rulesets
namespace Agent {
  Info: {
    name, description, mode: "subagent" | "primary" | "all"
    native: boolean, hidden: boolean
    topP, temperature, color
    permission: PermissionNext.Ruleset  // CRITICAL
    model: { modelID, providerID }
    variant, prompt, options, steps
  }
  
  // Native agents - BRANDED
  build: { name: "build", mode: "primary", native: true }
  plan: { name: "plan", mode: "primary", native: true }
  general: { name: "general", mode: "subagent", native: true }
  explore: { name: "explore", mode: "subagent", native: true }
  compaction: { name: "compaction", mode: "primary", native: true, hidden: true }
  title: { name: "title", mode: "primary", native: true, hidden: true }
  summary: { name: "summary", mode: "primary", native: true, hidden: true }
}
```

### 1.4 Tool System with Guards

```typescript
// From: src/runtime/tools/builtins/tool.ts
// Tool definition with validation
namespace Tool {
  interface Info<Parameters, Metadata> {
    id: string, strict?: boolean
    init(ctx): Promise<{
      description: string
      parameters: Parameters  // Zod schema
      execute(args, ctx): Promise<{
        title: string
        metadata: Metadata
        output: string
        attachments?: FilePart[]
      }>
    }>
  }
  
  // Built-in tools - CRITICAL SET
  bash, read, write, edit, ls, glob, grep
  websearch, webfetch, codesearch
  question, todo, task, skill, agent, plan
  memory_read, memory_write, doom_loop
  external_directory, registry
  notebook, apply_patch, multiedit
  browser, computer_use, lsp
  batch, verify, invalid
}

// From: src/runtime/tools/guard/permission/next.ts
// PermissionNext system - CRITICAL
namespace PermissionNext {
  Ruleset: Record<string, "allow" | "deny" | "ask" | Ruleset>
  merge(...rulesets): Ruleset
  fromConfig(config): Ruleset
  
  // Default permissions - BRANDED BEHAVIOR
  defaults: {
    "*": "allow"
    doom_loop: "ask"
    external_directory: { "*": "ask", [Truncate.GLOB]: "allow" }
    question: "deny"
    plan_enter: "deny"
    plan_exit: "deny"
    read: { "*": "allow", "*.env": "ask", "*.env.*": "ask" }
  }
}
```

### 1.5 Skill System

```typescript
// From: src/runtime/skills/skill.ts
// Markdown-based skill definitions
namespace Skill {
  Info: { name, description, location, content }
  
  // External skill directories - INTEROPERABILITY
  EXTERNAL_DIRS = [".claude", ".agents", ".openclaw"]
  EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  
  // Gizzi skill directories - BRANDED
  GIZZI_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
  
  // Discovery from both Gizzi and external sources
  dirs(): Promise<string[]>
}

// From: src/runtime/skills/creator.ts
// AI-powered skill generation - UNIQUE
namespace Skill.Creator {
  generate(input): Promise<Skill.Info>
  evaluate(skill): Promise<EvaluationResult>
}
```

### 1.6 TUI Architecture (SolidJS + OpenTUI)

```typescript
// From: src/cli/ui/tui/app.tsx
// Main TUI app using SolidJS (not React)
function tui(input: { url, args, directory?, fetch?, headers?, events?, onExit? })

// Provider architecture
<ArgsProvider>
  <ExitProvider>
    <KVProvider>
      <AnimationProvider>
        <ThemeProvider>
          <RouteProvider>
            <DialogProvider>
              <ToastProvider>
                // ... routes
              </ToastProvider>
            </DialogProvider>
          </RouteProvider>
        </ThemeProvider>
      </AnimationProvider>
    </KVProvider>
  </ExitProvider>
</ArgsProvider>

// Dialog system - BRANDED UI PATTERNS
DialogAgent, DialogAgentManager
DialogSkill, DialogSkillCreate, DialogSkillEval
DialogSessionList, DialogSessionRename, DialogSessionSearch
DialogMcp, DialogStatus, DialogHelp
DialogCronList, DialogCoworkApprovals, DialogCoworkPairing
DialogMemoryExplorer, DialogPluginMarketplace

// UI Components (opentui-based)
Dialog, DialogSelect, DialogPrompt, DialogConfirm
Toast, Spinner, Link
```

### 1.7 Brand Elements (CRITICAL TO PRESERVE)

```typescript
// From: src/shared/brand/meta.ts
export const GIZZIBrand = {
  name: "GIZZI",           // PRIMARY BRAND
  productLine: "Code",
  product: "GIZZI Code",   // PRODUCT NAME
  command: "gizzi-code",   // CLI COMMAND
  wordmark: "GIZZI.IO",    // WORDMARK
  minimal: "GIZZI",        // SHORT FORM
} as const

// From: src/shared/brand/copy.ts
// All user-facing strings - MUST PRESERVE FOR CONSISTENCY
GIZZICopy = {
  header: { subagentSession, parent, previous, next }
  sidebar: { contextPack, runtime, adapters, workItems }
  footer: { boot, lawBeacon, runtime, adapters }
  prompt: { variants, agents, commands }
  palette: { copyShareLink, shareSession, ... }
  toast: { clipboardCopied, shareUrlCopied, ... }
  model: { connectProvider, noProviderSelected }
  permission: { alwaysAllowTitle, requiredTitle }
  question: { title, review, confirm }
  command: { connectProvider }
  dialog: { statusTitle, runtimeSummaryTitle }
}

// GIZZI Flag - CRITICAL BRAND ELEMENT
export const GIZZIFlag = {
  ENABLED: "GIZZI"
}

// From: src/cli/ui/components/gizzi/
// GIZZI visual components - BRANDED
ShimmeringBanner, GIZZIAnimation
```

### 1.8 Provider System

```typescript
// From: src/runtime/providers/provider.ts
// Multi-provider model support
namespace Provider {
  Info: { id, name, auth: AuthConfig }
  
  // Built-in providers
  anthropic, openai, google, github_copilot
  
  // OAuth providers
  oauth: {
    anthropic: OAuthProvider
    openai: OAuthProvider
    google: OAuthProvider
    github_copilot: OAuthProvider
  }
}
```

### 1.9 Continuity/Handoff System

```typescript
// From: src/continuity/
// Cross-tool session transfer - UNIQUE TO GIZZI
namespace Continuity {
  // Extract context from any tool's session format
  extract(tool: ToolType, workspace: string): SessionContext
  
  // Emit handoff bundle
  emit(context): HandoffBundle
  
  // Parse incoming handoff
  parse(bundle): SessionContext
  
  // Gates for approval
  gates: { ask, confirm }
}
```

### 1.10 Memory & Kernel Sync

```typescript
// From: src/runtime/memory/
namespace Memory {
  // Local memory storage
  recall(query): Promise<MemoryEntry[]>
  write(entry): Promise<void>
  
  // Kernel synchronization
  kernelSync: {
    push(): Promise<void>
    pull(): Promise<void>
  }
}
```

---

## 2. CLAUDE CODE PRIMITIVES (TO PORT/INTEGRATE)

### 2.1 TUI Components (React + Ink)

```typescript
// Superior component library - PORT TO GIZZI TUI
// From: src/components/

// Permission dialogs - MORE MATURE
permissions/
  AskUserQuestionPermissionRequest/
  BashPermissionRequest/
  ComputerUseApproval/
  FileEditPermissionRequest/
  FilePermissionDialog/
  NotebookEditPermissionRequest/
  PermissionDialog.tsx
  PermissionPrompt.tsx

// Message components - RICHER
messages/
  AssistantTextMessage.tsx
  AssistantThinkingMessage.tsx
  AssistantToolUseMessage.tsx
  UserPromptMessage.tsx
  UserToolResultMessage/
  // ... 20+ message types

// Input components - MORE FEATURES
PromptInput/
  HistorySearchInput.tsx
  IssueFlagBanner.tsx
  Notifications.tsx
  PromptInput.tsx
  PromptInputFooter.tsx
  VoiceIndicator.tsx
  inputModes.ts
  inputPaste.ts

// Design system - PORTABLE
design-system/
  Dialog.tsx
  FuzzyPicker.tsx
  KeyboardShortcutHint.tsx
  ListItem.tsx
  LoadingState.tsx
  Pane.tsxn  ProgressBar.tsx
  Tabs.tsx
  ThemeProvider.tsx
```

### 2.2 Tools to Port

```typescript
// From: src/tools/
// Tools Gizzi doesn't have - PORT

AgentTool/           // More mature subagent system
BriefTool.ts         // Context briefing
CronCreateTool/      // Scheduled tasks
EnterPlanModeTool/   // Plan mode
EnterWorktreeTool/   // Git worktree
LSPTool/             // Language Server Protocol
MCPTool/             // Model Context Protocol
NotebookEditTool/    // Jupyter notebooks
REPLTool/            // Interactive REPL
RemoteTriggerTool/   // Remote triggers
SendMessageTool/     // Inter-agent messaging
SkillTool/           // Alternative skill system
SleepTool/           // Proactive mode
TeamCreateTool/      // Team management
TungstenTool/        // Tungsten integration
TodoWriteTool/       // Task management
```

### 2.3 Bridge System (CRITICAL - PORT)

```typescript
// From: src/bridge/
// IDE integration - GIZZI DOESN'T HAVE THIS
bridgeMain.ts        // Main bridge loop
bridgeMessaging.ts   // Message protocol
bridgePermissionCallbacks.ts
replBridge.ts        // REPL bridge
sessionRunner.ts     // Session execution

// VS Code, JetBrains integration - MAJOR GAP
```

### 2.4 Command System

```typescript
// From: src/commands/
// Commands to port/adapt

cost/        // Cost tracking
doctor/      // Environment diagnostics
export/      // Session export
feedback/    // User feedback
memory/      // Memory management (different from Gizzi's)
plan/        // Plan mode
plugin/      // Plugin marketplace
remote-env/  // Remote environments
review/      // Code review
skills/      // Skill management (different from Gizzi's)
tasks/       // Task management
vim/         // Vim mode
voice/       // Voice input
```

### 2.5 Hooks System

```typescript
// From: src/hooks/
// Rich hooks to port

useArrowKeyHistory.tsx
useCommandKeybindings.tsx
useHistorySearch.ts
useIDEIntegration.tsx
useLspPluginRecommendation.tsx
useMemoryUsage.ts
usePermissionPoller.ts
usePromptSuggestion.ts
useRemoteSession.ts
useSettings.ts
useSkillImprovementSurvey.ts
useSwarmInitialization.ts
useTaskListWatcher.ts
useVimMode.ts
useVoice.tsx
```

---

## 3. INTEGRATION ARCHITECTURE

### 3.1 Unified Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED PLATFORM                                  │
│                    "Gizzi Core + Claude TUI Extension"                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  PRESENTATION LAYER (Dual Mode)                                  │   │
│   │  ┌──────────────────┐  ┌─────────────────────────────────────┐  │   │
│   │  │ Gizzi TUI        │  │ Claude TUI (Enhanced - Optional)    │  │   │
│   │  │ (SolidJS/OpenTUI)│  │ (React/Ink)                         │  │   │
│   │  │                  │  │                                     │  │   │
│   │  │ • ShimmeringBanner│  │ • Rich permission dialogs          │  │   │
│   │  │ • GIZZI branding │  │ • IDE bridge integration           │  │   │
│   │  │ • Native dialogs │  │ • Voice input                      │  │   │
│   │  │ • Cowork UI      │  │ • Vim mode                         │  │   │
│   │  └──────────────────┘  └─────────────────────────────────────┘  │   │
│   │                              ↑                                   │   │
│   │         Both use Gizzi Runtime (Bus, Session, Tools)            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  GIZZI RUNTIME (BACKBONE - PRESERVE ALL PRIMITIVES)              │   │
│   │                                                                  │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │   │
│   │  │ Bus          │ │ Instance     │ │ Session                  │ │   │
│   │  │ • publish    │ │ • state()    │ │ • parent-child           │ │   │
│   │  │ • subscribe  │ │ • directory  │ │ • continuity             │ │   │
│   │  │ • events     │ │ • worktree   │ │ • handoff                │ │   │
│   │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │   │
│   │                                                                  │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │   │
│   │  │ Agent        │ │ Tool+Guards  │ │ Skills                   │ │   │
│   │  │ • native     │ │ • PermissionNext│ • markdown-based        │ │   │
│   │  │ • permission │ │ • validation │ │ • external dirs          │ │   │
│   │  │ • subagents  │ │ • truncation │ │ • creator                │ │   │
│   │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │   │
│   │                                                                  │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │   │
│   │  │ Provider     │ │ Memory       │ │ Continuity               │ │   │
│   │  │ • multi-model│ │ • kernel sync│ │ • cross-tool             │ │   │
│   │  │ • OAuth      │ │ • recall     │ │ • context transfer       │ │   │
│   │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  PORTED CLAUDE PRIMITIVES                                        │   │
│   │                                                                  │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │   │
│   │  │ Bridge       │ │ Extra Tools  │ │ Commands                 │ │   │
│   │  │ • IDE        │ │ • MCP        │ │ • cost, doctor, vim      │ │   │
│   │  │ • REPL       │ │ • LSP        │ │ • voice, plan, tasks     │ │   │
│   │  │ • VS Code    │ │ • Cron       │ │ • review, export         │ │   │
│   │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Brand Preservation Strategy

| Element | Gizzi Original | Integration Approach |
|---------|---------------|---------------------|
| **Primary Brand** | GIZZI | **KEEP** - Product is "GIZZI Code" |
| **Command** | `gizzi-code` | **KEEP** - CLI entry point |
| **Wordmark** | GIZZI.IO | **KEEP** - Visual identity |
| **TUI Framework** | SolidJS + OpenTUI | **KEEP** - Primary TUI |
| **Copy/Strings** | GIZZICopy | **KEEP** - All user-facing strings |
| **Flag System** | Flag.* | **KEEP** - Runtime configuration |
| **Secondary TUI** | N/A | **ADD** - Claude Ink TUI as option |
| **IDE Bridge** | N/A | **ADD** - Port from Claude Code |

---

## 4. DETAILED INTEGRATION MAP

### 4.1 Gizzi → Keep As-Is

```typescript
// Core architecture - DO NOT MODIFY
src/shared/bus/                    // Event bus
src/shared/brand/                  // Brand identity
src/runtime/context/               // Context management
  flag/                            // Feature flags
  project/instance.ts              // Instance state
src/runtime/session/               // Session management
  continuity/                      // Cross-tool handoff
src/runtime/loop/                  // Agent loop
  agent.ts                         // Native agents
src/runtime/tools/                 // Tool system
  guard/permission/next.ts         // PermissionNext
src/runtime/skills/                // Skill system
src/cli/ui/tui/                    // TUI (SolidJS)
  components/gizzi/                // GIZZI branded components
```

### 4.2 Claude Code → Port to Gizzi

```typescript
// New modules to create in Gizzi
src/bridge/                        // IDE integration (NEW)
src/cli/ui/ink/                    // Alternative TUI (NEW)
  // React + Ink components
src/runtime/tools/builtins/        // Additional tools
  mcp.tool.ts                      // MCP tool
  lsp.tool.ts                      // LSP tool
  cron.tool.ts                     // Cron tool
  notebook.tool.ts                 // Notebook tool
  repl.tool.ts                     // REPL tool
  team.tool.ts                     // Team management
src/commands/                      // Additional commands
  cost.ts, doctor.ts, vim.ts, etc.
```

### 4.3 Unified Elements

```typescript
// Shared between both TUIs
src/runtime/session/               // Same session system
src/runtime/tools/                 // Same tool registry
src/shared/bus/                    // Same event bus
src/runtime/providers/             // Same provider system
```

---

## 5. CRITICAL INTEGRATION DECISIONS

### 5.1 TUI Strategy

**Decision:** Keep Gizzi's SolidJS/OpenTUI as primary, port select Claude Ink components

**Rationale:**
- Gizzi TUI is deeply integrated with brand (ShimmeringBanner, GIZZI styling)
- SolidJS signals provide better performance for TUI updates
- OpenTUI is purpose-built for terminal UIs
- Claude's Ink components can be adapted where they offer superior UX (permission dialogs)

### 5.2 Tool System

**Decision:** Extend Gizzi's tool system with Claude's tools

**Rationale:**
- Gizzi's Tool.define() with Zod validation is solid
- PermissionNext system is more flexible than Claude's
- Can port Claude's tool implementations into Gizzi's framework

### 5.3 Session Management

**Decision:** Use Gizzi's session system exclusively

**Rationale:**
- Gizzi's continuity/handoff system is unique and critical
- Parent-child session relationships are core feature
- Cross-tool session transfer is key differentiator

### 5.4 Brand Identity

**Decision:** Preserve GIZZI brand fully

**Rationale:**
- Product is "GIZZI Code", command is `gizzi-code`
- All user-facing strings use GIZZICopy
- Visual identity (ShimmeringBanner, etc.) is core brand

---

## 6. IMPLEMENTATION ROADMAP

### Phase 1: Bridge Integration (Weeks 1-3)
```
- [ ] Port Claude Code bridge/ to Gizzi
- [ ] Add IDE integration (VS Code, JetBrains)
- [ ] Implement REPL bridge
- [ ] Add sessionRunner for IDE sessions
```

### Phase 2: Tool Porting (Weeks 4-6)
```
- [ ] Port MCP tool from Claude
- [ ] Port LSP tool from Claude
- [ ] Port Notebook tool from Claude
- [ ] Port Cron tool from Claude
- [ ] Port Team tools from Claude
```

### Phase 3: Alternative TUI (Weeks 7-10)
```
- [ ] Create Ink-based TUI as option
- [ ] Port rich permission dialogs
- [ ] Port voice input
- [ ] Port vim mode
- [ ] Add TUI switch command: /tui solid|ink
```

### Phase 4: Command Expansion (Weeks 11-13)
```
- [ ] Port cost tracking
- [ ] Port doctor command
- [ ] Port plan mode
- [ ] Port export/import
- [ ] Port review command
```

### Phase 5: Polish (Weeks 14-16)
```
- [ ] Unified documentation
- [ ] Migration guide
- [ ] Performance optimization
- [ ] Testing
```

---

## 7. SUMMARY

### Gizzi Primitives (Preserve)
- **Bus** - Event system
- **Flag** - Feature flags
- **Instance** - State management
- **Session** - With continuity/handoff
- **Agent** - Native agents with PermissionNext
- **Tool** - With guards and validation
- **Skills** - Markdown-based
- **Brand** - GIZZI identity
- **TUI** - SolidJS/OpenTUI primary

### Claude Code Primitives (Port)
- **Bridge** - IDE integration
- **Tools** - MCP, LSP, Cron, Notebook, REPL
- **TUI** - Ink as alternative
- **Commands** - cost, doctor, plan, review
- **Hooks** - Rich UI hooks

### Result
A unified platform with **Gizzi as the backbone runtime** and **Claude Code's mature components** enhancing the experience. The product remains **GIZZI Code** with `gizzi-code` as the command, preserving all brand identity while gaining powerful new capabilities.

---

*Exhaustive analysis complete. Ready for implementation planning.*
