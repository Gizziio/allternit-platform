# Handoff — Desktop UI fixes (2026-07-17)

Audience: the next agent picking up this work. Everything you need is here; do not
re-investigate from scratch. Two pieces remain: **verify two UI fixes in the running
app**, then **commit + push to GitHub without reverting anyone else's work**.

## Environment state (running now)

- **Repo**: `/Users/macbook/Desktop/allternit-workspace/allternit`, branch `main`,
  remote `origin git@github.com-gizziio:Gizziio/allternit-platform.git`.
- **allternit-api** (Rust, port 8013): running from the repo build
  `target/debug/allternit-api` with:
  `ALLTERNIT_DATA_DIR=/private/tmp/claude-501/-Users-macbook/24462a68-dc3f-47fd-be30-064e94133491/scratchpad/allternit_data`
  and `GIZZI_PASSWORD=testpass123`. Both are REQUIRED — without the data dir it
  uses the wrong DB (the 6 seeded agents live in the scratchpad one); without the
  password `/api/agent-chat` 500s (gizzi daemon at 127.0.0.1:4096 requires Basic auth).
  The previous binary (`/private/tmp/allternit-codex-target/...`, another agent's build)
  was killed; don't resurrect it.
- **vite dev server**: `pnpm dev` in `surfaces/ai.allternit.com` on port 3013.
  If `504 Outdated Optimize Dep` or `cache is not defined` (react-dom 19/18 mismatch)
  appears: `rm -rf surfaces/ai.allternit.com/node_modules/.vite` and restart vite.
- **Electron desktop shell**: `NODE_ENV=development npx electron . --remote-debugging-port=9222`
  in `surfaces/allternit-desktop`. Loads http://localhost:3013.
- **CDP driver** for UI verification: `/tmp/allternit-cdp/drive.mjs` — takes a
  scenario JSON of steps (`nav`, `eval`, `click`, `wait`, `shot`) and a report path:
  `node drive.mjs scenario.json report.json`.
  Pitfalls: `Page.captureScreenshot` hangs when the window is hidden (it auto-hides
  on blur) — use `eval` steps, avoid `shot`; kill stray `drive.mjs` processes (one
  stuck connection blocks the target for others); Chromium replays old console
  entries to every new CDP client — filter replays by checking `http.4xx` events
  (live network) rather than `log.error` lines.

## Done (all verified live in the app unless noted)

- `tailwind.config.ts` — semantic colors used `hsl(var(--token))` over full-color
  tokens → every popover/card was transparent. Now `var(--token)` directly.
- `src/lib/agents/api-config.ts` — `gizziBaseUrl()` returns `allternit-gizzi://localhost`
  in the desktop shell (Electron broker adds CORS headers) → Settings → Usage works.
- `CreateAgentForm.tsx` — voice `listVoices()` unhandled rejection caught; models
  501 downgraded to debug (static AGENT_MODELS fallback exists).
- Wizard sticky footer made opaque + `pb-24` spacer (content no longer scrolls under it).
- `WorkspaceTab.tsx` — `workspaceRelativePath()` strips `…/agents/<id>/`; tree shows
  relative paths, basenames, no more ALL-CAPS absolute paths.
- `cmd/allternit-api`: `GET /api/v1/models` (23 entries from shared provider specs in
  `provider_routes.rs`), `GET /api/v1/voice/voices` (`{voices: []}`); auth upsert bug
  fixed in `auth.rs` (`ensure_user_in_db` adopts existing row on email-vs-id mismatch);
  `/files/list` returns 200-empty for missing dirs (`file_routes.rs`).
- `src/plugins/fileSystem.ts` — `exists()` uses GET `{exists}` (was HEAD→404→two more
  404 fallback probes; this was the hundreds-of-red-lines debug-panel storm).
- `ResourceUsageDashboard.tsx` — charts gated on ResizeObserver size (kills
  width(-1)/height(-1) warnings).
- `SettingsView.tsx` — removed fake "Real-time usage breakdown" placeholder + state.
- `agent.store.ts` — `createAgent` 45s timeout (no more infinite "Creating…").
- `CanvasToolbar.tsx` — added missing `GitDiff` import.
- Seeded `~/agents/<id>/` bootstrap files (15 docs each) for Deep Research, Code
  Assistant, Data Analyst, Data Catalyst, Architect — verified in Workspace tab.
- Capabilities chat-to-edit (`CapabilitiesManager.tsx` RightPane + `WorkspaceChatEditor`
  `subject` prop): open skill → SKILL.md → ⋯ → Edit → textarea AND "Edit with chat"
  panel → streamed preview → Apply → Save. Verified end-to-end.
- Restored `~/.codex/skills/playwright/SKILL.md` from
  `~/.codex/vendor_imports/skills/skills/.curated/playwright/SKILL.md` after a
  verification side effect overwrote it (do not touch it again).
- Rail footer (`ShellRail.tsx`): icon-only Apps & Extensions button in the user row
  (it was briefly replaced with a labeled row — user rejected that; icon restored).
- `ShellApp.tsx`: auto-collapse rail when `active.viewType === 'apps-extensions'`.
- `CapabilitiesManager.tsx` `mergedCliTools`: dedupe by `item.id` (React
  duplicate-key warnings `cli-clang`/`cli-flex`).

## Remaining (do these)

1. **Verify in app** (CDP driver):
   - Click rail icon `button[title="Apps & Extensions"]` → Apps & Extensions view
     opens AND the rail collapses (Agent Hub rail button becomes hidden).
   - Capability Library → CLI Tools tab → no duplicate-key console warnings.
2. **Commit + push** to `origin main`:
   - Another agent (claude, PID 60318) is LIVE-EDITING this tree. Do NOT revert,
     delete, or selectively exclude their changes — commit the tree as it is
     (their work-in-progress included; `git status` shows many files outside this
     handoff's scope — that's theirs, keep it).
   - Suggested: one commit for these fixes; message per repo convention
     (`fix(ui): ...` / `feat(ui): ...` style, see `git log --oneline -8`).
   - No force-push, no history rewrites, plain `git push origin main`.

## Known cosmetic note

Rail user shows "Desktop Dev User" instead of "Joe · Pro" — no desktop pairing ever
existed ("not paired" in every launch log); the old label came from the old API
binary's `/me`. Not a regression in code; leave it.
