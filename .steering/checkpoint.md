# Steering checkpoint — session/fastload-0914

- **Goal:** Make Allternit Desktop launch fast (26s cold start → target <8s), make boot failures fail-fast with real errors, and ship splash option A (A://TERNIT wordmark + Details toggle).
- **Just did:** Diagnosed launch path from logs (20.8s local-engine dead poll, serial bring-up, blocking folder-grant gate, 90s fail-slow API boot). Created worktree `allternit-session-fastload-0914`, DAG `dag_492447` with 6 nodes. User approved fixes + option A splash (auto mode; user said "do the fixes… i want option a").
- **Next:** Implement in `surfaces/allternit-desktop`: parallel bring-up, ECONNREFUSED fast-paths, fail-fast on child exit, non-blocking folder grants, splash rewrite. Then typecheck + vitest + `node scripts/release-preflight.mjs` (must be 26/0) + launch timing check.
- **Open questions:** Whether to await local-engine before API spawn depends on how cmd/allternit-api consumes LOCAL_ENGINE_URL (proxy-at-request-time → can pass URL without readiness). PR merge + DMG rebuild deferred to user after verification.
