# Gizzi-Code Deep Feature Audit vs Claude Code

**Date:** 2026-03-07
**Scope:** Memory, Thinking/Streaming, Slash Commands, @ Mentions, Hooks, Plugins, Tool Filtering

---

## 1. Memory System

### Claude Code
- **Auto-memory directory**: `~/.claude/projects/{PROJECT_HASH}/memory/`
- **MEMORY.md**: Always loaded into context (first 200 lines), truncated after
- **Topic files**: Create `patterns.md`, `debugging.md` etc. in memory dir, linked from MEMORY.md
- **Auto-learning**: Saves stable patterns, preferences, architecture decisions across sessions
- **Explicit commands**: User says "remember X" -> saved; "forget X" -> removed
- **Project-hash isolation**: Memory scoped by SHA of project path

### Gizzi-Code Has
- **5-layer AgentWorkspace**: L1-Cognitive, L2-Identity, L3-Governance, L4-Skills, L5-Business
- **MEMORY.md**: `L1-COGNITIVE/memory/MEMORY.md` exists in `.gizzi/` workspace
- **memory.jsonl**: Append-only ledger of all tool calls and events
- **handoff.md**: Session resumption baton with 13-section format (objective, progress, decisions, TODOs, errors, next actions)
- **Checkpoint system**: `checkpoint.ts` - SHA-256 file snapshots, auto-checkpoint every 5 min, crash recovery
- **Session persistence**: `session-persistence.ts` - auto-save every 30s, complete state serialization
- **Cross-tool continuity**: Baton handoff to codex, copilot, cursor, etc.
- **CI gates**: Validation before session resumption

### CRITICAL GAPS

| Gap | Impact | Priority |
|-----|--------|----------|
| **MEMORY.md not auto-loaded into context** | `instruction.ts` loads AGENTS.md/CLAUDE.md but NOT workspace MEMORY.md | P0 |
| **No project-hash based memory** | Memory tied to `.gizzi/` disk location, not project identity. Moving project breaks memory | P1 |
| **No topic-specific memory files** | Only MEMORY.md + memory.jsonl, no `patterns.md` etc. | P1 |
| **No auto-learning of patterns** | Memory writes are manual via `AgentWorkspace.appendMemory()`, no implicit extraction | P1 |
| **No `/memory` or `/forget` slash commands** | Cannot manage memory from TUI | P2 |

### What Gizzi-Code Does Better
- Structured 5-layer architecture vs Claude Code's flat directory
- Ledger-based audit trail (memory.jsonl)
- Crash recovery with file-hash checkpoints
- Cross-tool session handoff (baton system)
- CI gates for session quality validation

---

## 2. Thinking / Reasoning Modes

### Claude Code
- **`/think`**: Enables extended thinking (budget_tokens: 10240)
- **`/think hard`**: Higher budget (budget_tokens: 31999)
- **`/ultrathink`** / **`/megathink`**: Maximum budget (max tokens)
- **Effort flag**: `--effort low|medium|high` CLI flag
- **Per-message cost**: Displays thinking token count and cost per message
- **Collapsible UI**: Thinking blocks collapse/expand in TUI
- **Budget tracking**: Global budget_tokens management

### Gizzi-Code Has
- **Variant system**: `--variant low|high|max` on `run` command
- **Provider-specific reasoning**: Transform layer maps variants to native provider options:
  - Anthropic adaptive (opus-4-6, sonnet-4-6): `effort` levels
  - Anthropic standard: `thinking.budgetTokens` (16000/31999)
  - Google Gemini 2.5+: `thinkingBudget` (16000/24576)
  - OpenAI/Azure: `reasoningEffort` levels
  - GitHub Copilot: `thinking_budget: 4000`
- **`--thinking` flag**: Shows thinking blocks in `run` output
- **`/thinking` slash command**: Toggle thinking visibility in TUI
- **Reasoning stream processing**: `processor.ts` handles `reasoning-start/delta/end` events
- **`<think>` tag parsing**: Text mode switching for models that use think tags
- **Reasoning trace visualization**: `reasoning-trace.ts` extracts structured steps from thinking text
- **Token/cost tracking**: `usage.ts` tracks input/output/reasoning/cache separately
- **Usage panel**: Compact/detailed/full views with daily trends and model breakdown

### GAPS

| Gap | Impact | Priority |
|-----|--------|----------|
| **No `/think`, `/think hard`, `/ultrathink` commands** | Users can't escalate reasoning mid-session from TUI | P0 |
| **No `--effort` CLI flag** | Missing convenience flag (uses `--variant` instead) | P1 |
| **No per-message thinking token display** | Only session totals shown, not per-message breakdown | P2 |
| **Thinking blocks always visible or hidden** | No collapsible toggle per-block (only global `/thinking` toggle) | P2 |

### What Gizzi-Code Does Better
- Multi-provider variant support (not just Anthropic)
- Reasoning trace visualization with step extraction
- Richer usage analytics (daily trends, model/provider breakdown)

---

## 3. Streaming & Output Formats

### Claude Code
- **`-p/--print`**: Pipe-friendly output mode (plain text, exits)
- **`--output-format text|json|stream-json`**: Structured output
- **`--input-format text|stream-json`**: Streaming input for pipes
- **`--json-schema`**: Structured output validation
- **Real-time SSE**: Token-by-token streaming in TUI

### Gizzi-Code Has
- **SSE streaming**: Real-time token streaming via Bus events + `streamText()` from AI SDK
- **TUI streaming**: `streaming={true}` on markdown/code components
- **`--format json`**: JSON export in `run` command (raw event streaming)
- **Markdown rendering**: Two modes - experimental markdown component or code block with syntax highlighting
- **Conceal mode**: Sensitive content filtering during streaming

### GAPS

| Gap | Impact | Priority |
|-----|--------|----------|
| **No `-p/--print` pipe mode** | Can't use in shell pipelines or scripts | P0 |
| **No `--output-format stream-json`** | Can't programmatically consume real-time events | P0 |
| **No `--input-format stream-json`** | Can't stream input from pipes | P1 |
| **No `--json-schema` validation** | Can't enforce structured output shape | P2 |

---

## 4. Slash Commands

### Complete Gizzi-Code Slash Command List

**Session Management:**
| Command | Aliases | Description |
|---------|---------|-------------|
| `/sessions` | `/resume`, `/continue` | Switch session |
| `/new` | `/clear` | New session |
| `/share` | - | Share session / copy share link |
| `/unshare` | - | Remove session share |
| `/rename` | - | Rename session |
| `/timeline` | - | Jump to message in timeline |
| `/fork` | - | Fork from message |
| `/compact` | `/summarize` | Create checkpoint / compaction |
| `/undo` | - | Undo previous message |
| `/redo` | - | Redo undone message |
| `/copy` | - | Copy session transcript |
| `/export` | - | Export session to file |
| `/handoff` | - | Create handoff baton |

**Agent & Model:**
| Command | Aliases | Description |
|---------|---------|-------------|
| `/models` | - | Switch model |
| `/agents` | - | Switch agent |
| `/agent-manage` | - | Manage agents |
| `/agent-mode` | `/mode` | Agent mode |
| `/skills` | - | Browse skills |
| `/cron` | - | Cron jobs |
| `/mcps` | - | Toggle MCP servers |
| `/connect` | - | Connect provider |

**Display Toggles:**
| Command | Aliases | Description |
|---------|---------|-------------|
| `/thinking` | `/toggle-thinking` | Toggle thinking visibility |
| `/runtime-trace` | - | Toggle runtime trace |
| `/receipts` | - | Toggle receipts |
| `/preview-cards` | - | Toggle preview cards |
| `/lane-history` | - | Toggle lane history |
| `/runtime-focus` | - | Toggle runtime focus mode |
| `/timestamps` | `/toggle-timestamps` | Toggle timestamps |

**Navigation & Tools:**
| Command | Aliases | Description |
|---------|---------|-------------|
| `/help` | - | Keyboard shortcuts help |
| `/search` | - | Search messages |
| `/bookmarks` | - | View bookmarks |
| `/jump` | - | Jump to message by index |
| `/files` | - | View file references |
| `/pinned` | - | View pinned messages |
| `/copy-code` | - | Copy last code block |
| `/usage` | - | Usage statistics |
| `/editor` | - | Open external editor |

**System:**
| Command | Aliases | Description |
|---------|---------|-------------|
| `/status` | - | View status |
| `/themes` | - | Switch theme |
| `/tasks` | `/bg`, `/background` | Background tasks |
| `/exit` | `/quit`, `/q` | Exit app |

**Server-side commands** (synced from MCP servers and custom command configs) also appear in the autocomplete.

**Total: ~40+ slash commands**

### Claude Code Commands Missing from Gizzi-Code

| Missing Command | Description | Priority |
|-----------------|-------------|----------|
| `/bug` | Report a bug | LOW |
| `/init` | Initialize project (exists as server command, not slash) | LOW |
| `/login` / `/logout` | Auth management (gizzi uses `/connect`) | MEDIUM |
| `/doctor` | Health check | MEDIUM |
| `/review` | Review changes (exists as server command) | LOW |
| `/terminal-setup` | Terminal config | LOW |
| `/memory` | View/manage auto-memory | P0 |
| `/forget` | Remove memory entry | P0 |
| `/project` | Project info | LOW |
| `/cost` | Cost display (gizzi has `/usage` which is richer) | ALIGNED |
| `/model` | Quick model switch (gizzi has `/models`) | ALIGNED |
| `/vim` | Vim mode toggle | LOW |
| `/diff` | Show diff | MEDIUM |
| `/config` | Edit config | MEDIUM |
| `/hooks` | Manage hooks | MEDIUM |
| `/permissions` | Permission settings | P1 |
| `/commit` | Git commit | MEDIUM |
| `/pr-comments` | PR comment integration | LOW |
| `/release-notes` | Generate release notes | LOW |
| `/fast` / `/slow` | Toggle speed mode | LOW |
| `/worktree` | Isolated worktree | P1 |
| `/listen` | Listen mode | LOW |

### Gizzi-Code Extra Commands (Not in Claude Code)
- `/cron` - Scheduled automation
- `/agent-manage` - Agent lifecycle management
- `/agent-mode` - Agent mode switching
- `/mcps` - MCP server toggling
- `/connect` - Multi-provider connection
- `/handoff` - Cross-tool baton
- `/runtime-trace` - Runtime visualization
- `/runtime-focus` - Focus mode
- `/lane-history` - Lane history view
- `/preview-cards` - Card previews
- `/receipts` - Tool receipts
- `/bookmarks` - Message bookmarks
- `/pinned` - Pinned messages
- `/editor` - External editor integration
- `/skills` - Skill browser
- `/themes` - Theme switching

---

## 5. @ Mentions

### Claude Code
- **@file** with line ranges: `@file.ts:10-20`
- **@folder**: Entire folder context
- **@agent**: Delegate to agent
- **@mcp-resource**: MCP resource URI
- Fuzzy search autocomplete in TUI

### Gizzi-Code Has (FULLY ALIGNED + EXTRA)
- **@file** with line ranges: `@file.ts#10-20` (uses `#` instead of `:`)
- **@folder**: Directory listing with `/` suffix detection
- **@agent**: Agent mention with styled extmarks
- **@mcp-resource**: MCP resource URI with description
- **Fuzzy search**: `fuzzysort` library with frecency scoring
- **Frecency ranking**: Recently/frequently used files ranked higher
- **Extmark system**: Styled inline markers for @ mentions (different colors for files vs agents)
- **Tab to expand**: Tab on directory expands into it
- **Line range syntax**: `@file.ts#10` or `@file.ts#10-20`

### GAPS
| Gap | Impact | Priority |
|-----|--------|----------|
| **Different line range syntax** (`#` vs `:`) | Minor UX difference, Claude Code users expect `:` | LOW |
| **No @folder deep inclusion** | Claude Code may recursively include folder contents | LOW |

---

## 6. Hooks System

### Claude Code
- **Shell command hooks**: Execute shell commands on events
- **Events**: PreToolUse, PostToolUse, Notification, Stop, SubagentStop
- **Matchers**: Tool name patterns + event patterns with glob support
- **Actions**: approve, deny, modify tool arguments
- **Configuration**: `settings.json` `hooks` key, validated schema
- **CLI management**: `/hooks` slash command

### Gizzi-Code Has
- **HTTP webhook hooks**: POST events to HTTP endpoints
- **Events**: UserPromptSubmit, PreToolUse, PostToolUse, ToolError, SessionStart, SessionEnd
- **Actions**: allow, deny, modify (PreToolUse only supports modification)
- **Configuration**: `config.hooks.http` array
- **Hook dispatcher**: `dispatcher.ts` merges multiple hook responses (any deny blocks)
- **Integration points**: `dispatch.ts` (tool use), `loop.ts` (session lifecycle)

### CRITICAL GAPS

| Gap | Impact | Priority |
|-----|--------|----------|
| **No shell command hooks** | `command/executor.ts` is empty - only HTTP webhooks work | P0 |
| **Hooks not in config schema** | `config.hooks` not in Zod `Config.Info.strict()` - unvalidated | P0 |
| **No tool name matchers** | HTTP hooks trigger on all configured events, no per-tool filtering | P1 |
| **No `/hooks` slash command** | Cannot manage hooks from TUI | P1 |
| **Limited modification support** | Only PreToolUse supports payload modification | P2 |

### What Gizzi-Code Has Extra
- UserPromptSubmit event (Claude Code doesn't hook into prompt submission)
- ToolError event (explicit error hook)
- HTTP-first design (better for remote/serverless hook handlers)

---

## 7. Plugin System

### Claude Code
- **CLI management**: `claude plugin install/uninstall/enable/disable/update`
- **Marketplace**: Official registry with discovery
- **Validation**: `claude plugin validate` for plugin authors
- **Session-scoped**: `--plugin-dir` for per-session plugins
- **Plugin hooks**: Tool definitions, auth providers, message transforms

### Gizzi-Code Has
- **Config-based loading**: `plugin: string[]` in config, auto npm install via Bun
- **Built-in plugins**: CodexAuthPlugin, opencode-anthropic-auth
- **Rich plugin hooks** (25+ hooks):
  - **Auth**: OAuth, API key, token refresh, model filtering
  - **Chat**: message intercept, params modify, headers modify
  - **Tool**: define tools, modify definitions, before/after execution
  - **Command**: before execution intercept
  - **Permission**: override permission prompts
  - **Shell**: env customization
  - **Session**: event subscription, compaction customization, message/system prompt transforms, text completion override

### GAPS

| Gap | Impact | Priority |
|-----|--------|----------|
| **No `gizzi-code plugin` CLI subcommand** | No install/uninstall/enable/disable from CLI | P0 |
| **No marketplace** | Plugins are raw npm packages, no discovery | P1 |
| **No plugin validation** | No capability declaration or verification | P1 |
| **No per-session enable/disable** | Plugins loaded at startup, can't toggle | P2 |
| **No `--plugin-dir` flag** | Can't scope plugins to session | P2 |

### What Gizzi-Code Does Better
- 25+ plugin hooks vs Claude Code's more limited hook surface
- Auth plugin system (Codex OAuth integration)
- Plugin hooks for system prompt and message transforms
- Text completion override for custom completions

---

## 8. Tool Filtering & Permissions

### Claude Code
- **Permission modes**: `--permission-mode default|acceptEdits|plan|dontAsk|bypassPermissions|auto`
- **Per-tool rules**: Allow/deny with glob patterns in settings
- **CLI flags**: `--tools`, `--allowedTools`, `--disallowedTools`
- **Workspace trust**: Dialog on first run
- **`--dangerously-skip-permissions`**: For CI/CD sandboxes

### Gizzi-Code Has
- **Guard system**: `tools/guard/` with permission checking
- **Permission module**: `tools/guard/permission/next.ts` with allow/ask/deny
- **Policy system**: `tools/guard/policy.ts` for tool policies
- **Compaction guard**: `tools/guard/compaction.ts`

### GAPS

| Gap | Impact | Priority |
|-----|--------|----------|
| **No `--permission-mode` CLI flag** | Cannot set trust level from command line | P0 |
| **No `--allowedTools` / `--disallowedTools`** | Cannot filter tools from CLI | P0 |
| **No `--dangerously-skip-permissions`** | Blocks CI/CD automation | P0 |
| **No workspace trust dialog** | No first-run trust confirmation | P1 |
| **No `/permissions` slash command** | Cannot manage permissions from TUI | P1 |
| **No per-tool glob patterns in settings** | Cannot configure fine-grained tool access | P1 |

---

## 9. Priority Summary

### P0 - Critical (Blocks Parity)
1. Permission modes (`--permission-mode`, `--dangerously-skip-permissions`)
2. Print/pipe mode (`-p/--print`)
3. Output formats (`--output-format text|json|stream-json`)
4. Think/ultrathink slash commands (`/think`, `/think hard`, `/ultrathink`)
5. Auto-load MEMORY.md into context (add to `instruction.ts`)
6. Shell command hooks (implement `command/executor.ts`)
7. Hooks in config schema (add to Zod `Config.Info`)
8. Plugin CLI subcommand (`gizzi-code plugin install/list/enable/disable`)
9. Tool filtering flags (`--allowedTools`, `--disallowedTools`)

### P1 - High (Production Workflows)
10. Budget limits (`--max-budget-usd`)
11. System prompt overrides (`--system-prompt`, `--append-system-prompt`)
12. Worktree CLI flag (`--worktree`)
13. `/memory` and `/forget` commands
14. Project-hash based memory isolation
15. Auto-learning of patterns across sessions
16. Tool name matchers for hooks
17. Plugin marketplace
18. Per-tool permission glob patterns
19. `/permissions`, `/hooks`, `/config` slash commands

### P2 - Medium (Power Users)
20. Effort level flag (`--effort`)
21. Fallback model (`--fallback-model`)
22. Model aliases (`sonnet`, `opus`, `haiku`)
23. Layered settings (user/project/local)
24. Input format streaming (`--input-format stream-json`)
25. Per-message thinking token display
26. Collapsible thinking blocks
27. Per-session plugin enable/disable
28. Topic-specific memory files

### P3 - Low (Polish)
29. `/diff`, `/commit`, `/vim`, `/doctor`
30. JSON schema output validation
31. PR resume (`--from-pr`)
32. Chrome integration CLI flag
33. NotebookEdit tool

---

## 10. Gizzi-Code Unique Strengths

Features Claude Code does NOT have:

1. **Multi-provider support** - Any LLM provider, not just Anthropic
2. **Web interface** - `gizzi-code web` for browser-based UI
3. **Headless server** - `gizzi-code serve` for API-only mode
4. **ACP protocol** - Agent Client Protocol for inter-agent communication
5. **Cron automation** - Scheduled jobs with `/cron` management
6. **Session export/import** - Full data portability
7. **GitHub PR agent** - `gizzi-code pr` for PR-driven workflows
8. **Stats command** - Token usage analytics with daily trends
9. **Models.dev integration** - Broad model catalog from any provider
10. **5-layer AgentWorkspace** - Structured cognitive architecture
11. **Cross-tool handoff** - Baton system for codex/copilot/cursor continuity
12. **Crash recovery** - File-hash checkpoints with auto-recovery
13. **25+ plugin hooks** - Richer extensibility than Claude Code
14. **Auth plugins** - Codex, Copilot, GitLab OAuth built-in
15. **Frecency-ranked autocomplete** - Smarter file suggestions
16. **Theme system** - Multiple themes with dark/light toggle
17. **Runtime trace visualization** - Structured step extraction from thinking
18. **Bookmarks & pinned messages** - Session organization
19. **External editor integration** - `/editor` opens $EDITOR
20. **Agent mode switching** - Dynamic agent personality
