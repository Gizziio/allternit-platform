ROLE
You are a senior full-stack engineer building the v0 “Capsule Shell + Kernel Contracts” for A2rchitech.
Do NOT refactor the repo. Do NOT redesign architecture. Implement only what’s needed for the entry-point flow.

GOAL
Ship an end-to-end skeleton where:
1) UI shell fetches frameworks from server.
2) UI dispatches intents to server.
3) Server returns events + artifacts + a CanvasSpec.
4) UI renders CanvasSpec and shows journal events.
All work is via contracts; UI never runs tools.

CONTEXT
We already have an apps skeleton:
- apps/shell: tab bar (capsules), command bar (intent), canvas renderer mount, journal pane
- apps/ui: simple canvas+view renderer
- apps/shared/contracts.ts: local TypeScript contracts used by shell

We need a minimal server (“kernel”) that implements HTTP endpoints; can be Node/Express/Fastify OR Rust/Axum.
Choose the fastest path consistent with repo conventions, but keep it minimal.

HARD INVARIANTS
- Capsules are runtime instances, not user-authored apps.
- Frameworks are templates that spawn capsules and default canvases.
- Journal is append-only events; artifacts are referenced by events.
- Dispatch response must include: events[], artifacts[] (or refs), and canvas spec.
- Tool execution is server-side only (stubbed/mocked is ok).
- Workspace_id is required everywhere (use ws_default for v0 if needed).

DELIVERABLES
A) Server endpoints:
1) GET /v1/workspaces/:ws/frameworks
   returns FrameworkSpec[] (include persistence policy: ephemeral|docked|pinned)
2) POST /v1/intent/dispatch
   request: { workspace_id, capsule_id?, intent_text, context_hints? }
   response: { capsule, events[], artifacts[], canvas }
3) GET /v1/journal/stream?workspace_id=...&capsule_id=...&limit=...
   returns { events[] }
4) GET /v1/artifacts/:artifact_id
   returns artifact content or artifact ref (v0 can inline JSON)

B) Update apps/shell to use server instead of local built-ins:
- On startup: fetch frameworks and populate registry
- On submit: POST dispatch; apply returned capsule + canvas; append events locally for UI display (until streaming is wired)
- Journal pane: either show local appended events or call /journal/stream every N seconds

C) Minimal data models:
- JournalEvent (id, ts, kind, payload, parents?)
- Artifact (id, type, uri?, hash?, content? for v0)
- CanvasSpec (canvasId, title, views[])
- ViewSpec typed by view.type with bindings and optional data
- CapsuleInstance (capsuleId, frameworkId, title, activeCanvasId, state)

IMPLEMENTATION NOTES
- Framework selection: v0 prefix-based (e.g., "search", "note", "home").
- For "search X": emit tool_call + tool_result and return an observe_capsule artifact.
- For "note X": emit note event and return notes canvas.
- For "home": return home canvas.

EVIDENCE REQUIREMENT
For any tool-like operation (search/web): return an artifact of type "observe_capsule" that contains structured evidence fields:
{ q, results: [{title,url,snippet}], generated_at, source:"mock" } in v0.

ACCEPTANCE CRITERIA (must pass)
1) Running shell + server:
   - typing "search cats" opens/activates a Search capsule tab and renders Search canvas
   - journal pane shows: intent → tool_call → tool_result → canvas_update
2) typing "note hello" opens Notes capsule and canvas shows a list or object view containing note content (from artifact or journal)
3) Frameworks endpoint must drive the available framework list (even if UI doesn’t render list yet)
4) Every dispatch returns events[] and a canvas; no dispatch returns “just text”
5) Workspace_id is required; server rejects missing with 400.

OUTPUT
Return:
- the server folder location and run commands
- the updated files list
- any new config required
- short instructions to run both UI + server

DO NOT
- add large dependencies
- change repo structure
- refactor crates/services
- invent new spec systems

Direction + handoff guide (no backend implementation)

What you’re building is a shell + kernel contract where the UI never “does work”; it requests work, then renders journal → artifacts → canvases. The agent-generated mini-apps are frameworks (templates) that spawn capsules (runtime instances) and declare default canvases, allowed intents, and tool scope.

⸻

0) Hard invariants (non-negotiable)
    1.    Capsules are runtime instances, not user-authored apps.
    2.    Frameworks spawn capsules and declare:
    •    allowed intents
    •    default canvases (view specs)
    •    tool scope / risk policy
    3.    The journal is the spine:
    •    append-only events
    •    artifacts referenced by events
    •    canvases are projections (never the source of truth)
    4.    Tools never run inside UI. UI requests work; kernel executes; UI renders receipts/evidence.

⸻

1) Minimal components to implement (v0 → v1)

A) Shell app (already exists as skeleton)

Responsibilities:
    •    Workspace selector (even if hardcoded default)
    •    Capsule tab bar: open/close/activate
    •    Canvas area: render CanvasSpec
    •    Command bar: send “intent” to kernel
    •    Journal pane: show events stream (or last N)

B) Kernel HTTP service (stub first, real later)

Responsibilities:
    •    Accept intent
    •    Select framework (routing can be naïve initially)
    •    Emit events + artifacts
    •    Return new/updated CanvasSpec(s)

C) Registry service (can be embedded into kernel initially)

Responsibilities:
    •    Serve FrameworkSpecs per workspace
    •    Version frameworks (so UI can cache)

D) Journal persistence (can be memory → sqlite → postgres)

Responsibilities:
    •    Append events
    •    Store artifacts or store URIs to artifacts
    •    Stream events per workspace + capsule

⸻

2) Contracts the coding agent must implement (exact payloads)

2.1 FrameworkSpec (server → shell)

GET /v1/workspaces/{ws}/frameworks

[
  {
    "frameworkId": "fwk_search",
    "title": "Search",
    "allowedIntents": ["search"],
    "maxToolScope": "read",
    "persistence": "docked",
    "defaultCanvases": [
      {
        "canvasId": "cnv_search",
        "title": "Search",
        "views": [
          { "viewId": "view_search", "type": "search_lens", "bindings": { "query": {} } }
        ]
      }
    ]
  }
]

Notes
    •    persistence: "ephemeral" | "docked" | "pinned" (Arc-style: pinned tabs = pinned capsules)
    •    defaultCanvases must be renderable without tool execution

⸻

2.2 Intent dispatch (shell → kernel)

POST /v1/intent/dispatch

{
  "workspace_id": "ws_default",
  "capsule_id": "cap_123",
  "intent_text": "search cats",
  "context_hints": {
    "active_canvas_id": "cnv_search",
    "cursor": null
  }
}

2.3 Dispatch response (kernel → shell)

{
  "capsule": {
    "capsuleId": "cap_123",
    "frameworkId": "fwk_search",
    "title": "Search: cats",
    "activeCanvasId": "cnv_search",
    "state": { "q": "cats" }
  },
  "events": [
    { "id":"evt_1","ts":1736460000000,"kind":"intent","payload":{"text":"search cats"} },
    { "id":"evt_2","ts":1736460000100,"kind":"tool_call","payload":{"tool_id":"web.search","args":{"q":"cats"}} },
    { "id":"evt_3","ts":1736460000300,"kind":"tool_result","payload":{"tool_id":"web.search","ok":true,"artifact_ids":["art_1"]} },
    { "id":"evt_4","ts":1736460000310,"kind":"canvas_update","payload":{"canvas_id":"cnv_search"} }
  ],
  "artifacts": [
    { "id":"art_1","type":"observe_capsule","uri":"ctx://artifacts/observe/art_1.json","hash":"sha256:..." }
  ],
  "canvas": {
    "canvasId":"cnv_search",
    "title":"Search",
    "views":[
      {
        "viewId":"view_search",
        "type":"search_lens",
        "bindings": { "query": { "q": "cats" } },
        "data": { "results_ref": "art_1" }
      }
    ]
  }
}

Critical: kernel always returns:
    •    append events
    •    artifacts (or artifact references)
    •    the canvas spec to render

⸻

3) Journal API (persistence boundary)

3.1 Append

POST /v1/journal/append

{ "workspace_id":"ws_default", "events":[ ... ] }

3.2 Stream / fetch

GET /v1/journal/stream?workspace_id=ws_default&capsule_id=cap_123&limit=200

{ "events":[ ... ] }

3.3 Artifacts

GET /v1/artifacts/{artifact_id}

{ "id":"art_1","type":"observe_capsule","content":{...}, "hash":"sha256:..." }


⸻

4) Framework execution model (how “agent-generated mini apps” works)

4.1 Routing (v0)
    •    parse intent prefix (search, note, home)
    •    choose framework

4.2 Routing (v1)

Replace prefix matching with:
    •    an agent router that outputs:
    •    frameworkId
    •    directive (typed)
    •    tool plan (declared tools + scope)

4.3 Framework runtime (v0)

Framework is just a template:
    •    creates capsule instance
    •    sets capsule state
    •    chooses canvas spec
    •    emits events

4.4 Framework runtime (v1)

Framework becomes:
    •    compile(intent, state) -> Directive
    •    execute(Directive) -> Events + Artifacts
    •    project(Events/Artifacts) -> CanvasSpec

That is the “agent generated mini-app” in deterministic form.

⸻

5) Tool system (stub now, real later)

5.1 Tool contract

Tool call must produce:
    •    tool_call event
    •    tool_result event
    •    at least one artifact when it touches external world (evidence)

5.2 Evidence artifacts (required for web use)
    •    ObserveCapsule: structured evidence snapshot(s) (URLs, DOM snippets, screenshots refs, extracted facts)
    •    ReplayCapsule (optional): steps timeline (clicks, selectors, timings)

5.3 Policy gates (v1)

Before any write/exec tool:
    •    kernel returns “Action Preview” object
    •    UI must confirm
    •    kernel emits consent receipt

⸻

6) Workspaces + dock/pin (how it maps to the UI metaphor)
    •    Workspace = a namespace for:
    •    journal stream
    •    capsule set
    •    framework list
    •    policy profile
    •    Docked capsule = persists across sessions in that workspace
    •    Pinned capsule = docked + promoted to top (always visible)

This is the “Arc spaces / pinned tabs” mapping, but for capsules.

⸻

7) “What’s next” after the three basics work

Once shell can:
    •    fetch frameworks
    •    dispatch intent
    •    render canvas
    •    show journal events

Then build:
    1.    Canvas view taxonomy expansion
    •    timeline view
    •    provenance view
    •    diff view
    •    workflow view
    2.    Directive compiler boundary
    •    schema validated directive objects
    3.    Agent router
    •    outputs frameworkId + directive + tool plan
    4.    Observe/Replay for web use
    •    tool produces evidence artifacts
    5.    Distillation
    •    distillate artifacts (compressed outputs) generated from events/artifacts

⸻

8) Handoff “Build Order” checklist for the coding agent

(stubbed kernel)
    •    Implement /v1/workspaces/{ws}/frameworks
    •    Implement /v1/intent/dispatch that:
    •    selects framework
    •    emits events
    •    returns CanvasSpec
    •    Implement /v1/journal/stream (in memory ok)
    •    Wire shell to those endpoints

(persistence + evidence)
    •    Replace in-memory journal with sqlite/postgres
    •    Implement /v1/artifacts/{id} storage
    •    Add ObserveCapsule artifact format for “search” mock

(agent routing)
    •    Replace prefix router with agent router output contract
    •    Add directive schema + validation

⸻
