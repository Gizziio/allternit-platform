# AO TUI Machines — P2 notes

**Spec:** `Allternit Brain/Research/specs/ao-tui-machines.md` (P2 of ao v3,
`Products/AgentOrchestratorRuntime.md` §5)
**Branch:** `ao/tui-machines` · **Date:** 2026-09-09
**Status:** DONE — rebrand + `machine connect` + Allternit default config +
Mac/Linux pilot complete. One integration fix beyond the rebrand list was
required (see §4).

---

## 1. What changed

### Rebrand (66 files, +728/−641)

The vendored herdr TUI in `infrastructure/executor/ao-engine/` now ships as
the ao face:

- All user-visible brand strings: clap name/about, CLI usage/help/diagnostics,
  window-title fallback, onboarding, shell labels, config diagnostics, remote
  install/hints, log file names, socket-busy/server errors, protocol version
  errors, tracing messages, embedded `DEFAULT_CONFIG` (incl. Allternit
  `[theme.custom]` palette + `window_title`), `skills/herdr/SKILL.md`.
- `app_dir_name()` → `ao` / `ao-dev` (debug builds): config `~/.config/ao`,
  state `~/.local/state/ao`, worktrees `~/.ao/worktrees`.
- Remote install suffix `.local/bin/ao`.

Kept per binding decisions (memo §6): `HERDR_*` env vars, toast serde value,
right-click enum value, protocol tokens `herdr:*`, socket file names,
`herdr-plugin.toml`, integration marker blocks (`# >>> herdr kimi integration`
kept for third-party config-file compat), upstream github URLs,
`update.rs` install detection, identifiers.

**Path migration note:** existing herdr state dirs must be renamed manually
(`~/.config/herdr` → `~/.config/ao`, `~/.local/state/herdr` →
`~/.local/state/ao`). No data transform.

### `ao machine connect` (new)

`src/cli/machine.rs`: `ao machine connect <profile-id> [--keybindings
local|server]` — thin mapping from the saved machine catalog profile to
`remote::run_remote` (~75 lines, additive; no new transport).

### Allternit `DEFAULT_CONFIG`

Embedded default ships the Allternit `[theme.custom]` palette and
`window_title = "ao"`.

## 2. Verification evidence

Full evidence set: `~/.agent-orchestrator/evidence/ao-tui-machines/`
(grep/test/fork-diff from the first session half) and
`~/.agent-orchestrator/evidence/ao-tui-machines/pilot/` (this session).

- `ao --version` → `ao 0.9.0`; `ao machine --help` lists `connect`;
  `--default-config` header + theme block confirmed
  (`ao-version-and-machine-help.txt`, `ao-default-config-head.txt`).
- Build green (`cargo build -p herdr`).
- Test parity: full-suite rerun shows only the 9 pre-existing
  `detect::manifest` parallel flakes + the same pre-existing upstream SIGPIPE
  harness death as the P0 baseline; `detect` serial 111/111
  (`cargo-test-baseline*.log`, `cargo-test-after*.log`). 4 test expectations
  that tracked renamed strings were fixed.
- This session (after the §4 fix): `cargo test -p herdr --test machine_setup`
  5/5 pass (these invoke `ao status client --json`, which only routes
  correctly with the rehome); `cargo test -p herdr --bin ao` 2409 passed
  before the pre-existing SIGPIPE death.
- Fork-diff guardrail: non-brand diff = `machine connect` fn + DEFAULT_CONFIG
  theme block + the §4 status routing (justified there). PASS
  (`fork-diff-stat.txt`).

## 3. Pilot (Mac + Linux) — evidence in `pilot/`

Host pair: this Mac (Apple Silicon, macOS) + `vps` (Ubuntu, glibc 2.39,
x86_64, `mail.news.allternit.com`).

1. **Cross-build** — `cargo zigbuild -p herdr --target
   x86_64-unknown-linux-gnu` (needs zig 0.15; see §5). Binary verified as
   ELF x86-64, runs on vps: `ao 0.9.0`.
2. **`ao machine add vps --label vps --remote-session ao`** →
   `Saved SSH machine ac9ac1d7ceda43af49ef21b521bcb5b6. Remote server is
   ready.` Remote headless server confirmed running on vps
   (`02-machine-add-success.txt`, `03-machine-list.txt`). The binary was
   pre-seeded to `vps:~/.local/bin/ao` via scp because the install-approval
   prompt requires a tty by design (`01-machine-add.txt` shows the prompt;
   a pty-fed `y` raced and was rejected — `01b`).
3. **Combined cross-machine list** — TUI (`./target/debug/ao --session ao`,
   tmux 120x40) sidebar shows `▾ Local` (workspace `allternit-ao-tui-…`)
   and `▾ vps ●` with its remote workspace `~` in one list
   (`04-combined-machine-list.txt`). `ao --session ao agent list` returns
   aggregated JSON (`05-agent-list-combined.txt`; empty agent set — no
   agent CLIs were spawned in panes for the pilot).
4. **Reconnect-on-drop** — killed the local ssh bridge PID at 10:59:52
   (`06-kill-bridge.time`); TUI flipped to `vps ◐ reconnecting`; back to `●`
   at 11:00:14 (~22 s, within the ≤30 s supervisor backoff); new bridge ssh
   PID 72297 confirmed (`07-reconnect-watch.txt`, `08-reconnected.txt`).
5. **`ao machine connect ac9ac…`** — attached directly into the remote
   session; remote proof inside the pane: `hostname` →
   `mail.news.allternit.com`, `Linux 6.8.0-136-generic x86_64`,
   `PILOT_MARKER` echoed (`09-machine-connect-proof.txt`; raw stream in
   `09-machine-connect.txt`).
6. **Cleanup** — client detached, local session-ao server stopped, remote
   server stopped, `ao machine remove` → `No saved SSH machines.`
   (`10-machine-remove.txt`).

## 4. Integration fix beyond the rebrand list (required)

P1's ao contract (`src/cli/ao.rs`) takes priority over the engine's own
words at the dispatcher (`src/cli.rs:110`), which shadowed engine `status`.
The remote machinery probes a saved machine with
`ao --session ao status server --json` (`src/remote/attach.rs:1100`), which
hit the ao contract parser instead: `error: '--json' is not a number`, and
`ao machine add` could never inspect/start a remote server. This blocked the
spec's Verify item "machine add round-trip against a real Linux host".

Fix (small, additive routing — the "future P2+ rehome" the P1 comment
anticipated): `ao::status` now forwards the engine's own forms —
`ao status --json|server [--json]|client [--json]|help` — to
`cli::status::run_status_command`; everything else stays on the ao contract
(`ao status [slug] [lines]`). Slugs literally named `server`/`client`/`help`
would now hit engine status — not a real slug shape (`ao-*`), accepted and
documented here.

## 5. Build notes / sharp edges

- **zig 0.15 required.** Homebrew `zig` is now 0.16, which fails the vendored
  libghostty-vt build (`build.rs` demands v0.15.2). Use the keg:
  `PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo build -p herdr`.
- **Cross-builds:** same PATH + `cargo zigbuild -p herdr --target
  x86_64-unknown-linux-gnu`.
- **Host and cross builds cannot run concurrently**: both write
  `vendor/libghostty-vt/zig-out/lib/libghostty-vt.a`, so the archive flips
  architecture mid-link (`archive member '/' not a mach-o file`). If a cross
  build clobbered the host lib: `rm -rf vendor/libghostty-vt/zig-out
  vendor/libghostty-vt/.zig-cache && touch build.rs` then rebuild host.
- `ao status` (no args) is the ao contract session list; engine status lives
  under the subcommand forms above.
- Saved-machine state is per-session: use `--session ao` (or `HERDR_SESSION`)
  for `agent/api/status` CLI probes against the session-ao server; the
  default socket is the non-session one.

## 6. Honest deferrals

- No agent CLI panes were spawned during the pilot, so the combined *agent*
  list was exercised empty (machine/workspace aggregation is evidenced;
  `agent list` JSON round-trip verified against the live server).
- The remote-install approval path was not exercised end-to-end (tty
  requirement); the prompt itself is evidenced, the bytes were seeded via
  scp. `tests/machine_setup.rs` covers the approval flows against a fake SSH
  host (5/5).
- `machine rename`/`enable`/`disable` not separately piloted (same catalog
  code path as `list`/`remove`, which were exercised).
