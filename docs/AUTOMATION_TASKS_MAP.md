# Automation Tasks (iOS) — Map

Source: `docs/SURFACE_AUDIT_FINAL_REPORT.md`, "Automation Tasks (Goals/Routines/Loops/Cron)" — classified `GAP`, tier-a. Also referenced by three related rows scoped separately in the tracker: Cowork Cron view, Intelli-Schedule panel, Code's Automation Tasks row (same underlying feature, different entry points — this build satisfies all of them).

## Verified: this one IS genuinely greenfield on iOS

Unlike Device Pairing, a broad grep of `surfaces/allternit-mobile/ios/{Features,Core}` for goal/routine/loop/cron/automation/schedule turned up zero real hits — every match is an unrelated false positive (prose copy, or the ACI computer-use agent's unrelated "goal" instruction concept). No client, no models, no feature folder. The audit's claim holds here.

## Backend — four distinct systems, richer than the audit's one-line description implies

All mounted on gizzi-code's own server under `/v1` (`cmd/gizzi-code/src/runtime/server/server.ts:463-464`), same base as the pty/permission routes iOS already talks to (`AppConfig.gizziCodeBaseURL`):

- **`/v1/cron`** (`routes/cron.ts`) — time-scheduled jobs. `GET /status`, `GET/POST /jobs`, `GET/PUT/DELETE /jobs/:id`, `POST /jobs/:id/pause`, `POST /jobs/:id/resume`, `POST /jobs/:id/run` (manual trigger), `GET /jobs/:id/runs`, `GET /runs`, `GET /runs/:id`.
- **`/v1/automations`** (`routes/automations.ts`) — Routines (named step sequences, CRUD + run, lines 104-225), Loops (repeating command + exit condition, CRUD + run, 228-344), Goals (objective-driven autonomous work with budgets/milestones, CRUD + queue/pause/reorder/continuations, 347-583).

**Data model** (`cmd/gizzi-code/src/runtime/automation/cron/types.ts:63-155`): a cron job is a discriminated union by `type` — `shell | http | agent | cowork | function`, each with its own `config` shape. `BaseJob` common fields: `id, name, description?, type, status (active|paused|disabled|error), schedule (CronSchedule{expression,timezone?} | IntervalSchedule{seconds,startAt?}), createdAt, updatedAt, lastRunAt?, nextRunAt?, maxRuns?, runCount, failCount, timeoutSeconds?, maxRetries?, retryDelaySeconds?, scope? ("session"=loop, "persistent"=scheduled), tags, metadata`. Run records (`CronRun`, lines 160-188): `id, jobId, status (pending|running|success|failed|cancelled|timeout), scheduledAt, startedAt?, finishedAt?, durationMs?, output?, error?, triggeredBy`.

## Web reference — bigger surface than "one screen"

`surfaces/ai.allternit.com/src/components/agents/context-strip/AutomationDrawer.tsx` (748 lines): three tabs (Scheduled / History / Config), full create/edit/delete/pause/resume + run history, via `lib/agents/scheduled-jobs.service.ts`. A *second*, separate client (`lib/automation-api.ts`) covers goals/routines/loops specifically. Web genuinely has two parallel automation surfaces, not one.

## iOS conventions to reuse

- **List/detail UI pattern**: `Features/Projects/Views/ProjectsListView.swift` + `ProjectDetailView.swift` — closest existing precedent (list → tap → detail, single client, full CRUD). Copy this structure, not `ProjectsClient`'s networking (see below).
- **Client shape**: must follow `PtyClient`/`PermissionClient` (`AppConfig.gizziCodeBaseURL` direct), **not** `ProjectsClient` (`APIClient.shared`/relay — that talks to `allternit-api`, a different backend entirely). Cron/automations live on the gizzi-code server, same as permission/pty.

## Phase 1 scope decision

Full Goals+Routines+Loops+Cron in one pass is too large for one reviewable diff. Phase 1 = **Cron jobs only** (the audit's most literal "scheduled/recurring agent work" ask, and the one with the cleanest single-concept API): list, detail (status/schedule/run history), pause/resume/delete/run-now, and creation limited to `type: "agent"` jobs only (prompt + schedule — the most natural mobile-authored job type; shell/http/cowork/function creation deferred). Routines/Loops/Goals become Phase 2/3, tracked separately in `docs/SURFACE_AUDIT_PROGRESS.md`.
