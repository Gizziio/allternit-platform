# Steering checkpoint

## Goal

HEAD
Automation Tasks (iOS) Phase 3: build Loops as an iOS sibling surface to the
already-shipped Phase 1 cron and Phase 2 routines implementations, backed by
the already-existing `v1/automations/loops` backend (no backend changes).
Spec: `docs/AUTOMATION_TASKS_PHASE_3_TASK.md`.

## Just did

- Read the full backend route handlers (`cmd/gizzi-code/src/runtime/server/
  routes/automations.ts:228-344`) and the entire `loop-engine.ts` to confirm
  exact wire shapes — in particular the `iteration_log` element shape
  (`LoopLogEntry`) — before writing any Swift, same discipline as Phase 2.
- Confirmed the task spec's called-out backend differences from Routines by
  reading the code directly: loops start running immediately on creation
  (`LoopEngine.startLoop` called inline in the POST handler, row's initial
  `state` is `"running"` not `"defined"`), and `iteration_log` elements are
  camelCase (`LoopLogEntry` is a plain TS interface, not a drizzle column)
  while the loop row's own top-level fields are snake_case like Routine's.
- Built the Loops equivalents of every Phase 2 routine file, as siblings:
  - `Core/API/Models/Loop.swift` — `LoopIteration` (`Decodable`, camelCase
    wire, no `CodingKeys` needed), `Loop` (`Decodable` only, matching
    `Routine`'s decode-only convention, explicit snake_case `CodingKeys`),
    `CreateLoopRequest` (`Encodable`, needs `CodingKeys` since
    `exit_condition`/`max_iterations` genuinely diverge from Swift naming,
    unlike Routine's create body).
  - `Core/API/LoopsClient.swift` — mirrors `RoutinesClient` exactly; only
    implements endpoints actually used (`listLoops`, `createLoop`,
    `runLoop`, `deleteLoop`) — no `PUT`/update, nothing in scope calls it.
  - `Core/LoopStore.swift` — same `ObservableObject`/`@Published`
    fetch-if-needed/refresh/mutate-then-refresh pattern as `RoutineStore`.
  - `Features/Automation/Views/LoopsListView.swift`, `LoopDetailView.swift`,
    `CreateLoopSheet.swift` — mirror the Routines views with the spec'd
    differences: create form's required field is `command` (monospaced),
    `max_iterations` is a `Stepper` (1...100, default 10) not free text, no
    "Run Now" at creation (loop already running), and the detail view's
    Restart action is disabled + relabeled "Running…" while `state ==
    "running"`. Iteration log replaces the step list, each entry expandable
    to show full output (mirrors Phase 1's cron run-row expand pattern).
- Wired nav: added `AutomationKind.loops` as a third case
  (`Core/AppMode.swift`) and a `.loops` branch in `ChatView.swift`'s switch.
  Verified — by reading the actual code, not assuming — that both existing
  pickers in `AutomationTasksListView.swift`/`RoutinesListView.swift` already
  iterate `ForEach(AutomationKind.allCases...)` generically, so they picked
  up the third segment with zero picker-code changes; only touched their
  doc comments (stale "Cron/Routines" -> "Cron/Routines/Loops").
- Verified: `swift -frontend -parse` clean on all 10 touched files (6 new, 4
  modified). No Xcode build/simulator run or live-server QA, per task
  constraints — response shapes verified by reading source only.
- Wrote deliverable `docs/AUTOMATION_TASKS_PHASE_3_NOTES.md` (frontmatter +
  prose), including the exact `iteration_log`/`LoopLogEntry` shape found and
  how it was modeled.
- Rewrote `.steering/checkpoint.md`/`spec.md` for this phase proactively
  (not waiting for a steering flag this time — staleness was called out as
  a recurring gap after Phase 2).Implement the memory agent bulk / fast ingest mode (spec:
`.pipeline/builds/memory-bulk-fast-ingest-TASK.md`, source spec
`.pipeline/queue/memory-bulk-fast-ingest.md`): when `POST /api/ingest` carries
`metadata.mode: "bulk"`, skip LLM enrichment, store the memory with raw content,
and keep it searchable; normal ingest pipeline remains unchanged; metadata
(source, trust_tier, provenance_ref) is preserved.

## Just did

- Implemented bulk mode in `services/memory/agent/src/ingest-agent.ts`:
  detects `metadata.mode === "bulk"`, sets summary to the first 500 characters
  of content, entities/topics to empty arrays, importance to `"medium"`, and
  bypasses `summarize`/`extractEntities`/`assessImportance`.
- Threaded `metadata` through the ingest path:
  - `http-server.ts` `/api/ingest` and `/api/ingest/bulk` forward metadata.
  - `orchestrator.ingest()` accepts optional `metadata` and passes it to the
    ingest agent.
- Extended `IngestResult` with `memory?: Memory` so `http-server.ts` can add
  successfully ingested memories to the in-memory vector index (fixes the
  pre-existing condition where `/api/vector/search` had no indexed memories).
- Added `services/memory/agent/src/ingest-agent.test.ts` covering R1–R5 with
  a mocked `LocalModelManager` and real `MemoryStore`.
- Fixed pre-existing `local-model.test.ts` embedding assertion that broke
  because a real Ollama server is running; the test now stubs `VectorStore.embed`
  and still verifies embeddings do not hit the MLX endpoint.
- Rebuilt `better-sqlite3` native bindings for Node v24 and ran verification
  with Node v24 (`/opt/homebrew/opt/node@24/bin`); default shell Node v26 cannot
  load or compile the binding.
- Wrote `docs/BUILD_MEMORY_BULK_FAST_INGEST_NOTES.md` and touched the sentinel.
>>>>>>> origin/ao/build-memory-bulk-fast-ingest

## Files changed

HEAD
- `surfaces/allternit-mobile/ios/Core/API/Models/Loop.swift` (new)
- `surfaces/allternit-mobile/ios/Core/API/LoopsClient.swift` (new)
- `surfaces/allternit-mobile/ios/Core/LoopStore.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/LoopsListView.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/LoopDetailView.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/CreateLoopSheet.swift` (new)
- `surfaces/allternit-mobile/ios/Core/AppMode.swift`
- `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift`
- `surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTasksListView.swift` (doc comment only)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/RoutinesListView.swift` (doc comment only)
- `docs/AUTOMATION_TASKS_PHASE_3_NOTES.md` (new, deliverable)
- `.steering/checkpoint.md`, `.steering/spec.md` (this update)Prescribed commit:
`git add -A && git commit -m "build(memory-bulk-fast-ingest): bulk/fast ingest mode for memory agent"`.
Fix and retry if the gate blocks.
>>>>>>> origin/ao/build-memory-bulk-fast-ingest

## Known follow-ups

- No Xcode build/simulator run performed (excluded by task constraints).
- No manual QA against a running gizzi-code server.
- No git operations performed (no commit/push/PR) — per task constraints,
  the orchestrator handles that after review.
- Goals (Phase 4) remains untouched, as scoped.
