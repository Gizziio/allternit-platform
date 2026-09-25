# Attestation: session/no-sips-fallback — root fix: sips removed from the capture loop

- **Date:** 2026-09-25
- **Agent:** Kimi Code
- **PR:** #731 (merge commit 5669fb613)
- **Commit:** 643ff68be `fix(phone-remote): replace sips with first-party resize_jpeg helper`

## What was done

PRs #729/#730 added sweeping of sips's UUID orphans — containment only. Owner review: "that isn't
a fix, that's only trying to clean it up." Correct. The defect was the fallback's design: shelling
out to `sips` per frame (~8fps, process lifetime) while sips orphans one UUID-named intermediate
per invocation in the per-user temp root via `confstr(_CS_DARWIN_USER_TEMP_DIR)` (a private TMPDIR
env does not redirect it — verified with eslogger).

Root fix: new `server/capture/resize_jpeg.swift` (compiled binary committed alongside source,
matching the `sc_capture` convention) downscales the frame atomically, touching only its
input/output paths — no TCC, no temp intermediates. If `swiftc` is unavailable the loop sends
full-res frames rather than returning to sips. The temp-root sweep from #730 stays as
belt-and-braces for older builds/other tools.

## Verification

- `resize_jpeg` standalone: 1280×720, ~298 KB, ~50 ms warm.
- Patched server `--capture screencapture --fps 10`, 30 s: zero sips processes spawned (previously
  ~8/s), T-root orphan count falling, `/frame` → 200 at 1280×720 (~280 KB).
- Installed `/Applications/Allternit Desktop.app` hot-patched (capture.mjs + resize_jpeg.swift +
  compiled binary) and restarted; 30 s observation: UUID orphans 0 → 0, zero sips processes.

## Honest deferrals

- Full desktop release rebuild (lifecycle step 8) still owed; installed bundle is hot-patched with
  files identical to merged main (5669fb613).
- The screencapture fallback still spawns `screencapture` + `resize_jpeg` per frame — acceptable
  now that both are well-behaved, but the sckit path (single persistent helper) remains the
  preferred mode; surfacing the Screen Recording TCC grant in the app UI would keep most installs
  off the fallback entirely.
- Pre-existing dirty state in the shared checkout (`cmd/allternit-cloud-api/`, gizzi-code oauth
  files) is another session's in-flight work, untouched; `git-discipline-check.sh` FAILs on that
  pre-existing state only.
