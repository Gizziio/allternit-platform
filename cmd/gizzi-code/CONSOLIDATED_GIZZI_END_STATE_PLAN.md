# Consolidated Gizzi End-State Plan

## End State

The final product is not:

- `claude-code` living inside `gizzi-code`
- a layered adapter system
- a permanent bridge architecture
- a dual-runtime product

The final product is:

- one consolidated codebase
- one product identity
- one build
- one runtime model
- one session model
- one command surface
- one branding surface

That product is `gizzi-code`.

Claude is the canonical donor during migration.

Gizzi is the final consolidated product after migration.

## Correct Framing

There are three different states and they should not be mixed together:

### 1. Migration State

Temporary.

Purpose:

- land all Claude files
- reconstruct missing Claude dependencies
- keep the system buildable while convergence is incomplete

This is where vendoring and bridges are useful.

### 2. Convergence State

Temporary.

Purpose:

- replace temporary bridges with direct implementations
- collapse duplicate abstractions
- choose one canonical type system, session model, tool registry, runtime boot path, and build path

### 3. Final Product State

Permanent target.

Purpose:

- eliminate donor/host distinction
- eliminate compatibility layers
- eliminate duplicate trees
- rename and brand the result as Gizzi only

This is the only acceptable end state.

## Architecture Rule

Bridges are allowed only as migration infrastructure.

They are not allowed in the final architecture unless they correspond to a real product boundary that should exist anyway.

Examples of acceptable permanent boundaries:

- package boundaries
- plugin SDK boundaries
- client/server boundaries
- remote-control protocol boundaries
- MCP protocol boundaries

Examples of unacceptable permanent boundaries:

- `claude-bridge`
- `claude-reconstructed`
- compatibility wrappers that exist only because migration was unfinished
- duplicated session models
- duplicated command registries
- duplicated app boot paths

## Correct End-State Priority

The final consolidation should follow this rule:

1. keep Claude behavior where it is stronger
2. keep Gizzi infrastructure where it is stronger
3. collapse both into one direct Gizzi-native implementation

So the target is not "Claude-first forever."

The target is:

- Claude-first during migration
- best-of-both during convergence
- Gizzi-only in the final architecture

## What Must Be Unified In The Final Product

These cannot remain doubled.

### Identity

- package name
- CLI name
- environment variable namespace
- product copy
- docs and README language
- telemetry namespace if any remains
- config file names
- local app data paths

### Boot And Build

- one entrypoint
- one build system
- one tsconfig strategy
- one package graph
- one release path

### Runtime Core

- one app state model
- one session model
- one message model
- one task model
- one tool registry
- one permission system
- one config/settings system
- one auth model
- one persistence layer

### Server And Remote

- one remote-control surface
- one transport strategy
- one relay/control-plane model
- one server routing layer

### UI

- one command registry
- one REPL shell
- one interactive UI component system
- one session UX

## What This Means For Integration

The work has to be divided into two plans:

### Plan A: Migration Plan

How to get from today's drifted state to a functioning imported Claude-based system inside the repo.

### Plan B: Consolidation Plan

How to remove the temporary scaffolding and turn the result into one Gizzi product.

The mistake would be to treat Plan A as the destination.

## Revised Strategy

### Phase 1: Full Claude Landing

Land every Claude file in the repo with minimal distortion.

This is a temporary structural state only.

Goal:

- preserve donor behavior
- get accurate dependency accounting

### Phase 2: Missing Claude Reconstruction

Rebuild the missing 20 percent using:

- real Claude-adjacent code
- `free-code` where real
- Gizzi production implementations
- OSS/public protocols

Goal:

- get Claude feature coverage as complete as possible

### Phase 3: Functional Parity Boot

Boot the product using Claude-driven behavior with production-grade missing pieces filled in.

Goal:

- prove end-to-end behavior

### Phase 4: Model Selection

Choose the single canonical implementation for each core concern:

- session
- state
- task orchestration
- tool dispatch
- remote control
- verification
- config/auth/settings
- UI command flow

Rule:

- if Claude is better and complete, Claude becomes the basis
- if Gizzi is stronger at substrate level, port its strength into the canonical implementation
- do not leave both systems alive

### Phase 5: Direct Consolidation

Remove temporary migration namespaces and wrappers.

Actions:

- move canonical code into final Gizzi paths
- rewrite imports to final locations
- delete donor-only temporary directories
- delete compatibility wrappers
- delete duplicate implementations

### Phase 6: Final Identity Pass

Make the entire product Gizzi-native:

- naming
- branding
- package identity
- command identity
- docs
- config
- release assets

## Answer To Your Concern

You are right.

A bridge-layer-heavy plan is only a midpoint plan.

It is useful only to:

- avoid breaking the system while integrating all Claude files
- preserve donor semantics during reconstruction
- keep the work measurable

But it is not the destination.

The destination must be a direct, consolidated, branded Gizzi codebase with no migration-only abstractions left behind.

## Practical Rule Going Forward

Any temporary layer we introduce must have an explicit removal plan.

For every temporary namespace or bridge we create, we should record:

- why it exists
- what it is protecting
- what condition allows removal
- what final module/path replaces it

If we cannot state the removal condition, the layer should not be created.

## Immediate Next Deliverable

The next useful artifact is not another abstract plan.

It should be a convergence matrix that marks, for each major subsystem:

- Claude canonical implementation
- Gizzi competing implementation
- chosen final owner
- temporary migration path
- final path after consolidation

That will let the migration plan and the end-state plan stay aligned.
