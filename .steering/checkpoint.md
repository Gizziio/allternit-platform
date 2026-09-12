# Steering checkpoint — artphase3-0912 (this session) + relay-watchdog (merged #424)

- **Goal (artphase3-0912):** A:// Artifacts Phase 3 (issue #389): hosted
  publish/unpublish/status gateway routes + deploy plumbing + minimal web
  actions + design-doc updates, per docs/design/artifacts-api.md §6 decisions.
- **Just did:** V150 migration; content_artifact_publish.rs (POST/GET/DELETE
  /content-artifacts/:id/publish) with the sandbox-policy gate (422, names the
  policy), immutable version snapshot, unpublish = route removal only, and an
  ArtifactPublisher trait (wrangler pages deploy impl env-gated;
  filesystem publisher dev default). Web: publish/unpublish + status on gallery
  cards. Design doc §3/§6/§7 updated. cargo test content_artifact 14/14; full
  api suite 1007 passed with only known pre-existing flakes; tsc 0 errors;
  design vitest 1770/0; release-preflight 35/0; live curl smoke green
  (publish → status → append → snapshot pinned → unpublish → deployment kept,
  422 gate).
- **Next:** merge PR #426 once the release build is green, then ledger attestation,
  desktop rebuild, cleanup.
- **Open questions:** none.

## Checkpoint — desktop-relay-watchdog-0912 (session merged via #424, kept for history)

- **Goal:** Fix #423 — desktop runtime relay silent-death (node dark until app restart).
- **Just did:** Worktree `desktop-relay-watchdog-0912` off origin/main. `auth-manager.ts` gained a relay heartbeat watchdog: `relayLastMessageAt` stamped on every WS message (cloud pings every 25s), a 30s interval closes the socket with code 4000 when the last message is older than 75s — the close handler stops the watchdog and schedules the existing backoff reconnect. Watchdog stopped in `clearSession()` too; `reconnectRuntimeRelay()` already funnels through the close handler. Desktop typecheck ✅, 125 vitest ✅, release-preflight 35/0 ✅.
- **Next:** PR → merge → ledger → rebuild desktop DMG from merged main (unsigned local build) → install into /Applications (quit running app first) → relaunch and verify `[Auth] Paired runtime relay connected` + viewer path.
- **Open questions:** none.
