# Gizzi-Code vs Claude Code: Alignment Audit

**Date:** 2026-03-07
**Claude Code Version:** 2.1.71
**Gizzi-Code Version:** 1.0.0 (source)

---

## Status Legend
- ALIGNED = Feature exists and works equivalently
- PARTIAL = Feature exists but incomplete or different behavior
- MISSING = Feature does not exist in gizzi-code
- EXTRA   = Feature in gizzi-code not in Claude Code

---

## 1. CLI Interface & Flags

### ALIGNED
| Feature | Claude Code | Gizzi-Code | Notes |
|---------|------------|------------|-------|
| Default interactive TUI | `claude` | `gizzi-code` | Both launch TUI by default |
| Non-interactive mode | `claude -p` | `gizzi-code run` | Different syntax but same concept |
| Continue session | `--continue` / `-c` | `--continue` / `-c` | Same |
| Resume by ID | `--resume` / `-r` | `--session` / `-s` | Different flag name |
| Model selection | `--model` | `--model` / `-m` | Same |
| Version | `--version` / `-v` | `--version` / `-v` | Same |
| Fork session | `--fork-session` | `--fork` | Same concept |
| Agent selection | `--agent` | `--agent` | Same |
| Help | `--help` / `-h` | `--help` / `-h` | Same |

### MISSING (Priority: HIGH)
| Feature | Claude Code Flag | Impact |
|---------|-----------------|--------|
| **Permission modes** | `--permission-mode` (acceptEdits, bypassPermissions, default, plan, auto) | Critical for CI/CD, automation, trust levels |
| **Skip permissions** | `--dangerously-skip-permissions` | Sandbox/CI usage |
| **Print mode** | `-p, --print` (pipe-friendly output) | Critical for scripting/automation |
| **Output format** | `--output-format` (text, json, stream-json) | Programmatic integration |
| **Input format** | `--input-format` (text, stream-json) | Streaming input for pipes |
| **Budget limit** | `--max-budget-usd` | Cost control |
| **Effort level** | `--effort` (low, medium, high) | Reasoning control |
| **Fallback model** | `--fallback-model` | Resilience when primary overloaded |
| **System prompt override** | `--system-prompt` | Custom system prompts per session |
| **Append system prompt** | `--append-system-prompt` | Additive system prompt |
| **Tool filtering** | `--tools`, `--allowedTools`, `--disallowedTools` | Security, sandboxing |
| **Worktree** | `--worktree` / `-w` | Isolated git worktrees per session |
| **Tmux integration** | `--tmux` | Multi-pane worktree sessions |
| **Additional dirs** | `--add-dir` | External directory access |
| **Debug mode** | `--debug` with category filtering | Observability |
| **Debug file** | `--debug-file` | Log to file |
| **PR resume** | `--from-pr` | Resume session linked to PR |
| **Chrome integration** | `--chrome` / `--no-chrome` | Browser extension |
| **Session persistence control** | `--no-session-persistence` | Ephemeral sessions |
| **JSON schema output** | `--json-schema` | Structured output validation |
| **Settings sources** | `--setting-sources` (user, project, local) | Fine-grained settings control |
| **Settings file** | `--settings` | Load settings from file/JSON |
| **MCP config** | `--mcp-config`, `--strict-mcp-config` | MCP from CLI flags |
| **Betas** | `--betas` | API beta headers |
| **Plugin dir** | `--plugin-dir` | Session-scoped plugins |
| **File resources** | `--file` | Download files at startup |
| **Verbose override** | `--verbose` | Override verbose setting |
| **Session ID** | `--session-id` | Explicit UUID for sessions |
| **Replay user messages** | `--replay-user-messages` | Stream-json acknowledgment |

### MISSING (Priority: MEDIUM)
| Feature | Claude Code Flag | Impact |
|---------|-----------------|--------|
| **Agents definition** | `--agents` (inline JSON) | Define custom agents from CLI |
| **Include partial messages** | `--include-partial-messages` | Streaming output granularity |

---

## 2. Subcommands

### ALIGNED
| Command | Claude Code | Gizzi-Code | Notes |
|---------|------------|------------|-------|
| MCP management | `claude mcp` | `gizzi-code mcp` | Both have add/list/remove |
| Auth | `claude auth` | `gizzi-code connect` | Different name, similar purpose |
| Update/Upgrade | `claude update` | `gizzi-code upgrade` | Same concept |
| Model listing | (inline) | `gizzi-code models` | Gizzi has dedicated command |

### PARTIAL
| Command | Gap Description |
|---------|----------------|
| `mcp add` | Claude supports `--transport http`, headers, env vars. Gizzi may lack HTTP transport |
| `mcp serve` | Claude can expose itself AS an MCP server. Gizzi has ACP but check MCP serve |
| `mcp add-from-claude-desktop` | Claude imports from Claude Desktop. Gizzi N/A |
| `auth` | Claude has `login/logout/status`. Gizzi has `connect` (provider-focused) |
| Plugin management | Claude has `install/uninstall/enable/disable/update/marketplace/validate`. Gizzi has basic plugin system but no CLI commands |

### MISSING
| Command | Description | Priority |
|---------|-------------|----------|
| `claude doctor` | Health check for auto-updater and system | MEDIUM |
| `claude install` | Install native build (stable/latest/specific) | LOW (gizzi has upgrade) |
| `claude setup-token` | Long-lived auth token setup | MEDIUM |
| `claude plugin` | Full plugin CLI (install/uninstall/enable/disable/marketplace) | HIGH |
| `claude agents` | List configured agents from CLI | MEDIUM |

### EXTRA (Gizzi-Code has, Claude Code doesn't)
| Command | Description |
|---------|-------------|
| `gizzi-code serve` | Headless server mode |
| `gizzi-code web` | Web interface |
| `gizzi-code acp` | Agent Client Protocol server |
| `gizzi-code stats` | Token usage statistics |
| `gizzi-code export/import` | Session data portability |
| `gizzi-code github` | GitHub agent management |
| `gizzi-code pr` | PR checkout + agent run |
| `gizzi-code db` | Database tools |
| `gizzi-code cron` | Scheduled automation |
| `gizzi-code debug` | Debug subcommands (agent, config, file, lsp, ripgrep, skill, snapshot) |

---

## 3. Architecture & Internal Flow Gaps

### 3.1 Permission System (CRITICAL GAP)

**Claude Code** has a sophisticated permission model:
- 5 permission modes: `default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions`, `auto`
- Per-tool allow/deny rules with glob patterns
- Workspace trust dialog on first run
- Settings-based permission configuration (user/project/local)

**Gizzi-Code** has:
- Basic permission system in `tools/guard/permission/` with allow/ask/deny
- No CLI-level permission modes
- No workspace trust flow
- Missing `--dangerously-skip-permissions` for CI/CD

**Action needed:** Implement permission modes, workspace trust, and CLI flags.

### 3.2 Print/Pipe Mode (CRITICAL GAP)

**Claude Code's** `-p/--print` mode:
- Outputs plain text and exits (non-interactive)
- Combined with `--output-format json` for structured output
- Combined with `--output-format stream-json` for real-time events
- Combined with `--input-format stream-json` for streaming input
- Supports `--max-budget-usd` for cost limits
- Supports `--json-schema` for structured validation

**Gizzi-Code** has `run` command but:
- No `--output-format` options (no JSON, no stream-json)
- No `--input-format` streaming
- No budget limits
- No structured output validation
- No pipe-friendly mode equivalent to `-p`

**Action needed:** Add output format options, streaming JSON, budget limits to `run`.

### 3.3 Worktree Isolation (HIGH GAP)

**Claude Code** creates isolated git worktrees per session:
- `--worktree` flag creates a fresh worktree
- Optional tmux integration for multi-pane
- Agent works in isolation, changes can be reviewed

**Gizzi-Code** has:
- `src/runtime/workspace/worktree.ts` exists
- `src/runtime/context/worktree/` exists
- But no CLI flag to create worktrees

**Action needed:** Wire worktree to CLI flag `--worktree`.

### 3.4 Settings System (MEDIUM GAP)

**Claude Code** has layered settings:
- User settings (`~/.claude/settings.json`)
- Project settings (`.claude/settings.json`)
- Local settings (`.claude/settings.local.json`)
- `--setting-sources` to control which layers load
- `--settings` to load from file/JSON

**Gizzi-Code** has:
- `~/.config/gizzi/config.json` (single config)
- Project-level `AGENTS.md` / `CLAUDE.md` instruction files
- No layered settings system
- No `settings.json` equivalent at project level

**Action needed:** Implement layered settings (user/project/local) with merge semantics.

### 3.5 Tool System Comparison

**ALIGNED tools:**
| Claude Code | Gizzi-Code | Status |
|------------|------------|--------|
| Bash | bash.ts | ALIGNED |
| Read | read.ts | ALIGNED |
| Write | write.ts | ALIGNED |
| Edit | edit.ts | ALIGNED |
| Glob | glob.ts | ALIGNED |
| Grep | grep.ts | ALIGNED |
| WebFetch | webfetch.ts | ALIGNED |
| WebSearch | websearch.ts | ALIGNED |
| Task (TodoWrite) | todo.ts / task.ts | ALIGNED |
| LS (ListDirectory) | ls.ts | ALIGNED |
| AskUser (Question) | question.ts | ALIGNED |
| Plan | plan.ts | ALIGNED |
| Skill | skill.ts | ALIGNED |
| ApplyPatch | apply_patch.ts | ALIGNED |
| MultiEdit | multiedit.ts | ALIGNED |
| LSP | lsp.ts | ALIGNED |
| Batch | batch.ts | ALIGNED |

**MISSING tools:**
| Claude Code Tool | Description | Priority |
|-----------------|-------------|----------|
| **NotebookEdit** | Jupyter notebook cell editing | LOW |

**EXTRA tools (Gizzi has):**
| Tool | Description |
|------|-------------|
| codesearch.ts | Code search beyond grep |
| external-directory.ts | External directory management |
| truncation.ts | Token truncation tool |

### 3.6 Plugin System (HIGH GAP)

**Claude Code** has full plugin lifecycle:
- `claude plugin install/uninstall/enable/disable/update`
- Marketplace support with multiple registries
- Plugin validation (`claude plugin validate`)
- Session-scoped plugins (`--plugin-dir`)

**Gizzi-Code** has:
- Internal plugin system (`src/runtime/integrations/plugin/`)
- Copilot and Codex auth plugins
- No CLI plugin management commands
- No marketplace

**Action needed:** Add `gizzi-code plugin` subcommand with install/list/enable/disable.

### 3.7 Chrome/Browser Integration (LOW GAP)

**Claude Code** has `--chrome` flag for browser extension integration.

**Gizzi-Code** has no browser extension integration from CLI (though the platform has a separate chrome extension app).

---

## 4. Internal Flow Alignment

### 4.1 Session Lifecycle
| Phase | Claude Code | Gizzi-Code | Status |
|-------|------------|------------|--------|
| Create session | Yes | Yes | ALIGNED |
| Resume session | By ID or picker | By ID or `--continue` | ALIGNED |
| Fork session | Yes | Yes | ALIGNED |
| Session snapshots | Yes | Yes (snapshot/) | ALIGNED |
| Session compaction | Yes | Yes (compaction.ts) | ALIGNED |
| Session continuity | Yes (context handoff) | Yes (continuity/) | ALIGNED |
| Session sharing | Yes | Yes (share/) | PARTIAL |

### 4.2 Agent Loop
| Phase | Claude Code | Gizzi-Code | Status |
|-------|------------|------------|--------|
| Turn management | Yes | Yes (turn.ts) | ALIGNED |
| Budget tracking | Yes (tokens, cost) | Yes (budget.ts) but no USD limit | PARTIAL |
| Stop conditions | Yes | Yes (stop.ts) | ALIGNED |
| Message compaction | Yes | Yes (compact.ts) | ALIGNED |
| Execution traces | Yes | Yes (traces.ts) | ALIGNED |
| Planning phase | Yes | Yes (planner.ts) | ALIGNED |
| Verification | Yes | Yes (verifier.ts) | ALIGNED |

### 4.3 Provider System
| Feature | Claude Code | Gizzi-Code | Status |
|---------|------------|------------|--------|
| Multi-provider | Anthropic primary | Any provider | EXTRA (gizzi more flexible) |
| Model aliases | sonnet, opus, haiku | Full provider/model | PARTIAL (no aliases) |
| Small model fallback | haiku for background | getSmallModel() chain | ALIGNED |
| Provider auth | API key, OAuth | API key, OAuth, plugins | ALIGNED |
| Models.dev catalog | Not applicable | Yes | EXTRA |

---

## 5. Priority Action Items

### P0 (Critical - blocks parity usage)
1. **Permission modes** - Implement `--permission-mode` with at least `default`, `bypassPermissions`, `plan`
2. **Print mode** - Add `-p/--print` equivalent or enhance `run` with `--output-format`
3. **Output formats** - Support `text`, `json`, `stream-json` output in `run`

### P1 (High - needed for production workflows)
4. **Budget limits** - Add `--max-budget-usd` to `run`
5. **System prompt overrides** - Add `--system-prompt` and `--append-system-prompt`
6. **Tool filtering** - Add `--tools`, `--allowedTools`, `--disallowedTools`
7. **Plugin CLI** - Add `gizzi-code plugin` subcommand
8. **Worktree CLI flag** - Wire existing worktree code to `--worktree`

### P2 (Medium - nice to have for power users)
9. **Effort level** - Add `--effort` flag
10. **Fallback model** - Add `--fallback-model`
11. **Model aliases** - Support `sonnet`, `opus`, `haiku` shorthand
12. **Layered settings** - Implement user/project/local settings.json
13. **Debug mode** - Add `--debug` with category filtering
14. **Settings file** - Add `--settings` flag
15. **MCP from CLI** - Add `--mcp-config` flag

### P3 (Low - polish)
16. **PR resume** - Add `--from-pr`
17. **Chrome integration** - Browser extension CLI flag
18. **NotebookEdit tool** - Jupyter support
19. **Session persistence control** - `--no-session-persistence`
20. **JSON schema validation** - `--json-schema` for structured output

---

## 6. Strengths (Gizzi-Code Advantages)

Gizzi-code has several features Claude Code lacks:
1. **Multi-provider support** - Any LLM provider, not just Anthropic
2. **Web interface** - `gizzi-code web` for browser-based UI
3. **Headless server** - `gizzi-code serve` for API-only mode
4. **ACP protocol** - Agent Client Protocol for inter-agent communication
5. **Cron automation** - Scheduled jobs
6. **Session export/import** - Data portability
7. **GitHub PR agent** - `gizzi-code pr` for PR-driven workflows
8. **Stats command** - Token usage analytics
9. **Models.dev integration** - Broad model catalog
10. **mDNS discovery** - Network service discovery

---

## 7. Source Run Command

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code && bun run --conditions=browser ./src/cli/main.ts
```
