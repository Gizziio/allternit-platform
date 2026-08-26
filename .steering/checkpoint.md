# Steering checkpoint

## Allternit Bot 0.18.0 reconstruction integration into Allternit Platform

### Goal
Port differentiated Allternit Bot features and UI patterns into the Allternit Platform,
following the approved plan: real implementations only, 1000–1500 LOC per feature,
one real end-to-end screen recording per feature.

### Constraints
- No mock, stub, or placeholder code.
- Each feature must work end-to-end and be recorded.
- Work in session worktree `allternit-session-allternit-bot-0-18-integration`.

### Just did
- Created session worktree on branch `session/allternit-bot-0-18-integration`.
- Approved plan written to session plan file.
- Started Feature 0.1: Settings Shell Refactor.
- Audited `SettingsView.tsx` and `settings.config.ts`.

### Next
- Extract `SettingsLayout` component from `SettingsView.tsx`.
- Create section registry in `settings-sections.tsx` so new panels (Router, Usage, Computer) can be added without touching `SettingsView.tsx`.
- Keep all existing settings panels working.
- Run typecheck/lint.
- Record `00-01-settings-shell.mov`.

### Open questions
- None.
