# Breadcrumbs

## 2026-07-15 — Code Mode hero

- Empty-session hero lives in `surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx` (`LaunchpadStage`); Usage close/restore behavior is covered in `surfaces/ai.allternit.com/src/views/code/CodeCanvas.test.tsx`.
- Full spec: `docs/specs/code-mode-hero-usage-state.md`.

## 2026-07-15 — Code session mount and pane

- Local fallback execution is routed by `surfaces/ai.allternit.com/src/lib/agents/agent-mode-executor.ts`; the missing `code` plugin mapping caused “Plugin not found: undefined”.
- Session layout and the floating launcher live in `surfaces/ai.allternit.com/src/views/code/CodeThreadView.tsx`.
- Launcher component: `surfaces/ai.allternit.com/src/views/code/CodeSessionLauncher.tsx`.
- Pane shell: `surfaces/ai.allternit.com/src/views/code/CodeSessionSidePane.tsx`.
- ACI-only controls: `surfaces/ai.allternit.com/src/views/code/CodeAciPane.tsx`.
- Session transcript view: `surfaces/ai.allternit.com/src/views/code/CodeTranscriptPane.tsx`.
- Detached session window routing: `surfaces/allternit-desktop/src/main/unified-main.ts` (`setWindowOpenHandler`).
- Full spec: `docs/specs/code-session-mount-and-pane.md`.

## 2026-07-16 — Dead prop cleanup

- Removed the unused `onOpenSideTab` prop from `CodeCanvas.tsx` and `CodeThreadView.tsx`; the launcher is now the single source of pane navigation.
