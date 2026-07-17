# Phase 2 Task: MiroFish Simulation Engine

Read `SWARM_MIROFISH_MAP.md` and `SWARM_MIROFISH_PHASE_1_NOTES.md` first (same directory) — Phase
1 (the swarm sandbox tier at `src/lib/sandbox/swarm/`) is reviewed and complete; this phase builds
the actual MiroFish product layer on top of it. Do **not** start Phase 3 (report generation, chat
with simulated agents, UI wiring) in this pass.

## Design decisions made for you (do not re-derive or second-guess these — they were deliberated
## by the reviewer before this task was written)

**1. Simulated agents do not need E2B sandboxes.** `E2BSwarmProvider` (Phase 1) exists to isolate
*untrusted code execution*. A MiroFish agent's "turn" is a persona-conditioned LLM call plus a
memory read/write — no arbitrary code execution, so spinning up a Firecracker microVM per agent
per round would add ~150-500ms of pure waste per call for zero isolation benefit. Instead:

- Add `src/lib/sandbox/swarm/local-provider.ts` — `LocalSwarmProvider implements SwarmProvider`
  (same interface from Phase 1). It runs work in-process with the same bounded-concurrency
  discipline as `E2BSwarmProvider`, just without spinning up any external sandbox — a "unit" is
  just a lightweight in-memory record with a `metadata` bag, `createBatch`/`destroyBatch` are
  synchronous bookkeeping, and `runBatch` fans `fn` out with the same worker-pool pattern.
  `e2b-provider.ts` already has a `mapWithConcurrency` helper doing bounded fan-out — extract it
  into a shared `src/lib/sandbox/swarm/concurrency.ts` and have both providers import it, rather
  than duplicating it.
- The MiroFish simulation engine (below) uses `SwarmScheduler` + `LocalSwarmProvider` for
  per-agent-per-round LLM turns. `E2BSwarmProvider` stays available and unused by this phase — it's
  the right tool if a later phase adds agents that can execute tools/code as part of their
  simulated actions (see `docs/SWARM_ADJACENT_FEATURES.md`), but forcing it into pure-LLM turns
  now would be over-engineering for a capability nothing needs yet.

**2. No Zep, no new external SaaS dependency for memory.** The MiroFish reference project uses Zep
for agent memory. This phase does not add it — introducing a new billed external service is a
product/cost decision for Eoj to make explicitly, not something to pull in mid-implementation.
Instead: build a `MemoryStore` interface (append an event, retrieve recent/relevant events for a
given agent) with an `InMemoryMemoryStore` as the only implementation for this phase — a `Map`-
backed store scoped to one simulation run's lifetime is enough for Phase 2. Retrieval can be
simple (most-recent-N, optionally filtered by a naive keyword match against event text) — do not
build embedding/vector search in this phase, that's a real feature not a Phase 2 scope item.

**3. No database schema/migration work in this phase.** This repo has a dual-schema convention
(`src/lib/db/schema.ts` for Postgres/hosted, `src/lib/db/schema-sqlite.ts` for SQLite/self-hosted,
selected via `ALLTERNIT_SELF_HOSTED`) with `drizzle-kit generate`/`migrate` as the real migration
flow. Wiring persistent memory into that pair, correctly, for both backends, with a real migration,
deserves its own reviewed phase — not something to improvise as a side effect of this task. Keep
`MemoryStore` as an interface specifically so a future `DrizzleMemoryStore` can implement it later
without touching the simulation engine's call sites. Do not create any new file under
`src/lib/db/` or run any `drizzle-kit` command in this phase.

## Scope

Create `surfaces/ai.allternit.com/src/lib/mirofish/`:

- `types.ts` — Core types:
  - `SeedMaterial`: the real-world input (raw text + a `kind` discriminator, e.g.
    `"news" | "policy" | "financial" | "narrative" | "other"`).
  - `Persona`: id, name, a free-text description/backstory, and a small set of behavioral traits
    (keep this simple — a name, a short bio string, and a `Record<string, string>` traits bag is
    enough; don't over-model this).
  - `WorldState`: the running state of one simulation (id, seed material, personas, current round
    number, a log of round summaries).
  - `SimulationConfig`: population size, number of rounds, and anything else genuinely needed to
    run one simulation (keep minimal).
  - `AgentMemoryEvent`: what `MemoryStore` stores per agent per round (round number, content,
    timestamp).
- `local-provider.ts` is in `src/lib/sandbox/swarm/`, not here (see design decision 1 above) —
  don't duplicate it under `mirofish/`.
- `memory-store.ts` — `MemoryStore` interface + `InMemoryMemoryStore` (design decision 2 above).
- `persona-builder.ts` — Given a `SeedMaterial` and a population size, produce N `Persona`
  records. Use an LLM call for this (personas should be genuinely derived from the seed content,
  not templated placeholders) — call `getDefaultPluginModel()` from `@/lib/ai/providers`
  (its own doc comment names "swarms" as an anticipated caller — this is exactly that) or
  `getLanguageModel(modelId)` if a specific model is genuinely warranted. **Never hardcode a model
  id string anywhere** — this is a hard repo-wide rule (see how `getDefaultPluginModel` itself
  documents the fallout of the old hardcoded-model-id bug). Batch persona generation through
  `SwarmScheduler` + `LocalSwarmProvider` so generating hundreds of personas doesn't run serially.
- `simulation-engine.ts` — Orchestrates the multi-round loop:
  1. Build the initial `WorldState` from a `SeedMaterial` + `SimulationConfig` (via
     `persona-builder.ts`).
  2. For each round: fan out one LLM turn per agent (via `SwarmScheduler` +
     `LocalSwarmProvider.runBatch`) — each turn's prompt includes the agent's persona, its recent
     memory (via `MemoryStore`), and a compact summary of the previous round (not the full
     history — keep prompts bounded). Write each agent's turn output back to `MemoryStore` and
     append a round summary to `WorldState`.
  3. Return the final `WorldState` after all configured rounds.
  Agent-to-agent interaction for this phase means: each round's summary (what happened, who did
  what) is visible to every agent's next turn — you do not need pairwise agent-to-agent messaging
  infrastructure for Phase 2, a shared round summary is sufficient "social" signal. Don't build
  more than that; it's not scoped yet.
- `index.ts` — public exports.
- `README.md` — usage docs, same depth/style as `src/lib/sandbox/swarm/README.md` (your own
  Phase 1 output, if you're the same session — otherwise use it as the template).
- Tests (vitest, `*.test.ts` alongside the files they test, following `scheduler.test.ts`'s style
  from Phase 1): mock the LLM call boundary (do not call a real model in tests) and cover at least
  `InMemoryMemoryStore` (append/retrieve) and `simulation-engine.ts`'s round loop (correct number
  of rounds, every persona gets a turn per round, memory is written per turn).

Log with `createModuleLogger('MiroFish')` per `@/lib/logger`. Use the `@/*` path alias.

## Constraints

- No builds, no typecheck, no dev server. You may run `pnpm exec vitest run <path>` for the tests
  you write in this phase if the environment supports it; if it doesn't (e.g. the same
  broken-install issue noted in Phase 1's NOTES — missing `autoprefixer` breaking Vite's PostCSS
  config repo-wide), don't fight it — say so in NOTES like Phase 1 did.
- No git operations.
- Do not touch anything under `src/lib/db/`, do not run `drizzle-kit` anything (design decision 3).
- Do not touch `src/lib/agents/agent-workspace.service.ts`, `src/lib/agents/files-api.ts`,
  `src/lib/agents/useAgentBootstrap.ts`, `cmd/allternit-mux/`, anything under `rails/`, or
  `cmd/allternit-api/` — unrelated in-progress work lives there.
- Do not add Zep or any other new external SaaS dependency.
- Do not start Phase 3.

## Deliverable sentinel

When finished, write `surfaces/ai.allternit.com/docs/SWARM_MIROFISH_PHASE_2_NOTES.md` starting
with YAML frontmatter (`status: done|blocked`, `files_changed: [...]`, `deviations: [...]`,
`remaining: [...]`), followed by prose notes: how `local-provider.ts` maps onto the `SwarmProvider`
interface, what a single round's prompt looks like (paste a representative example), and how you
kept prompts bounded across rounds. That file existing = this phase is done.
