# Herdr build fix — commrails rename in `ao/mailbox.rs`

**Date:** 2026-09-12 21:36
**Session:** `session/herdr-railsfix` (PR #432, merge `f4a49e3df`)
**Agent:** Kimi Code CLI (Joe's interactive session — fabric display-runtime recovery night)

## What was done

`cargo build -p herdr` failed on main with 11 errors: `infrastructure/executor/ao-engine/src/ao/mailbox.rs` still imported the pre-rename crate `allternit_agent_system_rails` (3 `use` statements) after the crate was renamed `allternit-commrails`. `Cargo.toml` already depended on the new name — only the imports were stale. Renamed the three `use` statements.

The same 3-line fix was found living only in the `allternit-session-phoneremote-0910` worktree (built into its binary 2026-09-11); it had never been landed canonically, which is why every other checkout (main included) could not build the `ao` binary. No CI workflow builds `herdr`, so nothing gated it.

## How it works

Cosmetic-correctness fix only: the crate rename PR renamed the library and the dependency declaration but missed this consumer. No behavior change — the symbols imported (`Bus`, `BusMessage`, `BusOptions`, `NewBusMessage`, `ActorType`, `Ledger`, `LedgerOptions`) are identical under the new crate name.

## Verification evidence

- `cargo build -p herdr` — green (2m17s). Was: 11 errors, could not compile.
- `cargo test -p herdr --bin ao ao:: -- --test-threads=1` — **104/104 pass** (includes all `ao::fabric` node tests).
- Full serial suite (`--test-threads=1`): **2532 tests pass**, then the test binary dies with SIGPIPE (signal 13) in `server::client_transport::tests::client_writer_closes_queue_after_socket_write_failure`. That module is untouched by this change; the single test **passes in isolation**. Classified as the same known pre-existing environment flake family documented in `docs/AO_FABRIC_NODE_NOTES.md` (order-dependent test-binary crashes on this machine).

## Operational context (why this session happened)

Joe reported the fabric display runtime offline. Recovery findings:

1. The display chain is Fabric PWA → cloud runtime-relay → `ao fabric serve` shim (loopback) → phone-remote desktop capture (`127.0.0.1:8477`, `sc_capture`). The phone-remote capture side was healthy the whole time; the missing piece was `ao fabric serve` — nothing was running it.
2. `ao fabric serve --port 8015` started from the phoneremote-0910 binary (the only one containing both the `/v1/remote-control/desktop/frame` routes and the PR #258 relay-gateway fix). Port 8014 was held by a stale duplicate serve; 8014/8015 skew is exactly what PR #258 fixed. Verified live: relay connected, `/frame` returns 200 image/jpeg (~165–207KB), `/hello` reports capture sckit 10fps hasFrame=true.
3. Installed `~/Library/LaunchAgents/com.allternit.ao-fabric.plist` — KeepAlive (SuccessfulExit), ThrottleInterval 300, RunAtLoad — running `~/.allternit/bin/ao fabric serve --port 8015`. The binary was copied to `~/.allternit/bin/` deliberately: session worktrees are deleted per hygiene rules, and main could not build a canonical `ao` (this PR fixes that; consider rebuilding `~/.allternit/bin/ao` from main and pointing the plist at a canonical location later).
4. Stale `ao fabric serve` processes (two duplicate relay connections for runtime `rt_0955ea41…`) were killed; LaunchAgent now owns the single healthy node.

## Incidents / honest deferrals

- Full-herdr serial suite SIGPIPE flake (above) — pre-existing, not fixed here.
- Desktop DMG rebuild not run: the change makes a sidecar compile again but alters no bundled behavior; the preview DMG's bundled `ao` predates this either way. Deferred to whoever next cuts a desktop release (release workflow builds sidecars in CI).
- The `ao fabric serve` LaunchAgent binary is the phoneremote-0910 build, not a main build — swap after the next main-based build.
- Shared checkout was on `ao/platform-console-agents` with uncommitted `fabric_routes.rs` work from another session; attestation committed from the session worktree on detached `origin/main` (`git push HEAD:main`) to avoid disturbing it.
