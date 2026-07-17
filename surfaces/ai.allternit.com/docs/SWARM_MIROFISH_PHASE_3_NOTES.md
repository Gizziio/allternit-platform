---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/mirofish/agent-chat.ts
  - surfaces/ai.allternit.com/src/lib/mirofish/index.ts
  - surfaces/ai.allternit.com/src/plugins/built-in/mirofish/plugin.ts
  - surfaces/ai.allternit.com/src/stores/agent-surface-mode.store.ts
  - surfaces/ai.allternit.com/src/views/chat/components/SwarmSubModeTabs.tsx
  - surfaces/ai.allternit.com/src/views/chat/panels/MiroFishPanel.tsx
  - surfaces/ai.allternit.com/src/views/chat/ChatComposer.tsx
  - surfaces/ai.allternit.com/docs/SWARM_MIROFISH_PHASE_3_NOTES.md
deviations:
  - "MiroFishPanel.tsx does not import even the *types* from @/lib/mirofish (not even `import
    type`). Technically a plain `import type {...} from '@/lib/mirofish'` is erased at compile
    time and carries zero runtime footprint, so it would have been defensible — but the task's
    wording ('do not import @/lib/mirofish ... directly into MiroFishPanel.tsx') reads as an
    absolute rule, and honoring it literally costs nothing here. Instead every type the panel
    needs (SeedMaterial, SimulationConfig, WorldState, Persona, RoundSummary, SeedMaterialKind) is
    derived structurally from `typeof import('@/plugins/built-in/mirofish/plugin')` — a pure
    type-level query with no import statement referencing the forbidden paths at all, static or
    dynamic."
  - "askPersona's memory needs a MemoryStore that stays alive between the Run step and later
    chat questions for the same world, but Phase 2 designed MemoryStore as scoped to one
    runSimulation call, not attached to WorldState. src/plugins/built-in/mirofish/plugin.ts (new)
    holds a module-level `Map<worldId, MemoryStore>` — created during runMiroFishSimulation,
    looked up during askMiroFishPersona — so a persona's answers stay consistent with what
    happened in the simulation. This lives only as long as the lazy chunk stays loaded (matches
    how src/lib/plugins/index.ts's `pluginCache` already holds plugin instances across calls)."
  - "MiroFishPanel calls `runMiroFishSimulation` as one atomic action behind the Run button,
    rather than calling buildPersonas/buildInitialWorldState and runSimulation as separate UI
    steps. Item 6 of the task describes the Run button as triggering
    'buildInitialWorldState/runSimulation' together, and runSimulation already calls
    buildInitialWorldState as its own first step (Phase 2), so a single call is a faithful,
    non-simplified reading of that line, not a shortcut around a two-stage wizard the task didn't
    otherwise describe (no preview/confirm-personas-before-running-rounds step was specified)."
  - "Added soft UI caps (population 1-50, rounds 1-10, defaults 12/3) not specified by the task.
    Each persona and each round-turn is a real LLM call (populationSize + populationSize*rounds
    calls per run), so an unbounded control could let someone fire off hundreds of real model
    calls from one click. Flagging as a deliberate but unrequested safety choice, easy to change."
  - "Ran into a transient host-disk-full (ENOSPC) condition mid-verification that blocked every
    write-capable tool call, including the task tracker; resolved after the user cleared space.
    Not a code deviation, noting it since it interrupted the verification pass."
remaining:
  - "No visual mock was consulted — the task mentioned a linked preview in
    docs/SWARM_MIROFISH_MAP.md, but that file (as of this phase) contains no such link, and I
    judged the written spec (item 6) detailed enough to build from directly rather than stopping
    to ask for an artifact link that may not be findable. If the actual mock differs meaningfully
    in layout/interaction from what's here, treat this as a first pass to reconcile against it."
  - "No new tests were added for the new UI-adjacent files (SwarmSubModeTabs.tsx, MiroFishPanel.tsx,
    src/plugins/built-in/mirofish/plugin.ts) — the task's Scope section didn't list test
    requirements for Phase 3 the way Phase 1/2 did, so none were written. They were exercised via
    an ad hoc smoke test during verification (rendered both components, called the plugin
    module's exports against a mocked LLM boundary) but that test was scratch-only and was
    deleted afterward, per the task's constraints (no build/typecheck artifacts to leave behind).
    If Phase 3 needs durable coverage, that's a follow-up."
  - "MiroFishPanel has no persistence — refreshing the page loses the current WorldState and chat
    history, consistent with Phase 2's memory being run-scoped and Phase 3's constraint not to
    touch src/lib/db/."
  - "Report generation is exactly WorldState.roundSummaries rendered as a timeline, per the task's
    explicit instruction that Phase 2 already produces the report — no separate formatting/export
    (PDF, share link, etc.) was added, since none was asked for."
---

## What execution boundary I traced, and how MiroFishPanel mirrors it

Traced end-to-end, reading code rather than assuming: `src/lib/agents/mode-session-store.ts`
(a client-side zustand store — `createBrowserJSONStorage`, SSE subscriptions, no server context)
calls `executeAgentMode()` in `src/lib/agents/agent-mode-executor.ts`. For the `swarms` mode, that
function calls `createPluginInstance('swarms')` from `src/lib/plugins/index.ts`, which does
`definition.lazyImport()` — a dynamic `import('@/plugins/built-in/swarms/plugin')` — then calls
`plugin.execute(...)`. `SwarmsPlugin.execute` (`src/plugins/built-in/swarms/plugin.ts`) calls
`generateText`/`getLanguageModel`/`getDefaultPluginModel` **directly, in that same client process**
— there is no REST endpoint or server proxy wrapping those calls anywhere in this codebase (grepped
for one; none exists). This is true for every other built-in plugin and for `agent-mode-executor.ts`'s
own `docs`/`data` branches too — `@/lib/ai/providers`'s `generateText`/`getDefaultPluginModel` calls
are already, today, called from client-executed code throughout this app. (Whether `@ai-sdk/gateway`'s
own auth — it wants an `apiKey` or `AI_GATEWAY_API_KEY`, per its source — actually resolves cleanly
in a real browser session is a pre-existing property of the whole plugin system, identical for every
mode; not something this phase introduces, changes, or needed to resolve.)

The one concrete secret in this picture is `E2B_API_KEY`, read via `process.env.E2B_API_KEY` inside
`src/lib/sandbox/swarm/e2b-provider.ts` (Phase 1). `@/lib/mirofish` never imports that file — it
only reaches `local-provider.ts` + `scheduler.ts` + `types.ts` from the swarm tier — but the
swarm tier's own `index.ts` barrel does re-export `e2b-provider.ts`, so importing the barrel would
put it in the same module graph even if unused.

**What "mirror that exact execution path" means here, concretely:** the mechanism is *dynamic
import as the lazy-chunk boundary* — a plugin's real logic lives in a module that only the
lazy-loader ever statically imports; the caller (the composer, or here, the panel) only ever
reaches it through `import()`. I built:

- `src/plugins/built-in/mirofish/plugin.ts` — the **only** file that statically imports
  `@/lib/mirofish` (never `@/lib/sandbox/swarm`'s barrel — it imports `local-provider`/`scheduler`
  transitively through `@/lib/mirofish`'s own files, never `e2b-provider.ts`). It plays exactly the
  role `src/plugins/built-in/swarms/plugin.ts` plays for Specialist Team: the file where
  `generateText`/`getDefaultPluginModel` actually get called. It is *not* registered in
  `src/lib/plugins/index.ts`'s `PLUGINS` map and does not implement `ModePlugin` — that interface's
  single-shot `execute(input): Promise<output>` shape is built for the composer's one-prompt,
  one-artifact flow and doesn't fit a stateful Run + persona grid + follow-up-chat panel. Reusing
  the *bundling boundary* (dynamic import) without forcing an unrelated *lifecycle contract*
  (`ModePlugin`) onto a UI shape that doesn't need it was the deliberate choice here.
- `src/views/chat/panels/MiroFishPanel.tsx` reaches that module only via
  `await import('@/plugins/built-in/mirofish/plugin')` inside its `handleRun`/`handleAsk`
  callbacks — never a static import, and (per the deviations note above) not even a type-only
  import of `@/lib/mirofish` — every type is derived from `typeof import(...)` of the plugin
  module instead.

## Confirmation: "Specialist Team" is unchanged

`git diff --stat` against `src/plugins/built-in/swarms/plugin.ts` is empty — that file was never
opened for editing. In `ChatComposer.tsx`, the original
`{selectedModeId && <div className="w-full mt-8 pb-4"><TemplateGallery .../></div>}` block's
wrapper `div` and its props are untouched; the only change inside it is that `TemplateGallery` is
now one branch of a ternary (`selectedModeId === 'swarms' && selectedSwarmSubMode ===
'population-simulation' ? <MiroFishPanel /> : <TemplateGallery .../>`), with the exact same
`TemplateGallery` props as before. For every mode other than `swarms`, and for `swarms` in its
default `'specialist-team'` sub-mode (the default in `agent-surface-mode.store.ts`'s
`DEFAULT_SWARM_SUB_MODE`), that ternary always evaluates to the original `TemplateGallery` call,
byte-for-byte. A new sibling block (the `SwarmSubModeTabs` strip) was added *above* that div, and
only renders at all when `selectedModeId === 'swarms'` — it renders nothing for any other mode.
`AgentModeId`, `MODE_TABS`, `SURFACE_MODES`, and `CanonicalAgentModeId`/`AGENT_MODE_CONTRACTS` were
not touched (verified via `git diff` — empty for `ModeDock.tsx` and `agent-mode-contracts.ts`); the
only addition to `agent-surface-mode.store.ts` is the wholly separate `SwarmSubModeId` type and its
own `swarmSubModeBySurface` map/setter, following the existing `selectedModeBySurface`/
`setSelectedMode` pattern exactly.

Verified with tests, not just by reading: reran Phase 1/2's suites (`scheduler.test.ts`,
`memory-store.test.ts`, `simulation-engine.test.ts` — 20 tests, still all passing after this
phase's `mirofish/index.ts` addition) and an ad hoc smoke test (deleted afterward, per the
"no build artifacts" constraint) that rendered `SwarmSubModeTabs` and `MiroFishPanel`, confirmed
`SwarmSubModeTabs` fires `onSelectSubMode('population-simulation')` on click, confirmed the new
store field/setter work, and confirmed `src/plugins/built-in/mirofish/plugin.ts` exports
`runMiroFishSimulation`/`askMiroFishPersona` against a mocked `generateText`/`getDefaultPluginModel`
boundary — all passed.
