import ActivityKit
import Foundation

/// Shared between the main app target (which starts/updates/ends the
/// Activity from `LoopLiveActivityManager`) and the `AllternitWidgets`
/// extension (which renders it) — both targets include this file directly
/// (see `project.yml`'s `Core/LiveActivity` source path on each), since
/// `ActivityAttributes` conformances have to be visible to both sides.
///
/// Gap 4 (Live Activities): unlike push notifications, starting/updating/
/// ending a *local* (non-push-backed) Live Activity needs no Apple
/// Developer signing team or server plumbing — just `NSSupportsLiveActivities`
/// in Info.plist (added) — so this one is actually end-to-end real and
/// testable in the simulator, unlike Gap 3.
struct LoopActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var iterationsCompleted: Int
        var maxIterations: Int
        /// Mirrors `Loop.state` (running/succeeded/max_iterations/…) so the
        /// widget can reuse the same status-color mapping as
        /// `LoopsListView.statusColor(_:)` without importing the app's view
        /// layer.
        var state: String
    }

    /// Loop id — lets `LoopLiveActivityManager` find the right running
    /// `Activity` to update/end without keeping a separate lookup table.
    var loopId: String
    var command: String
}
