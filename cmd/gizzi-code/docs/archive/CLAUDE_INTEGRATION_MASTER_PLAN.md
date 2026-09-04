# Claude Integration Master Plan

## Decision

`gizzi-code` is the destination and source of truth.

`claude-code` is the donor codebase.

`free-code` is a reconstruction aid for top-level scaffold and some missing real files, but it is not the target architecture.

`gizzi-code-claude` is not the destination. It should be treated as a failed staging area and reference-only donor, not as the branch to continue integrating into.

## Immediate Boundary

Inside `/Users/macbook/Desktop/allternit-workspace/allternit/cmd`, these are the relevant boundaries:

- Keep active: `gizzi-code`
- Keep as donor/reference: `gizzi-code-claude`
- Keep as stable shared primitives: `gizzi-core`
- Do not use for current integration: `cli`, `cli-typescript`, `cli-rust-archive`, `.build*`, `dist`, `output`, `.gizzi`

Inside `gizzi-code`, the following should be treated as non-source noise during integration planning and build validation:

- `.build`
- `.build-production`
- `.build-transformed`
- `dist`
- `output`
- `.gizzi`

These should not be deleted yet. They should be excluded from search, mapping, and build-audit work until the integrated product is stable.

## Structural Reality

The two codebases are not organized the same way.

`gizzi-code` is runtime-first:

- `src/runtime`: 551 files
- `src/cli`: 278 files
- `src/shared`: 52 files
- workspaces in `packages/*` for remote control, relay, sdk, plugin, util, script

`claude-code` is interaction-first:

- `src/utils`: 564 files
- `src/components`: 389 files
- `src/commands`: 207 files
- `src/tools`: 184 files
- `src/services`: 130 files
- `src/hooks`: 104 files
- `src/ink`: 96 files

This means the migration cannot be done as a flat copy. It has to be done as a staged graft:

1. vendor the Claude tree intact
2. restore its missing foundations
3. bridge it into Gizzi runtime/services/packages
4. progressively make Claude surfaces the default user-facing path

## Source Audit Summary

### Active Gizzi Areas

The strongest production subsystems already present in `gizzi-code` are:

- `src/runtime/session`
- `src/runtime/server`
- `src/runtime/tools`
- `src/runtime/verification`
- `src/runtime/workspace`
- `src/runtime/integrations`
- `src/cli/ui/tui`
- `packages/remote-control`
- `packages/cloud-relay`
- `packages/direct-stream`
- `packages/cowork-controller`
- `packages/sdk`

These are the best candidates to absorb or replace missing private Claude functionality.

### Claude Donor Areas

The most valuable donor surfaces in `claude-code` are:

- `src/main.tsx`
- `src/entrypoints/*`
- `src/commands/*`
- `src/components/*`
- `src/ink/*`
- `src/tools/*`
- `src/services/*`
- `src/hooks/*`
- `src/bridge/*`
- `src/remote/*`
- `src/tasks/*`

These are the surfaces that carry the more mature Claude command UX, tool UX, React/Ink app flow, and higher-level session orchestration.

## Hard Constraint

The donor codebase is incomplete. The missing portion is not distributed evenly. A relatively small set of missing foundational modules fans out into most of the donor tree.

The highest-impact missing foundations include:

- `ink.js`
- `Tool.js`
- `Task.js`
- `commands.js`
- `bootstrap/state.js`
- `types/message.js`
- `state/AppState.js`
- `services/analytics/*`
- `utils/config.js`
- `utils/auth.js`
- `utils/messages.js`
- `utils/settings/*`
- `utils/model/*`
- `utils/permissions/*`
- `tools/AgentTool/*`

There are also entire missing feature families:

- `daemon/*`
- `ssh/*`
- `proactive/*`
- `uds*`
- `server/*` beyond the small public subtree
- `query/transitions.js`
- several analytics, policy, plugin, and settings dependencies

This means the correct order is not "move every file and fix later". The correct order is "restore the missing foundations first, then move the dependent layers".

## Production Rule

No stubs, placeholders, or fake adapters.

Every missing dependency must be resolved using one of these only:

1. real code already present in `claude-code`
2. real code from `free-code` where it is actual implementation and not a shim
3. real production code already present in `gizzi-code`
4. real OSS packages and publicly documented protocols

If a missing Claude private feature has no public source basis and no equivalent in Gizzi, it should be marked blocked and left out of the first production merge target.

## Integration Strategy

### Phase 0: Freeze the Boundaries

Goal: stop drift and prevent further confusion.

Actions:

- Do not continue work inside `gizzi-code-claude`
- Do not merge from artifact folders or generated output
- Treat `gizzi-code` as the only active destination
- Create a dedicated vendor namespace inside `gizzi-code` for the Claude donor

Recommended destination namespace:

- `src/vendor/claude/*`

Reason:

- keeps donor code intact while it is still incomplete
- avoids immediate namespace collision with `src/runtime/*` and `src/cli/*`
- allows progressive bridges instead of destructive replacements

### Phase 1: Restore Claude Build Foundations

Goal: make the donor tree buildable in isolation inside the destination repo.

Required work:

- add the missing Claude top-level scaffold into `gizzi-code`
- restore donor build/runtime entrypoints
- restore donor foundational modules before moving higher-level commands/components

Production sources to use:

- `free-code` for real top-level scaffold files:
  - `package.json`
  - `tsconfig.json`
  - `env.d.ts`
  - `scripts/build.ts`
- `free-code` for the subset of real missing donor modules that are not shims
- `gizzi-code` packages and runtime for production replacements where Claude private modules are absent

Acceptance criteria:

- Claude donor subtree typechecks as a vendored subsystem
- missing-import list is reduced from foundational failures to feature-specific failures

### Phase 2: Build the Bridge Layer

Goal: connect Claude’s interaction surfaces to Gizzi’s production runtime.

This bridge layer should live outside the vendored donor tree.

Recommended location:

- `src/integration/claude/*`

Bridge responsibilities:

- session lifecycle mapping
- tool registry mapping
- permission model mapping
- MCP registry mapping
- remote-control and relay mapping
- verification and review mapping
- workspace/project mapping
- auth/config/settings translation

Reason:

- preserves Claude donor code as a mostly intact upstream-like tree
- localizes integration logic
- makes future donor refreshes possible

### Phase 3: Promote Claude User Surfaces

Goal: use Claude’s mature command/component/tool UX as the default where it is clearly stronger.

Precedence rule:

- Claude command, tool, component, and Ink surfaces take precedence for user-facing interaction
- Gizzi runtime, relay, verification, workspace, and package infrastructure take precedence where Claude is missing or private

This means:

- keep Gizzi runtime as the execution substrate
- make Claude the interaction shell on top of it

### Phase 4: Replace Missing Private Claude Capabilities

Goal: achieve production equivalents for the missing 20% without inventing fake internals.

Approved replacement patterns:

- use `packages/remote-control` and `packages/cloud-relay` instead of Claude-private remote/bridge internals where possible
- use `src/runtime/session` instead of rebuilding a private session storage layer from scratch
- use `src/runtime/tools` and `src/runtime/tools/mcp` instead of reproducing private tool registry logic where the behavior can be mapped
- use `src/runtime/verification` instead of reconstructing internal verification-only systems
- use OSS implementations for public transport and host services:
  - `ws` for websocket transport
  - Node `net` for UDS/IPC
  - `ssh2` for SSH/session transport
  - HTTP/SSE where direct-stream semantics are sufficient

Blocked until real public basis exists:

- private analytics and first-party telemetry backends
- private assistant/kairos internals with no public source basis
- private classifier or prompt-routing services with no public protocol
- private daemon/control-plane workers if no equivalent public contract exists

## Subsystem Mapping

### 1. CLI And App Shell

Claude donor:

- `src/entrypoints/*`
- `src/main.tsx`
- `src/commands/*`
- `src/components/*`
- `src/ink/*`
- `src/screens/*`
- `src/hooks/*`

Destination:

- vendor intact under `src/vendor/claude/*`
- expose through `src/cli/*` only after the bridge layer is ready

Precedence:

- Claude should win for interactive UX and command flow

Required integration:

- replace Claude global state/config/session providers with bridge adapters into Gizzi runtime context

### 2. Tools

Claude donor:

- `src/tools/*`
- `src/tools/AgentTool/*`
- `src/Tool.ts`
- `src/tools.ts`

Gizzi production substrate:

- `src/runtime/tools/*`
- `src/runtime/tools/builtins/*`
- `src/runtime/tools/mcp/*`
- `packages/plugin`
- `packages/sdk`

Precedence:

- Claude tool UX and tool-level behavior should win where code exists
- Gizzi tool dispatch, permission, plugin, and MCP substrate should win where Claude depends on missing private internals

Required integration:

- build a tool registry adapter between Claude tool definitions and Gizzi dispatch/guard/MCP systems

### 3. Session, State, Persistence

Claude donor:

- `src/state/*`
- `src/history.ts`
- `src/context/*`
- `src/types/message.js` and related conversation types

Gizzi production substrate:

- `src/runtime/session/*`
- `src/runtime/context/*`
- `src/runtime/workspace/*`

Precedence:

- Gizzi should remain the source of truth for persistent session storage
- Claude can own session presentation and interaction flow

Required integration:

- map Claude message/session abstractions onto Gizzi session rows, prompt state, snapshot state, and project context

### 4. Remote, Bridge, Relay, Server

Claude donor:

- `src/bridge/*`
- `src/remote/*`
- `src/server/*`
- missing `daemon/*`, `ssh/*`, `uds*`

Gizzi production substrate:

- `packages/remote-control`
- `packages/cloud-relay`
- `packages/direct-stream`
- `packages/cowork-controller`
- `src/runtime/server/*`

Precedence:

- Gizzi should win for the underlying transport and hosted session topology
- Claude remote/bridge UX can be ported on top if still valuable

Required integration:

- rewrite Claude remote-control entrypoints to target Gizzi remote-control packages instead of rebuilding private Anthropic transport layers

### 5. Verification And Review

Claude donor:

- review-related commands and tools
- task and plan-mode surfaces

Gizzi production substrate:

- `src/runtime/verification/*`

Precedence:

- Gizzi should win for verification engine and storage
- Claude review UX can be adapted to call Gizzi verification services

### 6. MCP And Plugins

Claude donor:

- `src/services/mcp/*`
- plugin CLI surfaces

Gizzi production substrate:

- `src/runtime/tools/mcp/*`
- `packages/plugin`
- `packages/sdk`

Precedence:

- use Gizzi substrate where Claude MCP internals are private or incomplete
- retain Claude command UX if it maps cleanly

## Execution Order

### Stage A: Inventory Lock

- create canonical path map of active source in `gizzi-code`
- create canonical donor path map of `claude-code`
- mark all generated/artifact/runtime folders as excluded

### Stage B: Vendor Import

- copy the donor tree into `gizzi-code/src/vendor/claude`
- do not rewrite imports yet except where required for vendoring
- keep donor structure intact

### Stage C: Foundation Reconstruction

- restore missing Claude scaffold files
- restore foundational donor modules from `free-code` where real
- implement production replacements for missing transport/config/session/tool primitives using Gizzi and OSS

### Stage D: Bridge Layer

- create `src/integration/claude/*`
- map config, auth, session, tool, MCP, remote-control, verification

### Stage E: Surface Promotion

- route Gizzi CLI startup into Claude app shell where complete
- keep Gizzi-native commands for any still-unported area

### Stage F: Consolidation

- remove duplicate entrypoints
- retire `gizzi-code-claude` from active development
- only then consider deleting legacy `cmd` siblings that are proven unused

## What Should Be Removed Now

Nothing should be deleted immediately except obviously disposable generated output if you explicitly want a cleanup pass.

For now:

- do not delete `gizzi-code-claude`
- do not delete `cli`
- do not delete other `cmd` siblings
- do not delete `.build*`, `dist`, `output`, `.gizzi` yet

Instead, mark them as:

- non-authoritative
- excluded from search
- excluded from build validation
- excluded from integration work

Deletion should happen only after:

1. `gizzi-code` builds with the new integrated path
2. active entrypoints are verified
3. imports prove those folders are unused

## Recommended First Implementation Slice

The first slice should not be "all files".

It should be:

1. create `src/vendor/claude`
2. import Claude entrypoints, commands, components, hooks, ink, tools, services intact
3. restore the missing donor scaffold and foundational modules
4. build `src/integration/claude/session`, `toolRegistry`, `config`, `mcp`, `remoteControl`
5. wire a single Claude command path end to end on top of Gizzi runtime

Best initial end-to-end target:

- Claude interactive REPL / main app shell
- backed by Gizzi session, tools, MCP, and verification

This will prove the architecture before the full migration.

## Output Of This Plan

The correct target architecture is:

- `gizzi-code` remains the product repo
- Claude becomes a vendored interaction layer inside it
- Gizzi remains the production runtime substrate
- missing private Claude features are replaced only with real Gizzi or OSS implementations
- `gizzi-code-claude` stops being a development surface

## Next Documents To Produce

After this master plan, the next artifacts should be:

1. a file-by-file donor import manifest
2. a foundation reconstruction ledger for missing Claude modules
3. a bridge contract spec for session/tool/config/MCP/remote-control
4. a deletion candidate list for non-authoritative folders in `cmd`
