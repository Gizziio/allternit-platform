---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/concurrency.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/e2b-provider.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/local-provider.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/index.ts
  - surfaces/ai.allternit.com/src/lib/sandbox/swarm/README.md
  - surfaces/ai.allternit.com/src/lib/mirofish/types.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/memory-store.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/memory-store.test.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/persona-builder.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/simulation-engine.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/simulation-engine.test.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/index.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/README.md
  - surfaces/ai.allternit.com/docs/SWARM_MIROFISH_PHASE_2_NOTES.md
deviations:
  - "e2b-provider.ts's mapWithConcurrency was extracted into swarm/concurrency.ts exactly as
    design decision 1 directed, and E2BSwarmProvider now imports it — this is a Phase 1 file
    modified in Phase 2, not a new file, so it's called out explicitly here even though it's
    listed under files_changed."
  - "The swarm/ and mirofish/ READMEs were both touched: swarm/README.md got a new section for
    LocalSwarmProvider and a correction to its 'What this module is not' bullet (it previously
    said only E2BSwarmProvider was implemented, which Phase 2 makes no longer true). This wasn't
    explicitly listed as in-scope for Phase 2 but keeping Phase 1's own doc accurate given Phase 2
    changes its factual claims seemed clearly better than leaving it stale."
  - "persona-builder.ts and simulation-engine.ts's per-agent LLM call uses `generateText` + a
    regex-extracted JSON parse (with a plain-text fallback on parse failure), matching the
    existing pattern in src/plugins/built-in/swarms/plugin.ts's buildConsensus — not
    `generateObject`. Checked: `generateObject` is not used anywhere else in this codebase, so
    generateText+parse is the established idiom here, not a shortcut."
  - "Contrary to the Phase 1 NOTES' caveat that no test could be executed (no node_modules
    existed then), node_modules now exists in this checkout and `pnpm exec vitest` mostly works —
    except Vite's PostCSS config fails to load because `autoprefixer` (referenced by
    postcss.config.cjs, tailwindcss + autoprefixer) is not actually listed in package.json at
    all, so it's missing regardless of install state. This blocks every vitest run in this repo,
    not just this phase's tests, exactly as the Phase 2 task's own text anticipated. Did not fix
    it (out of scope, pre-existing, repo-wide). Worked around it for verification only, without
    touching any repo file: ran vitest against a throwaway config file (in the scratchpad
    directory, deleted afterward) identical to the repo's vitest.config.ts but with
    `css: { postcss: { plugins: [] } } ` added to skip the broken auto-discovery. Under that
    scratch config, all 20 tests across scheduler.test.ts (Phase 1, also unexecuted until now),
    memory-store.test.ts, and simulation-engine.test.ts pass. Also smoke-imported
    `@/lib/sandbox/swarm` (including `E2BSwarmProvider`) and `@/lib/mirofish`'s full public
    surface to confirm nothing fails to parse/resolve — also via the scratch config, also cleaned
    up after. The repo's actual `vitest.config.ts` was not modified."
remaining:
  - "Phase 3 (report generation, chat with a simulated agent, UI wiring) is untouched, as scoped."
  - "The repo-wide missing-`autoprefixer` issue (blocks `pnpm exec vitest` / likely `pnpm dev` /
    `pnpm build` via the shared PostCSS config) is still unresolved — flagging again since it
    blocks routine verification for any future phase touching this surface, not just this one."
  - "MemoryStore has no persistent implementation yet (design decision 3) — a future
    DrizzleMemoryStore needs its own reviewed phase covering the dual Postgres/SQLite schema
    convention and a real migration."
  - "Persona/turn quality has not been eyeballed against a real model — persona-builder.ts and
    simulation-engine.ts were only exercised against a mocked LLM boundary in tests, never a real
    getDefaultPluginModel() call, since no model provider credentials are configured in this
    environment."
---

## How `local-provider.ts` maps onto the `SwarmProvider` interface

`LocalSwarmProvider` (`src/lib/sandbox/swarm/local-provider.ts`) implements the same four-method
interface as `E2BSwarmProvider`, with every operation reduced to what it actually needs to be
for in-process work with no external system on the other end:

- **`createBatch(specs)`** — synchronous bookkeeping only: allocates a `SwarmUnit` (a fresh id,
  `status: "ready"`, the spec's metadata bag) and stores it in a local `Map`, for every spec, in
  order. There's no external call that can fail partway, so `failures` is always `[]` — Phase 1's
  `SwarmScheduler` still chunks and tracks these the same way it would for E2B, it just never
  sees a create failure to clean up after.
- **`runBatch(units, fn)`** — the one method that actually does concurrent work. Fans `fn` out
  over `units` through the same `mapWithConcurrency` helper `E2BSwarmProvider` uses (extracted
  into `concurrency.ts` in this phase so both providers share one bounded worker-pool
  implementation instead of two copies of it). This is where persona generation and per-round
  agent turns actually run.
- **`destroyBatch(unitIds)`** — deletes matching entries from the local `Map`. An id that isn't
  present (already destroyed, or never created by this provider instance) is reported as a
  failure, same shape as E2B's "sandbox not found" case, so callers don't need to special-case
  which provider they're talking to.
- **`status(unitId)`** — looks the unit up in the `Map`; throws if it isn't there (mirroring
  E2B's `getInfo` throwing for an unknown sandbox id).

Net effect: `SwarmScheduler`, and anything built on `SwarmProvider`, cannot tell from the
interface alone whether it's talking to E2B or to `LocalSwarmProvider` — exactly the point of
keeping the interface thin. `persona-builder.ts` and `simulation-engine.ts` both use
`new LocalSwarmProvider()` + `SwarmScheduler` for `createBatch`/`destroyBatch` bookkeeping, and
call `provider.runBatch(...)` directly for the actual fan-out (the scheduler itself doesn't wrap
`runBatch` — that responsibility stayed on the provider in Phase 1's design, since `runBatch`'s
own concurrency is already bounded by the provider's internal cap).

## A representative round prompt

One agent's turn prompt from `simulation-engine.ts`'s `buildTurnPrompt`, with placeholder content
(this is the literal template, not a mocked test fixture):

```
You are Dana Whitfield. A mid-career logistics manager at a regional freight company who commutes downtown five days a week.
Traits: {"risk_tolerance":"medium","political_lean":"moderate","primary_concern":"commute cost"}

Seed material (policy):
"""
The city council is proposing a $12 congestion charge for vehicles entering the downtown core on weekdays, with revenue earmarked for transit expansion.
"""

What happened last round: Round 1: 3 agents acted. persona-a: Expressed frustration about added commute costs but acknowledged... | persona-b: Supportive, citing reduced traffic near her clinic... | persona-c: Skeptical the transit expansion will materialize... (+0 more)

Your recent memory:
Round 1: I think this charge will hurt small logistics operators like us the most — we can't just switch to transit for freight runs.

It is round 2. In 2-4 sentences, describe what you think, say, or do this round, in character. Respond with plain text only, no JSON, no preamble.
```

The persona-generation prompt (`persona-builder.ts`'s `buildPersonaPrompt`) is separate and asks
for a single JSON object (`name`/`bio`/`traits`) instead — it runs once per persona before any
rounds start, not per round.

## How prompts stay bounded across rounds

Three things keep a turn's prompt from growing with the number of rounds already run:

1. **Only the immediately previous round's summary is included**, not the full
   `WorldState.roundSummaries` history — `buildTurnPrompt` reads
   `world.roundSummaries[world.roundSummaries.length - 1]` only, truncated to
   `config.maxSummaryChars` (default 1000 characters, configurable per `SimulationConfig`).
2. **Only recent memory, not the full per-agent history** — `MemoryStore.retrieve(personaId)`
   defaults to the 5 most-recent events for that agent (`InMemoryMemoryStore`'s
   `DEFAULT_RETRIEVAL_LIMIT`), regardless of how many rounds have run.
3. **Round summaries themselves are capped at generation time** — `summarizeRound` only includes
   the first 5 agents' turns (each individually truncated to 160 characters) plus a `(+N more)`
   count, so a round summary's own size doesn't scale with population size either.

The seed material text itself is included verbatim in every turn's prompt (not summarized) since
it's the one piece of context that must stay exact — that's the one part of the prompt whose size
is bounded by the caller's seed material choice, not by this engine.

## Test results

All 20 tests pass: 11 in `scheduler.test.ts` (Phase 1's tests — this was the first time they were
actually executed; Phase 1 had no working `node_modules` install to run them against), 6 in
`memory-store.test.ts`, and 3 in `simulation-engine.test.ts`. See the `deviations` entry above for
how the repo-wide missing-`autoprefixer` PostCSS failure was worked around for this verification
run without modifying any repo file.
