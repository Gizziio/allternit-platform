# Attestation — session fix/sw-cache-guard (fabric-session SW cache guard)

- Date: 2026-09-10
- Agent family: kimi (subagent agent-14, orchestrator-directed)
- Branch: `fix/sw-cache-guard` → PR #247, merged `36336f24f7`

## What was done

The fabric-session PWA service worker
(`surfaces/ai.allternit.com/public/fabric-session-service-worker.js`) uses a
hand-bumped `CACHE_NAME`; deploys that change PWA assets without bumping it
strand installed PWAs on stale caches — this actually blanked the PWA for a
user after a deploy (tracked as the "SW cache-first stale shell" follow-up).

PR #247 adds a CI guard: `scripts/check-sw-cache-bump.mjs` fails a PR that
touches fabric-session watch paths (SW itself, `fabric-session.html`,
webmanifest, icons/splash, `src/fabric-session/`) without a `CACHE_NAME`
bump, via the new PR-triggered workflow
`.github/workflows/fabric-session-cache-guard.yml`.

## How it works / verification

- Script diffs `base...head`, extracts `CACHE_NAME` at both refs, exits 1 with
  a actionable message when watch paths changed without a bump.
- Verified locally in disposable clones (mktemp -d): baseline pass, negative
  (touch src without bump → fail), positive (touch + bump v20→v21 → pass),
  SW-only variants both directions.
- **Incident + fix:** first CI run failed because the workflow passed bare
  branch names (`main`) that don't exist in the Actions checkout; fixed by
  prefixing `origin/` in the workflow env and adding an `origin/` retry
  (`resolveRef`) in the script. `gh pr checks 247`: guard pass, gitleaks pass,
  typography pass. Vercel preview failures on the PR are the account-level
  rate limit (pre-existing).
- Caveat recorded in the PR body: the three PNG watch paths don't exist in the
  repo yet (webmanifest references them); they guard those assets if added.

## Honest deferrals

- The guard only protects PRs; direct pushes to main bypass it (repo rules
  should require PRs — outside this change).
- Does not retroactively fix already-stranded clients: users with a stale v20
  cache get the fresh shell on next navigation (network-first), so impact is
  bounded.
