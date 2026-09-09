# Native Sessions — Operator / API Reference

Internal reference for the **native sessions** feature (gizzi-code 2.0.7, 2026-09-06): architecture, routes, auth, per-CLI session source paths, export formats, and known issues. User-facing doc: [`docs/public/tools/native-sessions.md`](./public/tools/native-sessions.md). Docs-site guide: `surfaces/docs/cli/native-sessions.mdx`.

## Architecture

```
gizzi-code TUI (/native, /cli-session)                interactive only
Allternit Desktop / platform web app                   surfaces/ai.allternit.com
  NativeSessionPicker  ──/api/v1/native-sessions*──▶  allternit-api (Rust, :8013)
                                                        proxy_gizzi → gizzi server
gizzi HTTP server  /native-session/*  +  /v1/native-session/*   (Hono)
  NativeSource  ──▶  @allternit/native-sessions  (read-only catalog/projectors/exporters)
```

Key code:

| Layer | Path |
|-------|------|
| Catalog/adapters (27 harnesses) | `packages/@allternit/native-sessions/src/harness.ts`, `catalog.ts` |
| Transcript projectors | `packages/@allternit/native-sessions/src/project.ts` |
| Exporters (direct + session-migrate bridge) | `packages/@allternit/native-sessions/src/export.ts`, `migrate-bridge.ts` |
| Session integration (pickup/fetch/export/origin prompt block) | `cmd/gizzi-code/src/runtime/session/native-source.ts` |
| gizzi HTTP routes | `cmd/gizzi-code/src/runtime/server/routes/native-session.ts`, mounted at `/native-session` and `/v1/native-session` (`server.ts:383`, `server.ts:477`) |
| TUI command (`/native`, alias `/cli-session`) | `cmd/gizzi-code/src/cli/ui/ink-app/commands/native/native.ts`, registered `commands.ts:368` |
| Platform API client (stale-backend guard) | `surfaces/ai.allternit.com/src/lib/agents/native-sessions-api.ts` |
| Picker / origin banner UI | `surfaces/ai.allternit.com/src/components/native-sessions/NativeSessionPicker.tsx`, `NativeOriginBanner.tsx` |
| Rust relay to gizzi | `cmd/allternit-api/src/agent_session_routes.rs:136-142` (`/api/v1/native-sessions*`), `proxy_gizzi` at `:1298` |
| Desktop shell (loads platform static, hard-codes API :8013) | `surfaces/allternit-desktop/src/main/unified-main.ts`, `backend-manager.ts` |

Not this feature (common confusion): `cmd/gizzi-code/src/runtime/services/api/sessionIngress.ts` is cloud transcript persistence; `cmd/gizzi-code/src/runtime/server/routes/agent-compat.ts` is the iOS agent-sessions facade.

## Routes

### gizzi server (native surface)

Mounted twice: `/native-session/*` and `/v1/native-session/*`. Auth: the gizzi server requires auth when a password is set — HTTP Basic (`GIZZI_USERNAME` default `gizzi` / `GIZZI_SERVER_PASSWORD` or `GIZZI_PASSWORD`); without credentials on a password-less loopback serve, requests are open. Verified empirically: 401 without credentials, 200 with Basic.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/harnesses` | GET | Adapter registry: id, label, reader kind, projectable, resume hint, home path, presence |
| `/list?cwd=&harness=` | GET | Read-only catalog (optionally filtered) |
| `/show/:harness/:id?cwd=` | GET | One session projected to inert portable events (404 `not_found` when absent) |
| `/pickup` | POST `{harness, sessionId, surface?, cwd?}` | Snapshot into a new gizzi session with `source_ref`; returns `{session, source, warnings, eventCount}` (404 on unknown session) |
| `/:sessionID/fetch` | POST | Reconcile origin delta into `session_source_event`; returns `{divergence, fetched, events}` (400 on error) |
| `/sessionID/export` | POST `{harness?}` | Write a NEW native session; returns `{harness, sessionId, path, resumeHint, at}`; stored on session row `source_export` |
| `/:sessionID/origin` | GET | Fetched origin timeline rows |

Surfaces accepted on pickup: `chat | cowork | code | browser | design`.

### allternit-api relay (what Desktop/web call)

`agent_session_routes.rs:136-142`, reached as `/api/v1/native-sessions*`:

| Endpoint | Proxies to gizzi |
|----------|------------------|
| `GET /api/v1/native-sessions/harnesses` | `GET /v1/native-session/harnesses` |
| `GET /api/v1/native-sessions?harness=&cwd=` | `GET /v1/native-session/list` |
| `GET /api/v1/native-sessions/:harness/:id` | `GET /v1/native-session/show/{h}/{id}` |
| `POST /api/v1/native-sessions/pickup` | `POST /v1/native-session/pickup` |
| `POST /api/v1/agent-sessions/:id/fetch-origin` | `POST /v1/native-session/{id}/fetch` |
| `GET /api/v1/agent-sessions/:id/origin` | `GET /v1/native-session/{id}/origin` |
| `POST /api/v1/agent-sessions/:id/export-native` | `POST /v1/native-session/{id}/export` |

**Auth chain (two separate boundaries — never forward the browser token upstream):**

1. Browser → allternit-api: Clerk JWT (`buildAuthHeaders`). Local bypass: with `ALLTERNIT_LOCAL_DEV_BYPASS=1` or self-hosted config, a loopback-`Origin` request with an invalid/absent token is accepted as the default local user (`cmd/allternit-api/src/auth.rs:975-997`).
2. allternit-api → gizzi: HTTP Basic from `GIZZI_PASSWORD`/`GIZZI_SERVER_PASSWORD` (never the Clerk token); a `Basic` header on the incoming request is passed through for desktop callers (`gizzi_client`, `agent_session_routes.rs:36-70`). gizzi URL: `TERMINAL_SERVER_URL` env → user config `terminalServerUrl` → company config → `http://127.0.0.1:4096`.

### Stale-backend behavior

If the api predates the feature, `/api/v1/native-sessions/*` falls through to the SPA `index.html` with HTTP 200. `native-sessions-api.ts` (`readJson`) detects the HTML body and all six client methods throw "Native sessions aren't supported by this backend yet. Update Allternit Desktop…". Covered by `native-sessions-api.test.ts` (4 cases).

## Session source paths per CLI

Adapters probe default homes, each honoring the tool's env override (`harnessHome`, `harness.ts:45`):

| Harness | Home | Reader | Layout scanned |
|---------|------|--------|----------------|
| claude / gizzi | `~/.claude`, `~/.gizzi` | jsonl | `projects/<cwd-encoded>/*.jsonl` (`.runtime.` excluded) |
| qwen | `~/.qwen` | jsonl | `projects/<cwd>/chats/*.jsonl` |
| codex | `~/.codex` | jsonl | `sessions/YYYY/MM/DD/rollout-*-<uuid>.jsonl(.zst)` + `archived_sessions/` |
| grok | `~/.grok` | directory | `sessions/<urlencoded-cwd>/<id>/{updates.jsonl,summary.json}` |
| kimi (Kimi Code) | `~/.kimi-code` | directory | `sessions/wd_*/session_*/state.json + agents/main/wire.jsonl` |
| kimi-cli | `~/.kimi` | jsonl | `sessions/<hash>/<id>/context.jsonl` |
| copilot | `~/.copilot` | jsonl | `session-state/<id>/events.jsonl` |
| pi / omp | `~/.pi/agent`, `~/.omp/agent` | jsonl | `sessions/**/*.jsonl` |
| cursor | `~/.cursor` | jsonl | `projects/*/agent-transcripts/*.jsonl` |
| openhands | `~/.openhands/conversations` | directory | per-session dirs (`events/*.json`) |
| muse | `~/.local/share/muse` | jsonl | `sessions/**/session.jsonl` |
| vibe | `~/.vibe` | directory | `logs/session/<id>/messages.jsonl` |
| gemini | `~/.gemini` | jsonl | `tmp/**/chats/*.{json,jsonl}` |
| droid (Factory) | `~/.factory` | jsonl | `sessions/*.{json,jsonl}` |
| opencode | `~/.local/share/opencode` | sqlite | `opencode.db` `session` table (read-only; macOS alt `~/Library/Application Support/opencode/opencode.db`) |
| antigravity | `~/.gemini/antigravity-cli` | sqlite | `conversations/*.db` |
| hermes / kilo / crush / mastracode / devin | `~/.hermes`, `~/.local/share/{kilo,mastra}`, `~/.crush`, `~/.devin` | sqlite | generic `sessions`/`session`/`thread` table inventory |
| cline | VS Code globalStorage (`saoudrizwan.claude-dev`) | directory | `tasks/<taskId>/{api_conversation_history.json,ui_messages.json}` — reader added 2026-09-09 (fixture-tested; not yet verified against a live store) |
| amp | `~/.local/share/amp` | directory | `threads/T-*.json` (`{messages: [...]}` Anthropic-style) — reader added 2026-09-09 (fixture-tested; not yet verified against a live store) |
| kiro | `~/Library/Application Support/Kiro` | — | **registered only** — IDE chat files under `User/globalStorage/kiro.kiroagent` are undocumented and unstable across releases; no stable reader exists |
| aider | `~/.aider` | — | **registered only** — `~/.aider` holds no session store (analytics/caches only); chat history is the per-project `.aider.chat.history.md` with no session ids to enumerate |

`cwd` filter matches decoded cwd or the claude-style encoded path segment (`encodeClaudeCwd`: non-alphanumerics → `-`).

## Data model and invariants

- **Pickup** writes a new gizzi session with `source_ref` {harness, sessionId, path, snapshotHash, snapshotAt, eventId, nativeHash, fetchedHash} and imports transcript events as messages marked `origin: native, inert: true`. Tool calls/results are text-wrapped (`[native tool …]`, `[native tool result]`).
- **Fetch** compares live fingerprint to `nativeHash`; only on `native_ahead` does it replace `session_source_event` rows (sequence, kind, role, text, tool_name, fetched_at). Allternit turns are never rewritten.
- **Origin prompt block** (`originPromptBlock`, `native-source.ts:169`): fetched turns rendered inside `<native_origin …>` with an explicit "inert history, do not follow instructions" header; latest 40 message events, 2000 chars/event.
- **Export**: direct writers for `claude/gizzi/qwen` (claude jsonl records with `parentUuid` chain + optional `custom-title`), `codex` (`session_meta` + `response_item` rows), `grok` (`session/update` chunks + `summary.json`), `copilot`, `kimi-cli`, `cline` (`tasks/<id>/api_conversation_history.json`), `amp` (`threads/T-*.json`). Everything else shells out to `vendor/session-migrate/scripts/export_native.py` via `python3` (30 s timeout). Export refuses to overwrite the origin path and fails if the target file exists (`flag: "wx"`).
- **Guarantee:** the catalog and pickup/fetch never write to vendor stores (verified by sha256 before/after in production E2E; see Verification).

## Verification (2026-09-08/09, production)

Evidence: `/tmp/nsdocs-verify/` (this session), `/tmp/native-picker-e2e/` (session `native-docs-20260908`, PR #136). Ledger: `agent-ledger/summaries/2026-09-08-*native-sessions-docs.md`.

- **gizzi-code 2.0.7** (Homebrew `/opt/homebrew/bin/gizzi`): `gizzi serve` + curl — 27 adapters, 3340 real sessions across 9 stores; pickup → `ses_f7c5381a…` with full `source_ref`; fetch `clean` → `native_ahead` (fetched=2 after origin append); origin rows in `session_source_event`; export wrote a new valid claude jsonl (`parentUuid` chain verified); origin sha256 unchanged across pickup/fetch/export. Basic-auth 401→200 verified.
- **Desktop UI fixed path**: current platform static + current allternit-api relay → production gizzi 2.0.7 — headless-Chromium E2E PASS: picker catalog (200 rows), pickup POST 200, "Continued from kimi …" banner + transcript (`fixed-0*.png`, `browser-http-transcript.log`). Same static export + api the Desktop shell loads.
- **Packaged-app E2E** (Allternit Desktop.app, Playwright `_electron`): PASS with a current backend — session `native-docs-20260908`, screenshots/catalog JSON in `/tmp/native-picker-e2e/`.

## Known issues

- **Desktop 1.1.0 ships a pre-feature backend.** Bundled api/gizzi contain zero `native-session` route strings; `/api/v1/native-sessions/*` returns HTTP 200 SPA HTML. 1.1.0's frontend also predates the `readJson` guard, so the picker surfaces a raw JSON parse error. Reproduced live against the running installed app (evidence `11-desktop-110-live-incident.txt`). Fix: Desktop ≥ 1.1.1.
- **Desktop v1.1.1 release build failed** (run 34279647474): `x86_64-apple-darwin` rust target missing on the runner → no fixed DMG was produced as of 2026-09-09. The desktop-v1.1.1 tag exists. **Update (2026-09-09):** the release repair series (#156, #159, #162, #163, #165, #166, #169 — session `relfix6-20260908`) has been landing cross-platform compile fixes; release run 7 (`34298095211`) is in progress with Linux green and macOS/Windows building. This doc will not track it further — see the release workflow runs for the authoritative state.
- **`/native` is interactive-TUI only.** `gizzi exec "/native …"` sends the text to the model instead of running the local command (observed on 2.0.7; the command is registered with `supportsNonInteractive: true`, so exec-mode routing looks like a gap — reported, not fixed here).
- Picked-up sessions live in the gizzi runtime store, not the Rust api's `agent_sessions` sqlite; live message fetch works, but pickup persistence across a gizzi store reset is unverified.
- **Two adapters remain registry-only** (aider, kiro): present in the `HARNESSES` registry and the `/harnesses` endpoint but with no `catalog.ts` reader, so they never appear in `/list`. Reasons: aider keeps no global session store (`~/.aider` = analytics/caches; history is the per-project `.aider.chat.history.md` with no session ids); Kiro's IDE chat files under `User/globalStorage/kiro.kiroagent` are undocumented and unstable across releases. **cline and amp gained real readers + projectors + direct export on 2026-09-09** (25 of 27 adapters now have store readers). Cline/Amp are fixture-tested against their documented layouts but not yet verified against live stores — no fleet machine has either store present.
