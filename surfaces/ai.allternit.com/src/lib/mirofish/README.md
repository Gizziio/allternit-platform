# MiroFish Simulation Engine

The product layer on top of `@/lib/sandbox/swarm` (Phase 1's infra): given
real-world seed material, populate a simulated world with LLM-driven
personas, run a multi-round simulation where each round's outcome feeds the
next, and hand back the final world state. Reference:
[MiroFish](https://github.com/666ghj/MiroFish) — see
`docs/SWARM_MIROFISH_MAP.md` for the full product context.

This is Phase 2: the simulation engine itself. Report generation, chat with
a simulated agent afterward, and UI wiring are Phase 3 — not here.

## Overview

```
SeedMaterial + SimulationConfig
  → persona-builder.ts   (LLM call per persona, fanned out via SwarmScheduler + LocalSwarmProvider)
  → simulation-engine.ts (N rounds; one LLM turn per persona per round, same fan-out pattern)
      ├─ MemoryStore      (per-agent event log, read at the start of each turn, written at the end)
      └─ WorldState        (round summaries — the one piece of "social" signal every agent sees)
```

- **`Persona`** — a name, a short bio, and a `traits` bag. Deliberately
  simple for Phase 2.
- **`MemoryStore`** — interface + `InMemoryMemoryStore`, the only
  implementation this phase ships. No Zep, no external SaaS dependency, no
  vector search — most-recent-N (optionally keyword-filtered) is enough
  for now. See "Design decisions" below.
- **`WorldState`** — the running state of one simulation: seed, personas,
  current round, and a log of round summaries.
- Agent-to-agent interaction in Phase 2 means: every agent's next turn sees
  the previous round's shared summary. There's no pairwise agent-to-agent
  messaging — that's not scoped yet.

## Quick Start

```typescript
import { runSimulation } from "@/lib/mirofish";

const world = await runSimulation(
  { kind: "news", text: "A city council proposes a congestion charge downtown." },
  { populationSize: 50, rounds: 3 }
);

console.log(world.personas.length);       // 50
console.log(world.roundSummaries.length); // 3
console.log(world.roundSummaries[2].summary);
```

To use your own memory store (e.g. a future `DrizzleMemoryStore`) or tune
concurrency:

```typescript
import { runSimulation, InMemoryMemoryStore } from "@/lib/mirofish";

const world = await runSimulation(seed, config, {
  memoryStore: new InMemoryMemoryStore(), // default if omitted
  concurrency: 15,                        // per-round / persona-build fan-out cap
});
```

## `persona-builder.ts`

`buildPersonas(seed, populationSize, options?)` makes one LLM call per
persona — never templated placeholders — so personas are genuinely derived
from the seed content. Calls are fanned out through `SwarmScheduler` +
`LocalSwarmProvider` (see `@/lib/sandbox/swarm`), the same bounded-fan-out
infra Phase 1 built, so a population of hundreds doesn't run one call at a
time. Uses `getDefaultPluginModel()` from `@/lib/ai/providers` — **never** a
hardcoded model id string (see that function's doc comment for why that's a
hard rule in this repo).

## `simulation-engine.ts`

`runSimulation(seed, config, options?)`:

1. `buildInitialWorldState` builds the population via `persona-builder.ts`.
2. For each configured round: one LLM turn per persona, fanned out the same
   way. Each turn's prompt includes the persona, its recent memory (via
   `MemoryStore.retrieve`), and the *previous* round's summary — not the
   full simulation history, so prompts stay bounded as rounds accumulate
   (see `docs/SWARM_MIROFISH_PHASE_2_NOTES.md` for a worked example prompt).
   Each turn's output is written back to `MemoryStore` and folded into that
   round's summary.
3. Returns the final `WorldState` after all rounds.

`buildInitialWorldState` is also exported on its own, in case a caller wants
the initial population without running any rounds yet.

## Design decisions (carried over from the Phase 2 task spec)

- **No E2B sandboxes for agent turns.** A persona's turn is a
  persona-conditioned LLM call plus a memory read/write — no arbitrary code
  execution, so there's nothing for a Firecracker microVM to isolate.
  `LocalSwarmProvider` (in `@/lib/sandbox/swarm/`, not duplicated here) runs
  the same `SwarmProvider` interface entirely in-process. `E2BSwarmProvider`
  stays available, unused by this phase — it's the right tool once a later
  phase adds agents that execute tools/code as part of a simulated action.
- **No Zep, no new external SaaS dependency for memory.** `InMemoryMemoryStore`
  is a `Map` scoped to one simulation run's lifetime. `MemoryStore` stays an
  interface so a persistent implementation can be added later without
  touching `simulation-engine.ts`'s call sites.
- **No database schema/migration work.** Nothing here touches
  `src/lib/db/` or runs `drizzle-kit` — wiring persistent memory into the
  repo's dual Postgres/SQLite schema convention is its own reviewed phase.

## Testing

```bash
pnpm vitest run src/lib/mirofish/memory-store.test.ts
pnpm vitest run src/lib/mirofish/simulation-engine.test.ts
```

Both mock the LLM call boundary (`ai`'s `generateText` and
`@/lib/ai/providers`'s `getDefaultPluginModel`) — no real model calls in
tests. `memory-store.test.ts` covers append/retrieve, per-agent isolation,
the most-recent-N limit, and keyword filtering. `simulation-engine.test.ts`
covers: the configured number of rounds actually run, every persona gets a
turn each round, memory is written per turn, and the previous round's
summary is visible in the next round's prompts.

## What this module is not

- Not report generation or chat-with-an-agent — that's Phase 3.
- Not aware of E2B or any sandbox-isolation concern — it consumes
  `SwarmProvider` through `LocalSwarmProvider` without knowing (or needing
  to know) that `E2BSwarmProvider` exists.
- Not persistent. `InMemoryMemoryStore` and `WorldState` both live only for
  the duration of one `runSimulation` call in the current process.
