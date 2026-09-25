# Attestation: session/sips-templeak — phone-remote sips temp-file disk leak fix

- **Date:** 2026-09-25
- **Agent:** Kimi Code
- **PR:** #729 (merge commit a4d7d3d7a)
- **Commit:** 36933d013 `fix(phone-remote): sweep sips UUID temp orphans in screencapture loop`

## What was done

The host machine's disk filled to 100% twice; 512 GB of UUID-named 1280×720 JPEGs were found in
`$TMPDIR` (`/private/var/folders/9v/.../T`). Traced with `eslogger`/`fs_usage`: the installed
Allternit Desktop's phone-remote server (screencapture fallback path in
`surfaces/phone-remote/server/lib/capture.mjs`) invokes `sips -Z 1280 --out <small.jpg>` at ~8 fps
for the process lifetime, and each sips invocation orphans one UUID-named intermediate (~300 KB)
in TMPDIR — ~2.4 MB/s ≈ 200 GB/day. Controlled test with the app paused: 15 sips runs → exactly
+15 orphans, confirming sips-in-TMPDIR as the leak, not the app writing frames directly.

## Fix

`capture.mjs #startScreencaptureLoop`: tmp/small now live in a per-process `mkdtemp` working dir;
every 50 frames the loop deletes UUID-named orphans older than 2 s (in-flight sips writes are
skipped by the age check); the working dir is removed recursively on `stop`.

## Verification

- Patched server run with `--capture screencapture --fps 10 --bind 127.0.0.1` for 30 s:
  working dir held only `capture.jpg` + `small.jpg`, 0 UUID orphans; `GET /frame` → 200.
- The 512 GB of orphaned files were deleted from the host; free space recovered 6.9 GB → 518 GB.

## Incidents / honest deferrals

- **Installed app not yet patched.** `/Applications/Allternit Desktop.app` still runs the leaky
  code; the leak recurs until the desktop binary is rebuilt/reinstalled (lifecycle step 8 deferred
  to a follow-up: phone-remote is bundled under `surfaces/allternit-desktop/resources`). Until
  then the leak is bounded only by restarting the app / rebooting.
- The sckit primary capture path is unaffected (no sips involved); the leak only occurs when the
  screencapture fallback is active.
- The exact sips-internal mechanism (why the UUID intermediate is orphaned when output is under
  TMPDIR but not under /tmp in standalone tests) was not root-caused inside Apple's binary; the fix
  contains the symptom regardless of mechanism.
- Pre-existing: shared checkout had uncommitted changes in `cmd/allternit-cloud-api/` (another
  session's in-flight work — untouched), and stale session worktrees/branches
  (desktop-full-0915, laya-finetune, openmaus-botmode-0915, tier-a) remain unmerged/unaudited.
