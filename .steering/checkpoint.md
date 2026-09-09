# Steering checkpoint — session/nsverify-20260908

Supersedes the nsdocs checkpoint below (that session landed its docs in PR via session/nsdocs;
this session verified the same surface independently in production and reconciled doc claims).

## Goal
Verify gizzi-code v2.0.7 "native sessions" in production against real native stores
on this machine; determine allternit-desktop integration status; close docs gaps;
land via PR + ledger per repo ritual.

## Just did
- Worktree `allternit-session-nsverify-20260908` on `session/nsverify-20260908` from origin/main.
- Task 1 (LIVE-VERIFIED, evidence in PR #172 body): `gizzi serve --port 4899` exercised full
  `/v1/native-session/*` surface against real stores (kimi 351, claude 272, codex 2480,
  grok 59 sessions). Pickup → `ses_f7c4...` with full source_ref; SHA-256 of quiescent
  claude origin identical before/after; fetch reported native_ahead=152 turns on a live
  kimi origin then clean; export wrote NEW UUID claude files (2x) with origin untouched;
  404s on unknown ids. Read-only guarantee structural (wx + forbidPath + random UUID).
- Task 1b: `gizzi session --help` has NO native subcommands — pickup/fetch/export are
  TUI-only (verified limitation, already documented by nsdocs as `gizzi exec` gap).
- Task 2: picker lives in surfaces/ai.allternit.com shell → gateway
  `/api/v1/native-sessions/*` → cmd/allternit-api proxy → gizzi `/v1/native-session/*`.
  Desktop hosts that SPA + binaries; desktop repo itself has zero native-session code —
  changelog claim verified accurate.
- Task 3 (reconciled with session/nsdocs, which landed first): dropped my duplicate
  `docs/public/cli/native-sessions.md` (nsdocs landed `docs/public/tools/native-sessions.md`
  user doc + `docs/NATIVE_SESSIONS.md` operator reference). My unique verified finding
  folded in instead: **aider/cline/amp/kiro are registry-only — no catalog reader**
  (live: `list?harness=aider` → 0 sessions). Fixed the tools doc's incorrect
  "every harness can be cataloged and picked up" claim + Aider ✅ row, and added the
  missing aider row to the operator doc's source-paths table.

## Next
Push reconciliation commits, merge PR #172 --merge, ledger attestation on main,
worktree cleanup.

## Open questions
None.

---

<details>
<summary>Prior checkpoint — session/nsdocs (landed via main, kept for history)</summary>

# Steering checkpoint — session/nsdocs

## Goal
Verify the gizzi-code v2.0.7 "native sessions" feature in production (CLI + Allternit Desktop), map it, and write user-facing + operator/API docs under docs/public/ based only on verified evidence. Land via PR per session ritual.

## Just did
- Created worktree allternit-session-nsdocs on branch session/nsdocs from origin/main (2d4e7965a).

## Just did (mapping + gaps)
- Full map done: `@allternit/native-sessions` pkg (27 harness adapters, harness.ts:13-41; catalog.ts readers; project.ts projectors; export.ts writers incl. session-migrate bridge), gizzi `NativeSource` (native-source.ts), routes mounted at `/native-session` + `/v1/native-session` (server.ts:383,477), TUI `/native` (commands/native/native.ts).
- sessionIngress.ts = cloud log persistence (NOT this feature) and agent-compat.ts = iOS agent-sessions facade (NOT this feature) — both red herrings in the entry-point list, noted as pre-existing.
- Platform/Desktop consumer: `surfaces/ai.allternit.com/src/lib/agents/native-sessions-api.ts` → `/api/v1/native-sessions*` → Rust api proxy (agent_session_routes.rs:136-142) → gizzi `/v1/native-session/*` with Basic auth. UI: NativeSessionPicker via ShellRail "Continue CLI session".
- PRIOR SESSIONS TODAY (ledger): PR #136 wrote surfaces/docs/cli/native-sessions.mdx + E2E evidence /tmp/native-picker-e2e (still on disk); PR #146/#149/#156 shipped desktop 1.1.1 attempts. KEY: installed Desktop is still 1.1.0; desktop-v1.1.1 release run 34279647474 FAILED (x86_64-apple-darwin rust target missing on runner) — no fixed DMG exists.

## Gaps found
- docs/public/tools/ has NO native-sessions doc (only mcp.md, tool-belt.md, strict-tool-use.md).
- docs/ has NO operator/API doc (routes/auth chain/per-CLI source paths/export format). mdx has a short HTTP table only.

## Verification status (evidence in /tmp/nsdocs-verify/)
- CLI PASS (production gizzi 2.0.7, /opt/homebrew/bin/gizzi): 27 harnesses listed, 3340 real sessions cataloged; pickup of scratch claude session → ses_f7c5381a…; fetch clean → native_ahead (fetched=2 after simulated origin append) → stored origin events; export wrote NEW claude jsonl (valid parentUuid chain); origin sha256 unchanged by gizzi ops. Basic auth empirically verified (401→200). NOTE: `gizzi exec "/native …"` does NOT run the slash command (text goes to model) — /native is interactive-TUI only (registered commands.ts:368, alias /cli-session).
- Desktop: incident captured LIVE against user's running Desktop 1.1.0 (bundled api pid 8636 on :8013 returns HTTP 200 SPA HTML for /api/v1/native-sessions/harnesses; 0 native-session strings in bundled api+gizzi binaries; guard string absent from bundle).
- Desktop v1.1.1 release run 34279647474 FAILED (x86_64-apple-darwin rust target missing) — no fixed DMG exists.
- Fixed-path verification in progress: current api debug binary on 18013 (ALLTERNIT_LOCAL_DEV_BYPASS=1, TERMINAL_SERVER_URL→prod gizzi :4099) + current platform dist (worktree build, has readJson guard) → headless-chromium E2E of the exact Desktop UI.

## Next
1. Finish browser E2E, view screenshots.
2. Write docs/public/tools/native-sessions.md + operator/API doc; update root AGENTS.md doc index.
3. Land per ritual.

</details>
