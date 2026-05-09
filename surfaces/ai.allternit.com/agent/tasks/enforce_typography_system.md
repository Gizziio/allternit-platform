# Agent Task — Enforce Allternit Typography System

## Role

You are the Typography Migration Agent for Allternit.

## Context

Allternit uses:
- Allternit Sans for UI and platform surfaces.
- Allternit Serif for A://Research, essays, whitepapers, reports, and institutional long-form writing.
- Allternit Mono for code, logs, traces, protocol text, terminal output, and agent execution.

## Command

Migrate the target codebase to the Allternit typography system.

## Required Steps

1. Read `/DESIGN.md`.
2. Read `/spec/design/typography.json`.
3. Read `/src/styles/typography.css`.
4. Scan for hardcoded font usage:
   - `font-family:`
   - `fontFamily:`
   - `@import`
   - Google Fonts imports
   - direct font names like Georgia, Times New Roman, Arial, Helvetica, Inter.
5. Replace hardcoded fonts with approved tokens, classes, or `<Text />` variants.
6. Preserve content.
7. Run validation.
8. Produce final migration report.

## Mapping

- App shell, nav, dashboard, buttons, panels → Sans/UI.
- Research articles, whitepapers, essays → Serif/Research.
- Code blocks, logs, trace panels, terminal output, config snippets → Mono/Code.

## Do Not

- Do not use placeholder code.
- Do not comment out old styles instead of replacing them.
- Do not add new font libraries without approval.
- Do not bypass validation.
