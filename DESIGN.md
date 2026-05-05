# DESIGN.md — Allternit Typography & Brand Enforcement

Version: v1.0  
Brand: Allternit PBC / A://TERNIT

## Core Principle

Allternit typography is not decoration. It is system infrastructure.

Every text surface must communicate authority, clarity, structure, and endurance.

## Typeface Families

### Allternit Sans
Primary platform and interface typeface.

Use for:
- app UI
- navigation
- buttons
- labels
- dashboards
- settings
- system states
- short explanatory text

### Allternit Serif
Institutional and long-form typeface.

Use for:
- A://Research
- whitepapers
- essays
- reports
- editorial pages
- philosophy/theory writing
- institutional statements

### Allternit Mono
Execution and protocol typeface.

Use for:
- code
- logs
- traces
- terminal output
- agent execution steps
- JSON/YAML/config snippets
- protocol text

## Locked Usage Rules

1. Sans is the default UI font.
2. Serif is only for research, editorial, long-form, and institutional material.
3. Mono is only for code, logs, traces, agent output, and protocol/config text.
4. Never assign fonts directly inside components.
5. Always use design tokens, typography components, or approved utility classes.
6. Never randomly mix serif and sans in the same context.
7. The `A://` prefix must be treated as a brand/protocol glyph and kept visually consistent.
8. No decorative or novelty fonts.
9. No ad-hoc font imports unless approved in this file.
10. Any new text style must be added to the typography token system first.

## Surface Mapping

| Surface | Typeface |
|---|---|
| Platform shell | Allternit Sans |
| Dashboard cards | Allternit Sans |
| Buttons | Allternit Sans |
| Navigation | Allternit Sans |
| A://Research article title | Allternit Serif |
| A://Research body | Allternit Serif |
| Whitepapers | Allternit Serif |
| Code blocks | Allternit Mono |
| Agent logs | Allternit Mono |
| Terminal panels | Allternit Mono |

## Text Hierarchy

Platform UI:
- `text-display`
- `text-heading`
- `text-subheading`
- `text-body`
- `text-caption`
- `text-label`
- `text-code`

Research:
- `research-display`
- `research-heading`
- `research-body`
- `research-meta`
- `research-note`

Agent / protocol:
- `agent-log`
- `agent-step`
- `agent-status`
- `protocol-token`

## CSS Token Contract

```css
:root {
  --font-allternit-sans: "Allternit Sans", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-allternit-serif: "Allternit Serif", Georgia, ui-serif, serif;
  --font-allternit-mono: "Allternit Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace;

  --font-ui: var(--font-allternit-sans);
  --font-research: var(--font-allternit-serif);
  --font-code: var(--font-allternit-mono);
}
```

## Component Contract

All text should use typography components, approved CSS utilities, or approved design token classes.

Allowed:

```tsx
<Text variant="body">Platform copy</Text>
<Text variant="researchBody">Research paragraph</Text>
<Text variant="code">agent.execute()</Text>
```

Forbidden:

```tsx
<div style={{ fontFamily: "Georgia" }}>
<div style={{ fontFamily: "Inter" }}>
```

## Migration Rule

When modifying existing UI, agents must:

1. Scan for hardcoded font names.
2. Replace direct font-family usage with tokens.
3. Replace arbitrary text classes with typography variants where possible.
4. Preserve content.
5. Validate no forbidden font patterns remain.
6. Attach validation output to the task report.

## Agent Completion Criteria

A typography migration task is complete only when:

- no unauthorized `font-family` declarations remain
- no direct external font imports remain
- all text surfaces use the typography token system
- research/editorial surfaces use serif correctly
- app UI uses sans correctly
- code/log/protocol surfaces use mono correctly
- validation script passes
