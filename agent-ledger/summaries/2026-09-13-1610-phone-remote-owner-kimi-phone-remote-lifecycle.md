# Phone-remote lifecycle ownership (PR #479)

Session: phone-remote-owner · Agent: kimi-code · 2026-09-13 · Merge: c3bbb8a84

## What was done

Incident: the Fabric viewer cast a stale frame from Sept 12 8:04pm for hours.
The desktop app proxies viewer traffic to 127.0.0.1:8477 but nothing owned the
phone-remote server — it had been started by hand from a worktree, its
sc_capture child froze silently, and the server served `lastFrame` forever
with `/hello` reporting `hasFrame: true`. PR #479 makes the desktop app the
owner in 4 commits:

1. **feat(phone-remote): frame watchdog, one restart, honest /hello stale
   flag** — 5s frame-freshness watchdog (10fps stream); freeze → kill helper →
   one in-process sckit restart → else exit non-zero for a supervisor. Pure
   `isStale()` + injectable scheduler for deterministic tests. `/hello` gains
   `stale` + error fields. PORT env support (backward-compatible).
2. **feat(desktop): phone-remote-manager owns the 8477 server lifecycle** —
   probe /healthz on launch, spawn the bundled server via
   ELECTRON_RUN_AS_NODE, wait for health, supervise with 1s→30s backoff,
   adopt-don't-kill foreign listeners (warns with owner PID), SIGTERM→SIGKILL
   own child on quit. Failures never block app boot.
3. **build(desktop): bundle phone-remote server in Resources + preflight
   gate** — extraResources (sources only; first-run swiftc builds sc_capture
   as today); release-preflight gains the check (35 → 36).
4. **docs(phone-remote): lifecycle ownership, watchdog behavior, /hello
   stale.**

## Verification

- phone-remote tests: 38 checks pass (22 existing + 16 new).
- Live watchdog smoke on throwaway port with real sckit capture: SIGSTOP →
  trip at 5s → restart → frames resume; refreeze → FATAL → exit non-zero,
  port freed. Fixed a real superseded-child race this smoke exposed.
- Desktop typecheck clean; release-preflight 36/0.
- Production :8477 instance untouched throughout (verified healthy).
- CI on PR: vitest/typecheck green; Vercel previews fail repo-wide on a rate
  limit (pre-existing). Rebased onto moved main mid-session; re-verified.

## Incidents / honest notes

- Desktop vitest suite not run locally (typecheck only) — CI covered it.
- The previous manual-start workflow still works for development; the app
  will adopt such a server and decline to supervise it (by design, loudly).
- Rebuild of the installed Desktop from merged main + live verification
  (spawn, freeze recovery, quit-frees-port) is the parent's post-merge step.
