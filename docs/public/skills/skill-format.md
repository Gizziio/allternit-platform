# SKILL.md Package Format

A **skill** is a self-contained agent capability package. It lives as a directory under `~/.allternit/skills/` and is declared by a `SKILL.md` manifest file.

## Directory Layout

```text
~/.allternit/skills/
└── allternit-powerpoint/
    ├── SKILL.md
    └── powerpoint.ts      # entrypoint, relative to the skill directory
```

## Front Matter

`SKILL.md` begins with YAML front matter between triple dashes.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Canonical skill ID, e.g. `allternit/powerpoint`. |
| `version` | `string` | SemVer version, e.g. `0.1.0`. |
| `description` | `string` | Short human-readable summary. |
| `tools` | `string[]` | Names of the tools this skill exposes. |
| `entrypoint` | `string` | Relative path to the implementation module. |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `progressive_disclosure` | `object` | Structured disclosure levels (see below). |

## Progressive Disclosure

Skills may surface only a subset of tools initially and reveal more as trust or context grows. The `progressive_disclosure` section describes those levels.

### As Front Matter

```yaml
---
name: allternit/powerpoint
version: 0.1.0
description: Generate PowerPoint presentations
tools:
  - create_presentation
  - add_slide
entrypoint: powerpoint.ts
progressive_disclosure:
  levels:
    - name: basic
      trigger: first user request to create a deck
      tools:
        - create_presentation
    - name: full
      trigger: user asks to edit an existing deck
      tools:
        - create_presentation
        - add_slide
---
```

### As a Markdown Section

You may also describe disclosure levels in a `## Progressive disclosure` section after the front matter:

```markdown
## Progressive disclosure

- **basic**: `create_presentation` only, triggered when the user asks for a new deck.
- **full**: adds `add_slide` once the user wants to iterate on content.
```

## Validation

The skill registry (`sdk/allternit-sdk/src/ai-runtime/skills/registry.ts`) loads every skill directory and validates that:

1. `SKILL.md` exists and is readable.
2. Required front-matter fields are present and correctly typed.
3. `version` looks like semantic versioning (`major.minor.patch`).
4. `tools` is a non-empty array of non-empty strings.
5. `entrypoint` is a non-empty string.

Malformed skills are reported as load-time errors and are not surfaced to agents.

## Example

```markdown
---
name: allternit/powerpoint
version: 0.1.0
description: Generate and edit .pptx presentations
tools:
  - create_presentation
  - add_slide
entrypoint: powerpoint.ts
---

## Progressive disclosure

- **basic**: `create_presentation` when the user asks for a new deck.
- **full**: `add_slide` when the user wants to extend an existing deck.
```
