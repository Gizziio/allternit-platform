# Steering checkpoint — session/nsverify-20260908

## Goal
Verify gizzi-code v2.0.7 "native sessions" in production against real native stores
on this machine; determine allternit-desktop integration status; close docs gaps with a
feature doc; land via PR + ledger per repo ritual.

## Just did
- Worktree `allternit-session-nsverify-20260908` on `session/nsverify-20260908` from origin/main.
- Task 1 (LIVE-VERIFIED, evidence in PR body): `gizzi serve --port 4899` exercised full
  `/v1/native-session/*` surface against real stores (kimi 351, claude 272, codex 2480,
  grok 59 sessions). Pickup → `ses_f7c4...` with full source_ref; SHA-256 of quiescent
  claude origin identical before/after; fetch reported native_ahead=152 turns on a live
  kimi origin then clean; export wrote NEW UUID claude files (2x) with origin untouched;
  404s on unknown ids. Read-only guarantee structural (wx + forbidPath + random UUID).
- Task 1b: `gizzi session --help` has NO native subcommands — pickup/fetch/export are
  TUI-only (verified limitation, documented).
- Task 2: picker lives in surfaces/ai.allternit.com shell (`nativeSessionsApi` → gateway
  `/api/v1/native-sessions/*` → cmd/allternit-api proxy → gizzi `/v1/native-session/*`).
  Desktop hosts that SPA + binaries (desktop CHANGELOG 1.1.1 fixed stale binaries);
  desktop repo itself has zero native-session code — changelog claim verified accurate.
- Task 3: wrote `docs/public/cli/native-sessions.md` (concepts, TUI + HTTP reference,
  harness table, web/desktop status, limitations). Found + documented: aider/cline/amp/kiro
  are registry-only (no catalog reader). CHANGELOG 2.0.7 left untouched (claims verified).

## Next
Commit doc + checkpoint, push, PR with verification evidence, merge --merge, ledger
attestation on main, worktree cleanup.

## Open questions
None.
