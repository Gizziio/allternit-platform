# ts burn-down b0255 (batch 27 of the @ts-nocheck burn-down)

> **Session:** ao/ts-burn-next10 · **Agent:** kimi-code · **Date:** 2026-09-19 01:10
> **PR:** #661 merged `08d6e1083` (branch head `bfca6b8bc`)
> **Queue:** `cmd/gizzi-code/script/typecheck-burndown/queue.json` · Guard: `cmd/gizzi-code/test/ts-nocheck-guard.test.ts`

## What was done

Burned burn batch **b0255** (18 files, 7447 LOC, ink-app settings/hooks/plugins/model
slice). 17 files had their `// @ts-nocheck` header stripped; 1 file (`ide.ts`) was
restored byte-exact and escalated as a latent runtime bug (see below).

Converged in **6 tsc iterations** from 6 initial errors across 4 files:

1. `Passes.tsx` (TS2614 ×2): `ink-app/services/oauth/types` is a dead shim
   (`types_ts()` stub — same family as the quarantined dead shims but not itself
   quarantined). The real types live in the runtime twin
   `src/runtime/services/oauth/types.ts`. Rerouted the type import to
   `../../../../../runtime/services/oauth/types.js` — the same cross-tree pattern
   already used by `services/oauth/client.ts`, `services/oauth/index.ts`, and
   `services/oauth/getOauthProfile.ts` in the same directory. **Note for batch
   b0254**: `services/api/referral.ts` imports the same 4 types from the same shim
   and will need the identical reroute when burned.
2. `Passes.tsx` (TS2339/TS2352): usage-vs-type drift — the component treats
   `redemptionsData.redemptions` as an array and reads `.limit`, but
   `ReferralRedemptionsResponse` declares `redemptions: number` (count) with no
   `limit`. Which side is stale cannot be determined from this repo (single consumer;
   API is remote). Preserved runtime behavior exactly with local
   `as unknown as { redemptions?: unknown[] | null }` / `as { limit?: number }`
   casts and documented the drift in the queue note. Follow-up: verify the real
   `/referral/redemptions` response shape and reconcile type or usage.
3. `execHttpHook.ts` (TS2724): `HookEvent` is not exported from the ink-app
   `entrypoints/agentSdkTypes.ts` twin (only `HOOK_EVENTS`). Derived the type
   locally: `type HookEvent = (typeof HOOK_EVENTS)[number]`, mirroring the
   top-level `src/entrypoints/sdk/coreTypes.ts:208` definition. The ink-app
   `entrypoints/sdk/coreTypes.ts` twin could gain the same export in a later pass
   (it already exports `HOOK_EVENTS`).
4. `worktree.ts` (TS2339): `tsconfig` has `strict: false`, and truthiness narrowing
   on a boolean-literal discriminant does not narrow the union (verified with a
   minimal repro; `r.existed === false` and `switch` both narrow fine).
   `if (!result.existed)` → `if (result.existed === false)` — identical semantics.
5. `ide.ts` — **latent runtime bug, escalated**: `ideOnboardingDialog` is
   `async () => import('../components/IdeOnboardingDialog.js')`, but both call sites
   (lines 1326, 1337) call `ideOnboardingDialog().hasIdeOnboardingDialogBeenShown()`
   on the returned **Promise** without awaiting. At runtime this is `undefined()` →
   TypeError inside a `.then` callback (the onboarding gate is effectively broken).
   Fixing requires a behavior change (await the dynamic import before the check),
   outside type-only scope. Header restored byte-exact via `git show HEAD:`.

## Queue bookkeeping

- `b0255`: NEW → DONE, `burnedFiles: 17`, `burnedLoc: 5941` (wc -l of stripped
  files), `escalated: [ide.ts]` with full detail.
- stats: `totalNocheck` 1333 → 1316, `totalQueueFiles` 949 → 931,
  `totalQueueLoc` 357844 → 350397. `totalAccounted` untouched (1473).
- Guard identity: live scan 952 + recorded burns 521 = 1473 ✓ (guard test reconciles
  the physical scan, not the queue listing — recorded burns must count only actually
  stripped files; a header-retained escalation stays live in the scan).
- `ide.ts` accounted via `test/ts-nocheck-allowlist.txt` — the documented escape
  hatch for intentionally retained headers, with a dated justification comment.

## Verification evidence

- Baseline `pnpm run typecheck` (ensure-sdk-dist + tsc): **0 errors**; final: **0
  errors** (re-run after probe revert).
- **TS2322 probe**: appended `const __probe: string = 42` to each of the 17 stripped
  files → exactly **17 errors** (one per file) → reverted; `git diff | shasum`
  identical before/after (`d80e2615…`). (Note: the probe line text does not appear
  in tsc's error message — count TS2322 per file, not `__probe` greps.)
- `pnpm test`: **1329 pass / 42 skip / 0 fail** (111 smoke entries, ~42 s),
  ts-nocheck guard green on re-run after allowlist fix.
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- eslint (repo root config): zero new problems. `mcpbHandler.ts` `preserve-caught-
  error` (372:5) + unused-var warning verified **pre-existing at HEAD** via
  `git stash` baseline (373:5 with header). 17 pre-existing `ban-ts-comment` errors
  removed by the burn. `custom-rules/prefer-use-keybindings` "rule not found" on
  Passes.tsx is a pre-existing config artifact present at baseline.
- `bash script/check-ts-nocheck.sh`: count decreased 1335 → 1318 vs the older
  committed ratchet baseline (ratchet passes; baseline file intentionally left —
  same as prior burn PRs).
- `scripts/git-discipline-check.sh`: PASS (on main == origin/main `08d6e1083`,
  worktree clean, unmerged branches all live-worktree/allowlisted).

## Outstanding work

- **ide.ts latent bug** (b0255 escalated): await the lazy import before
  `hasIdeOnboardingDialogBeenShown()` at the two call sites, then strip the header
  and remove the allowlist entry.
- **Passes.tsx type drift**: verify the real referral-redemptions API shape;
  reconcile `ReferralRedemptionsResponse` (runtime twin) with the component's
  array/`limit` expectation.
- **b0254 follow-up**: `services/api/referral.ts` needs the same dead-shim import
  reroute when that batch burns.
- `ts-nocheck-baseline.txt` (ratchet file) is now 17 stale vs physical count —
  optionally regen with `bash script/check-ts-nocheck.sh --update` in a future
  bookkeeping pass.
