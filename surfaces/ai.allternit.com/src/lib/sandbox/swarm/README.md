# Swarm Sandbox Tier

High-volume, ephemeral execution contexts — create, run, and destroy many
sandboxes concurrently. Different problem from the single-request sandboxes
elsewhere in `@/lib/sandbox`: this tier is about the control plane not
becoming a bottleneck at high concurrency, with batch lifecycle calls instead
of one-at-a-time.

## Overview

```
Caller (N logical units) → SwarmScheduler (bounded concurrency + tracking) → SwarmProvider → E2B
```

- **`SwarmProvider`** — thin interface (`createBatch` / `runBatch` /
  `destroyBatch` / `status`). Two implementations: `E2BSwarmProvider` for
  units that need real sandbox isolation (untrusted code execution), and
  `LocalSwarmProvider` for units that don't (e.g. a persona-conditioned LLM
  call — see `@/lib/mirofish`).
- **`SwarmScheduler`** — sits in front of a provider. Caps how many
  create/destroy calls are in flight at once, chunks large requests into
  provider-sized batches, and tracks every unit it creates so nothing gets
  leaked even on partial failure.
- **`SwarmUnit`** — one ephemeral execution context. Its `metadata` field is
  an opaque, caller-defined bag; this module has no opinion on what goes in
  it (persona data, simulation state, or anything else is a product-layer
  concern, not this one).

This module is intentionally standalone — it does not import anything from
elsewhere in `@/lib/sandbox`, and it does not know about "personas" or
"simulation rounds" or any other product concept.

## Quick Start

```typescript
import { SwarmScheduler, E2BSwarmProvider } from "@/lib/sandbox/swarm";

const provider = new E2BSwarmProvider(); // reads E2B_API_KEY from env
const scheduler = new SwarmScheduler(provider, { concurrency: 10 });

// Create 500 units, 10 at a time against E2B.
const { units, failures } = await scheduler.createBatch(
  Array.from({ length: 500 }, () => ({ metadata: {} }))
);

console.log(`created ${units.length}, failed ${failures.length}`);

// ... do work against `units` via provider.runBatch or your own logic ...

// Destroy everything this scheduler is still tracking as alive.
await scheduler.destroyAll();
```

## `SwarmProvider` interface

```typescript
interface SwarmProvider {
  createBatch(specs: SwarmUnitSpec[]): Promise<SwarmBatchCreateResult>;
  runBatch<T>(units: SwarmUnit[], fn: SwarmUnitRunFn<T>): Promise<SwarmUnitRunResult<T>[]>;
  destroyBatch(unitIds: string[]): Promise<SwarmBatchDestroyResult>;
  status(unitId: string): Promise<SwarmUnit>;
}
```

`createBatch` and `destroyBatch` never throw for a single unit's failure —
they return a partial-success shape (`{ units, failures }` /
`{ destroyed, failures }`) so one bad spec doesn't sink the whole batch.

## `E2BSwarmProvider`

The [E2B SDK](https://e2b.dev) has no native bulk-create/bulk-kill endpoint —
`Sandbox.create()` and `Sandbox.kill()` each operate on one sandbox at a time.
`E2BSwarmProvider` implements "batch" by fanning those calls out concurrently
(a bounded worker pool, not a serial `for` loop and not an unbounded
`Promise.all`) so a batch of N units doesn't take N times as long as one.

```typescript
import { E2BSwarmProvider } from "@/lib/sandbox/swarm";

const provider = new E2BSwarmProvider({
  apiKey: process.env.E2B_API_KEY, // optional — this is the default source
  defaultTemplate: "base",          // optional per-spec override
  concurrency: 20,                  // optional internal safety cap if used without SwarmScheduler
});
```

**Configuration:**

```bash
# .env
E2B_API_KEY=e2b_...   # https://e2b.dev/dashboard
```

**Metadata:** E2B sandbox metadata is a flat `Record<string, string>`. A
`SwarmUnitSpec.metadata` bag (arbitrary JSON) is serialized into a single
field on create and parsed back out on `status()` — callers never need to
know this happens.

## `LocalSwarmProvider`

Same `SwarmProvider` interface as `E2BSwarmProvider`, but entirely in-process
— no external sandbox, no network call to create or destroy a unit. Use this
when a "unit" is doing work that doesn't need isolation, like a
persona-conditioned LLM call plus a memory read/write (this is what
`@/lib/mirofish`'s simulation engine uses):

```typescript
import { SwarmScheduler, LocalSwarmProvider } from "@/lib/sandbox/swarm";

const provider = new LocalSwarmProvider({ concurrency: 20 }); // internal safety cap, see below
const scheduler = new SwarmScheduler(provider, { concurrency: 10 });

const { units } = await scheduler.createBatch(specs); // synchronous bookkeeping, no I/O
const results = await provider.runBatch(units, async (unit) => {
  /* do the actual per-unit work, e.g. one LLM call */
});
await scheduler.destroyBatch(units.map((u) => u.id));
```

`createBatch` on `LocalSwarmProvider` never partially fails — there's no
external system for the bookkeeping to fail against — so `failures` is
always empty. `destroyBatch` can still report failures for unit IDs that
don't exist (already destroyed, or never created by this provider instance).

Both providers share one bounded-concurrency fan-out helper
(`mapWithConcurrency` in `concurrency.ts`) rather than duplicating the
worker-pool logic — `runBatch` on either provider, and `E2BSwarmProvider`'s
`createBatch`/`destroyBatch`, all go through it.

## `SwarmScheduler`

```typescript
const scheduler = new SwarmScheduler(provider, {
  concurrency: 10, // default: 10 — see "Choosing a concurrency cap" below
});
```

**Responsibilities:**

1. **Bounded concurrency** — a logical `createBatch(specs)` call is chunked
   into groups of at most `concurrency` specs; groups are sent to the
   provider one at a time, so at most `concurrency` units are ever being
   created or destroyed simultaneously against the provider (E2B's API, for
   `E2BSwarmProvider`).
2. **Batching** — each group is a single call to `provider.createBatch` /
   `provider.destroyBatch`, not N single calls.
3. **Cleanup guarantees** — every unit that's actually created is tracked
   (`scheduler.trackedUnitIds()`) the moment it comes back successful, even
   if other specs in the same `createBatch` call failed. A unit that fails
   to *destroy* stays tracked (it isn't dropped from bookkeeping just because
   one destroy attempt failed), so a retry or `destroyAll()` can still find
   and clean it up. Net effect: no sandbox this scheduler created is ever
   silently forgotten about.

```typescript
// Destroy specific units:
await scheduler.destroyBatch(["unit-1", "unit-2"]);

// Destroy everything still tracked as alive:
await scheduler.destroyAll();

// Inspect what's currently tracked:
scheduler.trackedCount;       // number
scheduler.trackedUnitIds();   // string[]
```

### Choosing a concurrency cap

E2B enforces per-account concurrent-sandbox and rate limits that vary by
plan. `SwarmScheduler`'s default of `10` is a conservative starting point
meant to work out of the box without hitting those limits; raise it once you
know your plan's actual ceiling. `E2BSwarmProvider` also carries its own
internal cap (default `20`) purely as a safety net if it's ever used directly
without a scheduler in front of it — in normal usage the scheduler's cap is
the one that matters, since it controls how many specs reach the provider in
each call.

## Testing

```bash
pnpm vitest run src/lib/sandbox/swarm/scheduler.test.ts
```

`scheduler.test.ts` exercises `SwarmScheduler` against a mock `SwarmProvider`
— no real E2B calls. It covers: batch create, batch destroy, partial-failure
cleanup (created units from a partially-failed batch are still trackable and
destroyable), and that the concurrency cap is actually respected.

## What this module is not

- Not a code-execution API — it doesn't run code and doesn't decide *what*
  runs inside a unit. `runBatch(units, fn)` just fans arbitrary async work
  out across units with the same bounded-concurrency discipline as create/
  destroy.
- Not aware of personas, simulation rounds, memory, or any other
  product-layer concept — those belong in whatever's built on top of this
  (see `docs/SWARM_MIROFISH_MAP.md`).
- Not a grab-bag of providers for their own sake. There are two
  implementations (`E2BSwarmProvider` for sandbox-isolated work,
  `LocalSwarmProvider` for in-process work) because both have a real,
  current caller — not a third, fourth, ... speculative backend added
  because the interface makes it easy to.
