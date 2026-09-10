# Session attestation — session/deployfix-kimi

**Agent family:** kimi-code · **Date:** 2026-09-10 · **PR:** #259 → merge `8a0b98c2a` · **Workflow run:** 34521788900

## What was done

Owner reported "ai.allternit.com is not up to date with the Allternit desktop app."
Root cause: the `Deploy AI + Platform to Cloudflare Pages` workflow had failed on
**8 consecutive merges today** (#236–#253) at the verify-ai gate, so no push to main
reached the Pages deploy. All 8 failures were the same 3 stale unit tests in
`surfaces/ai.allternit.com` — tests that still asserted pre-change behavior after
intentional production changes merged earlier:

1. `src/lib/fabric-session-kind.test.ts` — `fabricKindSurface('bot')` returns
   `'bot'` since the first-class Bot home mode (`762eeb5e1`), not `'cowork'`.
2. `src/lib/bots/vm-operator.test.ts` — `snapshotSandbox` routes through the
   computers API (`POST /api/v1/computers/{id}/snapshots`) since orgo parity
   (`f2bb03c3b`), not `/bots/{agent}/desktop/snapshots`; test titles renamed.
3. `src/remote-control/api/recordings.test.ts` — `getRecordingDetail` probes for
   video when `video_url` is absent (`3abe282be`); the test payload now includes
   `video_url` so the single-fetch assertion still covers media URLs from payload.

Test-only change; zero production code touched. No desktop-release-path files
touched → release-preflight not required (AGENTS.md rule 2 scope).

## How it works

Nothing architectural — the verify-ai job (`pnpm typecheck` + `pnpm test` in the
surface) gates the `deploy-ai` Pages upload. With the 3 tests green, a merge to
main rebuilds `dist/` from latest main and wrangler-uploads it to project
`ai-allternit`.

## Verification evidence

- Local reproduction in session worktree `allternit-session-deployfix` (from
  `origin/main` `7b2506d9b`): same 3 failures, same assertion lines as CI.
- After fix: 3 target files 35/35; full surface `pnpm typecheck` clean,
  `pnpm test` 188 files passed / 1 skipped, 1518 tests passed / 14 skipped.
- Post-merge workflow run 34521788900: verify-ai ✓ 5m52s, Deploy ai.allternit.com ✓
  3m9s, Deploy platform.allternit.com ✓ 1m59s. Live site serves the fresh build
  (index.html references new hashed assets, fetched 19:52Z).

## Incidents / honest deferrals

- **Post-deploy Clerk smoke job is red and pre-existing:** it fails with
  `CLERK_TEST_PASSWORD is required` — `CLERK_TEST_EMAIL` / `CLERK_TEST_PASSWORD` /
  secondary-account secrets are empty in repo settings. Every run today died at
  verify-ai before reaching it, so there is no recent green baseline. It does NOT
  block the deploy (deploy job completed first). Needs a human to either populate
  the Clerk test-account secrets in GitHub repo settings or mark the job
  `continue-on-error`. Left as-is — secrets are a human decision per review gates.
- The shared main checkout had pre-existing uncommitted edits to
  `platform-auth-client.tsx` / `vite.config.ts` (another session's in-flight work);
  left untouched per worktree-ownership rules. `git pull --ff-only` merged cleanly
  around them.
- AGENTS.md step 8 (desktop binary rebuild) not applicable: session touched only
  web-surface unit tests, nothing the desktop bundles.
