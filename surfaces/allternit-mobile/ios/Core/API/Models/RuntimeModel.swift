import Foundation

/// One row of the flattened model catalog — `GET /api/v1/models`
/// (v1_routes.rs `list_available_models` → provider_routes.rs
/// `available_model_catalog`): `{id: "provider/model", name, provider,
/// description?, tier?, supports_effort?}`.
/// `id` is exactly what `POST /api/agent-chat` accepts as `runtimeModelId`
/// (v1_routes.rs:182-200 splits it back into provider + model).
struct RuntimeModel: Decodable, Sendable, Identifiable, Equatable {
    /// Picker grouping, mirroring the Claude app's sheet sections.
    /// `legacy` rows collapse under a "More models" disclosure.
    enum Tier: String, Decodable, Sendable, Equatable {
        case flagship, standard, fast, legacy
    }

    let id: String
    let name: String
    let provider: String
    /// One-line positioning copy ("Most efficient for everyday tasks").
    /// Optional: pre-metadata backends omit it and the row hides the subtitle.
    let description: String?
    let tier: Tier?
    /// Reasoning-effort selector (Low/Medium/High) eligibility.
    let supportsEffort: Bool

    /// The bare model id ("claude-sonnet-4.6" out of
    /// "anthropic/claude-sonnet-4.6") — the composer pill's compact label.
    var shortName: String {
        id.split(separator: "/", maxSplits: 1).last.map(String.init) ?? id
    }

    var resolvedTier: Tier { tier ?? .standard }

    private enum CodingKeys: String, CodingKey {
        case id, name, provider, description, tier
        case supportsEffort = "supports_effort"
    }

    init(id: String, name: String, provider: String, description: String? = nil, tier: Tier? = nil, supportsEffort: Bool = false) {
        self.id = id
        self.name = name
        self.provider = provider
        self.description = description
        self.tier = tier
        self.supportsEffort = supportsEffort
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        provider = try container.decode(String.self, forKey: .provider)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        tier = try container.decodeIfPresent(Tier.self, forKey: .tier)
        supportsEffort = try container.decodeIfPresent(Bool.self, forKey: .supportsEffort) ?? false
    }
}

/// Reasoning effort sent alongside the model (`effort` in the agent-chat
/// body). Mirrors the Claude app's Low/Medium/High picker.
enum ModelEffort: String, CaseIterable, Sendable {
    case low, medium, high

    var label: String { rawValue.capitalized }
}
