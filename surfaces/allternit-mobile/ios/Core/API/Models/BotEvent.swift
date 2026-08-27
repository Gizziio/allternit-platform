import Foundation

// -----------------------------------------------------------------------------
// BotEvent — one row of the server-owned bot event ledger (`bot_events`
// table, migration cmd/allternit-api/migrations/V92__bot_events.sql), as
// serialized by `GET /api/v1/bots/:id/events`
// (cmd/allternit-api/src/bot_event_routes.rs — `BotEventView` /
// `ActivityPageView`, both `#[serde(rename_all = "camelCase")]`).
//
// The web contract this mirrors is `ActivityEvent` / `ActivityPage`
// (surfaces/ai.allternit.com/src/lib/bots/bot-activity-api.ts): events are
// listed ascending by the per-bot `sequence`, which doubles as the
// pagination cursor (`after_sequence`, exposed as `nextCursor`).
//
// Event types are the goal/plan/task/attempt/validation/delegation taxonomy
// from surfaces/ai.allternit.com/src/lib/bots/goal-task-contracts.ts:636-687
// (e.g. `goal.created`, `task.running`, `task.waiting_for_approval`,
// `attempt.started`) plus `loop.snapshot`
// (surfaces/ai.allternit.com/src/lib/bots/bot-event-store.ts:31).
// -----------------------------------------------------------------------------

/// A single ledger event for one bot.
struct BotEvent: Decodable, Sendable, Identifiable {
    let id: String
    /// Per-bot monotonic sequence assigned at insert (bot_event_routes.rs
    /// `append_event`); also the pagination cursor.
    let sequence: Int
    let botId: String
    let sessionId: String?
    let goalId: String?
    let wihId: String?
    let taskId: String?
    let runId: String?
    let eventType: String
    let actor: Actor
    /// Arbitrary JSON object. The server validates payloads as JSON on
    /// insert and degrades a corrupt row to `null` on read
    /// (`StoredBotEvent::into_view`), so a non-object payload decodes as
    /// empty rather than failing the page.
    let payload: [String: JSONValue]
    /// RFC3339 (chrono `to_rfc3339()` — fractional seconds optional).
    let occurredAt: String

    struct Actor: Decodable, Sendable {
        let type: String
        let id: String
    }

    enum CodingKeys: String, CodingKey {
        case id, sequence, botId, sessionId, goalId, wihId, taskId, runId
        case eventType, actor, payload, occurredAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        sequence = (try? container.decode(Int.self, forKey: .sequence)) ?? 0
        botId = (try? container.decode(String.self, forKey: .botId)) ?? ""
        sessionId = try container.decodeIfPresent(String.self, forKey: .sessionId)
        goalId = try container.decodeIfPresent(String.self, forKey: .goalId)
        wihId = try container.decodeIfPresent(String.self, forKey: .wihId)
        taskId = try container.decodeIfPresent(String.self, forKey: .taskId)
        runId = try container.decodeIfPresent(String.self, forKey: .runId)
        eventType = (try? container.decode(String.self, forKey: .eventType)) ?? ""
        actor = (try? container.decode(Actor.self, forKey: .actor))
            ?? Actor(type: "unknown", id: "unknown")
        payload = (try? container.decodeIfPresent([String: JSONValue].self, forKey: .payload)) ?? [:]
        occurredAt = (try? container.decode(String.self, forKey: .occurredAt)) ?? ""
    }

    /// Parsed `occurredAt`, tolerating chrono's omitted fractional seconds
    /// (same posture as AgentRunEvent.parseTimestamp).
    var occurredAtDate: Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: occurredAt) { return date }
        return ISO8601DateFormatter().date(from: occurredAt)
    }

    /// The taxonomy prefix before the first dot (`task` in `task.running`).
    private var typePrefix: String.SubSequence {
        eventType.split(separator: ".", maxSplits: 1).first ?? ""
    }

    /// Feed label, grouped by the event-type prefix
    /// (goal-task-contracts.ts:636-687): `<Group> <action>` with snake_case
    /// actions humanized (`task.waiting_for_approval` → "Task waiting for
    /// approval"). Unknown prefixes keep the raw type, same posture as
    /// `AgentRunEvent.unknown`.
    var label: String {
        let group: String
        switch typePrefix {
        case "goal": group = "Goal"
        case "plan": group = "Plan"
        case "task": group = "Task"
        case "attempt": group = "Attempt"
        case "validation": group = "Validation"
        case "delegation": group = "Delegation"
        case "loop": group = "Loop"
        default: return eventType
        }
        guard let dot = eventType.firstIndex(of: ".") else { return eventType }
        let action = eventType[eventType.index(after: dot)...]
            .replacingOccurrences(of: "_", with: " ")
        return "\(group) \(action)"
    }

    /// SF Symbol for the feed row, grouped like `label`.
    var iconName: String {
        switch typePrefix {
        case "goal": return "target"
        case "plan": return "list.bullet"
        case "task": return "checkmark.circle"
        case "attempt": return "arrow.clockwise"
        case "validation": return "checkmark.shield"
        case "delegation": return "person.2"
        case "loop": return "repeat"
        default: return "bolt"
        }
    }
}

/// Cursor page from `GET /api/v1/bots/:id/events` (`ActivityPageView`).
/// `events` is ascending by `sequence`; `nextCursor` is present only when
/// `hasMore` and is the last returned event's sequence as a string.
struct BotEventPage: Decodable, Sendable {
    let events: [BotEvent]
    let nextCursor: String?
    let hasMore: Bool
}
