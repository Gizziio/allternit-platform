# Choices

## 2026-07-15 — Code Mode hero

- Replaced the closed Usage dashboard with a compact “Show usage” control; kept Usage reversible without restoring unrelated setup actions.
- Removed the Scaffold/Refactor/Debug/Optimize/Explore quick-action pills from the empty-session hero.
- Full spec: `docs/specs/code-mode-hero-usage-state.md`.

## 2026-07-15 — Code session workspace pane

- Made the floating launcher the single owner of Terminal, Diff, and ACI navigation; each expanded pane now has only its local controls.
- Replaced the labeled restore control with a minimal Terminal / Diff / ACI / ellipsis launcher row; detailed actions stay in contextual menus.
- Connected Terminal, Diff, Files, Artifacts, and ACI to their respective backend services instead of leaving them as UI placeholders.
- Added a dedicated transcript pane reached from the launcher ellipsis.
- Added a detached Electron window path for “Open in → New window” that hides the mode switcher and shows a session-only rail.
- Updated the Electron main-window `setWindowOpenHandler` so the detached-session fallback also opens a new `BrowserWindow` instead of the external browser.
- Full spec: `docs/specs/code-session-mount-and-pane.md`.

## 2026-07-16 — Dead prop cleanup

- Removed the unused `onOpenSideTab` prop and its outdated `'files' | 'preview' | 'terminal' | 'git'` type from `CodeCanvas.tsx`; navigation is now owned entirely by `CodeSessionLauncher` and the right-side pane.
