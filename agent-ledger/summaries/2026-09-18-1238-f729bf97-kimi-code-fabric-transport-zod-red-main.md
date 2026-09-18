# 2026-09-18-1238 — RED-main investigation: fabric/transport.ts zod `Values<>` errors (session f729bf97, kimi-code)

**Outcome: NO code change required.** transport.ts is correct as written. The RED-main
was a poisoned build artifact plus a stale install in the shared checkout; the
recurrence prevention already landed in PRs #599/#600. This session reproduced the
exact 6 errors, established the mechanism, and repaired the shared checkout
environment. The tsc oracle is green on `origin/main` (15168c913) in both a clean
worktree and the shared checkout.

## The reported failure

`cd cmd/gizzi-code && bash script/ensure-sdk-dist.sh && npx tsc --noEmit` → 6 errors
at `src/runtime/fabric/transport.ts:51-56`:

```
error TS2339: Property 'read' does not exist on type
  'Values<{ read: "read"; write: "write"; execute: "execute"; compute: "compute"; observe: "observe"; stream: "stream"; }>'
```

(one per capability-kind member: read/write/execute/compute/observe/stream)

## Root cause (exact mechanism)

`platform/packages/os-contracts` depends on **zod v3** (`zod: ^3.25.0`,
`spine.ts` uses `z.enum([...])` → v3 `ZodEnum<["read", ...]>` tuple typing, whose
`.enum` is a literal map). `cmd/gizzi-code` depends on **zod v4** (`zod: 4.3.6`,
`transport.ts` imports `zod/v4` and mirrors the contract enum via
`z.enum([contractCapabilityKindSchema.enum.read, ...])` — v3 map values fed into a
v4 `z.enum`, which is sound).

The drift: PR #597 moved os-contracts to `platform/packages/os-contracts` but left
the committed pnpm-lock workspace link paths stale. In any checkout installed from
that lockfile, os-contracts got **no nested zod**, so its `tsc -p tsconfig.build.json`
resolved `zod` to the root-hoisted **4.3.6 (v4)**. Two failures followed:

1. spine.ts line 148 errors under v4 (`TS2554: Expected 2-3 arguments, but got 1`),
   but os-contracts' build config emits despite errors → dist shipped with
   `capabilityKindSchema: z.ZodEnum<{ read: "read"; ... }>` — a **v4 map-shaped type
   argument** in the .d.ts, while the d.ts `import { z } from "zod"`.
2. At gizzi-code check time, tsc resolves that `zod` import through os-contracts'
   (now repaired) nested zod **3.25.76**, where `Values<T extends EnumValues>` expects
   a tuple. `Values<{map}>` degrades to a plain union, so `.enum.read`…`.enum.stream`
   fail with exactly the 6 reported TS2339s.

`ensure-sdk-dist.sh` could not self-heal: its freshness check is
missing-or-older-than-src, and the poisoned dist was newer than src.

## What already fixed it in git

- PR #599 (`ao/global-dts-fix`) purged 54 shadowing ambient `declare module` blocks.
- PR #600 (`ao/react-dts-fix`, merge b119af992) synced `pnpm-lock.yaml` (716 lines)
  + `pnpm-workspace.yaml`, so os-contracts again installs its nested zod 3.25.76.
  Its ledger entry notes the ensure-sdk-dist rebuild cleared the 6 errors.

## What this session did (environment repair, no git changes)

1. Reproduced the exact 6 errors in the shared checkout (they never reproduced in a
   clean worktree — clean installs were green at both 1ecb56268 and 15168c913).
2. Repaired the shared checkout: `pnpm install --frozen-lockfile` (restored nested
   os-contracts zod 3.25.76), then deleted the three ensure-sdk-managed dists
   (`platform/packages/os-contracts/dist`, `packages/sdk/dist`,
   `sdk/computer-use/dist`) and rebuilt via `script/ensure-sdk-dist.sh` → dist now
   emits the correct `z.ZodEnum<["read", ...]>`.
3. Restored an incidental lockfile dirt (`pnpm install` ingesting the untracked
   `surfaces/allternit-desktop/resources/office-engine/` scratch dir) byte-identical
   from `origin/main` — shared checkout left clean.
4. Verified the full gate battery at `origin/main` (15168c913).

## Gates (at origin/main 15168c913)

- `ensure-sdk-dist.sh && npx tsc --noEmit` → **exit 0** (clean worktree AND shared
  checkout; the burn-down oracle)
- `bun run test` smoke → **1311 pass / 0 fail / 42 skip across 107 files**
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**
- `eslint src/runtime/fabric/transport.ts` → **0 errors** (7 pre-existing
  unused-import warnings, none new)
- `cargo check` not run: failure is purely TS-side, no Rust involvement
- `scripts/git-discipline-check.sh` → **PASS** (on main == origin/main, clean tree)
- `pnpm install --frozen-lockfile` → exit 0 (lockfile healthy post-#600)

## PR / merge

None — zero source diff. transport.ts + its import line untouched (verified they
are the correct v3-consumer/v4-validator bridge). Branch `ao/fabric-transport-zod-fix`
created per process, carried no commits, deleted at cleanup.

## Follow-ups (deferred, worth a decision)

- **Harden `ensure-sdk-dist.sh`**: its freshness check can't detect a dist built
  against the wrong zod (the exact poison that cost this investigation). Options:
  rebuild when the resolved `zod` version changes, or add `noEmitOnError` to
  os-contracts' `tsconfig.build.json` so a v4-typed build fails instead of emitting
  garbage d.ts. Out of this session's allowed edit scope (transport.ts only) — needs
  an owner decision.
- The untracked `surfaces/allternit-desktop/resources/office-engine/` dir (with its
  own package.json) gets picked up by the pnpm workspace glob on any `pnpm install`,
  dirtying the lockfile. Should be gitignored or excluded.

## Honest deferrals

- The exact pre-#600 6-error environment (stale lockfile + shadows) no longer exists
  anywhere, so the repro was demonstrated on its still-living remnant (the shared
  checkout's poisoned dist), which is byte-for-byte the reported error text.
