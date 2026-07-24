import SwiftUI

/// Cowork top-deck permission options (CoworkTopDeck.tsx:8-12). `ask` is the
/// web's default ("Ask before actions").
enum CoworkPermission: String, CaseIterable, Sendable {
    case autoApprove = "auto-approve"
    case ask = "ask"
    case readOnly = "read-only"

    var label: String {
        switch self {
        case .autoApprove: return "Auto-approve"
        case .ask: return "Ask before actions"
        case .readOnly: return "Read-only"
        }
    }

    var description: String {
        switch self {
        case .autoApprove: return "Agent can run tools and edits freely"
        case .ask: return "Agent asks before running commands or edits"
        case .readOnly: return "Agent can only read and research"
        }
    }
}

/// Composer-level agent state, mirroring the web's agent-surface mode state:
/// the Agent On/Off pill, the selected agent, and the selected agent-mode
/// tile are all tracked PER SURFACE (chat / cowork), and selections persist.
///
/// Web references: BottomDock.tsx (pill + toggle), ModeDock.tsx (tiles,
/// defaulted to the first visible tile when unset/invalid,
/// ModeDock.tsx:63-67), agent-surface-mode.store (per-surface persistence).
///
/// Also owns the agent registry fetch (`GET /api/v1/agents` — the same
/// endpoint behind the web's AgentSelectorDropdown). Rows are full
/// `AgentRecord`s (shared with the Agent Hub via AgentClient), so the
/// selection sheet and the send path can read descriptions, models, and
/// system prompts without a second fetch.
@MainActor
final class AgentModeStore: ObservableObject {
    // MARK: - Persisted per-surface state

    @Published private(set) var agentEnabledByMode: [AppMode: Bool] = [:]
    @Published private(set) var agentIdByMode: [AppMode: String] = [:]
    @Published private(set) var tileByMode: [AppMode: AgentModeTile] = [:]
    /// When agent mode is on, the bottom deck is either expanded (showing all
    /// tiles) or collapsed to just the selected tile. Starts expanded so the
    /// user can pick a mode; selecting a tile collapses it.
    @Published private(set) var isAgentModeDeckExpanded: [AppMode: Bool] = [:]

    /// Cowork top-deck permission level (global, not per-surface — the web
    /// keeps it as a single composer state).
    @Published var coworkPermission: CoworkPermission {
        didSet { defaults.set(coworkPermission.rawValue, forKey: Keys.permissions) }
    }

    /// Cowork top-deck project selection. `ProjectStore.shared` is the single
    /// source of truth (it owns the list, the persistence, and publishes
    /// changes); this forwards so the deck's existing call sites keep working.
    var selectedProjectId: String? {
        get { ProjectStore.shared.selectedProjectId }
        set { ProjectStore.shared.selectedProjectId = newValue }
    }

    // MARK: - Agent registry (GET /api/v1/agents)

    @Published private(set) var agents: [AgentRecord] = []
    @Published private(set) var isLoadingAgents = false
    @Published private(set) var agentsError: String? = nil

    private let defaults: UserDefaults
    private let agentClient: AgentClient
    private var fetchTask: Task<Void, Never>? = nil

    private enum Keys {
        static let permissions = "allternit-cowork-permissions"
        static func enabled(_ mode: AppMode) -> String { "allternit-agent-enabled-\(mode.rawValue)" }
        static func agentId(_ mode: AppMode) -> String { "allternit-agent-id-\(mode.rawValue)" }
        static func tile(_ mode: AppMode) -> String { "allternit-agent-tile-\(mode.rawValue)" }
    }

    init(defaults: UserDefaults = .standard, agentClient: AgentClient = AgentClient()) {
        self.defaults = defaults
        self.agentClient = agentClient

        var enabled: [AppMode: Bool] = [:]
        var agentIds: [AppMode: String] = [:]
        var tiles: [AppMode: AgentModeTile] = [:]
        for mode in AppMode.allCases {
            if defaults.object(forKey: Keys.enabled(mode)) != nil {
                enabled[mode] = defaults.bool(forKey: Keys.enabled(mode))
            }
            if let agentId = defaults.string(forKey: Keys.agentId(mode)) {
                agentIds[mode] = agentId
            }
            if let tileRaw = defaults.string(forKey: Keys.tile(mode)),
               let tile = AgentModeTile(rawValue: tileRaw) {
                tiles[mode] = tile
            }
        }
        self.agentEnabledByMode = enabled
        self.agentIdByMode = agentIds
        self.tileByMode = tiles
        self.coworkPermission = defaults.string(forKey: Keys.permissions)
            .flatMap(CoworkPermission.init(rawValue:)) ?? .ask
    }

    // MARK: - Agent On/Off pill

    func isAgentEnabled(for mode: AppMode) -> Bool {
        agentEnabledByMode[mode] ?? false
    }

    func setAgentEnabled(_ enabled: Bool, for mode: AppMode) {
        agentEnabledByMode[mode] = enabled
        defaults.set(enabled, forKey: Keys.enabled(mode))
        if enabled {
            isAgentModeDeckExpanded[mode] = true
        }
    }

    func toggleAgent(for mode: AppMode) {
        setAgentEnabled(!isAgentEnabled(for: mode), for: mode)
    }

    func isAgentModeDeckExpanded(for mode: AppMode) -> Bool {
        isAgentModeDeckExpanded[mode] ?? true
    }

    func setAgentModeDeckExpanded(_ expanded: Bool, for mode: AppMode) {
        isAgentModeDeckExpanded[mode] = expanded
    }

    func toggleAgentModeDeckExpanded(for mode: AppMode) {
        setAgentModeDeckExpanded(!isAgentModeDeckExpanded(for: mode), for: mode)
    }

    /// `session_mode` for the next session create on this surface
    /// (mode-session-store.ts:850/893 — 'agent' when the pill is on).
    func sessionMode(for mode: AppMode) -> String {
        isAgentEnabled(for: mode) ? "agent" : "regular"
    }

    // MARK: - Agent selection

    func selectedAgentId(for mode: AppMode) -> String? {
        agentIdByMode[mode]
    }

    func selectedAgent(for mode: AppMode) -> AgentRecord? {
        guard let id = agentIdByMode[mode] else { return nil }
        return agents.first { $0.id == id }
    }

    /// nil clears the selection (the web dropdown's "clear" action — the
    /// backend then binds the session to its default agent).
    func selectAgent(_ agent: AgentRecord?, for mode: AppMode) {
        agentIdByMode[mode] = agent?.id
        defaults.set(agent?.id, forKey: Keys.agentId(mode))
    }

    /// Agents selectable on the given surface (BottomDock.tsx:231-234).
    func agentsForSurface(_ surface: AppMode) -> [AgentRecord] {
        agents.filter { $0.allows(surface: surface) }
    }

    // MARK: - Agent-mode tile (bottom deck)

    /// Persisted tile when still valid for the surface; otherwise the first
    /// visible tile — mirroring ModeDock's defaulting effect
    /// (ModeDock.tsx:63-67).
    func selectedTile(for surface: AppMode) -> AgentModeTile {
        let visible = AgentModeTile.visibleTiles(for: surface)
        if let tile = tileByMode[surface], visible.contains(tile) {
            return tile
        }
        return visible[0]
    }

    func selectTile(_ tile: AgentModeTile, for surface: AppMode) {
        tileByMode[surface] = tile
        defaults.set(tile.rawValue, forKey: Keys.tile(surface))
        isAgentModeDeckExpanded[surface] = false
    }

    // MARK: - Registry fetch

    /// Fetches the agent registry once per launch unless forced; concurrent
    /// callers share the in-flight request (agent.store.ts:273-304 pattern).
    func fetchAgentsIfNeeded(force: Bool = false) {
        guard force || agents.isEmpty, fetchTask == nil else { return }
        isLoadingAgents = true
        agentsError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoadingAgents = false
                self.fetchTask = nil
            }
            do {
                self.agents = try await self.agentClient.listAgents()
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.agentsError = error.localizedDescription
            }
        }
    }
}
