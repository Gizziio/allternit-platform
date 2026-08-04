import Foundation

// -----------------------------------------------------------------------------
// Swarm ADE client — derives swarm agents from agent-sessions.
//
// Mirrors the mapping logic in
// surfaces/ai.allternit.com/src/views/swarm/SwarmMonitor.store.ts:
//   - role is inferred from session name/tags/description
//   - status is inferred from last access time
//   - tasks/events are synthesized from the most recent assistant messages
// -----------------------------------------------------------------------------

final class SwarmClient: @unchecked Sendable {
    private let chatClient: AgentChatClient

    init(chatClient: AgentChatClient = AgentChatClient()) {
        self.chatClient = chatClient
    }

    /// Loads all agent sessions and maps them to swarm agents (without messages).
    func listAgents() async throws -> [SwarmAgent] {
        let sessions = try await chatClient.listSessions()
        return sessions.enumerated().map { index, session in
            mapSessionToAgent(session: session, messages: [], index: index)
        }
    }

    /// Loads one session's messages and rebuilds that agent with real tasks.
    func agentWithMessages(sessionId: String, sessions: [AgentSession]) async throws -> SwarmAgent? {
        guard let index = sessions.firstIndex(where: { $0.id == sessionId }) else { return nil }
        let messages = try await chatClient.listMessages(sessionId: sessionId)
        return mapSessionToAgent(session: sessions[index], messages: messages, index: index)
    }

    /// Refreshes a single agent's derived state from fresh messages.
    func refreshAgent(_ agent: SwarmAgent, sessions: [AgentSession]) async throws -> SwarmAgent {
        guard let session = sessions.first(where: { $0.id == agent.id }) else { return agent }
        let messages = try await chatClient.listMessages(sessionId: agent.id)
        guard let index = sessions.firstIndex(where: { $0.id == agent.id }) else { return agent }
        return mapSessionToAgent(session: session, messages: messages, index: index)
    }

    // MARK: - Mapping

    private func mapSessionToAgent(session: AgentSession, messages: [AgentSessionMessage], index: Int) -> SwarmAgent {
        let role = detectRole(session: session)
        let status = detectStatus(session: session)
        let tasks = deriveTasks(from: messages, status: status)

        let tokensUsed = messages.reduce(0) { sum, msg in
            sum + Int(Double(msg.content.count) * 0.25)
        }
        let costAccumulated = Double(tokensUsed) * 0.00001

        return SwarmAgent(
            id: session.id,
            name: session.name ?? "Agent \(index + 1)",
            role: role,
            status: status,
            model: session.agentId ?? "default",
            tasksActive: tasks.filter { $0.status == .active }.count,
            tokensUsed: tokensUsed,
            costAccumulated: costAccumulated,
            avgLatency: 150 + Int.random(in: 0..<200),
            lastActivity: parseDate(session.lastAccessed) ?? Date(),
            uptime: calculateUptime(createdAt: session.createdAt),
            currentTasks: tasks,
            capabilities: session.tags,
            originSurface: session.originSurface ?? "chat"
        )
    }

    private func detectRole(session: AgentSession) -> SwarmAgentRole {
        let haystack = "\((session.name ?? "").lowercased()) \((session.description ?? "").lowercased()) \(session.tags.joined(separator: " ").lowercased())"
        if haystack.contains("orchestr") { return .orchestrator }
        if haystack.contains("review") { return .reviewer }
        if haystack.contains("special") { return .specialist }
        return .worker
    }

    private func detectStatus(session: AgentSession) -> SwarmAgentStatus {
        guard let last = parseDate(session.lastAccessed) else { return .idle }
        let fiveMinutesAgo = Date().addingTimeInterval(-5 * 60)
        return last > fiveMinutesAgo ? .working : .idle
    }

    private func deriveTasks(from messages: [AgentSessionMessage], status: SwarmAgentStatus) -> [SwarmTask] {
        let assistantMessages = messages.filter { $0.role == "assistant" }.suffix(3)
        guard !assistantMessages.isEmpty else { return [] }

        return assistantMessages.enumerated().map { index, msg in
            let isLast = index == assistantMessages.count - 1
            let taskStatus: SwarmTaskStatus = (isLast && status == .working) ? .active : .completed
            let progress = (isLast && status == .working) ? 65 : 100
            let tokens = Int(Double(msg.content.count) * 0.25)
            return SwarmTask(
                id: "task-\(msg.id)-\(index)",
                name: String(msg.content.prefix(40)) + (msg.content.count > 40 ? "…" : ""),
                status: taskStatus,
                progress: progress,
                tokensUsed: tokens,
                cost: Double(tokens) * 0.00001,
                startTime: parseDate(msg.timestamp) ?? Date(),
                duration: "2m 34s"
            )
        }
    }

    private func calculateUptime(createdAt: String) -> String {
        guard let created = parseDate(createdAt) else { return "0m" }
        let diff = Date().timeIntervalSince(created)
        let hours = Int(diff) / 3600
        let minutes = (Int(diff) % 3600) / 60
        if hours > 0 { return "\(hours)h \(minutes)m" }
        return "\(minutes)m"
    }

    private func parseDate(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: string) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }
}
