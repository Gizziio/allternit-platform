# Claude Code CLI Harness Analysis

## Overview
Claude Code operates as an **agentic harness** around Claude, providing tools, context management, and execution environment. Based on research from the official docs, cheat sheets, and community resources.

---

## 1. Core Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE CODE LAYERS                    │
├─────────────────────────────────────────────────────────┤
│  EXTENSION LAYER                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   MCP   │  │  Hooks  │  │ Skills  │  │ Plugins │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
├─────────────────────────────────────────────────────────┤
│  DELEGATION LAYER                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Subagents (up to 10 parallel)       │    │
│  │   Explore | Plan | General-purpose | Custom      │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  CORE LAYER                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Main Conversation Context                │    │
│  │   Tools: Read, Edit, Bash, Glob, Grep, etc.     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Built-in Slash Commands

### Session Management
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/exit` | Exit the REPL |
| `/clear` | Clear conversation history & reset context |
| `/clear reset` | Clear and reset conversation |
| `/clear new` | Clear and start new conversation |
| `/compact [instructions]` | Summarize conversation with optional instructions |
| `/config` | Open configuration panel |
| `/doctor` | Check installation health |
| `/cost` (/cos) | Show session cost and duration |

### Model & System
| Command | Description |
|---------|-------------|
| `/model` | Switch model (sonnet, opus, haiku) |
| `/output-style [style]` | Set output style (compact, explanatory, learning) |
| `/memory` | Edit memory/CLAUDE.md |
| `/status` | Show current status |
| `/statusline` | Configure status line |
| `/mcp` | MCP server management |
| `/agents` | Subagent management |
| `/skills` | Skill management |
| `/hooks` | Hook management |
| `/ide` | IDE integration management |

### Planning & Execution
| Command | Description |
|---------|-------------|
| `/plan` | Enter plan mode |
| `/init` | Initialize project |
| `/ultrathink` | Deep thinking mode |

---

## 3. Output Styles

Output styles directly modify the system prompt:

| Style | Description |
|-------|-------------|
| **Default** | Standard software engineering assistant |
| **Compact** | Concise responses, minimal explanation |
| **Explanatory** | Educational "Insights" while helping |
| **Learning** | Collaborative, learn-by-doing with `TODO(human)` markers |
| **Custom** | User-defined styles in `.claude/output-styles/` or `~/.claude/output-styles/` |

### Custom Output Style Format
```markdown
---
name: My Custom Style
description: What this style does
keep-coding-instructions: true
---

# Custom Style Instructions

You are an interactive CLI tool...
```

---

## 4. Subagents System

### Built-in Subagents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| **Explore** | Haiku | Read-only | Fast codebase exploration, file discovery |
| **Plan** | Inherits | Read-only | Research agent for planning |
| **General-purpose** | Inherits | All tools | Complex multi-step tasks |
| **Bash** | Inherits | Bash | Terminal commands in separate context |

### Subagent Configuration
Stored in `.claude/agents/` or `~/.claude/agents/` as Markdown with YAML frontmatter:

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
disallowedTools: Write, Edit
model: sonnet
permissionMode: acceptEdits
---

You are a code reviewer. Analyze code and provide specific,
actionable feedback on quality, security, and best practices.
```

### Frontmatter Fields
- `name` (required): Unique identifier
- `description` (required): When to delegate to this agent
- `tools`: Allowed tools list
- `disallowedTools`: Denied tools
- `model`: sonnet, opus, haiku, or inherit
- `permissionMode`: acceptEdits, acceptAll, or prompt
- `mcpServers`: Enabled MCP servers
- `hooks`: Hooks configuration
- `maxTurns`: Maximum turns before returning
- `skills`: Auto-loaded skills
- `memory`: Memory configuration

---

## 5. Skills System

Skills are task-specific prompts that can be:
- Invoked explicitly with `/skill-name`
- Auto-loaded when relevant
- Distributed via plugins

### Skill Storage
- Project level: `.claude/skills/`
- User level: `~/.claude/skills/`
- Plugin level: `skills/` in plugin

### Skill Format
```markdown
---
name: my-skill
description: What this skill does
auto: true  # Auto-load when relevant
---

Skill instructions here...
```

---

## 6. MCP (Model Context Protocol)

MCP extends Claude Code with external services:
- Databases
- GitHub
- Sentry
- Custom services

### MCP Configuration
Managed via `/mcp` command or config files.

---

## 7. Hooks System

Hooks guarantee execution of shell commands regardless of model behavior.

### Hook Triggers
- `pre-edit`: Before file edits
- `post-edit`: After file edits
- `pre-command`: Before bash commands
- `post-command`: After bash commands

---

## 8. Memory / CLAUDE.md System

### Memory Locations (Priority Order)
1. `~/.claude/CLAUDE.md` - Global user preferences
2. `.claude/CLAUDE.md` - Project-specific preferences
3. Reference files anywhere in filesystem

### Auto-Memory
- Claude automatically remembers patterns across sessions
- Stored in `.claude/memory/` or `~/.claude/memory/`

---

## 9. Configuration Hierarchy

Settings files at different levels (highest to lowest priority):

1. CLI flags
2. `.claude/settings.local.json` (local, gitignored)
3. `.claude/settings.json` (project, shared)
4. `~/.claude/settings.json` (user)
5. Default settings

### Example settings.json
```json
{
  "outputStyle": "explanatory",
  "model": "sonnet",
  "allowedTools": ["Bash", "Read", "Write", "Edit"],
  "permissions": {
    "mode": "acceptEdits"
  },
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-github"]
    }
  }
}
```

---

## 10. Permission System

### Permission Modes
| Mode | Description |
|------|-------------|
| `prompt` | Ask before every action |
| `acceptEdits` | Auto-accept file edits, prompt for bash |
| `acceptAll` | Auto-accept all actions |

### Tool-Level Permissions
```bash
claude --allowedTools "Bash(git:*)" "Write" "Read"
claude --disallowedTools "Bash(rm:*)" "Bash(sudo:*)"
```

---

## 11. Key CLI Flags

```bash
# Session control
claude --continue              # Resume last session
claude --resume SESSION_ID     # Resume specific session
claude --fork-session          # Fork current session

# Model selection
claude --model sonnet
claude --model opus
claude --model haiku

# Working directories
claude --add-dir ../apps ../lib

# Output format
claude --output-format json
claude --output-format text
claude --output-format stream-json

# Permissions
claude --dangerously-skip-permissions
claude --allowedTools "Bash" "Read"
claude --disallowedTools "Bash(sudo:*)"

# Headless mode
claude -p "prompt here"        # Print mode (execute and exit)
claude -p --max-turns 5 "query"

# Debug
claude --verbose
claude --debug "api,mcp"
```

---

## 12. What Makes Claude Code Special

Based on the tweet from Boris Cherny (@bcherny) and community feedback:

1. **Subagents for context management** - Spawn isolated agents for exploration
2. **Output styles** - Switch personalities (compact, explanatory, learning)
3. **Skills system** - Reusable, auto-loading workflows
4. **MCP protocol** - Clean external service integration
5. **Hooks** - Deterministic automation regardless of model behavior
6. **CLAUDE.md memory** - Persistent project and user context
7. **Permission system** - Fine-grained tool control
8. **Agentic loop** - Three-phase: gather context → take action → verify results
9. **Session management** - Resume, fork, compact conversations
10. **Slash commands** - Everything accessible via `/`

---

## 13. Comparison: Allternit TUI vs Claude Code

| Feature | Claude Code | Allternit TUI (Current) | Gap |
|---------|-------------|-------------------|-----|
| **Slash commands** | 20+ built-in | Basic (`/help`, `/model`, `/agent`) | Large |
| **Output styles** | 4 built-in + custom | None | Large |
| **Subagents** | Built-in + custom | None | Large |
| **Skills** | Full system | None | Large |
| **MCP** | Full protocol support | Basic MCP status display | Medium |
| **Hooks** | Pre/post action hooks | None | Large |
| **Memory/CLAUDE.md** | Global + project | None | Large |
| **Permission system** | Tool-level permissions | None | Medium |
| **Session management** | Resume, fork, compact | Basic session switching | Medium |
| **Cost tracking** | `/cost` command | None | Small |
| **Plan mode** | `/plan` subagent | None | Medium |
| **Compact** | `/compact` command | None | Small |
| **Agent loop** | 3-phase with verification | Basic dispatch | Medium |
| **TUI overlay** | Rich command palette | Basic overlays | Small |
| **File mentions** | `@` path completion | `@` with fuzzy matching | Parity |

---

## 14. Priority Implementation Roadmap

### Phase 1: Core UX Parity (High Impact)
1. **Expand slash commands** - Add `/clear`, `/compact`, `/cost`, `/memory`, `/plan`, `/ultrathink`
2. **Output styles** - Implement compact/explanatory/learning modes
3. **Cost tracking** - Track and display token usage
4. **Better session management** - Compact, fork concepts

### Phase 2: Agent System (High Complexity)
1. **Subagent framework** - Explore/Plan/General agents
2. **Skills system** - Auto-loading task prompts
3. **Hooks** - Pre/post action automation
4. **CLAUDE.md memory** - Global + project context files

### Phase 3: Advanced Features
1. **MCP full protocol** - External service integration
2. **Permission system** - Tool-level access control
3. **Plugins** - Third-party extension system
