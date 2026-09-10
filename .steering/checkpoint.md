# Checkpoint — session/desktop-icon-brand-20260910

## Goal
Replace the desktop app icon with the OFFICIAL Allternit brand asset (no invented art).

## Just did
- Sourced `Allternit Assets/Brand/A Protocol/app-icon/a-protocol-app-icon.png`
  (1024, official dark grid + orange accent mark) and applied only the macOS
  squircle mask (corner radius 22.4%) — no artwork changes.
- Rebuilt build/icon.png (1024), build/icon.icns (full iconset), build/icon.ico (16-256).
- release-preflight 35/0.

## Next
- Commit + PR + merge; sync main; ledger attestation; rebuild desktop DMG; cleanup.

## Open questions
- None.

---

# Steering checkpoint — session/botmode-api-0910 (update 1)

Goal: code-fix bot-desktop API bugs 6-8 documented by session/botmode-0910 (PR #262).

Just did:
- Worktree allternit-session-botmode-api-0910 on session/botmode-api-0910 from origin/main (3bea3f45b).
- Bug 8: DesktopQuery.sandbox_id now Option; resolve_sandbox_id falls back to the bot's
  persisted sandbox record; applied to status, screenshot, start, stop, destroy, observe,
  take-over, hand-back, mux run, mouse/keyboard/download/upload (pause/resume forward).
  400 only when neither query param nor persisted record exists.
- Bug 7: provision accepts an optional JSON body (ProvisionDesktopBody) merged over query
  params (query wins). Body-only callers now hit validation instead of being silently ignored.
- Bug 6: resolve_provision_spec defaults os to macos when only Tart is configured
  (pick_default_os pure fn); NotSupported spawn errors now carry an explicit hint
  (?os=macos&provider=tart / configure INCUS_URL or TART_HOST_URL).
- Tests: 7 new (status/start/observe bare-route fallback, no-record 400, body validation
  400, query-wins-over-body 503, pick_default_os matrix). cargo test -p allternit-api
  bot_desktop: 72/0 pass. Full suite + release build running in background.

Next: full suite green → release-preflight → live probe on isolated :18013 (bare provision
→ macos route, JSON-body provision parses, bare GET /desktop resolves persisted sandbox)
→ commit/push/PR/merge → ledger → cleanup. Desktop rebuild after all done (owner).

# Update 2 — verified + landed (2026-09-10 ~17:05 CDT)

Just did:
- Full suite: 830 pass, 4 fail — all 4 are agent_cloud_routes real-control-plane tests that fail identically on clean main (pre-existing env issue, unrelated).
- release-preflight 35/0; cargo build --release green.
- Live probe vs isolated :18013 (worktree release binary + real Tart host): bare provision -> 200 provider=tart (log: "Routing desktop spawn to substrate os=macos"); bad JSON body -> 400 validation; bare GET /desktop -> 200 with persisted sandbox; cleanup 204/200, tart clean.
- Attestation written: agent-ledger/summaries/2026-09-10-1705-botmode-api-0910-kimi-bot-desktop-api-ergonomics.md

Next: commit + push + PR + merge + ledger + cleanup. Desktop rebuild after all done (owner).
