import SwiftUI

// -----------------------------------------------------------------------------
// BotOperationalState — canonical per-bot runtime status projection.
//
// Ported from the web contracts:
//   surfaces/ai.allternit.com/src/lib/bots/orpc-contracts.ts:91-117
//     (BotOperationalStatusSchema / BotOperationalStateSchema)
//   surfaces/ai.allternit.com/src/lib/bots/bot-operational-state.store.ts:52-73
//     (STATUS_PRECEDENCE + dominantStatus)
//
// The server-owned projection endpoint `GET /api/v1/bots/:id/operational-state`
// (cmd/allternit-api/src/bot_event_routes.rs) returns exactly this shape;
// BotStatusStore (Core/BotStatusStore.swift) snapshots from it on subscribe and
// keeps it live via the `GET /api/v1/agents/:id/events` SSE stream
// (cmd/allternit-api/src/agent_routes.rs:84-138).
// -----------------------------------------------------------------------------

/// Canonical bot operational status (orpc-contracts.ts:91-101).
///
/// | Status           | Meaning                                                   |
/// |------------------|-----------------------------------------------------------|
/// | idle             | No active session, run, or pending approval               |
/// | working          | Executing a goal, task, or run                            |
/// | waitingInput     | Paused — needs a user message to continue                 |
/// | waitingApproval  | Paused — needs an approval to proceed                     |
/// | blocked          | Blocked by a repeated blocker; manual intervention needed |
/// | offline          | Bot daemon is unreachable or not registered               |
/// | degraded         | Partially functional (connector/computer issue)           |
/// | failed           | Terminal failure in the last run                          |
/// | completed        | Last run/goal finished successfully                       |
enum BotOperationalStatus: String, Codable, CaseIterable, Sendable {
    case idle
    case working
    case waitingInput = "waiting_input"
    case waitingApproval = "waiting_approval"
    case blocked
    case offline
    case degraded
    case failed
    case completed

    /// Ranking for merging simultaneous status signals
    /// (bot-operational-state.store.ts:52-63):
    /// waiting_approval > blocked > failed > working > waiting_input
    ///   > degraded > completed > idle > offline
    var precedence: Int {
        switch self {
        case .waitingApproval: return 8
        case .blocked: return 7
        case .failed: return 6
        case .working: return 5
        case .waitingInput: return 4
        case .degraded: return 3
        case .completed: return 2
        case .idle: return 1
        case .offline: return 0
        }
    }

    /// The higher-precedence of two statuses (web `dominantStatus`).
    static func dominant(_ a: BotOperationalStatus, _ b: BotOperationalStatus) -> BotOperationalStatus {
        a.precedence >= b.precedence ? a : b
    }

    /// Web `isWorking` selector: actively executing, or paused mid-run
    /// waiting on the user (bot-operational-state.store.ts:371-374).
    var isWorking: Bool {
        self == .working || self == .waitingInput
    }

    /// Web `needsAttention` selector (bot-operational-state.store.ts:376-384).
    var needsAttention: Bool {
        switch self {
        case .waitingApproval, .blocked, .failed, .degraded:
            return true
        default:
            return false
        }
    }

    /// Status-pill label (UI).
    var label: String {
        switch self {
        case .idle: return "Idle"
        case .working: return "Working"
        case .waitingInput: return "Needs input"
        case .waitingApproval: return "Needs approval"
        case .blocked: return "Blocked"
        case .offline: return "Offline"
        case .degraded: return "Degraded"
        case .failed: return "Failed"
        case .completed: return "Completed"
        }
    }

    /// Status-pill color (UI). The three attention statuses share the warning
    /// hue except `failed`, which is the error hue; working is the accent,
    /// completed/idle are success/neutral, offline is dimmed.
    var color: Color {
        switch self {
        case .working: return Color("AccentPrimary")
        case .completed, .idle: return Theme.statusSuccess
        case .waitingInput, .waitingApproval, .blocked, .degraded: return Theme.statusWarning
        case .failed: return Theme.statusError
        case .offline: return Color("TextSecondary").opacity(0.6)
        }
    }
}

/// Full server-owned operational projection of one bot
/// (orpc-contracts.ts:103-117). All fields decode tolerantly — the web
/// zod-defaults counts to 0 and `computerState` to "none"; unknown `status`
/// strings fall back to `idle` rather than failing the decode.
struct BotOperationalState: Codable, Sendable, Equatable {
    var status: BotOperationalStatus
    var activeSessionId: String?
    var activeRunId: String?
    var activeGoalId: String?
    var activeTaskId: String?
    var activeWihId: String?
    var activityLabel: String?
    var pendingApprovalsCount: Int
    var unreadMessagesCount: Int
    var computerState: ComputerState
    var nextRoutineRunAt: String?
    var lastEventSequence: Int
    var updatedAt: String

    /// `computerState` enum (orpc-contracts.ts:113).
    enum ComputerState: String, Codable, CaseIterable, Sendable {
        case none, provisioning, running, takeover, sleeping, terminated
    }

    enum CodingKeys: String, CodingKey {
        case status
        case activeSessionId = "activeSessionId"
        case activeRunId = "activeRunId"
        case activeGoalId = "activeGoalId"
        case activeTaskId = "activeTaskId"
        case activeWihId = "activeWihId"
        case activityLabel = "activityLabel"
        case pendingApprovalsCount = "pendingApprovalsCount"
        case unreadMessagesCount = "unreadMessagesCount"
        case computerState = "computerState"
        case nextRoutineRunAt = "nextRoutineRunAt"
        case lastEventSequence = "lastEventSequence"
        case updatedAt = "updatedAt"
    }

    /// Neutral starting projection — mirrors the web `defaultOperationalState`
    /// except for `status`: the web defaults to `offline` because an unfetched
    /// bot's daemon reachability is unknown; iOS seeds entries only for bots
    /// that exist in the registry, so `idle` is the honest neutral.
    init(status: BotOperationalStatus = .idle,
         activeSessionId: String? = nil,
         activeRunId: String? = nil,
         activeGoalId: String? = nil,
         activeTaskId: String? = nil,
         activeWihId: String? = nil,
         activityLabel: String? = nil,
         pendingApprovalsCount: Int = 0,
         unreadMessagesCount: Int = 0,
         computerState: ComputerState = .none,
         nextRoutineRunAt: String? = nil,
         lastEventSequence: Int = 0,
         updatedAt: String = "") {
        self.status = status
        self.activeSessionId = activeSessionId
        self.activeRunId = activeRunId
        self.activeGoalId = activeGoalId
        self.activeTaskId = activeTaskId
        self.activeWihId = activeWihId
        self.activityLabel = activityLabel
        self.pendingApprovalsCount = pendingApprovalsCount
        self.unreadMessagesCount = unreadMessagesCount
        self.computerState = computerState
        self.nextRoutineRunAt = nextRoutineRunAt
        self.lastEventSequence = lastEventSequence
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = (try? container.decode(BotOperationalStatus.self, forKey: .status)) ?? .idle
        activeSessionId = try container.decodeIfPresent(String.self, forKey: .activeSessionId)
        activeRunId = try container.decodeIfPresent(String.self, forKey: .activeRunId)
        activeGoalId = try container.decodeIfPresent(String.self, forKey: .activeGoalId)
        activeTaskId = try container.decodeIfPresent(String.self, forKey: .activeTaskId)
        activeWihId = try container.decodeIfPresent(String.self, forKey: .activeWihId)
        activityLabel = try container.decodeIfPresent(String.self, forKey: .activityLabel)
        pendingApprovalsCount = (try? container.decode(Int.self, forKey: .pendingApprovalsCount)) ?? 0
        unreadMessagesCount = (try? container.decode(Int.self, forKey: .unreadMessagesCount)) ?? 0
        computerState = (try? container.decode(ComputerState.self, forKey: .computerState)) ?? .none
        nextRoutineRunAt = try container.decodeIfPresent(String.self, forKey: .nextRoutineRunAt)
        lastEventSequence = (try? container.decode(Int.self, forKey: .lastEventSequence)) ?? 0
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
    }
}
