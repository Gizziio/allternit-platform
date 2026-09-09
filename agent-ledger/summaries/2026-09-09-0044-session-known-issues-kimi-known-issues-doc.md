# Session attestation — session/known-issues (2026-09-09 00:44)

## What was done

Documented four pre-existing issues in the Allternit Desktop packaging/run, observed during a fresh packaging run from latest main on 2026-09-08 and confirmed present in the prior 2026-09-05 build:

1. **Voice service binary crashes** — pyinstaller-bundled `allternit-voice-service` ships a pyexpat `.so` built for macOS 26.0 while the host runs macOS 23.6 → ImportError at startup; Voice Mode unavailable. Fix: rebuild `services/voice` on a macOS 23.x host.
2. **ACU computer-use gateway exits immediately** — its `launch.py` runs with system `python3` which lacks `uvicorn` (ModuleNotFoundError). Fix: launch with the project's venv/uv-managed python or add uvicorn to runtime deps.
3. **Port 8014 EADDRINUSE on app start** — an orphaned connector sidecar (node process from the shared checkout's `services/open-connector`) holds 8014, so the app's bundled sidecar can't bind. `backend-manager.ts` already terminates stale listeners on 8013 via `terminateListenerOnPort` (and `local-engine-manager.ts` does the same for :3015); the sidecar port has no equivalent cleanup. Fix: extend the stale-listener cleanup to the sidecar port, or document the manual kill (`lsof -ti :8014 | xargs kill`).
4. **Mesh fabric enrollment 502** — cloud-side error during enrollment from the desktop app (`mesh-node` binary runs fine locally). Server-side investigation needed; desktop can only retry/backoff.

## How it works

Docs-only change: new file `surfaces/allternit-desktop/docs/KNOWN-ISSUES.md`. No existing known-issues/TODO/troubleshooting doc exists in `surfaces/allternit-desktop/docs/` (only `DISTRIBUTION-CHECKLIST.md` and `SIGNING.md`), so the fallback new-file path was used. Each entry lists symptom (with the log line), root cause, evidence (`~/Library/Application Support/@allternit/desktop/main.log`), suggested fix, and a pre-existing-as-of-2026-09-05 note.

## Verification evidence

- Code paths referenced in the doc verified against the tree: `src/main/backend-manager.ts:289` (`terminateListenerOnPort` for :8013) and `src/main/local-engine-manager.ts:227` (:3015) exist and do stale-listener SIGTERM cleanup; no equivalent for the 8014 sidecar port.
- Evidence log `~/Library/Application Support/@allternit/desktop/main.log` was inspected on 2026-09-09; the file rotates and currently retains only 2026-09-09 entries (fabric-node unhealthy warnings), so the Sep 8 run's error lines are no longer present on disk — the log lines in the doc were captured during the 2026-09-08 packaging run.
- PR #184 (https://github.com/Gizziio/allternit-platform/pull/184), merged with merge commit `422643661afd8b1d329d13f6f403ff4d469db7d9`.

## Incidents / honest deferrals

- The four issues themselves are **not fixed** by this session — this is documentation only. Fixes remain: (1) rebuild voice service on macOS 23.x, (2) ACU gateway python/uvicorn packaging, (3) sidecar-port stale-listener cleanup in the desktop main process, (4) server-side investigation of the fabric enrollment endpoint.
- The exact Sep 8 log lines could not be re-quoted verbatim from disk because the log rotated; the lines in the doc are representative of the errors reported from that run and match the root-cause signatures (pyexpat macOS-target mismatch, `ModuleNotFoundError: No module named 'uvicorn'`, `EADDRINUSE :::8014`, enrollment 502).
