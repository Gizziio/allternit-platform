import Foundation

// -----------------------------------------------------------------------------
// Routine REST models — base path `v1/automations` on gizzi-code's own server
// (`cmd/gizzi-code/src/runtime/server/server.ts:367,455`), same host as
// CronClient/PtyClient/PermissionClient, NOT `allternit-api`.
//
// Mirrors the row shape built in the POST insert
// (`cmd/gizzi-code/src/runtime/server/routes/automations.ts:139-150`). Unlike
// CronJob's camelCase wire (a hand-serialized TS object with defined field
// names), the routine row's JS object literal keys are snake_case as written
// (`agent_id`, `time_created`, `time_updated`), so explicit `CodingKeys` map
// them — no snake-case global decoding strategy is applied.
//
// Timestamps are `Date.now()` ms-epoch numbers (automations.ts:147-148), NOT
// ISO strings like cron's `createdAt`/`updatedAt` — decoded as `Double` and
// converted with `Date(timeIntervalSince1970: ms / 1000)` at render time.
// -----------------------------------------------------------------------------

/// One step of a routine (`RoutineCreateSchema.steps`, automations.ts:19):
/// a shell command plus its execution status. `RoutineEngine.startRoutine`
/// (routine-engine.ts:26-46) drives status through
/// pending -> running -> done|failed as it runs steps sequentially.
struct RoutineStep: Codable, Sendable, Hashable {
    let command: String
    let status: String
}

/// A routine row (insert shape, automations.ts:139-150). `state` moves
/// defined -> running -> completed|failed (routine-engine.ts:12,64-74) — set
/// server-side only, via `POST .../run`; there's no dedicated pause/resume
/// endpoint like cron's.
struct Routine: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let agentId: String?
    let name: String
    let steps: [RoutineStep]
    let trigger: String?
    let schedule: String?
    let state: String
    let timeCreated: Double
    let timeUpdated: Double

    private enum CodingKeys: String, CodingKey {
        case id, name, steps, trigger, schedule, state
        case agentId = "agent_id"
        case timeCreated = "time_created"
        case timeUpdated = "time_updated"
    }
}

/// Body of `POST v1/automations/routines` (`RoutineCreateSchema`,
/// automations.ts:15-22, narrowed to what `CreateRoutineSheet` collects —
/// `id`/`agent_id` are left server-generated/unset).
struct CreateRoutineRequest: Encodable, Sendable {
    let name: String
    let steps: [RoutineStep]
    let trigger: String?
    let schedule: String?
}
