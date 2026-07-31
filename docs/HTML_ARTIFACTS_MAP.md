# HTML Artifacts — Ground-Truth Map (2026-07-31)

## Goal

Port Claude Code's "artifact" feature — deterministic, self-contained HTML
generation, publish-with-versioning, and rendered preview — into the
Allternit stack, end to end:

`gizzi-code` (CLI) generates HTML → publishes through `allternit-api`'s
canvas system with **stable-key versioning** (redeploy updates the same
record, doesn't create a new one) → iOS app's existing Artifacts Library
renders it.

Reference implementation to study (read-only, do not copy verbatim — it's
a Claude Code plugin, adapt the *pattern*, not the literal files):
`~/.gizzi/plugins/marketplaces/claude-plugins-official/plugins/project-artifact/`
(`SKILL.md` workflow: resolve config → pick tabs → generate HTML → review →
publish → share → write config; `template.html` is the self-contained HTML
skeleton with light/dark mode, status pills, tabs, callouts; `swe.md` is a
domain specialization). Also skim
`~/.gizzi/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/`
for the visual-design principles that make these artifacts look distinctive
rather than templated.

## Ground truth per repo (verified 2026-07-31, do not trust older memory notes over this)

### gizzi-code (`cmd/gizzi-code`, TypeScript/bun)

- **No existing artifact/canvas HTML-publish plumbing.**
- **Naming collision**: `/artifact` (aliased `artifacts`) already exists —
  `src/cli/ui/ink-app/commands/artifact/{index.ts,artifact.tsx}` — a TUI
  viewer for markdown files under `~/.gemini/antigravity-cli/brain/<sessionId>/`.
  Unrelated. **Do not reuse this name** for the new feature — pick something
  else (e.g. `html-artifact`, `canvas-publish` — your call, just don't collide).
  Also `src/runtime/util/artifacts.ts` parses inline `<artifact type="...">`
  chat tags (code/preview/diagram/diff/text) for chat-UI rendering — also
  unrelated, just be aware the word "Artifact" is already an exported type
  there.
- `src/cli/commands/share/index.ts` is an empty 0-byte unregistered stub.
  Real session-share logic is `src/runtime/session/share/share-next.ts`
  (publishes session transcripts to `opncd.ai` — different feature, not a
  pattern to reuse for HTML artifacts).
- **Backend HTTP client exists**: `src/runtime/services/api/allternitApi.ts`,
  wrapping `getAllternitApiConfig()`/`apiFetch`/`apiFetchJson` from
  `src/runtime/context/flag/flag.ts`. Base URL via `ALLTERNIT_API_URL` /
  `ALLTERNIT_API_BASE_URL` env (default `http://127.0.0.1:8013`). Currently
  only wraps `/tasks` and `/automation/routines|loops` — **no
  `agent-sessions`/`canvases` wrapper exists yet, add it here.**
- **Auth today**: `ALLTERNIT_API_TOKEN` bearer if set, else
  `x-allternit-user-id` + `x-allternit-desktop-access-token: gizzi-local-token`
  dev fallback. Per Eoj's decision (see Phase 1 backend task), the real path
  going forward is the **device-token mechanism** already used for MCP calls
  (`verify_runtime_device_token`, see backend section) — wire the CLI client
  to send that as a bearer token once Phase 1 lands it.
- **Skill/plugin convention**: builtin plugins live at
  `src/runtime/plugins/builtin/<name>/` with `.claude-plugin/plugin.json`,
  `commands/*.md`, `skills/<name>/SKILL.md`, optional `.mcp.json`. No
  existing builtin plugin bundles non-markdown static assets (no plugin
  ships a `.html` file today), but `src/runtime/skills/loadSkillsDir.ts`
  only requires a `SKILL.md` present in the directory — co-locating a
  `template.html` next to it is structurally fine, just novel. This is
  where the new skill should live.
- **Config convention**: `.gizzi/<name>.json` is primary, `.claude/<name>.json`
  is a read-only compat fallback, **always write new files to `.gizzi/`**
  (see `src/shared/utils/settings/settings.ts:236-320`,
  `src/shared/utils/config.ts:1790-1819`, and the precedent in
  `src/shared/utils/agentFileResolver.ts`). Follow this exactly for a new
  artifacts config store (e.g. `.gizzi/artifacts/<slug>/config.json`).

### allternit-api (`cmd/allternit-api`, Rust)

- Canvas routes: `cmd/allternit-api/src/canvas_routes.rs`, mounted at
  `/api/v1` behind `auth_middleware` (`main.rs:291`, `:350-354`).
  - `GET/POST /agent-sessions/:session_id/canvases` (list `:67`, create `:124`)
  - `GET/PATCH/DELETE /canvases/:canvas_id` (get `:175`, update `:224`, delete `:294`)
- DB model: `agent_canvases` table, `migrations/V13__agent_canvases.sql:6-16`
  — `id, session_id, user_id, title, components TEXT (json array), layout,
  metadata, created_at, updated_at`. Latest migration in the repo is V32 —
  **your new migration should be V33** (check for collisions right before
  you add it, another session may have landed one).
- The `{type:'artifact', artifactId, kind, title, content, url}` shape
  mentioned in old notes is `ArtifactUIPart`, a **frontend-only** TS type
  (`surfaces/ai.allternit.com/src/lib/ai/ui-parts.types.ts:135-142`) used
  for browser streaming events. It is NOT what's persisted server-side —
  the DB only has the generic `components` JSON blob. There's also a
  separate, unrelated `artifact_routes.rs` backing a document/research
  system (title/sections/revisions) — not relevant here, don't touch it.
- **Versioning does NOT exist.** `update_canvas` (`canvas_routes.rs:224-292`)
  does a real in-place `UPDATE ... WHERE id = ?6` — PATCH-by-known-id already
  works. But `create_canvas` (`:124`) always mints a fresh `Uuid::new_v4()`
  with no upsert path and no caller-supplied stable key. **This is the gap
  Phase 1 (backend) closes.**
- **Auth for a CLI**: `auth_middleware` (`src/auth.rs:~692-780`) accepts
  desktop-bootstrap shared-secret headers, Clerk JWT bearer, or a
  localhost-only dev bypass — **no device-token path reaches canvas routes
  today**. A separate device-token mechanism already exists and is proven —
  `verify_runtime_device_token` in `src/connector_routes.rs:117-206`,
  bearer-prefixed `allternit_runtime_…`, currently only wired into
  `mcp_proxy_internal`/`/internal/*` (public router, `main.rs:374`). **Eoj's
  decision: extend this same mechanism to reach canvas routes** rather than
  inventing a new auth type or repurposing the desktop-bootstrap dev-fallback
  path for real service auth.
- **No public/unauthenticated share URL exists anywhere** for canvases or
  artifacts. Out of scope for this work — the iOS app already fetches
  authenticated, so don't add a public route unless a later phase asks for it.

### iOS (`surfaces/allternit-mobile/ios`, SwiftUI)

- Further along than expected — **already renders HTML live**, not just
  metadata: `Features/Artifacts/Views/SandboxedArtifactWebView.swift` wraps
  `WKWebView`, serves artifact HTML via a custom `artifact://` scheme
  handler (never a real http(s) URL), injects a CSP (`default-src 'none'`),
  and only allows JS execution for html/js artifact types. Used from
  `ArtifactDetailsView.swift:199`.
- `ArtifactLibraryStore.swift` persists locally
  (`Application Support/artifact-library.json`) and mirrors bidirectionally
  to canvases via `Core/API/CanvasClient.swift`, keyed by a local
  `artifactId → canvasId` map so re-seen artifacts PATCH instead of
  duplicating **on the app's own mirror side**. `refreshFromBackend()`
  sweeps the 30 newest sessions' canvases, 4 concurrent.
- **No version/history concept** in the local model —
  `ArtifactRecord` (`Features/Artifacts/Views/ArtifactDetailsView.swift:3-32`)
  has no version field; `record()` does remove-then-reinsert (last write
  wins, single current state per id).
- **Auth**: `CanvasClient` rides on `APIClient.shared`, which awaits a
  Clerk bearer token via `AuthManager.shared.getToken()` — this is the
  interactive-user auth path, separate from the CLI's device-token path.
  No change needed here; the iOS app keeps using its own Clerk session.

## Toolchains on this machine (verified 2026-07-31)

- Rust: `cargo`/`rustc` via rustup — present (an old memory note claiming
  "no Rust toolchain" is stale, ignore it).
- bun: present.
- Xcode/`xcodebuild`: present.

All three surfaces can actually be built, not just statically checked —
**do it**. Past sessions in `cmd/gizzi-code` specifically have shipped bugs
that only running the real TUI/app caught, that static "is it
imported/called" audits missed. Build and exercise what you change.

## Phasing

1. **Backend** (`docs/HTML_ARTIFACTS_PHASE_1_TASK.md`) — device-token auth
   on canvas routes + stable-key upsert/versioning + migration. Independently
   buildable/testable via `cargo build`/`cargo test` and curl.
2. **gizzi-code CLI** (`docs/HTML_ARTIFACTS_PHASE_2_TASK.md`) — deterministic
   HTML generator, new skill/command, `allternitApi.ts` canvases wrapper,
   `.gizzi/artifacts/<slug>/config.json` store. Depends on Phase 1's actual
   endpoint contract (read Phase 1's NOTES file for the real shape, don't
   guess).
3. **iOS** (`docs/HTML_ARTIFACTS_PHASE_3_TASK.md`) — minimal version
   awareness in `ArtifactRecord`/store, verify the existing render pipeline
   handles gizzi-code-published artifacts correctly.
4. **End-to-end verification** (`docs/HTML_ARTIFACTS_PHASE_4_TASK.md`) — run
   allternit-api locally, publish twice from the CLI with the same key,
   confirm one canvas record (not two) via curl, confirm iOS can fetch and
   render it.

Only Phase 1's task file exists right now. Do NOT start Phase 2 until told
"Phase 1 is reviewed and approved" — each phase gets reviewed before the
next is handed to you.
