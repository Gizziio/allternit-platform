# Code Mode reference gap plan

This plan compares Allternit Code Mode and Gizzi Code with the product concepts in
`claude-code-best/claude-code`. It is an independent implementation plan; source
from the reference repository should not be copied.

## Product model

Code Mode should expose one understandable hierarchy:

1. A **goal** is the durable objective and completion contract.
2. A goal contains one or more **runs** (initial execution and continuations).
3. A run contains ordered or parallel **phases** and **agent tasks**.
4. Tasks emit **events**, request **approvals**, and create **artifacts**.
5. **Evidence** (checks, diffs, screenshots, receipts) determines whether the goal
   is complete or blocked.

Goals, runs, workflows, traces, routines, loops, sessions, and artifacts currently
use overlapping state models. New UI should adapt those models to this hierarchy
instead of introducing another unrelated execution store.

## Detailed gaps

| Capability | Current state | Target |
| --- | --- | --- |
| Persistent goals | Platform goal CRUD plus a separate simulated Gizzi engine | Durable objective, budget, milestones, pause/resume, continuation, complete/blocked audit |
| Workflow monitor | Multiple run, DAG, trace, swarm, and orchestration views; Gizzi `/workflows` is a shim | One live run inspector with phase tree, parallel lanes, agent state, event stream, and retry controls |
| Artifacts | Basic Markdown viewer tied to a legacy Gemini path; execution events expose some artifacts | Session artifact drawer supporting files, Markdown, HTML, images, JSON, diffs, provenance, and retention |
| Provider setup | Broad adapter support with fragmented configuration surfaces | Guided provider connection, capability matrix, model mapping, connection test, balance and rate-limit state |
| Peer collaboration | Swarm and agent infrastructure exists; no cohesive peer inbox/pipes UX | Discover peers, send or broadcast messages, inspect ownership, foreground a task, handle disconnects |
| Efficiency controls | Feature flags exist but are developer-facing | User-facing efficiency profiles controlling model tier, concurrency, memory extraction, suggestions, and budget |
| Context visibility | Context card, context view, memory, and token estimation are separate | Context ledger showing sources, token weight, compaction history, pinned items, and removable items |
| Session recovery | Several resume and remote-session mechanisms | Recovery center for interrupted local/remote runs, stale approvals, unsent input, and reconnect state |
| Permission UX | Permission infrastructure is substantial | Persistent approval inbox with risk explanation, scope, expiry, and approve-once/session/project choices |
| Learning mode | Skills and Labs exist separately | “Explain this run” and guided architecture learning using actual trace/artifact context |
| Observability | Logs, traces, usage, receipts, and dashboards are fragmented | A run timeline correlating prompts, tools, agents, cost, latency, errors, and artifacts |
| Remote control | Remote transport and permission bridge exist | Platform pairing flow, device/session list, QR link, connection health, and remote input ownership |
| Feature discovery | Large command and drawer surface | Searchable command palette with availability, required setup, shortcuts, and progressive disclosure |
| Reliability | Placeholder/simulated paths coexist with production paths | Explicit capability status: live, degraded, simulated, unavailable; never present simulated success as evidence |

## Delivery phases

### Phase 1 — execution contract

- Introduce a shared UI `GoalRun` adapter without immediately migrating storage.
- Build Code Mode Goal Control with objective, progress, token budget, milestones,
  validation summary, pause/resume, blocked, and complete actions.
- Normalize display states while preserving backend-specific states.
- Add connection and degraded-state handling.

### Phase 2 — run inspector

- Merge the useful portions of Executions, Agents, DAG, Trace, and Swarm into a
  single inspector.
- Show tree and timeline presentations of the same run data.
- Make approvals, errors, retries, and agent ownership actionable.

### Phase 3 — artifacts and evidence

- Define a canonical artifact descriptor and provenance contract.
- Add previews and connect artifacts to run events and completion evidence.
- Replace the legacy Gemini artifact directory assumption in Gizzi Code.

### Phase 4 — durable engine

- Replace the simulated Gizzi `GoalEngine` with orchestration-driven execution.
- Persist budgets, attempts, continuation audit, blocked reason, and evidence.
- Add migrations only after the shared contract is agreed and existing user data
  can be migrated safely.

### Phase 5 — onboarding and operations

- Provider onboarding and connection diagnostics.
- Efficiency profiles and cost guardrails.
- Peer/pipes collaboration and remote-control pairing.
- Context ledger, session recovery, and learning mode.

## First implementation slice

`GoalControlCenter` is the first compatibility slice. It uses the existing platform
goal API and stores the richer run contract inside goal metadata, so the UI can be
used before Gizzi storage migrations are introduced. The next slice should add a
backend adapter that maps Gizzi automation goals to the same view model and exposes
real continuation actions.

## Implementation status

- [x] Code Mode Goal Control Center with platform/Gizzi API compatibility.
- [x] Explicit goal start, pause, resume, block, and complete lifecycle actions.
- [x] Gizzi `/goal` persistence and lifecycle subcommands.
- [x] Removal of simulated validation success from the Gizzi goal engine.
- [x] Milestone and validation-evidence publishing endpoints.
- [x] Milestone-derived progress and guarded completion audit.
- [x] Live Code Mode goal refresh with actionable backend errors.
- [x] Unified Run Inspector for executions, task graph, agents, timeline, and evidence.
- [x] Canonical artifact descriptor and artifact drawer with run/receipt provenance.
- [x] Consolidated execution navigation; DAG, agent, and trace details live in Run Inspector.
- [ ] Storage migration for token budgets, continuation audits, and blocked reasons.
- [ ] Automatic orchestrator callback that invokes the implemented milestone and validation endpoints.
- [ ] Provider onboarding, efficiency profiles, peer messaging, and remote pairing.

The unchecked work requires broader backend contracts or product decisions and is
intentionally not represented as functional UI until those controls can affect real
runtime behavior.
