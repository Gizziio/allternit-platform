---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/types.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/e2b-provider.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/scheduler.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/index.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/README.md
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/scheduler.test.ts
  - surfaces/ai.allternit.com/package.json
  - pnpm-lock.yaml
  - surfaces/ai.allternit.com/.env.example
  - surfaces/ai.allternit.com/docs/SWARM_ADJACENT_FEATURES.md
  - surfaces/ai.allternit.com/docs/SWARM_MIROFISH_PHASE_1_NOTES.md
deviations:
  - "pnpm-lock.yaml was updated by running `pnpm install --lockfile-only --filter @allternit/ai`
    (repo-root-level, since the workspace shares one lockfile) rather than hand-editing it. This
    is the repo's normal flow for a lockfile update per the task's own instruction, it does not
    write node_modules or run install/postinstall scripts, and I diffed the result: the only
    non-additive changes are a few peer-dependency-qualified resolution keys shifting
    (@blocknote/mantine, @blocknote/react, @tiptap/react, one @types/node patch bump) as a normal
    side effect of pnpm recomputing the graph with e2b's peer deps added — no unrelated package's
    actual dependency version changed."
  - "SwarmScheduler's 'batching many logical create-N-units calls into the underlying provider's
    batch API' responsibility is implemented as within-call chunking (a single createBatch/
    destroyBatch call is split into provider-sized groups of at most `concurrency`, sent one
    group at a time) rather than time-window coalescing of separate, independently-issued calls
    (e.g. a DataLoader-style debounce across calls arriving close together). The simpler
    within-call form is what's tested and documented; cross-call coalescing was judged
    speculative for Phase 1 and isn't implemented."
  - "Did not run `pnpm test` / vitest to execute scheduler.test.ts — no node_modules exist
    anywhere in this repo checkout (confirmed before touching anything), and the task's own
    constraints prohibit install runs beyond the lockfile update needed for the new dependency.
    The test file was written and manually re-checked against the implementation's types and
    control flow instead; it has not been executed."
remaining:
  - "Phase 2 (MiroFish simulation engine — seed ingestion, persona/memory agent population,
    multi-round simulation loop) is untouched, as scoped."
  - "Phase 3 (report generation, deep interaction/chat, UI wiring) is untouched, as scoped."
  - "scheduler.test.ts has not actually been run (see deviations) — first thing to do once
    dependencies are installed is `pnpm vitest run src/lib/sandbox/swarm/scheduler.test.ts` to
    confirm it's green before relying on it."
  - "No live E2B account/API key was used or available in this environment, so E2BSwarmProvider
    has not been exercised against the real E2B API — only checked against the SDK's shipped
    TypeScript type definitions (installed via `npm pack e2b@2.34.0` into a scratch dir) to
    confirm the call shapes (Sandbox.create/kill/getInfo, SandboxOpts, SandboxInfo) are correct."
---

## E2B SDK package/version

`e2b@2.34.0` (npm, Apache-2.0, `https://github.com/e2b-dev/e2b`). Verified by checking
`npm view e2b version` / `dist-tags` against the live registry, not from memory. The SDK exposes
only single-sandbox operations — `Sandbox.create(template?, opts)`, `Sandbox.kill(sandboxId, opts)`,
`Sandbox.getInfo(sandboxId, opts)` — there is no native bulk-create or bulk-kill endpoint. This
was confirmed by extracting the package's shipped `.d.ts` (via `npm pack`) and grepping its
exported class surface rather than assuming an API shape existed. `E2BSwarmProvider`'s "batch"
methods are therefore a bounded-concurrency fan-out over these single calls (a small internal
worker-pool helper, not `Promise.all` over an unbounded array and not a serial loop), which is
exactly what the task spec asked for once the SDK's real shape was known.

## Partial-batch-failure cleanup (scheduler)

`SwarmScheduler` keeps its own `Map<unitId, SwarmUnit>` of everything it has created and not yet
destroyed:

- `createBatch(specs)` chunks the request into groups of at most `concurrency` and calls
  `provider.createBatch(group)` once per group, sequentially across groups. Every unit that comes
  back as created — even if other specs in the *same* group, or a *later* group, failed — is
  registered in the tracked map immediately. A group whose `provider.createBatch` call throws
  outright (rather than returning a partial-success result) is treated as a full failure for that
  group only; earlier and later groups are unaffected.
- `destroyBatch(unitIds)` / `destroyAll()` chunk the same way. A unit is only removed from the
  tracked map once its destroy call actually succeeds; a unit whose destroy fails stays tracked so
  a caller can retry (or call `destroyAll()` again later) without having to remember it separately.

Net effect: a partially-failed create batch never leaves a "successfully created but nobody knows
about it" sandbox, and a partially-failed destroy batch never leaves a "we tried to destroy it but
forgot it might still be alive" sandbox. `scheduler.test.ts` has explicit cases for both
directions (create-side partial failure, destroy-side partial failure with retry).

## Concurrency cap default

`SwarmScheduler`'s default is **10** (`DEFAULT_CONCURRENCY` in `scheduler.ts`). E2B's own
concurrent-sandbox and rate limits vary by account plan and aren't published as a single universal
number, so 10 was chosen as a conservative value that should work out of the box on a low-tier plan
without extra configuration, while still giving real fan-out over a serial loop. It's a constructor
option (`new SwarmScheduler(provider, { concurrency })`) so it can be raised once the caller knows
their actual plan's ceiling. `E2BSwarmProvider` separately carries its own internal cap (default
20) purely as a safety net for direct use without a scheduler in front — in normal usage the
scheduler's cap is the one that actually governs how many specs reach the provider per call.
