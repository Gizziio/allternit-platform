# Phone-remote input-helper bundle fix (PR #482)

Session: phone-remote-bundle-fix · Agent: kimi-code · 2026-09-13 · Merge: e5e38be8c

## What was done

The b2585 live verification of PR #479 (desktop-owned phone-remote) caught a
bundling gap the same hour it shipped: the app-spawned server started without
`input/input_helper.py` — the extraResources filter copied only the server
tree (index.mjs + lib/ + sc_capture.swift). The HID input bridge died at
boot (helper exit 2), remote input would have been dead, silently.

- `build.extraResources` gains `../phone-remote/input → phone-remote/input`
  (`input_helper.py`, `input_helper_x11.py`).
- release-preflight check 7 widened to gate both entries (server tree + input
  helper), so the gap cannot regress.

## Verification

- `node scripts/release-preflight.mjs`: 36/0 (check 7 widened in place, same
  count).
- The gap itself was found by the live b2585 spawn test (helper stderr in
  `~/Library/Application Support/@allternit/desktop/phone-remote.log`).

## Incidents / honest notes

- Same session (parent, not this branch): the b2585 boot also exposed a stale
  sidecar — `resources/bin/allternit-api` had been copied from the shared
  checkout (branch `ao/platform-console-agents`), and its embedded migration
  set predated V142, which the machine's DB already had applied → refinery
  "migration V142__runtime_settings is missing from the filesystem" panic
  loop, app never rendered. Fixed by building the sidecar from the same main
  worktree as the app (`cargo build --release -p allternit-api` at main
  5634603ec) and swapping it into the bundle (rm + fresh inode — never
  in-place `cp` over a running/mapped binary: macOS invalidates the code
  signature and SIGKILLs, learned earlier the same night on the daemon).
  **Standing rule recorded: never copy sidecar binaries from the shared
  checkout — build them from the worktree that builds the app.**
- Rebuilt DMG after this merge carries both fixes (input helper + fresh
  sidecar in resources/bin).
