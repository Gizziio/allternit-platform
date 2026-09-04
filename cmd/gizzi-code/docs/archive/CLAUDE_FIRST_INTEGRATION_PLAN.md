# Claude-First Integration Plan

## Core Decision

This is not a feature-picking exercise.

The goal is to integrate the entire `claude-code` codebase into `gizzi-code`.

That means:

- every Claude file is in scope
- Claude behavior is the target behavior
- Gizzi is the host repo and integration target
- Gizzi code is used to fill Claude's missing private or incomplete areas only where necessary

`free-code` remains a reconstruction reference, not the target architecture.

## What This Means In Practice

There are two different precedence rules, and they should not be confused.

### Product Precedence

Claude wins.

If a Claude file exists and is production-quality, it should be brought over and remain the source of truth for that concern.

This applies to:

- commands
- components
- ink UI
- app shell
- tools
- services
- hooks
- workflows
- task orchestration
- state shape
- command UX
- session UX
- remote UX

### Primitive Infrastructure Precedence

Runtime-first wins.

Primitive infra should be chosen by stability, not by brand lineage.

For infra-level responsibilities, the winner should be whichever implementation gives a complete, testable, production substrate with the least ambiguity.

This usually means:

- persistence
- IPC
- websocket/SSE transport
- relay/control plane
- server hosting
- MCP substrate
- verification substrate
- workspace/project persistence
- OS/process adapters

So the correct answer is:

- product behavior should be Claude-first
- primitive infra should be runtime-first

Those two rules are compatible.

## Why The Previous Framing Was Off

The prior plan leaned too much toward "Claude as interaction layer on top of Gizzi runtime."

That is too weak for your actual requirement.

Your actual requirement is:

- Claude is the primary codebase to preserve
- Gizzi is the host environment and salvage source
- integration should minimize Claude behavioral drift, not maximize reuse of Gizzi abstractions

So the plan should not start by asking "what Gizzi features do we keep?"

It should start by asking:

1. how do we land all Claude files intact inside `gizzi-code`
2. how do we reconstruct Claude's missing private 20%
3. how do we force Gizzi infrastructure to serve Claude semantics where possible
4. only after that, what Gizzi-native code is still needed

## Correct Integration Model

The right model is:

- `gizzi-code` is the repository shell
- Claude is the canonical product subtree
- Gizzi is the compatibility and infrastructure donor
- `free-code` and public OSS are reconstruction references for missing Claude gaps

This should be treated like a host-and-canonical merge, not a peer merge.

## Recommended Architecture

### 1. Canonical Claude Subtree

Import the entire Claude codebase intact under a canonical namespace first.

Recommended location:

- `src/claude/*`

Do not scatter Claude files across Gizzi immediately.

Reason:

- preserves donor topology
- preserves import relationships
- makes drift measurable
- allows full-file ingestion without premature refactors

This subtree should contain all Claude files, not a curated subset.

### 2. Reconstruction Layer

Create a separate layer for missing Claude files and missing private functionality.

Recommended location:

- `src/claude-reconstructed/*`

Use this only for:

- files genuinely missing from `claude-code`
- production replacements for missing private internals
- compatibility modules needed to complete the Claude tree

Sources allowed:

- real implementations from `free-code`
- real production code from `gizzi-code`
- real OSS packages and public protocols

No placeholders and no fake adapters.

### 3. Infra Bridge Layer

Create a strict anti-corruption layer between Claude product semantics and Gizzi infrastructure.

Recommended location:

- `src/claude-bridge/*`

This layer should translate:

- Claude session model to underlying storage/runtime model
- Claude tool contracts to actual execution backends
- Claude remote-control expectations to available transport/relay backends
- Claude config/auth/settings expectations to host implementations
- Claude MCP expectations to host registry/runtime

This is where Gizzi helps, but this layer should serve Claude semantics, not rewrite Claude into Gizzi semantics.

### 4. Host Surface

The top-level `gizzi-code` entrypoints should eventually boot the Claude app, not the old Gizzi app, once parity is reached.

That means the end state is not:

- Gizzi app with some Claude features

It is:

- Claude app running inside the `gizzi-code` repository, backed by reconstructed and bridged production infra

## Migration Rule

Every Claude file must be integrated.

That does not mean every Claude file must immediately replace an existing Gizzi file in place.

It means:

- every Claude file must be imported into the destination repo
- every Claude file must be assigned one of four statuses

Allowed statuses:

1. `canonical`
2. `canonical-with-reconstructed-dependency`
3. `canonical-with-bridge`
4. `blocked-by-missing-private-basis`

This is the right control system for the migration.

Without that, you get the same drift again.

## File Ownership Rules

### Canonical Claude

If the Claude file exists and works with reconstructed dependencies, it stays canonical.

Do not rewrite it to match Gizzi structure unless there is a hard technical reason.

### Gizzi Infra

If the Claude dependency is missing and the closest stable production equivalent already exists in Gizzi, use Gizzi as the backend implementation behind a bridge.

Do not replace Claude product-facing code with Gizzi UI/session/tool semantics just because Gizzi already has something nearby.

### Reconstructed Claude

If a missing Claude file can be rebuilt faithfully from:

- `free-code`
- public OSS
- public documentation
- adjacent intact Claude files

then reconstruct it as a Claude-owned file, not a Gizzi-owned substitute.

## Correct Precedence Hierarchy

The full precedence order should be:

1. intact `claude-code`
2. reconstructed Claude-compatible production code
3. Gizzi infrastructure behind bridge layers
4. `free-code` only as a reconstruction source

Not:

1. Gizzi runtime
2. Claude interaction

That earlier framing is too lossy for your goal.

## Primitive Infra Answer

You asked whether runtime-first or interaction-first is best for primitive infra.

For primitive infra, runtime-first is correct.

Reason:

- primitive infra needs strong lifecycle guarantees
- it needs deterministic persistence and process boundaries
- it needs reliable server, transport, storage, and execution semantics
- UI maturity does not automatically imply substrate maturity

But that does not mean Gizzi runtime should dominate product architecture.

The right split is:

- primitive infra: runtime-first
- product semantics: Claude-first

That is the stable answer.

## Revised Execution Plan

### Phase 1: Full Claude Import

Bring every file from `claude-code` into `gizzi-code`.

No selection.
No early pruning.
No consolidation yet.

Target:

- `src/claude/*`

Also bring in Claude top-level build/config files under a controlled namespace or integration area as needed.

Deliverable:

- a complete donor import manifest showing that every file has landed

### Phase 2: Dependency Classification

Classify every imported Claude file by dependency readiness.

Each file gets:

- no missing deps
- missing Claude private dep
- missing public dep
- depends on bridge
- blocked by unknown basis

Deliverable:

- a machine-generated ledger, not just a narrative doc

### Phase 3: Foundation Reconstruction

Reconstruct the missing high-fanout Claude foundations first.

Priority classes:

- bootstrapping
- config/settings/auth
- message/state/task core
- tool registry
- session core
- remote/server/transport core

This is the only sane way to unlock the rest of the tree.

### Phase 4: Infra Bridging

For missing foundations that should not be reconstructed from scratch, bridge them to host implementations.

Primary likely bridge targets from Gizzi:

- persistence/session storage
- server routing
- websocket/SSE relay
- remote-control backend
- verification backend
- MCP runtime
- workspace/project context

### Phase 5: Claude App Boot

Get the Claude entrypoint booting from inside `gizzi-code`.

Not feature complete yet.

But the boot path must be Claude's.

### Phase 6: Claude End-to-End Path

Get one full Claude-driven path working on top of reconstructed and bridged infra:

- startup
- session load/create
- prompt loop
- tool dispatch
- output rendering
- persistence

### Phase 7: Replace Gizzi Top-Level Product Surface

Once Claude paths are stable, make Claude the default top-level product surface.

Only then should Gizzi-native product surfaces be retired or demoted.

## What Should Not Happen

Do not:

- cherry-pick Claude features into existing Gizzi structure
- translate Claude directories directly into Gizzi naming too early
- let Gizzi session semantics replace Claude session semantics by default
- use `gizzi-code-claude` as the integration branch
- delete legacy folders before import and dependency audit are complete

Those are the paths that caused the current drift.

## What Gizzi Is Actually Good For In This Plan

Gizzi is still important, but in a narrower and more disciplined way.

Use Gizzi for:

- host repo continuity
- existing workspace/build context
- production transport/relay assets
- verification backend
- MCP/runtime substrate
- session/persistence substrate where Claude is incomplete
- any public production implementation that can sit behind Claude semantics

Do not use Gizzi as the default template for reorganizing Claude.

## Best Immediate Next Step

The next step should be a mechanical import-and-ledger phase, not more theory.

Specifically:

1. create the Claude canonical subtree in `gizzi-code`
2. generate a file-by-file import manifest for all Claude files
3. generate a dependency ledger for every imported file
4. mark which missing dependencies are:
   - reconstruct-as-Claude
   - bridge-to-Gizzi
   - bridge-to-OSS
   - blocked

That will give you the real map of the work, instead of another abstract architecture loop.
