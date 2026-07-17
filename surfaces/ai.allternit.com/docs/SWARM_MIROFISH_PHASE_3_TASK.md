# Phase 3 Task: MiroFish as a Nested Sub-Mode of Agent Swarm

Read `SWARM_MIROFISH_MAP.md`, `SWARM_MIROFISH_PHASE_1_NOTES.md`, and `SWARM_MIROFISH_PHASE_2_NOTES.md`
first (same directory). Phase 1 (swarm sandbox tier) and Phase 2 (MiroFish simulation engine,
`src/lib/mirofish/`) are both reviewed and complete. This phase wires Phase 2's engine into the UI.

## Design decision made for you (do not re-derive — this was corrected once already after review)

**MiroFish is not a new top-level mode.** An earlier draft of this plan gave it its own ModeDock
tab; the reviewer correctly flagged that this reads as a near-duplicate of the existing `Agent
Swarm` tab sitting right next to it (both look like "multiple agents doing something" from the
tab alone, even though the underlying mechanics differ). The corrected design, confirmed against
the real code before this task was written:

- `ModeDock.tsx`'s `MODE_TABS`/`SURFACE_MODES`, `agent-surface-mode.store.ts`'s `AgentModeId`
  union, and `agent-mode-contracts.ts`'s `CanonicalAgentModeId`/`AGENT_MODE_CONTRACTS` are **all
  untouched** by this phase. Do not add anything to any of them.
- Selecting the existing `Agent Swarm` mode today renders no dedicated panel — just the normal
  chat composer plus `TemplateGallery` (`ChatComposer.tsx` line ~2527:
  `{selectedModeId && <TemplateGallery modeId={selectedModeId} onSelectTemplate={...} />}`).
- Add a new nested sub-tab strip, `SwarmSubModeTabs`, rendered only when
  `selectedModeId === 'swarms'`, with two options: **"Specialist Team"** (today's existing
  behavior — unchanged, still drives `SwarmsPlugin` via `TemplateGallery`) and **"Population
  Simulation"** (MiroFish — new). When "Population Simulation" is the active sub-mode, render a
  new `MiroFishPanel` in place of `TemplateGallery` for that mode; when "Specialist Team" is
  active (the default), behavior is byte-for-byte what it is today.
- Style `SwarmSubModeTabs` after `ModeDock.tsx`'s own tab treatment (lines ~132–170: icon chip
  with a color-tinted background, `isSelected` styled via an inset ring using the tab's color at
  reduced opacity) but render it as an inline horizontal strip, not a popover — it's a secondary,
  always-visible selector nested under an already-selected top-level mode, not another top-level
  picker.
- Track which sub-mode is active with a new piece of state shaped like
  `agent-surface-mode.store.ts`'s existing `selectedModeBySurface` (a per-`AgentModeSurface` map),
  but scoped separately (e.g. `swarmSubModeBySurface`) — do not add sub-modes to the
  `AgentModeId` union itself, they are not top-level modes.

## Scope

### 1. `src/views/chat/components/SwarmSubModeTabs.tsx` (new)

Two-option inline tab strip: "Specialist Team" / "Population Simulation". Props: current
sub-mode, an `onSelect` callback. Persist selection via the new store field described above.

### 2. `agent-surface-mode.store.ts` (edit)

Add the new sub-mode state field (map of `AgentModeSurface` -> `'specialist-team' |
'population-simulation'`, defaulting to `'specialist-team'`) and its setter, following the exact
pattern already used for `selectedModeBySurface`/`setSelectedMode`. Do not touch `AgentModeId`.

### 3. `ChatComposer.tsx` (edit, ~line 2527)

Where `{selectedModeId && <TemplateGallery ... />}` renders: when `selectedModeId === 'swarms'`,
render `<SwarmSubModeTabs />` above it. When the active sub-mode is `'population-simulation'`,
render `<MiroFishPanel />` instead of `<TemplateGallery modeId="swarms" ... />`. Every other mode,
and the `'specialist-team'` sub-mode, keep today's exact `TemplateGallery` behavior — this must be
a pure addition, not a refactor of the existing render path for other modes.

### 4. Execution boundary — read this before writing `MiroFishPanel.tsx`

`src/lib/mirofish/*` and `src/lib/sandbox/swarm/*` call `generateText`/`getDefaultPluginModel`
(and, for the E2B provider, read `E2B_API_KEY`) — this is server-only code (API keys must never
reach a browser bundle). **Do not import `@/lib/mirofish` or `@/lib/sandbox/swarm` directly into
`MiroFishPanel.tsx`** (a client-rendered component). Instead: find exactly how the existing
`SwarmsPlugin` (`src/plugins/built-in/swarms/plugin.ts`, registered via the `lazyImport` in
`src/lib/plugins/index.ts`) actually gets invoked end-to-end when a user runs Agent Swarm mode
today — trace it from `src/lib/plugins/index.ts` forward — and route `MiroFishPanel`'s calls to
`runSimulation()` / `buildPersonas()` / the new `askPersona()` (below) through that **exact same**
execution path. If that path is a plugin-execution/tool-call mechanism rather than a REST
endpoint, mirror that mechanism; do not invent a new API route unless the traced path shows one is
genuinely how plugin execution reaches the server today. If you cannot conclusively determine the
real execution boundary, stop and report the ambiguity in NOTES rather than guessing — a wrong
guess here either leaks secrets client-side or silently no-ops.

### 5. `src/lib/mirofish/agent-chat.ts` (new)

Phase 2 has no "ask a persona a question post-hoc" capability — `runSimulation()` only drives the
round loop. Add `askPersona(world: WorldState, persona: Persona, memoryStore: MemoryStore,
question: string): Promise<string>`: one `generateText` call (via `getDefaultPluginModel()`, same
rule as always — no hardcoded model id) with a prompt built from the persona's bio/traits, its
recent memory (`memoryStore.retrieve(persona.id)`), the seed material, and the question — styled
the same way `buildTurnPrompt` in `simulation-engine.ts` is (bounded size, same prose style). This
does not write back to `memoryStore` — a post-hoc question is not a simulation round. Export it
from `src/lib/mirofish/index.ts`.

### 6. `src/views/chat/panels/MiroFishPanel.tsx` (new)

The panel mocked in `docs/SWARM_MIROFISH_MAP.md`'s linked preview (ask the user for the artifact
link if you need the visual again — the reviewer has it): seed material input (text + a `kind`
selector matching `SeedMaterialKind`), population size and round count controls, a Run button that
triggers `buildInitialWorldState`/`runSimulation` (via the execution boundary from item 4), then
results: a persona grid, a round-by-round report timeline rendering `WorldState.roundSummaries`
directly (this **is** the report — no separate report-generation module needed, Phase 2 already
produces it), and a chat sub-panel where selecting a persona and asking a question calls
`askPersona()`. Log with `createModuleLogger('MiroFish')`.

## Constraints

- No builds, no typecheck, no dev server, no git operations.
- Do not touch `ModeDock.tsx`'s `MODE_TABS`/`SURFACE_MODES`, `agent-surface-mode.store.ts`'s
  `AgentModeId` union, or `agent-mode-contracts.ts`'s `CanonicalAgentModeId`/
  `AGENT_MODE_CONTRACTS` — per the design decision above.
- Do not touch `src/plugins/built-in/swarms/plugin.ts` — "Specialist Team" must keep working
  exactly as it does today, untouched.
- Do not touch `src/lib/agents/agent-workspace.service.ts`, `src/lib/agents/files-api.ts`,
  `src/lib/agents/useAgentBootstrap.ts`, `cmd/allternit-mux/`, anything under `rails/`, or
  `cmd/allternit-api/` — unrelated in-progress work lives there.
- Do not touch anything under `src/lib/db/` (memory persistence is still out of scope, per Phase 2).

## Deliverable sentinel

When finished, write `surfaces/ai.allternit.com/docs/SWARM_MIROFISH_PHASE_3_NOTES.md` with the
same YAML frontmatter shape as Phases 1–2 (`status`, `files_changed`, `deviations`, `remaining`),
followed by prose notes: what execution boundary you traced `SwarmsPlugin` through and how
`MiroFishPanel` mirrors it, and confirmation that "Specialist Team" behavior is unchanged.
