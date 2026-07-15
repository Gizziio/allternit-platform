# Allternit Code Mode — Terminal-GUI Audit & Competitive Gap Analysis

**Date:** 2026-07-14  
**Scope:** `surfaces/ai.allternit.com/src/views/code/*`, canvas/tile system, terminal integration, session model  
**Auditor:** Kimi Code CLI  
**Visual evidence:** Claude Code Desktop frames extracted from user-provided screen recording (`/Users/macbook/Downloads/Screen Recording 2026-07-14 at 12.35.04 PM.mov`) and screenshots (`Screenshot 2026-07-14 at 12.34.17 PM.png`, `Screenshot 2026-07-14 at 12.55.47 PM.png`). Codex Desktop was **not** visually audited; observations for Codex come from public docs/CLI help only.

---

## 1. What the visual evidence actually shows (Claude Code Desktop)

### 1.1 Home / regular start view (screenshot 12.55.47 PM)

This is the view the user wants Allternit Code Mode landing to resemble:

- **Top header:** “What’s up next, Joe?” with Claude logo.
- **Stats/dashboard card:** sessions, messages, tokens, active days, streaks, peak hour, favorite model, plus a heatmap grid. Light, not overpowering.
- **Workspace context pills above the composer:** `Local` | `allternit` (folder icon) | `main` (git branch icon) | `worktree` (tag icon) | `[+]`.
- **Usage/limit banner** above the composer when applicable.
- **Long, narrow, bottom-docked composer:** full-width, rounded, placeholder *“Describe a task or ask a question”*.
- **Composer bottom row:** approval mode (`Accept edits`), attach (`+`), microphone, model selector (`Sonnet 5`), quality (`High`).
- **Small mascot** in the bottom-right corner, next to the composer — not centered, not the hero.

### 1.2 Code tab / session view (screen recording frames 1, 5, 10, 15, 17–19)

- **Left sidebar:** persistent session switcher (Home/Code tabs, New session, Artifacts, Customize, More, Recents list).
- **Main surface:** chat transcript. Chat is the main surface, not replaced by a terminal.
- **Top-right toolbar:** terminal, diff/files, browser, overflow menu. Clicking opens a right-side pane.
- **Right pane:** Terminal, Browser, or Working-tree diff. Slides in, not a permanent side tab set.
- **Bottom composer bar:** workspace/branch selector (`allternit main`), diff stats (`+8,292 −7,552`), “Commit changes” button, composer input (`Type / for commands`), approval mode, model selector.

### 1.3 Key takeaway from the visuals

Claude Code Desktop is **chat-main with instant tool panes**, not terminal-first. The landing is a command-center (stats + workspace pills + bottom composer). The session view adds a toolbar to summon terminal/diff/browser and a bottom workspace bar. The mascot is small and sits next to the composer, not in the center of the screen.

---

## 2. Current Allternit Code Mode audit

### 2.1 What exists today

| Area | Implementation | Grade |
|------|----------------|-------|
| **Session model** | `CodeSessionStore` — mode-specific, SSE-synced. Strong parity with Claude. | A- |
| **Workspace model** | `CodeModeStore` — localStorage-backed workspaces with repo status, instructions, files, canvas metadata. | B+ |
| **Thread view landing** | `CodeCanvas` → `LaunchpadStage` with centered `CodeLaunchBranding` (Gizzi mascot + animated greeting) and a centered `ChatComposer`. | C |
| **Thread view conversation** | `CodeCanvas` → `ConversationStage` — vertically-scrolling chat bubbles + bottom composer. | B- |
| **Right side pane** | `CodeSessionSidePane` — Files / Preview / Terminal / Git tabs. **Only renders when a session already exists.** | B |
| **Terminal** | `UnifiedTerminal` via workspace service WebSocket, hardcoded `sessionId="allternit-session"`, no session/working-dir binding. | B- |
| **Canvas view** | `CodeCanvasView` — infinite pan/zoom canvas with draggable tiles (session, preview, diff, terminal, notes, knowledge, knowledge-graph). | B+ |
| **Diff review** | Diff tiles + `H5iDiffPanel`. Parses unified diff; no syntax highlighting or hunk navigation. | B- |
| **File explorer** | `ExplorerView` in side pane. Exists but is not wired as an active file editor. | B- |
| **Git integration** | `GitView` in side pane. Basic status view. | B- |
| **Keyboard shortcuts** | Canvas has zoom/pan/undo; thread view has almost none. | C |
| **Mode/policies** | `SAFE / DEFAULT / AUTO / PLAN` modes exist in state but are weakly surfaced. | C+ |

### 2.2 The real problem: the landing looks like a chatbot, not a command center

`CodeCanvas.tsx:854-946` branches the UI into two chat-first stages:

1. **`LaunchpadStage`** — full-screen branded landing with `CodeLaunchBranding`, Gizzi mascot as the visual center, animated tagline, and a prominent centered `ChatComposer`. Placeholder: *“Describe what you want to build or modify...”* (`CodeCanvas.tsx:1072`).
2. **`ConversationStage`** — scrolling chat transcript.

`CodeThreadView.tsx:99-135` shows the side-pane toggle button only when `hasSession` is true. `CodeThreadView.tsx:195-263` shows the side pane (Files/Preview/Terminal/Git) only when `hasSession && !isPreviewCollapsed`. **The side pane is correctly gated behind a session.** The issue is not that tools are hidden; it is that the landing does not feel like a coding workspace before the session starts.

Specifically:
- Composer is centered, not bottom-docked.
- Mascot is the visual hero, not a companion to the input.
- Workspace context (environment, project, branch, worktree) is buried inside the composer bottom dock (`CompactUtilityBar`) instead of being visible pills above the input.
- There is no integrated toolbar in the session view to summon terminal/diff/browser instantly.
- There is no bottom workspace bar showing branch/diff stats/commit.

### 2.3 The side pane is weak even when it appears

`CodeSessionSidePane.tsx` has four tabs, but:

- It is a **tab set**, not a toolbar-summoned pane. Only one tab is visible at a time.
- Terminal defaults to `sessionId="allternit-session"` (`CodeSessionSidePane.tsx:93`), not the active code session.
- There is no visible working-directory / branch / commit context in the terminal header.
- Preview uses a hardcoded `http://localhost:3000` iframe (`CodePreviewPane.tsx`).
- Files tab is read-only navigation; there is no in-pane editor.
- Git tab is a basic status view.

### 2.4 Canvas view is partial progress

`CodeCanvasView` is closer to the terminal-GUI paradigm: draggable tiles, terminal tile, preview tile, diff tile, session tile. But:

- Default layout is `thread`, not `canvas` (`CodeModeStore.ts:707-709`).
- Session tiles still render chat (`CodeCanvasTileSession` wraps `StreamingChatComposer`).
- Terminal tiles lack a real PTY (per `SESSION-GAP-ANALYSIS.md:45`).
- Diff tiles lack syntax highlighting and hunk navigation.
- There is no persistent file editor tile.

---

## 3. Competitor benchmark

### 3.1 Claude Code Desktop — visually audited

Source: user-provided screen recording and screenshots.

| Feature | Home/start view | Code-tab session view |
|---------|-----------------|----------------------|
| **Primary surface** | Empty command center | Chat transcript |
| **Header** | “What’s up next, [name]?” | Session name + toolbar |
| **Dashboard** | Stats card (sessions, messages, tokens, heatmap) | — |
| **Workspace pills** | `Local \| project \| branch \| worktree` above composer | Bottom bar: `repo branch +N −M Commit changes` |
| **Composer** | Long, bottom-docked, rounded | Long, bottom-docked, rounded |
| **Mascot** | Small, bottom-right corner next to composer | — |
| **Toolbar** | — | Top-right: terminal, diff/files, browser, overflow |
| **Right pane** | — | Terminal / Browser / Working-tree diff |
| **Approval mode** | Bottom-left of composer | Bottom-left of composer |
| **Model selector** | Bottom-right of composer | Bottom-right of composer |

**Mental model:** landing = command center; session = chat + instant tool panes + workspace context bar.

### 3.2 OpenAI Codex (Desktop / CLI) — docs/CLI only, not visually audited

Source: `codex --help`, OpenAI Codex app announcement, public CLI guides.

| Feature | How Codex does it (from docs) |
|---------|-------------------------------|
| **CLI-first identity** | `codex` CLI is terminal-native; desktop app is a command center layered on top. |
| **Project/thread model** | Work organized by projects and threads; each thread can run in its own worktree. |
| **In-app diff review** | Built-in Git diff review, commit/push/PR workflows. |
| **Browser preview** | Local browser preview inside the app. |
| **Multi-terminal** | Multiple terminal tabs per thread (April 2026 update). |
| **Approval flow** | Red/green diffs in terminal; user approves/rejects changes. |
| **Skills / plugins** | Curated skill/plugin system for workflows. |

**Caveat:** These observations are from documentation and CLI help, not from direct screenshots or screen recordings.

### 3.3 Comparison matrix

| Capability | Allternit (Current) | Claude Desktop (visual) | Codex (docs only) |
|------------|---------------------|-------------------------|-------------------|
| Landing mental model | Chatbot landing page | Command center | Project/thread list |
| Composer position | Centered | Bottom-docked | Bottom / terminal |
| Workspace pills above composer | No (buried in dock) | Yes | Partial |
| Mascot on composer | No (centered hero) | Yes (small, corner) | No |
| Session sidebar | Yes (rail threads) | Yes (persistent left) | Yes |
| Toolbar for terminal/diff/browser | No | Yes (top-right) | Partial |
| Side pane before session | No (correctly gated) | No (Code tab has no side pane until session) | No |
| Terminal visibility before session | No | No in Home; one click in Code tab | Yes (CLI) |
| Session-aware terminal prompt | No (`allternit-session`) | Yes (`repo branch @sha version`) | Yes (per-thread) |
| In-app file editor | No | Yes (browser menu: Open file) | No (opens in editor) |
| First-class diff review | Partial (tiles + panel) | Yes (working-tree pane) | Yes |
| Drag-and-drop pane layout | Canvas only (opt-in) | No (toolbar panes) | No |
| Parallel session worktrees | State only, not enforced | Yes | Yes |
| Permission mode selector | Weak | Strong (`Accept edits`) | Strong |
| Live app preview | Hardcoded localhost iframe | Full browser pane | In-app browser preview |

---

## 4. Gap analysis

### 4.1 Critical gaps (block terminal-GUI identity)

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| 1 | **Landing is mascot-centered chatbot UI.** Centered Gizzi + centered composer trains users to think “chat app,” not “coding command center.” | `CodeCanvas.tsx:902-1106`, `CodeLaunchBranding.tsx` | Critical |
| 2 | **Composer is not bottom-docked.** Claude’s long, narrow bottom input is the signature of a command-line-style workspace. | `CodeCanvas.tsx:1034-1097` | Critical |
| 3 | **Workspace context is hidden in the composer dock.** Environment/project/branch/worktree should be visible pills above the composer. | `CodeCanvas.tsx:1086-1095` (`CompactUtilityBar`) | Critical |
| 4 | **No integrated toolbar in session view.** Terminal/diff/browser are buried in a side tab set; there is no one-click top-right toolbar. | `CodeSessionSidePane.tsx`, `CodeThreadView.tsx` | Critical |
| 5 | **No bottom workspace bar.** Claude shows branch, diff stats, and commit at the bottom. Allternit hides these in side tabs. | `CodeThreadView.tsx` | Critical |
| 6 | **Terminal is not session-aware.** `UnifiedTerminal` uses hardcoded `sessionId="allternit-session"` and does not display repo/branch/commit context. | `CodeSessionSidePane.tsx:93` | Critical |

### 4.2 High gaps (expected in a code workspace)

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| 7 | **No in-app file editor.** `ExplorerView` is read-only; file paths are not clickable into an editor pane. | `CodeSessionSidePane.tsx:13-16` | High |
| 8 | **Diff review is not first-class.** Diff tiles + H5i panel lack syntax highlighting, hunk navigation, inline comments, and approval flow. | `SESSION-GAP-ANALYSIS.md:21`, `CodeCanvasView.tsx` | High |
| 9 | **Canvas is opt-in and hidden.** `layoutMode` defaults to `thread`; most users never discover the canvas. | `CodeModeStore.ts:707-709` | High |
| 10 | **Thread view has no pane layout.** Cannot split chat + terminal + diff in the default thread mode. | `CodeThreadView.tsx` | High |
| 11 | **Keyboard shortcuts are sparse.** Canvas has zoom/pan; thread view lacks session cycling, terminal toggle, diff toggle. | `CodeCanvasView.tsx` | High |
| 12 | **Preview is hardcoded to `localhost:3000`.** No server config, no auto-detect, no multi-server tabs. | `CodePreviewPane.tsx:73`, `CodeCanvasView.tsx:282` | High |
| 13 | **Terminal tile has no real PTY in canvas.** Per existing audit, terminal tiles are local echo only. | `SESSION-GAP-ANALYSIS.md:45` | High |
| 14 | **Permission modes are weakly surfaced.** `SAFE / DEFAULT / AUTO / PLAN` exist in state but are not a first-class control next to send. | `CodeModeStore.ts:5-17` | High |

### 4.3 Medium gaps (polish & power-user)

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| 15 | **No inline comments on diffs.** Cannot request revisions by commenting on lines. | — | Medium |
| 16 | **No session status indicators in sidebar.** Sessions do not show running/idle/approval state at a glance. | `ShellRail.tsx:876-903` | Medium |
| 17 | **No background task / subagent pane.** Tasks run but are not visible outside the chat transcript. | — | Medium |
| 18 | **No `@mention` files in composer.** Cannot quickly add a file to context. | — | Medium |
| 19 | **Canvas lacks collision detection and snap guides.** Feels less native. | `SESSION-GAP-ANALYSIS.md:37` | Medium |

---

## 5. Recommendations (approved direction)

### 5.1 Strategic: landing = command center, session = chat + instant panes

Do not expose the side pane before a session. Instead:

- **Landing:** redesign to look like Claude Home — stats/dashboard near top, workspace pills above a long bottom-docked composer, Gizzi as a small companion next to the input.
- **Session view:** keep chat main, add an integrated top-right toolbar to summon terminal/diff/browser, and add a bottom workspace bar with branch/diff stats/commit.

This matches what the visual evidence shows and keeps the side pane correctly gated.

### 5.2 Tactical roadmap

#### Phase 1 — Landing command center (1–2 weeks)

1. **Move composer to bottom dock** in `LaunchpadStage`. Full-width (with safe margins), rounded, long and narrow like Claude Home.
2. **Add workspace context pills above the composer:** environment (`Local`), project/workspace, branch, worktree, and a “new” action. Promote the existing `CompactUtilityBar` content into visible pills.
3. **Reduce mascot prominence.** Keep Gizzi small and place it on/near the composer bar (bottom-right corner), not as the center of the screen.
4. **Replace centered branding block** with a lighter header + optional stats/recent-sessions card near the top.
5. **Change placeholder copy** from *“Describe what you want to build or modify...”* to *“Run a command or describe a task…”*.

Files: `CodeCanvas.tsx`, `CodeLaunchBranding.tsx`, `CodeUsageDashboard.tsx`.

#### Phase 2 — Bottom workspace bar (1–2 weeks)

1. **Add a persistent bottom workspace bar** in both landing and session views.
2. Show: environment pill, workspace/project pill, branch pill, diff stats (`+N −M`), and “Commit changes” button when a workspace is selected.
3. Keep approval mode and model selector attached to the composer bottom row, not the workspace bar.

Files: `CodeThreadView.tsx`, new `CodeWorkspaceBar.tsx`.

#### Phase 3 — Integrated toolbar (2–3 weeks)

1. **Add a top-right toolbar inside the chat header** that appears once a session exists.
2. Icons: terminal, diff/files, browser, overflow menu.
3. Clicking an icon opens the corresponding side-pane tab and expands the pane if collapsed.
4. The toolbar should feel like part of the header, not a separate implementation.

Files: `CodeThreadView.tsx`, `CodeSessionSidePane.tsx`.

#### Phase 4 — Session-aware terminal (2–3 weeks)

1. **Bind terminal `sessionId` to the active code session**, not `allternit-session`.
2. **Set terminal working directory** from the active workspace path.
3. **Display repo/branch/commit context** in the terminal header or prompt.
4. **Support multiple terminal tabs** in the side pane.

Files: `UnifiedTerminal.tsx`, `CodeSessionSidePane.tsx`, workspace service.

#### Phase 5 — Editor + diff upgrades (3–4 weeks)

1. **Build a file editor pane** that can open files from the explorer, chat file paths, and diff viewer.
2. **Upgrade diff pane** with syntax highlighting, hunk navigation, inline comments, and Apply/Reject actions.
3. **Make file paths clickable** into the editor.
4. **Add `@mention` file picker** in the composer.

Files: new `CodeFileEditor.tsx`, `CodeCanvasTileDiff.tsx`, `ExplorerView.tsx`, `ChatComposer.tsx`.

#### Phase 6 — Power features (4–6 weeks)

1. **Keyboard shortcut layer**: toggle terminal (`Ctrl+\``), toggle diff, toggle browser, cycle sessions.
2. **Side chat / branch question** without polluting the main thread.
3. **Background task / subagent pane**.
4. **Session status indicators** in sidebar.

Files: `ShellRail.tsx`, keyboard shortcut hooks, new task/subagent pane.

### 5.3 UX copy & branding changes

| Current | Recommended |
|---------|-------------|
| “Describe what you want to build or modify...” | “Run a command or describe a task…” |
| “Reply…” | “Send command or follow-up…” |
| Centered Gizzi mascot | Small Gizzi on/near the bottom composer |
| Centered composer | Bottom-docked composer |
| Hidden workspace context in dock | Visible pills above composer |
| “Threads” rail header | “Sessions” |

### 5.4 What to keep

- Side pane gated behind active session (`CodeThreadView.tsx` `hasSession` check).
- Mode-specific session isolation (`CodeSessionStore`).
- Worktree/sandbox isolation model.
- Policy modes (`SAFE / DEFAULT / AUTO / PLAN`).
- Canvas/tile architecture as the advanced layout.
- h5i provenance and audit panels.
- Existing `UnifiedTerminal` xterm.js foundation.

---

## 6. Concrete next steps

1. **Decision:** Should the landing stats card stay, shrink, or be replaced with recent sessions? Recommendation: keep a small stats/recent-sessions card near the top, similar to Claude Home.
2. **Decision:** Should the toolbar appear disabled on landing or only after the first message/session? Recommendation: only after session starts; landing should stay clean.
3. **Create design spec** for the new landing layout (header + stats card + workspace pills + bottom composer + Gizzi).
4. **Move composer to bottom dock** as the first implementation step.
5. **Promote `CompactUtilityBar` content to workspace pills** above the composer.
6. **Add integrated toolbar** in session view.
7. **Add bottom workspace bar** with branch/diff stats/commit.
8. **Upgrade `UnifiedTerminal`** to be session-aware.
9. **Add file editor component** and upgrade diff review.
10. **Update fixtures/tests** so Code Mode tests verify workspace/composer/toolbar behavior, not chat greeting animations.

---

## 7. Summary

Allternit Code Mode does not need to expose the side pane before a session. The correct pattern, shown by Claude Code Desktop, is:

- **Landing:** a command center with a bottom-docked composer, workspace context pills, a small mascot companion, and a light stats card.
- **Session view:** chat remains main, with an integrated toolbar to summon terminal/diff/browser and a bottom workspace bar for branch/diff/commit context.

The side pane should stay gated behind an active session. The highest-impact changes are: bottom-dock the composer, make workspace pills visible, move Gizzi to the composer area, add the integrated toolbar, and add the bottom workspace bar. That is what will make Code Mode look and operate like a terminal-based GUI instead of a chatbot.
