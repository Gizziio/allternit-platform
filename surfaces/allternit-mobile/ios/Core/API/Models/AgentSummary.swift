import Foundation

// -----------------------------------------------------------------------------
// Agent registry record — `GET /api/v1/agents` → `{ agents: [...] }`
// (cmd/allternit-api/src/agent_routes.rs:181-287).
//
// This is the data source behind the web composer's AgentSelectorDropdown
// (agent.service.ts:67-92 → api-client.ts:763-765 `listAgents`). Only the
// fields the mobile agent pill needs are decoded; the row carries many more
// (model, provider, config, …).
// -----------------------------------------------------------------------------

/// One registered agent. `enabledModes` is the backend's surface allow-list
/// (`enabled_modes`, mapped to `allowedSurfaces` by the web's
/// `transformAgentFromApi`, agent.service.ts:299-302) — the composer's agent
/// menu only shows agents allowed on the current surface.
struct AgentSummary: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    /// Surface raw values ("chat" / "cowork" / …). The backend defaults the
    /// column to ["chat"] (agent_routes.rs:220-221); a missing/undecodable
    /// value falls back the same way here.
    let enabledModes: [String]

    enum CodingKeys: String, CodingKey {
        case id, name
        case enabledModes = "enabled_modes"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Agent"

        if let modes = try? container.decode([String].self, forKey: .enabledModes) {
            enabledModes = modes
        } else if let raw = try? container.decode(String.self, forKey: .enabledModes),
                  let data = raw.data(using: .utf8),
                  let modes = try? JSONDecoder().decode([String].self, from: data) {
            // Tolerates the column arriving as a JSON-encoded string.
            enabledModes = modes
        } else {
            enabledModes = ["chat"]
        }
    }

    /// Whether this agent may be selected on the given surface (BottomDock's
    /// `allowedSurfaces.includes(agentModeSurface)` filter).
    func allows(surface: AppMode) -> Bool {
        enabledModes.contains(surface.rawValue)
    }
}

/// Envelope of `GET /api/v1/agents` (`{ "agents": [...] }`; the Rust handler
/// emits no `total`, agent_routes.rs:269).
struct AgentListResponse: Decodable, Sendable {
    let agents: [AgentSummary]
}
