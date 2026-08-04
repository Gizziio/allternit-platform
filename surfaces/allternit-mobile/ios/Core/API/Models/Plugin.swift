import Foundation

// -----------------------------------------------------------------------------
// Plugin marketplace models — lite iOS port of the web plugin registry.
//
// Mirrors a subset of UnifiedMarketplacePlugin from
// surfaces/ai.allternit.com/src/lib/plugins/marketplace-integration.ts.
// iOS does not run plugin code; this view lists bundled plugins and persists
// enabled state locally so users can curate which ones appear in the UI.
// -----------------------------------------------------------------------------

enum PluginCategory: String, CaseIterable, Sendable, Identifiable {
    case all
    case agent
    case automate
    case analyze
    case create
    case connector
    case utility

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "All"
        case .agent: return "Agents"
        case .automate: return "Automate"
        case .analyze: return "Analyze"
        case .create: return "Create"
        case .connector: return "Connectors"
        case .utility: return "Utilities"
        }
    }
}

enum PluginSource: String, Sendable {
    case builtIn = "built-in"
    case vendor
    case downloadable
}

struct MarketplacePlugin: Identifiable, Sendable {
    let id: String
    let name: String
    let description: String
    let category: PluginCategory
    let source: PluginSource
    let author: String
    let verified: Bool
    let version: String
    let price: String
    let downloads: Int
    let ratingAverage: Double
    let ratingCount: Int
    let capabilities: [String]
    let colorHex: String
}

extension MarketplacePlugin {
    /// A curated static catalog mirroring the web's bundled plugins.
    static let bundledCatalog: [MarketplacePlugin] = [
        MarketplacePlugin(
            id: "assets",
            name: "Assets",
            description: "Digital asset management, media library, and brand governance",
            category: .utility,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 0,
            ratingAverage: 0,
            ratingCount: 0,
            capabilities: ["asset-management", "media-library"],
            colorHex: "#22c55e"
        ),
        MarketplacePlugin(
            id: "swarms",
            name: "Swarms",
            description: "Multi-agent orchestration and consensus building",
            category: .agent,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 0,
            ratingAverage: 0,
            ratingCount: 0,
            capabilities: ["multi-agent", "agent-coordination"],
            colorHex: "#14B8A6"
        ),
        MarketplacePlugin(
            id: "flow",
            name: "Flow",
            description: "Visual workflow automation and custom automations",
            category: .automate,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 0,
            ratingAverage: 0,
            ratingCount: 0,
            capabilities: ["visual-builder", "automation"],
            colorHex: "#8b5cf6"
        ),
        MarketplacePlugin(
            id: "office-excel",
            name: "Allternit for Excel",
            description: "AI-powered Excel automation — formulas, charts, tables, financial modeling",
            category: .analyze,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 5000,
            ratingAverage: 4.7,
            ratingCount: 42,
            capabilities: ["excel-automation", "financial-modeling"],
            colorHex: "#22c55e"
        ),
        MarketplacePlugin(
            id: "office-word",
            name: "Allternit for Word",
            description: "AI-powered document drafting, editing, redlining, style application",
            category: .create,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 4800,
            ratingAverage: 4.6,
            ratingCount: 38,
            capabilities: ["word-automation", "documents"],
            colorHex: "#3b82f6"
        ),
        MarketplacePlugin(
            id: "office-powerpoint",
            name: "Allternit for PowerPoint",
            description: "AI-powered slide creation, deck design, content generation",
            category: .create,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 5200,
            ratingAverage: 4.8,
            ratingCount: 45,
            capabilities: ["powerpoint-automation", "slides"],
            colorHex: "#f59e0b"
        ),
        MarketplacePlugin(
            id: "chrome",
            name: "Allternit Chrome Extension",
            description: "Browser automation, web capture, and extension workflows",
            category: .connector,
            source: .builtIn,
            author: "Allternit",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 8500,
            ratingAverage: 4.7,
            ratingCount: 67,
            capabilities: ["browser-automation", "web-capture"],
            colorHex: "#6366F1"
        ),
        MarketplacePlugin(
            id: "legal",
            name: "Legal",
            description: "Speed up contract review, NDA triage, and compliance workflows",
            category: .analyze,
            source: .vendor,
            author: "Anthropic",
            verified: true,
            version: "1.1.0",
            price: "Free",
            downloads: 15000,
            ratingAverage: 4.8,
            ratingCount: 124,
            capabilities: ["contract-review", "compliance-check"],
            colorHex: "#a78bfa"
        ),
        MarketplacePlugin(
            id: "engineering",
            name: "Engineering",
            description: "Run tests, manage deployments, debug production issues",
            category: .automate,
            source: .vendor,
            author: "Anthropic",
            verified: true,
            version: "1.0.0",
            price: "Free",
            downloads: 22000,
            ratingAverage: 4.7,
            ratingCount: 189,
            capabilities: ["testing", "deployments", "debugging"],
            colorHex: "#60A5FA"
        ),
    ]
}
