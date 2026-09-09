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
