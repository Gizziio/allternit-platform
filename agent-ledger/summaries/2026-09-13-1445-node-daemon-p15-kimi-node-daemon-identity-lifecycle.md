# Node daemon Phase 1.5 — identity bridge + lifecycle hygiene (PR #472)

Session: node-daemon-p15 · Agent: kimi-code · 2026-09-13 · Merge: d8ffd7c32

## What was done

Phase 1 (PR #465) of the node daemon E2E'd the night of 2026-09-12/13 with a
manual decrypt bridge for the daemon identity (desktop writes an AES-256-GCM
envelope; the daemon needs plain JSON). Eoj's directive for the follow-up:
production-quality fix, not a patch; no competition with the desktop; CRUD-able
lifecycle; no zombie processes. PR #472 delivers that in 5 commits:

1. **feat(allternit-node): hot-reload rotated identity before each relay
   connect** — the reconnect loop re-reads the identity file before every
   connect; a changed token is adopted ("adopted rotated identity"); a
   missing/invalid file keeps the last-known credential and warns. Kills the
   dual-rotation staleness scenario by construction.
2. **feat(allternit-node): run LaunchDaemon as the pairing user** — plist gains
   `UserName` (SUDO_USER → identity-file owner → omit); logs move into the
   user's `~/Library/Logs/allternit/`; install creates + chowns the dir. Daemon
   no longer runs as root; fs/exec/terminal land in the user's home.
3. **fix(allternit-node): reap spawned processes — shutdown signal, exec
   timeout** — SIGTERM/SIGINT handler → `TerminalStore::shutdown_all()`
   (kill + reap every PTY child) → exit 0. Audit finding: the exec *timeout*
   path dropped the future and orphaned the child; fixed with explicit spawn,
   drained pipes (avoids the wait()-with-full-buffers deadlock), wait, and
   kill+reap on timeout. `node.launch`'s `open` stays intentionally
   fire-and-forget.
4. **fix(desktop): desktop is the single writer of the daemon identity** —
   `persistIdentity()` (pair + every rotation) writes
   `~/.config/allternit/runtime-identity.json` (mode 600, daemon serde shape,
   `expiresAt` RFC3339 — numeric epoch is rejected); `clearSession()` removes
   it so a revoked runtime leaves no adoptable creds. Failures warn, never
   break pairing. One writer (desktop), one direction; the daemon never writes
   the desktop's file.
5. **docs(allternit-node): README with desktop no-competition guarantees** —
   outbound-only (zero listening ports); desktop owns :8013/:8477 +
   phone-remote/screen; daemon owns node.core + node.launch; restart signals
   only exact-name "Allternit Desktop"; rotation flow documented.

## Verification

- `cargo test -p allternit-node-daemon`: 23/23 (17 pre-existing + 4
  identity-reload + 1 shutdown_all + 1 plist-user). Re-run on the rebased
  branch by the parent agent, not just the implementing subagent.
- `cargo build --release -p allternit-node-daemon`: clean.
- Desktop `npm run typecheck`: pass.
- `node scripts/release-preflight.mjs`: 35 passed / 0 failed (script has grown
  past the 26-check era; 0 failures is the gate).
- Branch was rebased onto a moved main mid-session (two sessions merged
  underneath: PR #470 bot-chat, PR #471 console-fe-p7); re-verified after.
- CI on PR #472: all real checks green; Vercel preview jobs fail repo-wide on
  a deployment rate limit (pre-existing, unrelated).

## Incidents / honest notes

- The pre-PR-472 identity handoff was a hand-run decrypt in the E2E session
  (documented in the daemon spec's E2E log). It keeps working until a desktop
  build containing commit 4 ships; nothing depends on removing it early.
- `sudo` resets HOME to /var/root: installs must run as
  `sudo HOME=/Users/<user> allternit-node install` or the plist's
  `ALLTERNIT_RUNTIME_IDENTITY_PATH` misresolves. Recorded in the spec.
- The daemon plist's `UserName` resolution has a `/Users/<user>` home-dir
  fallback so a known user never silently falls back to a root daemon.
- Deferred: reboot-survival test of the LaunchDaemon and an in-PWA terminal
  session while the desktop app is closed (Eoj-side checks); desktop rebuild
  shipping the single-writer sync (next desktop build cut).
