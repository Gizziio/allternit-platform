# Allternit Typography Enforcement Rule

Read before editing any UI or text surface:

1. `/DESIGN.md`
2. `/spec/design/typography.json`
3. `/src/styles/typography.css`

## Hard Rules

- Do not hardcode font families.
- Do not import unapproved fonts.
- Do not use arbitrary serif/sans/mono styling.
- Do not rewrite user-facing content unless explicitly asked.
- Do not create new text styles without adding them to the token system.

## Required Usage

- Platform UI: Allternit Sans via `--font-ui` or typography components.
- Research/editorial: Allternit Serif via `--font-research` or typography components.
- Code/logs/protocol: Allternit Mono via `--font-code` or typography components.

## Completion Gate

Run:

```bash
python scripts/validate-typography.py
```

The task is not complete unless validation passes.
