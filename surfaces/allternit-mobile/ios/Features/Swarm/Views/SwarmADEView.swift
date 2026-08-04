import SwiftUI

// -----------------------------------------------------------------------------
// SwarmADEView — iOS lite port of the web's SwarmADE
// (surfaces/ai.allternit.com/src/views/swarm/SwarmADE.tsx).
//
// Offers Grid / Console / Detail modes derived from agent-sessions. Topology
// and Kanban are intentionally collapsed into Grid on mobile; History is
// shown as a simple metrics sparkline in Console.
// -----------------------------------------------------------------------------

struct SwarmADEView: View {
    @Binding var isSidebarOpen: Bool
    @StateObject private var store = SwarmStore.shared

    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                headerBar
                Divider().background(Color("BorderSubtle"))
                modePicker
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            store.fetchIfNeeded()
        }
        .onChange(of: searchText) { _, newValue in
            store.searchQuery = newValue
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0)) {
                    isSidebarOpen.toggle()
                }
            }) {
                Image(systemName: "line.3.horizontal")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
                    .frame(width: 44, height: 44)
            }

            Text("Swarm ADE")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()

            Button(action: { store.refresh() }) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
            .disabled(store.isLoading)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Mode picker

    private var modePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach([SwarmViewMode.grid, .console, .detail]) { mode in
                    Button(action: {
                        if mode == .detail, store.selectedAgent == nil {
                            // Detail without selection defaults back to grid.
                            store.viewMode = .grid
                        } else {
                            store.viewMode = mode
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: mode.icon)
                                .font(.system(size: 13, weight: .semibold))
                            Text(mode.label)
                                .font(.subheadline)
                                .fontWeight(store.viewMode == mode ? .semibold : .regular)
                        }
                        .foregroundColor(store.viewMode == mode ? Color(hex: "#c17817") : Color("TextSecondary"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(store.viewMode == mode ? Color(hex: "#c17817").opacity(0.14) : Color("BgPanel"))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.agents.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.agents.isEmpty {
            errorState(message: loadError)
        } else if store.agents.isEmpty {
            emptyState
        } else {
            switch store.viewMode {
            case .grid:
                gridContent
            case .console:
                consoleContent
            case .detail:
                if let agent = store.selectedAgent {
                    detailContent(agent: agent)
                } else {
                    gridContent
                }
            default:
                gridContent
            }
        }
    }

    // MARK: - Grid

    private var gridContent: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(store.filteredAgents) { agent in
                    SwarmAgentCard(agent: agent, isSelected: store.selectedAgentId == agent.id) {
                        store.selectAgent(id: agent.id)
                    }
                }
            }
            .padding(12)
        }
    }

    // MARK: - Console

    private var consoleContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                SwarmMetricsPanel(metrics: store.metrics)
                SwarmEventsPanel(events: store.events)
            }
            .padding(12)
        }
    }

    // MARK: - Detail

    private func detailContent(agent: SwarmAgent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Button(action: { store.backToGrid() }) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .font(.subheadline)
                        .foregroundColor(Color("AccentPrimary"))
                    }
                    Spacer()
                }

                SwarmAgentDetailHeader(agent: agent)

                if !agent.currentTasks.isEmpty {
                    SwarmTasksSection(tasks: agent.currentTasks)
                }

                HStack(spacing: 12) {
                    Button(action: {
                        Task { await store.restartAgent(id: agent.id) }
                    }) {
                        Label("Restart", systemImage: "arrow.clockwise")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color(hex: agent.colorHex).opacity(0.14))
                            .foregroundColor(Color(hex: agent.colorHex))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    Button(action: {
                        Task { await store.stopAgent(id: agent.id) }
                    }) {
                        Label("Stop", systemImage: "stop.fill")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color("BgPanel"))
                            .foregroundColor(Color(hex: "#ef4444"))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding(12)
        }
    }

    // MARK: - Empty / error

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "person.3")
                .font(.system(size: 40))
                .foregroundColor(Color("TextSecondary"))
            Text("No swarm agents yet")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))
            Text("Start an agent-mode chat or code session and it will appear here.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
    }

    private func errorState(message: String) -> some View {
        VStack(spacing: 12) {
            Spacer()
            Text("Couldn't load swarm agents")
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
            Text(message)
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
            Button("Retry") {
                store.refresh()
            }
            .font(.subheadline)
            .foregroundColor(Color("AccentPrimary"))
            Spacer()
        }
        .padding(.horizontal, 20)
    }
}

// MARK: - Agent card

struct SwarmAgentCard: View {
    let agent: SwarmAgent
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Image(systemName: agent.role.icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color(hex: agent.colorHex))
                        .frame(width: 32, height: 32)
                        .background(Color(hex: agent.colorHex).opacity(0.14))
                        .clipShape(Circle())

                    Spacer()

                    StatusPill(status: agent.status)
                }

                Text(agent.name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)

                Text(agent.role.label)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))

                HStack(spacing: 12) {
                    MetricBadge(icon: "cpu", value: "\(agent.tokensUsed)")
                    MetricBadge(icon: "bolt", value: "\(agent.avgLatency)ms")
                }

                if !agent.currentTasks.isEmpty {
                    HStack {
                        Text(agent.currentTasks.first?.name ?? "")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                            .lineLimit(1)
                        Spacer()
                    }
                    ProgressView(value: Double(agent.currentTasks.first?.progress ?? 0), total: 100)
                        .tint(Color(hex: agent.colorHex))
                }
            }
            .padding(12)
            .background(Color("BgPanel"))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color(hex: agent.colorHex) : Color("BorderSubtle"), lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Status pill

struct StatusPill: View {
    let status: SwarmAgentStatus

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(hex: status.colorHex))
                .frame(width: 6, height: 6)
            Text(status.label)
                .font(.caption2)
                .fontWeight(.medium)
        }
        .foregroundColor(Color(hex: status.colorHex))
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(Color(hex: status.colorHex).opacity(0.12))
        .clipShape(Capsule())
    }
}

// MARK: - Metric badge

struct MetricBadge: View {
    let icon: String
    let value: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(value)
                .font(.caption2)
                .fontWeight(.medium)
        }
        .foregroundColor(Color("TextSecondary"))
    }
}

// MARK: - Metrics panel

struct SwarmMetricsPanel: View {
    let metrics: SwarmMetrics

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Metrics")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                MetricTile(title: "Active agents", value: "\(metrics.activeAgents)", accent: Theme.statusSuccess)
                MetricTile(title: "Active threads", value: "\(metrics.activeThreads)", accent: Theme.statusInfo)
                MetricTile(title: "Completed", value: "\(metrics.completedThreads)", accent: Theme.statusWarning)
                MetricTile(title: "Failed", value: "\(metrics.failedThreads)", accent: Color(hex: "#ef4444"))
                MetricTile(title: "Tokens", value: "\(metrics.totalTokens)", accent: Color("AccentPrimary"))
                MetricTile(title: "Cost", value: String(format: "$%.4f", metrics.totalCost), accent: Color("AccentPrimary"))
            }
        }
        .padding(12)
        .background(Color("BgPanel"))
        .cornerRadius(12)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2)
                .foregroundColor(Color("TextSecondary"))
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(accent.opacity(0.08))
        .cornerRadius(8)
    }
}

// MARK: - Events panel

struct SwarmEventsPanel: View {
    let events: [SwarmActivityEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Activity")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))

            if events.isEmpty {
                Text("No recent activity.")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(events) { event in
                        HStack(spacing: 10) {
                            Image(systemName: event.agentRole.icon)
                                .font(.caption)
                                .foregroundColor(Color(hex: event.agentRole.colorHex))
                                .frame(width: 24, height: 24)
                                .background(Color(hex: event.agentRole.colorHex).opacity(0.12))
                                .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 2) {
                                Text(event.agentName)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(Color("TextPrimary"))
                                Text(event.message)
                                    .font(.caption)
                                    .foregroundColor(Color("TextSecondary"))
                                    .lineLimit(2)
                            }

                            Spacer()

                            Text(event.timestamp)
                                .font(.caption2)
                                .foregroundColor(Color("TextTertiary"))
                        }
                        .padding(8)
                        .background(Color("BgSecondary"))
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(12)
        .background(Color("BgPanel"))
        .cornerRadius(12)
    }
}

// MARK: - Detail header

struct SwarmAgentDetailHeader: View {
    let agent: SwarmAgent

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: agent.role.icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(Color(hex: agent.colorHex))
                .frame(width: 56, height: 56)
                .background(Color(hex: agent.colorHex).opacity(0.14))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextPrimary"))
                Text("\(agent.role.label) · \(agent.model)")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                Text("Uptime \(agent.uptime) · \(agent.tokensUsed) tokens")
                    .font(.caption)
                    .foregroundColor(Color("TextTertiary"))
            }

            Spacer()

            StatusPill(status: agent.status)
        }
        .padding(12)
        .background(Color("BgPanel"))
        .cornerRadius(12)
    }
}

// MARK: - Tasks section

struct SwarmTasksSection: View {
    let tasks: [SwarmTask]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Current tasks")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))

            LazyVStack(spacing: 8) {
                ForEach(tasks) { task in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(task.name)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(Color("TextPrimary"))
                            Spacer()
                            Text(task.status.rawValue.capitalized)
                                .font(.caption2)
                                .fontWeight(.medium)
                                .foregroundColor(task.status == .active ? Theme.statusInfo : Theme.statusSuccess)
                        }
                        ProgressView(value: Double(task.progress), total: 100)
                            .tint(task.status == .active ? Theme.statusInfo : Theme.statusSuccess)
                        HStack {
                            Text("\(task.tokensUsed) tokens")
                            Spacer()
                            Text(String(format: "$%.5f", task.cost))
                        }
                        .font(.caption2)
                        .foregroundColor(Color("TextTertiary"))
                    }
                    .padding(10)
                    .background(Color("BgSecondary"))
                    .cornerRadius(8)
                }
            }
        }
        .padding(12)
        .background(Color("BgPanel"))
        .cornerRadius(12)
    }
}
