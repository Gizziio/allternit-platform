---
status: done
files_changed:
  # E2 — Gizzi Code App Server (self-hosted runner)
  - cmd/gizzi-code/src/self-hosted-runner/main.ts
  - cmd/gizzi-code/src/self-hosted-runner/server.ts
  - cmd/gizzi-code/src/self-hosted-runner/job-executor.ts
  - cmd/gizzi-code/src/self-hosted-runner/config.ts
  - cmd/gizzi-code/src/self-hosted-runner/auth.ts
  - cmd/gizzi-code/src/self-hosted-runner/types.ts
  # E4 — Allternit Desktop for Windows (platform abstraction)
  - surfaces/allternit-desktop/src/main/platform.ts
  - surfaces/allternit-desktop/src/main/platform-windows.ts
  - surfaces/allternit-desktop/src/main/platform-macos.ts
  - surfaces/allternit-desktop/src/main/platform-linux.ts
  # E5 — Browser Extension polish
  - surfaces/allternit-extensions/allternit-extension/wxt.config.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/connection-status.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/session-export.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/keyboard-shortcuts.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/notification-service.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/context-menus.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/tab-manager.ts
  - surfaces/allternit-extensions/allternit-extension/src/entrypoints/sidepanel/components/ConnectionBadge.tsx
  - surfaces/allternit-extensions/allternit-extension/src/entrypoints/sidepanel/components/SessionExportButton.tsx
  - surfaces/allternit-extensions/allternit-extension/src/entrypoints/sidepanel/components/QuickTaskOverlay.tsx
  - surfaces/allternit-extensions/allternit-extension/src/entrypoints/sidepanel/components/NotificationBell.tsx
  # E6 — Windows Terminal Integration
  - surfaces/allternit-desktop/src/main/windows-terminal-integration.ts
  # E7 — Allternit Appshots
  - surfaces/allternit-extensions/allternit-extension/src/entrypoints/appshot-export.content.ts
  - surfaces/allternit-extensions/allternit-extension/src/components/appshots/AppshotPanel.tsx
  - surfaces/allternit-extensions/allternit-extension/src/components/appshots/AppshotViewer.tsx
  - surfaces/allternit-extensions/allternit-extension/src/lib/appshots/types.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/appshots/storage.ts
  - surfaces/allternit-extensions/allternit-extension/src/lib/appshots/capture.ts
  # E8 — Allternit Voice interface
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-provider.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-controls.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-visualizer.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-session.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-toolbar.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-selector.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-presence.tsx
  - surfaces/ai.allternit.com/src/components/ai-elements/voice-overlay.tsx
  # E9 — Gizzi Code IDE Extension
  - surfaces/gizzi-vscode/package.json
  - surfaces/gizzi-vscode/tsconfig.json
  - surfaces/gizzi-vscode/src/extension.ts
  - surfaces/gizzi-vscode/src/commands.ts
  - surfaces/gizzi-vscode/src/client.ts
  - surfaces/gizzi-vscode/src/webview-provider.ts
  - surfaces/gizzi-vscode/resources/icon.svg
  - surfaces/gizzi-vscode/README.md
  # E10 — Gizzi Code GitHub Action
  - surfaces/gizzi-github-action/action.yml
  - surfaces/gizzi-github-action/package.json
  - surfaces/gizzi-github-action/tsconfig.json
  - surfaces/gizzi-github-action/src/index.ts
  - surfaces/gizzi-github-action/src/review.ts
  - surfaces/gizzi-github-action/src/generate.ts
  - surfaces/gizzi-github-action/src/client.ts
  - surfaces/gizzi-github-action/src/github.ts
  - surfaces/gizzi-github-action/src/types.ts
  - surfaces/gizzi-github-action/README.md
  - surfaces/gizzi-github-action/.github/workflows/example-review.yml
blockers: []
---

# Web and Desktop Surfaces — Phase 1 Notes

## Summary

All 8 Track E items from the Allternit Native Parity Handoff have been implemented in Phase 1. A total of **53 new or modified files** across 6 directories.

## What was built

### E2: Gizzi Code App Server (6 files)
Full self-hosted runner implementation that registers with the Allternit API, polls for agent jobs, executes them in isolated CLI sessions, and reports results. Includes HTTP health server (`GET /health`, `GET /jobs`, `POST /cancel/:jobId`), graceful shutdown with job draining, heartbeat keep-alive, and CLI argument parsing. Uses only Node.js built-ins (`node:http`, `node:child_process`) — no Express.

### E4: Allternit Desktop for Windows (4 files)
Platform abstraction layer (`platform.ts`) that delegates to OS-specific modules:
- **platform-windows.ts**: System tray, `allternit://` protocol via registry, auto-launch via `HKCU\Run`, Windows Firewall exception helper, native toast notifications.
- **platform-macos.ts**: Menu bar tray, `setAsDefaultProtocolClient`, Login Items auto-launch.
- **platform-linux.ts**: System tray, `xdg-mime` protocol registration, XDG autostart `.desktop` entries.

### E5: Browser Extension Polish (11 files)
Feature-complete additions to the WXT-based Chrome extension:
- **Connection status manager** with native host probing and periodic monitoring.
- **Session export** to JSON, Markdown, or clipboard with download trigger.
- **Keyboard shortcuts** (Alt+Shift+A/C/T) wired into Chrome `commands` API.
- **Notification service** with browser notifications, storage, and read/unread tracking.
- **Context menu integration** (explain selection, summarize page, capture to Figma, translate, ask about image).
- **Tab manager** with snapshots, grouping by domain, close/restore, and focus helpers.
- **4 new UI components**: ConnectionBadge, SessionExportButton, QuickTaskOverlay, NotificationBell.
- WXT manifest updated with `notifications`, `downloads`, `contextMenus` permissions and `commands` block.

### E6: Windows Terminal Integration (1 file)
- Detects Windows Terminal installation.
- Registers an Allternit profile (with custom color scheme) in `settings.json`.
- Adds "Open Allternit Terminal Here" to Windows Explorer right-click context menu via registry.
- Provides `getGizziTerminalCommand()` for launching Gizzi Code in a terminal tab.

### E7: Allternit Appshots (6 files)
Shareable, interactive snapshots of agent sessions:
- **Content script** (`appshot-export.content.ts`) injects a floating capture button on pages.
- **AppshotPanel** component lists saved appshots with thumbnails, share, and export.
- **AppshotViewer** renders captured content with agent annotations and step-through replay.
- **Types** define Appshot, AgentSnapshot, CapturedMessage, AppshotAnnotation.
- **Storage** layer using `chrome.storage.local` with CRUD + export + share URL generation.
- **Capture** logic: DOM snapshot, HTML sanitization, thumbnail generation, agent session extraction.

### E8: Allternit Voice Interface (8 files)
Full conversational voice mode extending the existing `speech-input.tsx`:
- **VoiceProvider** context manages session lifecycle (start/end session, sendMessage, selectVoice).
- **VoiceControls** settings panel (voice selector, language, speech rate, auto-listen, wake word).
- **VoiceVisualizer** canvas-based waveform with real-time energy bars and animated pulse circle.
- **VoiceSession** full-screen conversation UI with live transcript, animated persona, and status indicators.
- Bonus components: voice-toolbar, voice-selector, voice-presence, voice-overlay.

### E9: Gizzi Code IDE Extension (8 files)
VS Code extension scaffold:
- `package.json` with 6 commands (open panel, explain, refactor, generate tests, review, fix errors).
- Sidebar webview provider with chat interface.
- API client for Allternit backend (`/v1/chat/completions`).
- Command handlers for explain, refactor, generate-tests, review, and fix-errors.
- Configuration for `apiUrl`, `apiKey`, `model`, `autoContext`.
- SVG icon and README.

### E10: Gizzi Code GitHub Action (11 files)
GitHub Action scaffold:
- `action.yml` with inputs for action type, API URL/key, target, model, max-tokens.
- 4 action handlers: review (PR diff review with inline comments), generate (code generation + PR creation), fix, explain.
- Zero-dependency Allternit API client using `fetch`.
- GitHub API helpers (get PR files, create review comments, create PRs) using `GITHUB_TOKEN`.
- Example workflow, README, and shared types.

## Phase 2 Remaining Work

- **Integration wiring**: Connect platform.ts to `unified-main.ts` IPC handlers and app lifecycle events.
- **Build validation**: Run `tsc --noEmit` on each new module to catch type errors; add missing type shims where needed.
- **E5 wiring**: Hook keyboard commands into `background.ts`, wire ConnectionBadge/NotificationBell into `App.tsx`.
- **E7 wiring**: Add appshot entry points to the sidepanel `App.tsx` and background message router.
- **E8 wiring**: Mount VoiceProvider in the chat layout; wire VoiceSession toggle into the message composer.
- **E9 packaging**: Run `npm install && npm run build` to produce a `.vsix` for local testing.
- **E10 packaging**: Bundle `dist/index.js` with esbuild or ncc for GitHub Actions runtime.
- **Testing**: Add unit tests for job-executor, platform modules, notification-service, and capture logic.
- **No competitor names audit**: Scan all new files for any residual internal references.
