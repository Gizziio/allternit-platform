# TS burn-down b0366 (ao/ts-burn-next17)

- **Date:** 2026-09-19 02:11
- **Agent:** kimi-code (burn-down batch agent)
- **PR:** #673, merge commit `f1e11d6f7`
- **Batch:** b0366 — 32/32 files burned, 7,035 LOC, 0 escalations, allowlist untouched

## What was done

Took the fourth non-DONE batch (sibling protocol: first three non-DONE go to
siblings). Stripped `// @ts-nocheck` from all 32 files and fixed every type
error they hid. Worktree `allternit-ao-tsburn-next17`, branch
`ao/ts-burn-next17`, rebased onto `a1ff4584d` immediately before push.

Convergence histogram (tsc error counts after strip): **28 → 4 → 1 → 0**
(4 iterations; stop rule ~8). Not a header-only burn, so no TS2322 probe.

## Error patterns fixed (all type-only, no runtime behavior change except one noted bug fix)

1. `@allternit/gizzi-util` ships **no type declarations** — `NamedError` is
   `any`, so `isInstance()` cannot narrow. `shared/error/format.ts` (7 errors)
   fixed by casting `input` to the shape each branch reads, per the existing
   pattern in `src/runtime/providers/adapters/auth.ts`. A repo-wide fix
   (adding a `.d.ts` for gizzi-util) is a larger job — deferred; every file
   using `isInstance` against `unknown` will hit this.
2. Plugin SDK `AuthHook.loader` declared narrower than runtime (2-arg loader
   returning `apiKey`/`authType`) — local `RuntimeAuthLoader` type in
   `provider.ts`, same documented mismatch as `integrations/plugin/codex.ts`.
3. `mergeDeep` results inferred `never` values in `pickBy` callbacks —
   annotated `Record<string, Record<string, any>>` at two sites.
4. **Latent bug fixed:** `server.listen()` silently dropped `onListen`, so
   `worker.ts`'s `server` rpc handler awaited a promise that never resolved —
   guaranteed hang when the TUI starts with `--port`/`--hostname`/`--mdns`.
   `listen()` now accepts and forwards `onListen` (one-line behavior fix,
   flagged in the PR).
5. `skill-generator` stub: `GeneratedSkill` lacks `scripts`/`references`;
   `generateInterviewQuestions` takes the description — widened locally in
   `skills.ts`.
6. `cost-tracker.ts`: stub entrypoint never exported `ModelUsage` (old import
   was an error type) — local camelCase interface defined; it is unrelated to
   the canonical SDK `ModelUsage` (snake_case).
7. `errors.ts` twins (runtime + ink-app): `categorizeRetryableAPIError`
   declared `SDKAssistantMessageError` but returns category strings — return
   type corrected to `string`, unused imports dropped. (The ink-app twin's
   broken import had been masking the error type.)

## Queue state (guard identity)

Seeded from origin/main's queue.json at rebase time; absorbed sibling merges
(b0337, b0101, codemod regen — batchCount 103, recorded 640). Removed my 32
files from b0366, marked it DONE (burnedFiles 32, burnedLoc 7035). Stats
re-derived from the live tree via `build-queue.mjs` scan: totalNocheck
1094→1062, totalQueueFiles 800→768, totalQueueLoc 315413→308378.
`totalAccounted` untouched (1460; identity exact 788 + 672). Quarantine,
other batches, `src/types/*.d.ts`, pnpm-lock untouched.

## Verification

- `tsc --noEmit`: 0 errors (final run on rebased tree)
- `script/ci-smoke-test.sh`: SMOKE PASS, 1374 tests, 0 fail (guard 5/5 —
  first run failed the guard pre-queue-update, as expected by design)
- eslint on all 32 changed files: clean
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed
- git-discipline PASS (sibling `ao/ts-burn-tail2` passed as intentional —
  live worktree, unmerged burn commit in flight)

## Incidents / notes

- `Bun.Server` requires an explicit type argument in bun-types 1.3.14
  (`Bun.Server<unknown>`); bun-types declares no `onListen` on serve options,
  so the forward is done via conditional spread (no excess-property error).
- Deferred: typed `gizzi-util` declarations (would eliminate the whole
  isInstance-cast pattern class repo-wide).
