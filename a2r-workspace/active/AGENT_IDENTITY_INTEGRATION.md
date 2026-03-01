# Agent Identity File Integration

## Overview

The TUI now supports loading agent identity from openclaw-style configuration files (`SOUL.md`, `IDENTITY.md`, `HEARTBEAT.md`). This allows agents to have persistent personality, behavioral guidelines, and periodic task definitions.

## File Structure

The TUI looks for agent identity files in the following priority order:

1. **Project-specific**: `./.agent/` (in current working directory)
2. **Workspace**: `~/.openclaw/workspace/`
3. **Global**: `~/.openclaw/agents/main/`

Alternatively, you can use a `.agent/` subdirectory within any of the above locations:
- `~/.openclaw/workspace/.agent/`

## File Format

### IDENTITY.md
```markdown
# IDENTITY.md - Who Am I?

- **Name:** Gizzi
- **Nature:** Persistent distributed intelligence node
- **Vibe:** Sharp, resourceful, autonomous
- **Emoji:** ⚡
- **Avatar:** avatars/openclaw.png
```

### SOUL.md
Contains behavioral guidelines, personality traits, and operational principles for the agent.

### HEARTBEAT.md
Defines periodic tasks and self-check routines that the agent should perform.

## TUI Commands

| Command | Description |
|---------|-------------|
| `/agent` | Show current agent identity |
| `/agent show` | Same as above |
| `/agent info` | Same as above |
| `/agent create` | Create new agent interactively |
| `/agent new` | Same as create |
| `/agent reload` | Reload identity from files |
| `/agent refresh` | Same as reload |
| `/agent soul` | Display SOUL.md content |
| `/agent heartbeat` | Display HEARTBEAT.md content |
| `/agent <name>` | Set active agent by name |

## Creating a New Agent

Use `/agent create` to start an interactive flow:

1. **Name** - Agent identifier (required)
2. **Emoji** - Visual identifier (default: 🤖)
3. **Nature** - What kind of agent (e.g., "Code assistant for Rust")
4. **Vibe** - Personality (e.g., "Concise, thorough, helpful")
5. **Location** - Save to [l]ocal (./.agent/) or [g]lobal (~/.openclaw/workspace/)

The command creates:
- `IDENTITY.md` - Agent metadata
- `SOUL.md` - Behavioral guidelines
- `HEARTBEAT.md` - Periodic task template
- `memory/` - Directory for session logs

## Status Bar Integration

When an agent identity is loaded, the status bar shows:
```
[CHAT] ⚡ Gizzi state connected  activity idle
       ^^^^^^^^
       Agent identity
```

## Implementation Details

### Module Location
- `7-apps/cli/src/commands/tui/agent_identity.rs` - Core identity loading/parsing
- Integrated into `7-apps/cli/src/commands/tui.rs` - TUI commands and display

### Data Structure
```rust
pub struct AgentIdentity {
    pub name: Option<String>,
    pub nature: Option<String>,
    pub vibe: Option<String>,
    pub emoji: Option<String>,
    pub avatar: Option<String>,
    pub soul_content: Option<String>,
    pub identity_content: Option<String>,
    pub identity_fields: HashMap<String, String>,
    pub source_dir: Option<PathBuf>,
}
```

### Key Methods
- `AgentIdentity::load()` - Load from standard locations
- `AgentIdentity::load_from_dir(path)` - Load from specific directory
- `full_display()` - Returns "⚡ Gizzi" format
- `has_soul()` - Check if SOUL.md exists
- `has_heartbeat()` - Check if HEARTBEAT.md exists
- `load_heartbeat()` - Load heartbeat content

### Agent Creation Flow
```rust
enum AgentCreateState {
    Idle,
    PromptName,
    PromptEmoji { name: String },
    PromptNature { name: String, emoji: String },
    PromptVibe { name: String, emoji: String, nature: String },
    PromptLocation { name: String, emoji: String, nature: String, vibe: String },
    Confirm { name: String, emoji: String, nature: String, vibe: String, location: AgentLocation },
}

enum AgentLocation {
    Local,   // ./.agent/
    Global,  // ~/.openclaw/workspace/
}
```

## Testing

Run agent identity tests:
```bash
cargo test agent_identity
```

Tests cover:
- Parsing IDENTITY.md content
- Display formatting
- Default values

## Implementation Details

### New Methods in TuiApp
- `start_agent_creation()` - Begin the creation prompt flow
- `handle_agent_creation_input(input)` - Process each step of the flow
- `save_agent_files(...)` - Write all agent files to disk

### File Templates
When creating a new agent, the following templates are used:

**IDENTITY.md:**
```markdown
- **Name:** {name}
- **Nature:** {nature}
- **Vibe:** {vibe}
- **Emoji:** {emoji}
- **Avatar:** avatars/default.png
```

**SOUL.md:**
Contains behavioral guidelines with the agent's identity embedded.

**HEARTBEAT.md:**
Empty template ready for periodic task definitions.

## Future Enhancements

Potential improvements:
1. Hot-reload of identity files on change
2. Project-specific agent switching
3. Integration with `/subagent` for spawning agents with specific identities
4. Heartbeat task execution in TUI
5. SOUL.md content injection into system prompts
6. Edit existing agent files from TUI
