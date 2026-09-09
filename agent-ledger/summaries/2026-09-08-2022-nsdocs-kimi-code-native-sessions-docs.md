# Session attestation — nsdocs (kimi-code)

**Date:** 2026-09-08 (local) / 2026-09-09 01:20 UTC
**Branch:** `session/nsdocs` → PR #170, merge commit `002ae87e42f22642f829cb0cae70e7460fe16c64`
**Topic:** Native-sessions (gizzi-code 2.0.7) docs — public user guide + operator/API reference, with production verification in both gizzi-code and the Allternit Desktop surface

## What was done

Docs-only change (3 files, +243/−12), no code changes:

1. `docs/public/tools/native-sessions.md` (new) — user-facing guide, style-matched to
   `tool-belt.md`/`mcp.md`: pickup/fetch/export semantics, `/native` TUI usage,
   Desktop/web picker flow, 27-harness table (store paths, direct-export subset,
   resume hints), limits, Desktop ≥1.1.1 version note.
2. `docs/NATIVE_SESSIONS.md` (new) — operator/API reference: architecture/code map
   (incl. noting that `sessionIngress.ts` and `agent-compat.ts` from the task brief
   are NOT this feature), gizzi `/v1/native-session/*` + Rust relay
   `/api/v1/native-sessions*` route tables, two-boundary auth chain (Clerk browser
   token; Basic gizzi password never forwarded), per-CLI source paths/readers,
   data model + safety invariants, verification record, known issues.
3. `AGENTS.md` — indexed both docs under the tools-docs section.

Context: PR #136 (same day, session `native-docs-20260908`) had already shipped the
docs-site guide `surfaces/docs/cli/native-sessions.mdx` + retroactive CHANGELOG +
production E2E. This session covered the two remaining doc homes and re-verified
everything first-hand.

## Verification evidence (all on this machine)

- **gizzi-code 2.0.7 CLI — PASS.** Production Homebrew binary
  (`/opt/homebrew/bin/gizzi`), `gizzi serve --port 4099` + curl. Evidence:
  `/tmp/nsdocs-verify/00-version-and-help.txt`, `01-catalog.txt` (27 adapters,
  3340 real sessions across 9 stores), `02-pickup-fetch-export.txt` +
  `03-integrity-and-real-show.txt` (pickup → `ses_f7c5381a…` with full
  `source_ref`; fetch `clean` → `native_ahead` fetched=2 after appending turns to
  the origin file; origin rows in `session_source_event`; export wrote a NEW claude
  jsonl with valid `parentUuid` chain; **origin sha256 unchanged** across
  pickup/fetch/export; real kimi session projected 93 events). Basic auth 401→200
  verified empirically. Unit: `@allternit/native-sessions` 6/6 (`bun test src`).
- **Desktop incident — reproduced LIVE** against the user's RUNNING installed
  Allternit Desktop 1.1.0 (bundled api pid 8636 on :8013):
  `/api/v1/native-sessions/*` → HTTP 200 SPA `index.html`; bundled api+gizzi
  binaries contain 0 `native-session` strings; 1.1.0 bundle lacks the readJson
  guard. Evidence: `/tmp/nsdocs-verify/10-desktop-110-bundle.txt`,
  `11-desktop-110-live-incident.txt`.
- **Desktop UI fixed path — PASS.** Current platform static (built from this
  worktree; contains picker + guard) served by current `allternit-api` debug build
  on :18013 (`ALLTERNIT_LOCAL_DEV_BYPASS=1`, `TERMINAL_SERVER_URL` → production
  gizzi 2.0.7 on :4099). Headless-Chromium E2E (`e2e-fixed-path.cjs`,
  desktop-auth-bridge stub): picker catalog 200 rows → pickup POST 200 →
  "Continued from kimi 6d867601" banner + transcript. Screenshots
  `/tmp/nsdocs-verify/fixed-01-shell.png`, `fixed-02-picker-catalog.png`,
  `fixed-03-after-pickup.png`; HTTP transcript `browser-http-transcript.log`.
  Guard unit tests 4/4 (`native-sessions-api.test.ts`).
- **Packaged-app E2E**: performed earlier today by session `native-docs-20260908`
  (packaged app + current backend, `_electron`): PASS — evidence
  `/tmp/native-picker-e2e/` (screenshots, 3317-session catalog JSON, transcripts).

## Incidents / honest deferrals

1. **No fixed Desktop build exists (as of attestation).** `desktop-v1.1.1` release
   runs failed repeatedly today (run 34279647474: `x86_64-apple-darwin` rust target
   missing; later rounds fixed openssl-sys/vite-heap/win32-target/protoc per ledger
   entries relfix2–4). At attestation time a new run (34298095211, tag re-pointed
   to 4c08d34f) is **in progress** with all three build jobs running. Desktop 1.1.0
   remains broken for native sessions out of the box until one of these succeeds.
2. **`/native` is interactive-TUI only.** `gizzi exec "/native harnesses"` on 2.0.7
   sends the literal text to the model; the command is registered with
   `supportsNonInteractive: true` (`commands.ts:368`), so headless exec-mode routing
   looks like a gap. Reported in docs; not fixed (docs-only PR).
3. Pickup persistence across a gizzi store reset was not verified (picked-up
   sessions live in the gizzi runtime store, not the Rust api's sqlite).
4. Full packaged-Electron E2E with a current backend was NOT repeated by this
   session (user's Desktop 1.1.0 was live on :8013 and the shell hard-codes that
   port; taking it over would have disrupted the user's running app). The
   browser-based fixed-path E2E used the exact static export + relay the shell
   loads, and the packaged `_electron` pass from the earlier session stands.

## Cleanup

- Stopped temp servers: gizzi serve :4099, allternit-api :18013.
- Synthetic scratch claude sessions left for inspection under
  `~/.claude/projects/-tmp-nsdocs-verify/` (origin + one export), plus the picked-up
  gizzi sessions `ses_f7c5381a…` in the gizzi store.
- Evidence retained in `/tmp/nsdocs-verify/` (outside the repo); prior session's
  evidence in `/tmp/native-picker-e2e/`.
- Worktree `allternit-session-nsdocs` removed; branch `session/nsdocs` deleted
  local + remote.
