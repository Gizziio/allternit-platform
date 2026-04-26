# Allternit Agent Workspace Examples

This directory contains example agent workspaces demonstrating the 5-layer architecture.

## Examples

### 1. Code Assistant (`code-assistant/`)

A general-purpose coding assistant with focus on software development.

**Features:**
- File system operations within workspace
- Code analysis and refactoring
- Git integration
- Multi-language support

**Best for:** Software developers, code reviews, refactoring tasks

### 2. DevOps Agent (`devops-agent/`)

Infrastructure and deployment automation agent.

**Features:**
- Docker/container management
- Kubernetes operations
- CI/CD pipeline configuration
- Cloud resource management

**Best for:** DevOps engineers, SRE teams, platform teams

### 3. Writing Partner (`writing-partner/`)

Creative writing and content creation assistant.

**Features:**
- Long-form writing support
- Research assistance
- Style guide compliance
- Content organization

**Best for:** Writers, content creators, researchers

### 4. Data Analyst (`data-analyst/`)

Data processing and analysis agent.

**Features:**
- CSV/JSON data processing
- Statistical analysis
- Visualization generation
- Report creation

**Best for:** Data analysts, researchers, business intelligence

## Quick Start

### Using an Example

1. Copy the example to your workspace:
```bash
cp -r 5-agents/examples/code-assistant ~/my-agent
cd ~/my-agent
```

2. Initialize the workspace:
```bash
# Using CLI
allternit workspace init

# Or using Shell UI
# Open Agent Shell → File → Open Workspace → Select folder
```

3. Customize the identity:
```bash
# Edit IDENTITY.md with your preferred editor
vim IDENTITY.md
```

4. Start working:
```bash
# Boot the workspace
allternit workspace boot
```

### Creating Your Own

See the [Tutorial: Build Your First Agent Workspace](../TUTORIAL.md)

## Structure

Each example follows the 5-layer architecture:

```
example-workspace/
├── AGENTS.md           # Supreme law (copied from templates)
├── IDENTITY.md         # Agent identity (customize this!)
├── SOUL.md            # Personality and voice
├── USER.md            # User preferences
├── VOICE.md           # TTS configuration
├── POLICY.md          # Safety rules
├── PLAYBOOK.md        # Operational procedures
├── TOOLS.md           # Tool configuration
├── BRAIN.md           # Task graph
├── MEMORY.md          # Memory index
├── skills/            # Skill definitions
│   ├── filesystem/
│   ├── git/
│   └── ...
└── business/          # Client/project topology (optional)
```

## Customization Guide

### 1. Identity Layer

Edit these files to define who your agent is:

- **IDENTITY.md**: Name, nature, purpose
- **SOUL.md**: Voice, tone, personality
- **USER.md**: Your preferences and expertise level

### 2. Policy Layer

Edit **POLICY.md** to set safety boundaries:

```markdown
## Tool Permissions

| Tool | Action |
|------|--------|
| filesystem.read | allow |
| filesystem.write | require_approval |
| system.exec | deny |
```

### 3. Skills Layer

Add skills to the `skills/` directory:

```bash
# Install from registry
allternit skills install web-search

# Or manually copy
mkdir skills/my-custom-skill
cp SKILL.md contract.json skills/my-custom-skill/
```

### 4. Business Layer

For multi-client setups, edit:

- **CLIENTS.md**: Client registry
- **business/projects/**: Project-specific configs

## Contributing

To add a new example:

1. Create a new directory: `mkdir my-example/`
2. Copy template files: `cp -r templates/allternit_workspace/* my-example/`
3. Customize for your use case
4. Add README.md explaining the example
5. Submit a PR

## See Also

- [Agent Workspace Architecture](../AGENT_WORKSPACE_ARCHITECTURE.md)
- [Tutorial: Build Your First Agent](../TUTORIAL.md)
- [CLI Documentation](../../7-apps/cli/README.md)
