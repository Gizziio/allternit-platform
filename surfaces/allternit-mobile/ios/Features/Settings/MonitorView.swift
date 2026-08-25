import SwiftUI

/// Phase-1 Monitor view for iOS.
///
/// Mirrors the web's `MonitorView.tsx`: system metrics, quick stats, and
/// Agents/Logs tabs. Wired to `/api/v1/monitor/*`; control actions are shells
/// without handlers until backend support exists.
struct MonitorView: View {
    @StateObject private var store = MonitorStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var activeTab: Tab = .agents
    @State private var logFilter: MonitorLogLevel? = nil
    @State private var selectedAgentId: String? = nil

    private enum Tab: String, CaseIterable {
        case agents = "Agents"
        case logs = "System Log"
    }

    private var activeCount: Int { store.agents.filter { $0.status == .active }.count }
    private var errorCount: Int { store.agents.filter { $0.status == .error }.count }
    private var totalTokens: Int { store.agents.reduce(0) { $0 + $1.tokensUsed } }
    private var avgLatency: Int {
        let latencies = store.agents.filter { $0.latencyMs > 0 }.map(\.latencyMs)
        return latencies.isEmpty ? 0 : latencies.reduce(0, +) / latencies.count
    }

    private var filteredLogs: [MonitorLogEntry] {
        guard let logFilter else { return store.logs }
        return store.logs.filter { $0.level == logFilter }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().background(Color("BorderSubtle"))
            content
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .task {
            store.fetchIfNeeded()
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Agent Monitor")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Text("Live view of running agents and system activity")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            Spacer()

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                store.fetchIfNeeded(force: true)
            }) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Refresh")

            tabMenu

            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.agents.isEmpty && store.systemMetrics.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.agents.isEmpty && store.systemMetrics.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't load monitor")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    store.fetchIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else {
            ScrollView {
                VStack(spacing: 16) {
                    metricsRow
                    statsRow

                    switch activeTab {
                    case .agents:
                        agentsTab
                    case .logs:
                        logsTab
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
            .refreshable {
                await store.refresh()
            }
        }
    }

    // MARK: - Metrics row

    private var metricsRow: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(store.systemMetrics) { metric in
                VStack(alignment: .leading, spacing: 6) {
                    Text(metric.label.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color("TextSecondary"))
                        .tracking(0.6)
                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text(metric.value)
                            .font(.system(size: 28, weight: .heavy, design: .rounded))
                            .foregroundColor(color(for: metric.color))
                        Text(metric.unit)
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                    }
                    HStack(spacing: 4) {
                        Image(systemName: trendIcon(for: metric.trend))
                            .font(.system(size: 10, weight: .bold))
                        Text("\(metric.trendValue) vs yesterday")
                            .font(.caption2)
                    }
                    .foregroundColor(trendColor(for: metric.trend))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            }
        }
    }

    private func color(for hex: String) -> Color {
        Color(hex: hex)
    }

    private func trendIcon(for trend: MonitorTrend) -> String {
        switch trend {
        case .up: return "arrow.up"
        case .down: return "arrow.down"
        case .stable: return "circle.fill"
        }
    }

    private func trendColor(for trend: MonitorTrend) -> Color {
        switch trend {
        case .up: return Theme.statusWarning
        case .down: return Theme.statusSuccess
        case .stable: return Color("TextSecondary")
        }
    }

    // MARK: - Stats row

    private var statsRow: some View {
        FlowLayout(spacing: 8) {
            statChip("\(store.agents.count) total agents", icon: "cpu", color: Color("TextSecondary"))
            statChip("\(activeCount) active", icon: "checkmark.circle", color: Theme.statusSuccess)
            statChip("\(errorCount) with errors", icon: "exclamationmark.triangle", color: Theme.statusError)
            statChip("Avg \(avgLatency)ms latency", icon: "chart.line.uptrend.xyaxis", color: Color("AccentChat"))
            statChip("\(totalTokens / 1000)K tokens today", icon: "chart.line.uptrend.xyaxis", color: Color("AccentPrimary"))
        }
    }

    private func statChip(_ label: String, icon: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
            Text(label)
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundColor(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color("BgPanel"))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private var tabMenu: some View {
        Menu {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button(action: { activeTab = tab }) {
                    HStack {
                        if activeTab == tab { Image(systemName: "checkmark") }
                        Text(tab.rawValue)
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(activeTab.rawValue)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color("TextSecondary"))
            }
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background(Color("BgPanel"))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
        }
        .accessibilityLabel("Switch view")
    }

    // MARK: - Agents tab

    private var agentsTab: some View {
        LazyVStack(spacing: 10) {
            ForEach(store.agents) { agent in
                agentCard(agent)
            }
        }
    }

    private func agentCard(_ agent: MonitorAgent) -> some View {
        let isSelected = selectedAgentId == agent.id
        let statusColor = color(forStatus: agent.status)
        return VStack(spacing: 0) {
            Button(action: { selectedAgentId = isSelected ? nil : agent.id }) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(agent.name)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(Color("TextPrimary"))
                        Text("\(agent.type) · \(agent.model)")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                    }
                    .frame(minWidth: 120, alignment: .leading)

                    Text(agent.status.label.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .foregroundColor(statusColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(statusColor.opacity(0.12))
                        .clipShape(Capsule())

                    Spacer()

                    HStack(spacing: 12) {
                        agentStat("Tasks", value: "\(agent.taskCount)")
                        agentStat("Tokens", value: agent.tokensUsed >= 1000 ? "\(agent.tokensUsed / 1000)K" : "\(agent.tokensUsed)")
                        agentStat("Latency", value: agent.latencyMs > 0 ? "\(agent.latencyMs)ms" : "—")
                        agentStat("Uptime", value: agent.uptime)
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(14)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(isSelected ? statusColor.opacity(0.4) : Theme.borderWarmDefault, lineWidth: 1)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isSelected {
                HStack(spacing: 12) {
                    detailItem(icon: "memorychip", label: "Memory", value: "\(agent.memMb) MB")
                    detailItem(icon: "cpu", label: "Model", value: agent.model)
                    detailItem(icon: "clock", label: "Uptime", value: agent.uptime)
                    detailItem(icon: "activity", label: "Status", value: agent.status.label)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color("BgSecondary"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
            }
        }
    }

    private func agentStat(_ label: String, value: String) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(Color("TextSecondary"))
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color("TextPrimary"))
        }
    }

    private func detailItem(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(Color("AccentPrimary"))
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                Text(value)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Color("TextPrimary"))
            }
            Spacer()
        }
        .padding(10)
        .background(Color("BgPrimary"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }

    private func color(forStatus status: MonitorAgentStatus) -> Color {
        switch status {
        case .active: return Theme.statusSuccess
        case .idle: return Color("TextSecondary")
        case .error: return Theme.statusError
        case .paused: return Theme.statusWarning
        }
    }

    // MARK: - Logs tab

    private var logsTab: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                logFilterPill(nil)
                logFilterPill(.info)
                logFilterPill(.warn)
                logFilterPill(.error)
                Spacer()
                Text("\(filteredLogs.count) entries")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            LazyVStack(spacing: 0) {
                ForEach(Array(filteredLogs.enumerated()), id: \.element.id) { index, entry in
                    HStack(spacing: 12) {
                        Text(entry.time)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(Color("TextSecondary"))
                            .frame(width: 60, alignment: .leading)
                        Text(entry.level.rawValue.uppercased())
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(logColor(for: entry.level))
                            .frame(width: 44, alignment: .leading)
                        Text(entry.agent)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(Color("TextSecondary"))
                            .frame(width: 80, alignment: .leading)
                            .lineLimit(1)
                        Text(entry.message)
                            .font(.system(size: 12))
                            .foregroundColor(Color("TextPrimary"))
                            .lineLimit(2)
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(logBackground(for: entry.level))
                    .overlay(
                        Group {
                            if index < filteredLogs.count - 1 {
                                Divider().background(Color("BorderSubtle"))
                            }
                        }
                    )
                }
            }
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
        }
    }

    private func logFilterPill(_ level: MonitorLogLevel?) -> some View {
        let selected = logFilter == level
        return Button(action: { logFilter = level }) {
            Text(level?.rawValue.uppercased() ?? "ALL")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(selected ? Color("BgPrimary") : Color("TextPrimary"))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(selected ? Color("AccentChat") : Color("BgPanel"))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func logColor(for level: MonitorLogLevel) -> Color {
        switch level {
        case .info: return Color("TextSecondary")
        case .warn: return Theme.statusWarning
        case .error: return Theme.statusError
        case .debug: return Color("TextSecondary")
        }
    }

    private func logBackground(for level: MonitorLogLevel) -> Color {
        switch level {
        case .warn: return Theme.statusWarning.opacity(0.08)
        case .error: return Theme.statusError.opacity(0.08)
        default: return Color("BgPanel")
        }
    }
}

// MARK: - Flow layout helper

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                      y: bounds.minY + result.positions[index].y),
                          proposal: .unspecified)
        }
    }

    private struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                if x + size.width > maxWidth, x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }
                positions.append(CGPoint(x: x, y: y))
                x += size.width + spacing
                lineHeight = max(lineHeight, size.height)
            }
            self.size = CGSize(width: maxWidth, height: y + lineHeight)
        }
    }
}
