# Session attestation — native-docs-20260908 (kimi-code)

**Date:** 2026-09-08
**Branch:** `session/native-docs-20260908` → PR #136, merge commit `b217a0f56`
**Topic:** Close documentation gaps for the shipped native-sessions feature + production E2E verification

## What was done

Docs-only change (5 files, +121/−1), no code changes:

1. `vendor/session-migrate/PROVENANCE.md` — removed stale "outbound export is a
   later bridge, not v1" note; export-back shipped in v2.0.7 (7 direct writers:
   claude, gizzi, qwen, codex, grok, copilot, kimi-cli; rest via the vendored
   smigrate bridge).
2. `cmd/gizzi-code/CHANGELOG.md` — retroactive 2.0.7 "Added" entry for `/native`
   (pickup / fetch / export), the read-only-origin and inert-history guarantees,
   and the HTTP + picker surfaces. The 2.0.7 tag shipped with no changelog mention.
3. `surfaces/docs/cli/native-sessions.mdx` (new) — user guide: quick start,
   pickup/fetch/export semantics, divergence states, safety guarantees, 27-harness
   support table with resume hints, `/v1/native-session/*` HTTP reference.
   Registered in `surfaces/docs/docs.json` (Gizzi Code CLI group, after
   cli/session) and cross-linked from `surfaces/docs/cli/session.mdx`.

## Verification evidence

- `bun test src` in `packages/@allternit/native-sessions`: **6/6 pass**, 26 assertions.
- `docs.json` parses valid; mdx follows existing frontmatter conventions.
- **Production gizzi-code E2E (Homebrew `/opt/homebrew/bin/gizzi` v2.0.7, via
  `gizzi serve`) — PASS, all 7 steps:** catalog lists 27 harness adapters / 3315
  real sessions across 9 installed harnesses; pickup of a real Claude Code session
  created `ses_f7ea26df…` with full `source_ref` and origin file sha256 unchanged;
  fetch appended 2 synthetic origin turns as inert events (`native_ahead`, then
  idempotent `clean`); export wrote a **new** claude jsonl (valid format,
  `parentUuid` chain) without touching origin; unit tests cover the
  origin-overwrite refusal.
- **Desktop E2E (packaged `/Applications/Allternit Desktop.app` v1.1.0, Playwright
  `_electron`, real user profile) — full UI flow PASS *with a current
  allternit-api backend***: picker opened from the rail, catalog rendered 200 rows
  / 3317 sessions, pickup of a real GROK session created the session and rendered
  the NativeOriginBanner with the transcript. Evidence in `/tmp/native-picker-e2e/`
  (screenshots + `http-transcript.log` + `backend-catalog-3317-sessions.json`).

## Incident found (honest deferral — NOT fixed by this session)

**Desktop 1.1.0 shipped with a backend that predates native-sessions.**
The packaged app's bundled `Contents/Resources/bin/allternit-api` (and bundled
`gizzi-code`) were built 2026-09-06 20:21; the feature merged at 21:34
(`441ed7495`). The bundled api binary contains zero `native-sessions` route
strings, so out of the box every `/api/v1/native-sessions/*` call from the
desktop returns HTTP 200 with the SPA index.html and the picker shows
`Unexpected token '<' ... is not valid JSON` → "No native sessions found"
(screenshot `03b-fail-bundled-api-no-routes.png`). This is a **desktop release
packaging gap**, not a UI or gizzi bug — the E2E passed as soon as a current
api build served 8013.

**Recommended follow-up:** cut desktop v1.1.1 (`desktop-v1.1.1` tag →
`.github/workflows/release-desktop.yml` rebuilds api + gizzi from main), and
consider a picker error-state that detects the HTML fallback and says
"update the desktop app" instead of surfacing a raw JSON parse error.

Secondary note: a picked-up session was not visible in the Rust API's
`agent_sessions` sqlite (it lives in the gizzi runtime store); live message
fetch works. Pickup persistence-across-restart was not verified.

## Cleanup

- gizzi E2E synthetic artifacts intentionally left for inspection:
  `~/.claude/projects/-Users-joe-tmp-gizzi-native-verify/{7f3a9c1e,a0a2c25e}.jsonl`,
  gizzi sessions `ses_f7ea2c185ffeVIPxT74IImqVAj`, `ses_f7ea26df5ffeWE3jLRY6ZXSjsc`.
- Desktop E2E temp servers (vite 3014, api 8013, gizzi 4097) stopped;
  `~/Library/Application Support/allternit/config.json` restored from backup.
- Worktree `allternit-session-native-docs-20260908` removed; branch
  `session/native-docs-20260908` deleted local + remote after merge.
