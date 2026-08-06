import Foundation

/// Client for the agent registry CRUD behind the Agent Hub
/// (`cmd/allternit-api/src/agent_routes.rs`, routes at :38-68): full-row
/// agent CRUD, the pattern-template catalog, and the per-agent workspace
/// .md files.
///
/// The composer pill's lightweight list stays on `AgentChatClient.listAgents`
/// (AgentSummary); this client decodes the SAME endpoints as full
/// `AgentRecord` rows for the hub. Request failures surface to callers as an
/// error state, never a crash.
final class AgentClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    // MARK: - Agents (REST, /api/v1/agents)

    /// Lists the user's agents as full rows (`{ agents: [...] }`).
    func listAgents() async throws -> [AgentRecord] {
        let response: AgentRecordListResponse = try await client.get(path: "agents")
        return response.agents
    }

    /// Fetches one agent row (`{ agent: {...} }`) — the detail view's
    /// refresh after an edit (the PUT answers only `{"success": true}`).
    func getAgent(id: String) async throws -> AgentRecord {
        let response: AgentRecordResponse = try await client.get(path: "agents/\(Self.escape(id))")
        return response.agent
    }

    /// Creates an agent; returns the new agent id
    /// (`201 { agent: { id } }`, agent_routes.rs:531). The backend validates
    /// its creation checklist (name ≥ 3 chars, description ≥ 10, type/model/
    /// provider required, agent_routes.rs:331-355).
    @discardableResult
    func createAgent(name: String, description: String, type: String = "worker",
                     model: String, provider: String, systemPrompt: String? = nil,
                     avatar: String? = nil, enabledModes: [String]? = nil) async throws -> String {
        let response: CreateAgentResponse = try await client.post(
            path: "agents",
            body: CreateAgentBody(
                name: name, description: description, type: type, model: model,
                provider: provider, systemPrompt: systemPrompt, avatar: avatar,
                enabledModes: enabledModes
            )
        )
        return response.agent.id
    }

    /// Updates an agent (`PUT /api/v1/agents/:id` → `{"success": true}`).
    /// Every field is optional; nil keys are omitted from the body so the
    /// stored value stays untouched.
    func updateAgent(id: String, name: String? = nil, description: String? = nil,
                     model: String? = nil, provider: String? = nil,
                     systemPrompt: String? = nil, avatar: String? = nil,
                     enabledModes: [String]? = nil,
                     config: [String: JSONValue]? = nil) async throws {
        try await client.put(
            path: "agents/\(Self.escape(id))",
            body: UpdateAgentBody(
                name: name, description: description, model: model, provider: provider,
                systemPrompt: systemPrompt, avatar: avatar, enabledModes: enabledModes,
                config: config
            )
        )
    }

    /// `DELETE /api/v1/agents/:id` → `{"success": true}`.
    func deleteAgent(id: String) async throws {
        try await client.delete(path: "agents/\(Self.escape(id))")
    }

    // MARK: - Templates (REST, /api/v1/agent-templates)

    /// Lists the pattern-template catalog (`{ templates: [...] }`).
    func listTemplates() async throws -> [AgentTemplate] {
        let response: AgentTemplateListResponse = try await client.get(path: "agent-templates")
        return response.templates
    }

    /// Instantiates a template into a live agent crew; the orchestrator is
    /// the agent the hub navigates to (201 `{pattern, orchestrator,
    /// subagents}`, agent_routes.rs:974-978).
    func createFromTemplate(templateId: String, nameOverride: String? = nil) async throws -> InstantiateTemplateResponse {
        try await client.post(
            path: "agents/from-template",
            body: InstantiateTemplateBody(templateId: templateId, nameOverride: nameOverride)
        )
    }

    // MARK: - Workspace files (REST, /api/v1/agents/:id/workspace/*)

    /// Lists an agent's workspace .md files (`{ files: [{path, size_bytes,
    /// modified_at}] }`).
    func listWorkspaceFiles(agentId: String) async throws -> [WorkspaceFileInfo] {
        let response: WorkspaceFileListResponse = try await client.get(
            path: "agents/\(Self.escape(agentId))/workspace/files"
        )
        return response.files
    }

    /// Reads one workspace file (`{path, content}`; 404 when missing).
    func readWorkspaceFile(agentId: String, path: String) async throws -> WorkspaceFileContent {
        let escapedPath = path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path
        return try await client.get(
            path: "agents/\(Self.escape(agentId))/workspace/file?path=\(escapedPath)"
        )
    }

    /// Overwrites one workspace file (`PUT {path, content}`).
    func writeWorkspaceFile(agentId: String, path: String, content: String) async throws {
        try await client.put(
            path: "agents/\(Self.escape(agentId))/workspace/file",
            body: WriteWorkspaceFileBody(path: path, content: content)
        )
    }

    // MARK: - Bodies

    /// Mirrors `CreateAgentBody` (agent_routes.rs:291-323), subsetted to the
    /// fields the hub creates with; `type` is serde-renamed on the wire.
    private struct CreateAgentBody: Encodable {
        let name: String
        let description: String
        let type: String
        let model: String
        let provider: String
        let systemPrompt: String?
        let avatar: String?
        let enabledModes: [String]?

        enum CodingKeys: String, CodingKey {
            case name, description, type, model, provider, avatar
            case systemPrompt = "system_prompt"
            case enabledModes = "enabled_modes"
        }
    }

    /// `201 { agent: { id } }` from create (agent_routes.rs:531).
    private struct CreateAgentResponse: Decodable {
        struct AgentRef: Decodable {
            let id: String
        }
        let agent: AgentRef
    }

    /// Mirrors `UpdateAgentBody` (agent_routes.rs:1088-1117), subsetted to
    /// the hub's editable fields. The backend COALESCEs server-side only for
    /// present keys, so nil is omitted (synthesized encodeIfPresent).
    private struct UpdateAgentBody: Encodable {
        let name: String?
        let description: String?
        let model: String?
        let provider: String?
        let systemPrompt: String?
        let avatar: String?
        let enabledModes: [String]?
        /// Full-replace, not a merge — the backend COALESCEs the whole
        /// `config` column, so callers must send the complete merged object
        /// (AgentRecord.configReplacing does this).
        let config: [String: JSONValue]?

        enum CodingKeys: String, CodingKey {
            case name, description, model, provider, avatar, config
            case systemPrompt = "system_prompt"
            case enabledModes = "enabled_modes"
        }
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
