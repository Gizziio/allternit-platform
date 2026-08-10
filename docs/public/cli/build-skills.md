:# Build skills

Skills are reusable prompt-and-tool packages that extend what `gizzi-code` can do. A skill can define slash commands, system instructions, tools, and metadata. Skills live in markdown files with YAML frontmatter.

## Where `gizzi-code` loads local skills

Local skills are discovered from:

- `~/.config/gizzi/skills/` — user-level skills available in every project.
- `.gizzi/skills/` — project-level skills scoped to the current repository.
- Additional paths configured in `config.toml`:
  ```toml
  skills = ["~/my-skills", "./team-skills"]
  ```

Skills loaded later override earlier ones by name.

## Create a skill

Create a markdown file in a skills directory:

```markdown
---
name: run-tests
version: 1.0.0
description: Run the project test suite and summarize failures.
author: allternit
tags: [testing, ci]
tools: [bash, file.read]
---

# run-tests

Run the appropriate test command for the project. Prefer `npm test`, `bun test`, `cargo test`, or `pytest` based on the files present. After running, summarize the results, including the number of passing and failing tests and the first few failure messages.
```

Frontmatter fields:

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique skill identifier. |
| `version` | Yes | Semver string. |
| `description` | Yes | Short summary shown in listings. |
| `author` | No | Author name or org. |
| `tags` | No | Array of category tags. |
| `tools` | No | Tools the skill is allowed to use. |

## Optional metadata

You can add extra frontmatter to control how the skill is presented and executed:

```yaml
---
name: review-pr
model: anthropic/claude-4
variant: high
permission_mode: ask
---
```

Supported optional fields include:

- `model` — default model for the skill.
- `variant` / `effort_level` — reasoning effort.
- `permission_mode` — default permission mode when the skill runs.
- `sandbox` — sandbox preset override.

## Enable or disable local skills

Project-level skills are enabled automatically when `.gizzi/skills/` exists. To disable skill loading for a single invocation:

```bash
gizzi --disable-skills "quick question"
```

To disable specific skills by name, use the `tools` config:

```toml
[tools]
run-tests = false
```

## Best practices

- Keep skills focused on one task or workflow.
- Document expected inputs and outputs in the markdown body.
- Pin a `version` and bump it when behavior changes.
- Use `tools` to declare the least-privilege tool set the skill needs.
- Store project-specific skills in `.gizzi/skills/` and shared skills in `~/.config/gizzi/skills/`.

## Related pages

- [Build plugins](./build-plugins.md)
- [Advanced configuration](./advanced-configuration.md)
