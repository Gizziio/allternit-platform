# Session summary — nsverify-20260908 (kimi-code)

**PR:** #172 → merge SHA `4c5d5e8fa8f8447ac3477c2c28ce734fb0a61a3d`
**Topic:** Production verification of gizzi-code 2.0.7 native sessions + docs reconciliation
**Date:** 2026-09-08

## What was done

1. **Live-verified the full `/v1/native-session/*` HTTP surface** against `gizzi serve --port 4899`
   (production gizzi 2.0.7) using the real native stores on this machine:
   - Catalog: 27 adapters in `/harnesses` (presence-detected); list → kimi 351, claude 272,
     codex 2480, grok 59 real sessions.
   - Show: kimi session → 146 inert portable events, no warnings.
   - Pickup: new Gizzi session with full `source_ref` (harness, sessionId, path, snapshotHash,
     snapshotAt, nativeHash, fetchedHash).
   - **Read-only origin guarantee:** SHA-256 of a quiescent claude origin `.jsonl` byte-identical
     before/after pickup (`528fa574ad84…e52`). An earlier delta against a *live* kimi origin was
     root-caused to that origin's own CLI appending concurrently (file grew 733,918→741,130 bytes
     in 20s with no gizzi write) — retested clean on the quiescent origin.
   - Fetch/divergence: live origin → `native_ahead`, fetched 152 turns into
     `session_source_event`; second fetch `clean`. Quiescent → `clean`.
   - Export: two calls → two distinct new UUID claude transcript files (re-cataloged, valid
     parentUuid chain); origin checksum unchanged. Refusal to overwrite is structural
     (`wx`/`O_EXCL` + `forbidPath` guard + random session ids). No API route can mutate an origin.
   - Negatives: unknown ids → 404 on show/pickup/fetch; `cwd` param scopes the lookup
     (mismatch ⇒ 404, not partial match).
2. **Headless CLI check:** `gizzi session --help` has only list/delete/export — pickup/fetch/export
   are TUI-only (`/native`, alias `/cli-session`). Matches the `gizzi exec` gap already documented
   by session/nsdocs. Recorded as a verified limitation, not worked around.
3. **Desktop integration verdict:** the changelog "web/desktop session picker" claim is accurate.
   The picker is `surfaces/ai.allternit.com`'s `NativeSessionPicker` → `nativeSessionsApi` →
   gateway `/api/v1/native-sessions/*` → `cmd/allternit-api` proxy → gizzi `/v1/native-session/*`.
   Allternit Desktop hosts that SPA plus bundled allternit-api/gizzi binaries (its 1.1.1 changelog
   entry documents fixing stale pre-feature binaries). Grep-verified: `surfaces/allternit-desktop`
   contains zero native-session code — consumption is entirely through the embedded shell. No UI
   built (per task).
4. **Docs reconciliation:** session/nsdocs landed `docs/public/tools/native-sessions.md` +
   `docs/NATIVE_SESSIONS.md` while this session worked. This session's originally drafted
   `docs/public/cli/native-sessions.md` was **dropped as duplicative**; its unique verified
   finding was folded into the existing docs instead:
   - **aider, cline, amp, kiro are registry-only** — in the `HARNESSES` registry and `/harnesses`
     endpoint but with no `catalog.ts` store reader; live-verified `list?harness=…` → 0 sessions.
     "27 harness stores" = 27 registered adapters / 23 readers.
   - Corrected the tools doc's "Every harness can be cataloged and picked up" claim + the Aider
     ✅ row; added the registry-only caveat. Added the missing aider row + a Known-issues entry
     to the operator reference.
   - CHANGELOG 2.0.7 left untouched (its claims verified accurate).

## Incidents / notes

- Merge conflict with session/nsdocs' checkpoint.md on landing — resolved by keeping both
  checkpoints (nsdocs history preserved in a collapsed section).
- Verification artifacts cleaned up: test gizzi sessions deleted via API, exported test claude
  files removed from `~/.claude/projects/-private-tmp-gizzi-nsverify-cwd/`, scratch server stopped,
  `/tmp/gizzi-nsverify-*` removed.

## Honest deferrals

- Desktop picker itself not exercised in a browser/Electron this session (nsdocs already did a
  headless-Chromium E2E of the fixed path — see its ledger entry); verdict rests on code/grep
  evidence + desktop CHANGELOG.
- The 4 registry-only adapters need `catalog.ts` readers if pickup support for them is wanted —
  code work out of scope for this docs/verification session.
