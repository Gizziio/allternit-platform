# Steering checkpoint

**Goal:** WebMCP-shaped tool layer + semantic tool-call logging + timeline playback viewer — now with real video capture and a video-synced tool-call track.

**Just did:** Milestone 4 — video capture + tool-call track.
- `src/protocol/video-recorder.ts` (new): prepare/finalize helpers; video start epoch captured at context creation (`offset_ms = frame_ts - startedAtEpoch`); artifacts land as `<id>.webm` in `~/.allternit/recordings/`.
- `LocalPlaywrightProvider.startRecordedSession/stopRecordedSession/getVideoArtifact`: recordVideo on a Playwright-created context (works over CDP — verified empirically on playwright 1.58.2 with chromium-1234, headless; existing Chrome-created profile tabs stay video-less by Playwright design). Session binding re-points at the recorded tab; other contexts' pages are closed so the CDP action primitives resolve the recorded tab unambiguously.
- `launcher.connectViaCDP`: prefer the first context that has pages.
- Run controller `recordArtifact` → `artifact.created` events; browser server routes `POST /v1/browser-runs/:runId/video/start|stop`.
- Python ACU core: `RecordingManifest.video_path`/`video_start_epoch`; `POST /record` accepts them at start/stop; detail route adds `video_url`; new `GET /recordings/{id}/video` (webm, same containment hardening as GIF).
- Surface: `buildToolCallTrack` pure export in recording-timeline.ts; manifest video fields parsed; `recordings.ts` client fetches video like GIF; `AciRecordingTimelineView` gains a `<video>` pane (gateway artifact or "Open video…" file picker) with bidirectional scrubbing — track click seeks the video, `timeupdate` highlights the nearest track entry; screenshot mode remains the fallback.

**Verification:** allternit-browser `tsc --noEmit` clean; package vitest 89 passed / 8 skipped (incl. new recordVideo launch+CDP smoke and full provider drive-the-recorded-tab test); surface aci vitest 50 passed (19 timeline tests incl. 7 new track-export tests); Python `test_recordings_routes.py` 20 passed (6 new video tests) via scratch uv venv at /tmp/webmcp-test-venv. Pre-existing failures noted, not introduced: surface `tsc --noEmit` has 6 missing-module errors (mermaid/yjs/storybook/immer — none in touched files); `core/tests/test_replay.py` fails identically at HEAD; one stale committed assertion in test_recordings_routes.py (`kind: "action"` in route but not test) fixed in-place.

**Next:** Parent review; session wrap (commit/PR/ledger happen outside this subagent per instructions).

**Open questions:** None.

---

<!-- merged checkpoint from branch ao/tui-machines (P2, landed 2026-09-09) -->

# Steering checkpoint — ao/tui-machines (P2 executor)

## Goal
P2 of ao v3 (spec: Allternit Brain/Research/specs/ao-tui-machines.md): rebrand vendored
herdr TUI to ao face, add `ao machine connect`, ship Allternit DEFAULT_CONFIG, verify
(grep/test parity/fork-diff) + Mac+Linux pilot. Deliverable: docs/AO_TUI_MACHINES_NOTES.md
+ branch pushed.

## Just did
- Rebrand landed (work resumed after delegated subagent was stopped; finished + audited
  every edit myself). ~66 files, +713/−641, all user-visible brand strings: clap name/about,
  all CLI usage/help/diagnostics, window-title fallback, onboarding, shell labels, config
  diagnostics, remote install/hints, log file names, socket-busy/server errors, protocol
  version errors, tracing messages, DEFAULT_CONFIG (incl. Allternit [theme.custom] palette
  + window_title), SKILL.md (HERDR_ENV kept). app_dir_name() → ao/ao-dev (config
  ~/.config/ao, state ~/.local/state/ao, worktrees ~/.ao/worktrees). Install suffix
  .local/bin/ao. `ao machine connect <profile-id> [--keybindings local|server]` (~75 lines,
  maps catalog profile → remote::run_remote, best-effort select_ssh).
- Kept per binding decisions: HERDR_* env vars, toast serde value, right-click enum value,
  protocol tokens herdr:*, socket file names, herdr-plugin.toml, integration marker blocks,
  upstream github URLs, update.rs install detection, identifiers.
- Verify: build green. cargo test parity: rerun shows only the 9 pre-existing
  detect::manifest parallel flakes + same SIGPIPE harness death (baseline identical);
  detect serial 111/111. 4 test expectations fixed (they tracked renamed strings).
  Fork-diff guardrail: only non-brand changes = connect fn + DEFAULT_CONFIG theme block. PASS.
- Branding evidence: `ao --version` → "ao 0.9.0"; machine --help lists connect;
  --default-config header + theme block confirmed.
- Pilot prep: Linux host `vps` reachable (Ubuntu, glibc 2.39, x86_64). Cross-building
  ao for x86_64-unknown-linux-gnu via zig linker (for HERDR_REMOTE_BINARY seed).

## Next
- DONE: pilot complete (machine add/list/connect/remove round-trip vps,
  combined list, reconnect ~22s, connect proof). Docs written
  (docs/AO_TUI_MACHINES_NOTES.md). Remaining: commit/push/PR.
- machine_setup 5/5 + bin unit 2409 passed (pre-existing SIGPIPE death) after
  status rehome. zig@0.15 keg required for builds; host/cross builds share
  vendor zig-out and cannot run concurrently (documented in notes).

## Open questions
- Integration marker blocks keep the herdr name on purpose (documented).
- FOUND + FIXED (resumed session): P1's ao contract shadows engine `status`,
  which broke `ao machine add` (remote probe `status server --json` hit the
  contract parser: "'--json' is not a number"). Rehomed engine status forms
  (--json/server/client/help) inside ao::status. Small additive routing fix
  beyond the rebrand list — required by spec Verify "machine add round-trip".
- Cross-build binary pre-seeded to vps ~/.local/bin/ao via scp (install prompt
  needs a tty; pty attempt raced). Remote runs ao 0.9.0.
