import Foundation

/// Response-style preferences — `GET/PUT /api/v1/agent-preferences`
/// (`cmd/allternit-api/src/agent_preferences_routes.rs`, plan Phase 1.2):
/// `{response_style, custom_instructions, updated_at}`. `response_style` is
/// one of "concise" | "balanced" | "detailed" | "custom"; a GET with no
/// stored row returns the defaults ("balanced", "").
struct AgentPreferences: Decodable, Sendable {
    let responseStyle: String
    let customInstructions: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case responseStyle = "response_style"
        case customInstructions = "custom_instructions"
        case updatedAt = "updated_at"
    }
}

/// Client for the user-level agent preferences endpoint. Only the
/// networking layer lives here for now — the observable `PreferencesStore`
/// (cached state + send-time prompt directive) is plan Phase 2.3/5 and is
/// intentionally NOT built yet.
final class PreferencesClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/agent-preferences` → `{response_style,
    /// custom_instructions, updated_at}` (defaults row when none stored).
    func get() async throws -> AgentPreferences {
        try await client.get(path: "agent-preferences")
    }

    /// `PUT /api/v1/agent-preferences` — `{response_style,
    /// custom_instructions}`. The backend validates the style value, upserts
    /// the row, and best-effort syncs a managed STYLE.md into each of the
    /// user's agent workspaces.
    func put(responseStyle: String, customInstructions: String) async throws {
        try await client.put(
            path: "agent-preferences",
            body: PutPreferencesBody(responseStyle: responseStyle, customInstructions: customInstructions)
        )
    }

    private struct PutPreferencesBody: Encodable {
        let responseStyle: String
        let customInstructions: String

        enum CodingKeys: String, CodingKey {
            case responseStyle = "response_style"
            case customInstructions = "custom_instructions"
        }
    }
}
