# Build plugins

Plugins bundle skills, commands, agents, hooks, output styles, MCP servers, and LSP servers into a single installable package. Plugins can be shared through a marketplace, loaded from a local path, or shipped as built-ins.

## Plugin structure

A minimal plugin is a directory with a `plugin.json` manifest:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom gizzi-code plugin",
  "author": {
    "name": "Allternit",
    "email": "hello@allternit.com"
  }
}
```

Optional directories and files:

```
my-plugin/
├── plugin.json
├── commands/          # Custom slash commands
├── agents/            # Agent definitions
├── skills/            # Skill markdown files
├── hooks/             # Hook configurations
├── output-styles/     # Output style definitions
├── mcp-servers.json   # MCP server definitions
└── lsp-servers.json   # LSP server definitions
```

## Create a skills-only plugin manually

For a lightweight plugin that only adds skills, create:

```json
{
  "name": "team-skills",
  "version": "1.0.0",
  "description": "Shared team skills"
}
```

And place skill files in `skills/`:

```markdown
---
name: onboarding
description: Answer onboarding questions for new team members.
---

Help new team members get oriented with the repository structure, coding standards, and common commands.
```

## Install a plugin

From a local path:

```bash
gizzi plugin install ./my-plugin
```

From a marketplace repository:

```bash
gizzi plugin install my-plugin --repo https://github.com/example/gizzi-plugins
```

## Enable or disable plugins

```bash
# List installed plugins
gizzi plugin list

# Enable
gizzi plugin enable my-plugin

# Disable
gizzi plugin disable my-plugin
```

## Continue with the builder documentation

For more advanced plugin authoring, including:

- Defining custom slash commands with arguments
- Registering agents and output styles
- Configuring hooks and MCP servers
- Publishing to a marketplace

See the [Plugin authoring guide](../guides/plugin-authoring.md).

## Related pages

- [Build skills](./build-skills.md)
- [Advanced configuration](./advanced-configuration.md)
