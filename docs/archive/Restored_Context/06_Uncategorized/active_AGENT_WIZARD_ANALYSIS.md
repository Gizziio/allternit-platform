# Agent Creation Wizard - Complete Flow Analysis

## Current Issues

### 1. Storage Inconsistency
```
Studio Format:    .opencode/agent/{name}.md
OpenClaw Format:  .agent/IDENTITY.md, SOUL.md, HEARTBEAT.md
```

**Problem**: These are fundamentally different storage approaches
- Studio: Named files per agent (supports multiple agents)
- OpenClaw: Fixed filenames (single agent per directory)

### 2. Missing Common Features
Neither format creates the same outputs:

| Feature | Studio | OpenClaw |
|---------|--------|----------|
| Multiple agents in same dir | ✅ Yes | ❌ No |
| YAML frontmatter | ✅ Yes | ❌ No |
| Tool permissions | ✅ Yes | ❌ No |
| Mode selection | ✅ Yes | ❌ No |
| Emoji/Nature/Vibe | ❌ No | ✅ Yes |
| HEARTBEAT.md | ❌ No | ✅ Yes |
| Memory directory | ❌ No | ✅ Yes |
| SOUL.md | ❌ No | ✅ Yes |

## Wizard State Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│  STATE: Idle                                                    │
│  Trigger: /agent create                                         │
│  Action: Show intro banner, transition to PromptName            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptName                                              │
│  Input: String                                                  │
│  Validation: ^[a-z0-9_-]+$                                      │
│  Transform: to_lowercase(), spaces → hyphens                    │
│  Error: "Invalid name: {reason}"                                │
│  Success: Store name, transition to PromptFormat                │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptFormat                                            │
│  Input: "s" / "studio" or "o" / "openclaw"                      │
│  Data: name (String)                                            │
│  Action: Store format, transition to PromptStorage              │
│  Error: "Invalid choice"                                        │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptStorage                                           │
│  Input: "p" / "project" or "g" / "global"                       │
│  Data: name, format                                             │
│  Check: agent_exists(name, storage, format)                     │
│  Error if exists: "Agent already exists, try different name"    │
│  Success: Store storage, transition to PromptDescription        │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptDescription                                       │
│  Input: String (free text)                                      │
│  Data: name, format, storage                                    │
│  Validation: Required, non-empty                                │
│  Examples shown: "Code reviewer focused on Rust safety"         │
│  Success: Store description, transition to PromptGeneration     │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptGenerationMethod                                  │
│  Input: "m" / "manual" or "a" / "ai"                            │
│  Data: name, format, storage, description                       │
│  Branch A (Manual): Different paths per format                  │
│  Branch B (AI): Call generate_agent_via_ai()                    │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌─────────────────┐
│ Manual Path   │    │ AI Path         │
└───────┬───────┘    └────────┬────────┘
        │                     │
        ▼                     ▼
[Format-specific branches]  [AI Generation]


MANUAL PATH - STUDIO FORMAT:
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptModeStudio                                        │
│  Input: Multi-line text (ends with "." on its own line)         │
│  Data: name, storage, description, system_prompt (accumulating) │
│  Action: Collect system prompt lines until "."                  │
│  Success: Store system_prompt, transition to PromptToolsStudio  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptToolsStudio                                       │
│  Input: "p" / "s" / "a" (mode selection)                        │
│  Data: + system_prompt                                          │
│  Tools: Currently ALL enabled (simplified)                      │
│  Should: Multi-select overlay for tools                         │
│  Success: Store mode/tools, transition to ReviewStudio          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: ReviewStudio                                            │
│  Display: All collected data in formatted table                 │
│  Input: "y" / "yes" or "n" / "no"                               │
│  Action Y: save_agent_studio() → Done                           │
│  Action N: Cancel → Idle                                        │
└─────────────────────────────────────────────────────────────────┘


MANUAL PATH - OPENCLAW FORMAT:
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptEmojiOpenClaw                                     │
│  Input: Single emoji or empty (default: 🤖)                     │
│  Data: name, storage, description                               │
│  Success: Store emoji, transition to PromptNatureOpenClaw       │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptNatureOpenClaw                                    │
│  Input: String (required)                                       │
│  Data: + emoji                                                  │
│  Examples: "Code assistant for Rust development"                │
│  Success: Store nature, transition to PromptVibeOpenClaw        │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptVibeOpenClaw                                      │
│  Input: String or empty (default: "Helpful and professional")   │
│  Data: + nature                                                 │
│  Examples: "Helpful, concise, thorough"                         │
│  Success: Store vibe, transition to PromptSystemPromptOpenClaw  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: PromptSystemPromptOpenClaw                              │
│  Input: Multi-line text (ends with ".")                         │
│  Data: + vibe                                                   │
│  Default: Auto-generated from name/description/vibe             │
│  Success: Store system_prompt, transition to ReviewOpenClaw     │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: ReviewOpenClaw                                          │
│  Display: All collected data + list of files to be created      │
│  Input: "y" / "yes" or "n" / "no"                               │
│  Action Y: save_agent_openclaw() → Done                         │
│  Action N: Cancel → Idle                                        │
└─────────────────────────────────────────────────────────────────┘


AI PATH (Both Formats):
┌─────────────────────────────────────────────────────────────────┐
│  STATE: GeneratingAi                                            │
│  Action: Call generate_agent_via_ai()                           │
│  Current: Template-based (placeholder)                          │
│  Future: Actual LLM call to kernel                              │
│  Returns: GeneratedAgent { identifier, when_to_use,             │
│                           system_prompt }                       │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌─────────────────┐
│ Studio Format │    │ OpenClaw Format │
│ → ReviewAiStudio│   │ → PromptEmoji   │
│   (direct)    │    │   (needs more)  │
└───────────────┘    └─────────────────┘
```

## Current Assisted Measures

### 1. Name Validation
```rust
validate_agent_name(name: &str) -> Result<(), String>
```
- Pattern: `^[a-z0-9_-]+$`
- First char must be alphanumeric
- Auto-transforms: spaces → hyphens, lowercase

### 2. Duplicate Detection
```rust
agent_exists(name, storage, format) -> bool
```
- Prevents overwriting existing agents
- Check happens before file creation

### 3. Default Values
| Field | Default Value |
|-------|---------------|
| emoji | 🤖 |
| vibe | "Helpful and professional" |
| system_prompt (OpenClaw) | Auto-generated template |
| tools | ALL enabled |
| mode (AI path) | "all" |

### 4. AI Generation (Template-Based)
```rust
generate_agent_via_ai(name, description, format, storage)
```
- Currently uses template strings
- Future: Kernel LLM integration
- Generates: identifier, when_to_use, system_prompt

### 5. Path Resolution
```rust
get_agent_storage_path(storage, format) -> PathBuf
```
- Project: Relative to CWD
- Global: Uses HOME env var
- Creates directories automatically

## Deep Customizations Available

### Studio Format
1. **Tool Permissions**
   - Currently: All enabled (simplified)
   - Should: Multi-select UI for each of 12 tools
   - Stored: Only disabled tools in YAML

2. **Mode Selection**
   - Options: primary / subagent / all
   - Affects: How agent can be invoked

3. **System Prompt**
   - Multi-line input support
   - No character limit
   - Written in second person

4. **Storage Location**
   - Project: `.opencode/agent/`
   - Global: `~/.opencode/agent/`

### OpenClaw Format
1. **Identity Fields**
   - emoji: Visual identifier
   - nature: What the agent is
   - vibe: Personality/behavior
   - avatar: Image path

2. **System Prompt (SOUL.md)**
   - Includes identity context
   - Behavioral guidelines
   - Session reminders
   - Core truths/principles

3. **Heartbeat Tasks**
   - Template in HEARTBEAT.md
   - User fills in periodic tasks
   - Parsed by heartbeat system

4. **Memory System**
   - Creates `memory/` directory
   - Daily log files
   - Long-term MEMORY.md

5. **Storage Location**
   - Project: `.agent/`
   - Global: `~/.openclaw/workspace/`

## What Should Be Unified

### Option 1: Unified Storage (Recommended)
Create BOTH formats in the same location:
```
.agents/
├── {name}.md                    # Studio format (primary)
├── {name}/
│   ├── IDENTITY.md              # OpenClaw format (identity)
│   ├── SOUL.md                  # (merged with {name}.md)
│   ├── HEARTBEAT.md             # (heartbeat tasks)
│   └── memory/                  # (session logs)
└── registry.json                # Agent registry/index
```

**Benefits:**
- Single location for all agents
- Supports multiple agents
- Maintains both format benefits
- Registry for quick lookup

### Option 2: Unified File Format
Create a new format that includes everything:
```yaml
---
name: my-agent
emoji: 🤖
nature: Code assistant
vibe: Helpful and concise
mode: primary
tools:
  bash: true
  edit: false
heartbeat:
  - "Check email every 4h"
  - "Review git status"
---

# System Prompt
You are my-agent, a code assistant...

## Core Truths
...
```

**Benefits:**
- Single file per agent
- All features in one place
- Simpler to parse
- Easier to share

### Option 3: Convergent Paths
Both formats produce the SAME files:

**Studio mode creates:**
- `{name}.md` (YAML frontmatter)
- `{name}/HEARTBEAT.md` (if heartbeat tasks added)
- `{name}/memory/` (if sessions exist)

**OpenClaw mode creates:**
- Same `{name}.md` but with identity fields in frontmatter
- Same directory structure

**Key:** Both use named directories, both support multiple agents.

## Recommended Changes

### 1. Unified Directory Structure
```
.agents/                         # Single location
├── registry.yaml                # Index of all agents
├── my-agent/
│   ├── agent.yaml               # Main config (merged format)
│   ├── system.md                # System prompt
│   ├── heartbeat.md             # Periodic tasks
│   └── memory/
│       └── 2024-01-15.md
└── another-agent/
    └── ...
```

### 2. Wizard Flow Simplification
Remove the format choice - always create unified format:
```
1. Name
2. Storage (project/global)
3. Description
4. Identity (emoji, nature, vibe)
5. Mode (primary/subagent/all)
6. Tools (multi-select)
7. System Prompt (manual or AI)
8. Heartbeat tasks (optional)
9. Review & Create
```

### 3. Rename Platform References
- `.opencode/agent/` → `.allternit/agents/`
- `~/.opencode/agent/` → `~/.allternit/agents/`
- `.agent/` → `.allternit/agents/` (unified)
- `~/.openclaw/workspace/` → `~/.allternit/workspace/`

### 4. Add Missing Features
- [ ] Multi-select tool UI
- [ ] Real LLM integration for AI mode
- [ ] Heartbeat task editor
- [ ] Agent import/export
- [ ] Format conversion
