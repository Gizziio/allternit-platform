import ActivityKit
import Foundation

/// Shared between the main app target (which starts/updates/ends the
/// Activity from `BotLiveActivityManager`) and the `AllternitWidgets`
/// extension (which renders it) — both targets include this file directly
/// via `project.yml`'s `Core/LiveActivity` source path.
///
/// Unlike `LoopActivityAttributes`, this activity summarizes the dominant
/// bot operational state across all subscribed bots, so a user can glance
/// at the Dynamic Island to see whether any bot needs attention.
struct BotActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Canonical status raw value (`working`, `waiting_approval`, …).
        var status: String
        /// Human-readable sub-label, e.g. "Running" or "Waiting for approval".
        var activityLabel: String?
        /// Total pending approvals across all active bots (single-bot mode
        /// uses the bot's own count).
        var pendingApprovalsCount: Int
        /// Number of bots currently in a non-idle/non-offline state.
        var activeBotsCount: Int
        /// Number of bots that `needsAttention` (waiting_approval, blocked,
        /// failed, degraded).
        var attentionBotsCount: Int
        /// In single-bot mode, the display name of the pinned bot.
        var displayName: String?
    }

    /// Reserved for future variants (e.g., a pinned single-bot activity).
    /// Today the only supported value is `"summary"`.
    var mode: String
}
