# Session Projection

## Purpose

This document defines how A2R projects a single runtime session across multiple UI surfaces without creating duplicate session truth.

It is normative for:
- desktop session rendering
- web session rendering
- code mode rendering
- cowork mode rendering
- session replay and mirroring
- event ledger synchronization

---

## Core Principle

A2R has **one runtime session model**.

Desktop, web, code mode, and cowork mode are **surfaces** over that same session truth.

The system must not create separate, divergent session runtimes for:
- desktop
- web
- code mode
- cowork mode

---

## Session Truth Hierarchy

### 1. Runtime Session State
Primary source of truth.

Owns:
- run identity
- session identity
- planner state
- tool calls
- mode state
- artifacts
- receipts
- automation results
- task progress

### 2. Event Ledger
Persistent and replayable session stream.

Owns:
- append-only event history
- cursor-based replay
- reconnect continuity
- multi-surface synchronization
- audit/replay substrate

### 3. Surface Projections
Derived render states.

Includes:
- desktop app projection
- web app projection
- code mode projection
- cowork mode projection

Surface projections must be reconstructible from:
- runtime session state
- event ledger stream

---

## Non-Goals

This system does **not**:
- create separate desktop and web sessions for the same run
- allow UI surfaces to become independent runtime sources of truth
- allow mirrored surfaces to bypass runtime policy
- treat web projection as a separate automation runtime

---

## Session Identity

Each active unit of work must have:

- `run_id`
- `session_id`
- `surface_id` (optional, for projection identity only)
- `surface_type`
- `projection_cursor`

### Required rules

- `run_id` identifies the logical run
- `session_id` identifies the runtime session
- `surface_id` identifies a renderer/projection instance only
- multiple surfaces may attach to one `session_id`
- surfaces must never mint new runtime truth without runtime authorization

---

## Surface Types

Valid surface types:

- `desktop`
- `web`
- `code`
- `cowork`
- `thin-client` (future)
- `mobile` (future)

These are projection types, not runtime types.

---

## Source of Truth Model

### Runtime owns mutations
Only the runtime/session controller may commit authoritative state transitions.

Examples:
- tool call started
- tool call completed
- mode changed
- artifact created
- receipt emitted
- task status updated

### Surfaces own local UI state only
Surfaces may own ephemeral presentation state such as:
- panel width
- scroll position
- local tab selection
- collapsed sections
- viewport layout preferences

These must not redefine runtime truth.

---

## Projection Model

Each surface consumes a session projection stream.

### Projection inputs
- current runtime snapshot
- event ledger replay from cursor
- live event stream

### Projection outputs
- render tree
- surface-local view model
- user interaction intents

### Projection loop
1. attach to session
2. load snapshot
3. replay from cursor
4. subscribe to live events
5. render
6. send user interaction intents back through runtime controller

---

## Event Ledger Role

The Event Ledger is the shared sync substrate between runtime and all surfaces.

### Responsibilities
- append runtime events
- persist ordering
- provide cursor-based replay
- support reconnect/resume
- support multi-surface fanout
- support debugging and audit

### Ledger is not a UI
The Event Ledger does not own UI logic. It owns durable event continuity.

---

## Desktop Surface

Desktop is the primary operator surface.

### Responsibilities
- highest-fidelity operator UI
- primary control plane for interactive work
- session inspection
- code mode rendering
- cowork rendering
- browser/computer-use viewport integration

### Rules
- desktop may be primary controlling surface
- desktop projection still consumes runtime truth
- desktop must not bypass runtime/session controller

---

## Web Surface

Web is a mirrored or projected surface of the runtime session.

### Responsibilities
- remote viewing
- remote follow-along
- optional remote interaction if permitted
- replay from event ledger
- browser-accessible rendering of code/cowork session state

### Rules
- web is not a separate runtime
- web must attach to an existing session
- web may be read-only or interactive depending on policy
- web interactions are intents routed back to runtime/controller

---

## Code Mode Projection

Code mode is a projection of runtime session state for code-oriented workflows.

### Includes
- file/action stream
- tool activity
- diff summary
- active tasks
- artifacts
- receipts
- mode state

### Rules
- desktop code mode and web code mode render the same underlying session truth
- no separate code session per surface

---

## Cowork Mode Projection

Cowork mode is a projection of runtime session state for collaborative/session-mirroring workflows.

### Includes
- run status
- action stream
- browser/computer-use actions
- artifacts
- task timeline
- terminal/code/browser panels as available

### Rules
- `gizzi cowork web` opens a projection of an existing session
- it does not create a new independent cowork runtime

---

## Control Permissions

Not every surface has the same control rights.

### Permission levels
- `view`
- `comment`
- `suggest`
- `interact`
- `control`

### Default policy
- desktop: `control`
- web: `view` or `interact`, policy-dependent
- code projection: `view` or `interact`
- cowork projection: `view` or `interact`

### Critical rule
Any control action from a non-primary surface must be validated by:
- runtime session controller
- policy engine
- current session lock/ownership rules

---

## Primary Surface and Surface Locking

At any time, one surface may be marked primary.

### Primary surface responsibilities
- authoritative operator interaction
- privileged control actions
- final approval prompts where required

### Secondary surfaces
- mirror state
- may request control
- may submit intents
- may be read-only

### Optional future behavior
- control handoff
- temporary lock leasing
- shared-control collaboration mode

---

## User Intents From Surfaces

Surfaces do not directly mutate runtime state.

They submit intents such as:
- open file
- change panel
- request browser action
- approve action
- cancel run
- focus task
- request control

Runtime/controller decides whether to execute them.

---

## Session Mirroring

### Definition
Session mirroring is the projection of an existing session onto an additional surface.

### Example
`gizzi cowork web`:
- resolves target `run_id` / `session_id`
- requests mirror token or projection route
- opens web surface
- web surface replays from ledger and subscribes live

### Important
Mirroring does not create a second runtime.

---

## Automation vs Projection

These are separate concerns.

### Automation
Owned by A2R Computer Use service.

Examples:
- Playwright actions
- browser-use actions
- desktop automation
- screenshots
- extraction
- artifacts
- receipts

### Projection
Owned by session/state/surface architecture.

Examples:
- desktop rendering
- web rendering
- replay
- mirror URL
- event streaming
- code/cowork panels

Automation outputs feed projection state.
Projection does not execute automation directly.

---

## Required Runtime APIs

Minimum session-projection APIs:

### Snapshot
- get session snapshot by `session_id`

### Replay
- replay events from cursor

### Subscribe
- live event stream by `session_id`

### Surface attach
- attach new surface to session

### Surface intent
- send surface intent to runtime/controller

### Mirror route
- mint mirror URL/token for existing session

---

## Required Surface Metadata

Each attached surface should track:
- `surface_id`
- `surface_type`
- `session_id`
- `run_id`
- `attached_at`
- `last_cursor`
- `permission_level`
- `is_primary`
- `client_info`

---

## Failure and Recovery

### If web disconnects
- reconnect using last cursor
- replay missed events
- restore projection

### If desktop restarts
- runtime or ledger snapshot restores current state
- surfaces reattach

### If runtime ends
- all surfaces become terminal projections
- replay remains available if retained by ledger policy

---

## Security and Policy

### Required controls
- authenticated surface attach
- signed mirror tokens or equivalent
- permission checks for interactive surfaces
- audit of cross-surface control actions
- no direct state mutation from untrusted surfaces

### Must not allow
- arbitrary surface impersonation
- web surface bypassing desktop/runtime policy
- separate shadow sessions for mirrored views

---

## Acceptance Criteria

This spec is satisfied when:

1. one session can be rendered on desktop and web simultaneously
2. both surfaces show the same runtime-backed state
3. replay from ledger reconstructs the same projection
4. non-primary surfaces cannot bypass control policy
5. code mode and cowork mode are projections over shared session truth
6. mirroring a session does not create a second runtime session

---

## Implementation Notes

### Immediate direction
- keep desktop/runtime session as primary truth
- make web a projection route
- build Computer Use as execution service
- keep automation and projection concerns separate

### Near-term sequence
1. SessionProjection.md (this document)
2. stub Computer Use gateway
3. prove GIZZI browser tool round-trip
4. wire Playwright `goto + screenshot`
5. implement session projection APIs
6. wire `gizzi cowork web` to mirror existing session
