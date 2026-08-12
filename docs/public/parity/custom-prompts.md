# Custom prompts

Codex custom prompts turn reusable Markdown instructions into named commands and can declare metadata and arguments. The Allternit equivalent is a Markdown command under `.gizzi-code/command/` or a plugin's `commands/` directory.

## Add metadata and arguments

Create `.gizzi-code/command/review-api.md`:

```markdown
---
name: review-api
description: Review an API change for compatibility and security.
argument-hint: <path> [audience]
arguments: path audience
allowed-tools: Read, Grep, Bash
model: inherit
effort: high
user-invocable: true
when_to_use: Use after changing a public API contract.
version: 1.0.0
---

Review `$path` for the `$audience` audience.

Report breaking changes, authentication risks, migration steps, and missing tests.
Raw invocation arguments: $ARGUMENTS
```

Invoke it in the TUI:

```text
/review-api docs/public/api/reference.md SDK-users
```

Supported command metadata includes `name`, `description`, `argument-hint`, `arguments`, `allowed-tools`, `model`, `effort`, `user-invocable`, `when_to_use`, `version`, and `shell`. The loader parses named arguments for substitution and also exposes the complete argument string as `$ARGUMENTS`.

Use `allowed-tools` as a least-privilege declaration, not as a substitute for sandbox and approval policy. A command can set `user-invocable: false` when it should be available to agent workflows but hidden from direct slash-command invocation.

Project commands belong in `.gizzi-code/command/`. Distributable commands belong in a plugin's `commands/` directory and can refer to plugin assets through the plugin-root substitution supported by the command loader.

## See also

- [Build plugins](../cli/build-plugins.md)
- [Build skills](../cli/build-skills.md)
- [Skill format](../skills/skill-format.md)
