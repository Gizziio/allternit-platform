# Attestation: session/sips-templeak-2 — real containment of the sips temp-root leak

- **Date:** 2026-09-25
- **Agent:** Kimi Code
- **PR:** #730 (merge commit c39548fcc)
- **Commit:** 60753a650 `fix(phone-remote): sweep sips orphans from the per-user temp root`

## What was done

Follow-up to PR #729. That fix swept the per-process working dir, but live verification showed the
leak continuing: `sips` writes its UUID-named JPEG orphan to the **root of the per-user temp dir**
via `confstr(_CS_DARWIN_USER_TEMP_DIR)`, and setting a private `TMPDIR` env on the child does not
redirect it (confirmed with eslogger — orphan creation continued in T-root with TMPDIR set to the
working dir).

The sweep now targets `tmpdir()` itself, gated by: UUID-shaped filename + JPEG magic bytes
(`FFD8FF`) + 10 s age floor, so other apps' files and in-flight sips writes are untouched.

## Verification

- Patched server, `--capture screencapture --fps 10`, 45 s: T-root orphan count **fell**
  150,365 → 35,969 (sweep chewed through the backlog from the earlier leak while frames flowed);
  steady state ~200 and shrinking; `GET /frame` → 200.
- Installed `/Applications/Allternit Desktop.app` hot-patched with the merged file and restarted:
  orphan count falling (112 → 91 over 30 s) with the production app live.

## Honest deferrals

- The installed app was **hot-patched** (single file copied into the bundle), not rebuilt via the
  release path. Lifecycle step 8 (full desktop rebuild from merged main) is still owed; the
  hot-patch exactly matches merged main (`diff` clean against 60753a650's parent plus both fixes).
- Why sips orphans the intermediate at all (vs. standalone runs where it doesn't) was not
  root-caused inside Apple's binary; containment is mechanism-independent.
- Pre-existing dirty state in the shared checkout (`cmd/allternit-cloud-api/`,
  `cmd/gizzi-code/` oauth files) belongs to another session and was left untouched;
  `git-discipline-check.sh` FAILs on that pre-existing state only.
