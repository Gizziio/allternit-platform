import ActivityKit
import WidgetKit
import SwiftUI

/// Lock Screen banner + Dynamic Island presentation for the dominant bot
/// operational state across all subscribed bots, driven by
/// `BotLiveActivityManager` in the main app target.
struct BotLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BotActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color("BgPanel"))
                .activitySystemActionForegroundColor(Color("TextPrimary"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    statusIcon(context: context, size: 34)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(countText(context: context))
                        .font(.caption)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let displayName = context.state.displayName, !displayName.isEmpty {
                        Text(displayName)
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.8))
                            .lineLimit(1)
                    } else {
                        Text(detailText(context: context))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))
                            .lineLimit(1)
                    }
                }
            } compactLeading: {
                statusIcon(context: context, size: 18)
            } compactTrailing: {
                Text(countText(context: context))
                    .font(.caption2)
                    .foregroundColor(.white)
            } minimal: {
                statusIcon(context: context, size: 16)
            }
        }
    }

    private func countText(context: ActivityViewContext<BotActivityAttributes>) -> String {
        if context.state.attentionBotsCount > 0 {
            return "\(context.state.attentionBotsCount)"
        }
        return "\(context.state.activeBotsCount)"
    }

    private func detailText(context: ActivityViewContext<BotActivityAttributes>) -> String {
        if let label = context.state.activityLabel, !label.isEmpty {
            return label
        }
        return Self.statusLabel(context.state.status)
    }

    @ViewBuilder
    private func statusIcon(context: ActivityViewContext<BotActivityAttributes>, size: CGFloat) -> some View {
        let color = Self.statusColor(context.state.status)
        Image(systemName: Self.statusIconName(context.state.status))
            .font(.system(size: size * 0.55, weight: .semibold))
            .foregroundColor(color)
            .frame(width: size, height: size)
            .background(color.opacity(0.15))
            .clipShape(Circle())
    }

    // MARK: - Status mapping (mirrors BotOperationalStatus in the app target)

    fileprivate static func statusLabel(_ status: String) -> String {
        switch status {
        case "idle": return "Idle"
        case "working": return "Working"
        case "waiting_input": return "Needs input"
        case "waiting_approval": return "Needs approval"
        case "blocked": return "Blocked"
        case "offline": return "Offline"
        case "degraded": return "Degraded"
        case "failed": return "Failed"
        case "completed": return "Completed"
        default: return status.capitalized
        }
    }

    fileprivate static func statusColor(_ status: String) -> Color {
        switch status {
        case "working": return .blue
        case "completed", "idle": return .green
        case "waiting_input", "waiting_approval", "blocked", "degraded": return .orange
        case "failed": return .red
        case "offline": return .gray
        default: return .gray
        }
    }

    fileprivate static func statusIconName(_ status: String) -> String {
        switch status {
        case "working": return "cpu"
        case "waiting_input": return "text.bubble"
        case "waiting_approval": return "hand.raised"
        case "blocked": return "exclamationmark.triangle"
        case "failed": return "xmark.octagon"
        case "completed": return "checkmark.circle"
        case "degraded": return "exclamationmark.triangle"
        case "offline": return "wifi.slash"
        default: return "cpu"
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<BotActivityAttributes>

    var body: some View {
        HStack(spacing: 12) {
            let color = BotLiveActivityWidget.statusColor(context.state.status)
            Image(systemName: BotLiveActivityWidget.statusIconName(context.state.status))
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(color)
                .frame(width: 40, height: 40)
                .background(color.opacity(0.15))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                if let displayName = context.state.displayName, !displayName.isEmpty {
                    Text(displayName)
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)
                    Text(BotLiveActivityWidget.statusLabel(context.state.status))
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(1)
                } else {
                    Text(BotLiveActivityWidget.statusLabel(context.state.status))
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)

                    let subtitle = subtitleText
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(16)
    }

    private var subtitleText: String {
        var parts: [String] = []
        if context.state.activeBotsCount == 1 {
            parts.append("1 bot active")
        } else {
            parts.append("\(context.state.activeBotsCount) bots active")
        }
        if context.state.pendingApprovalsCount > 0 {
            parts.append("\(context.state.pendingApprovalsCount) pending approval")
        }
        if let label = context.state.activityLabel, !label.isEmpty {
            parts.append(label)
        }
        return parts.joined(separator: " · ")
    }
}
