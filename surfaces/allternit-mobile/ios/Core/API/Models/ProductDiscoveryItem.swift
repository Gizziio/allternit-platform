import SwiftUI

// ------------------------------------------------------------------------------
// Product Discovery data model — mirrors the static catalog in
// surfaces/ai.allternit.com/src/views/products/ProductsDiscoveryView.tsx.
//
// This is a marketing/discovery surface, not a backend-backed list, so the
// catalog is bundled in the app. `viewType` maps to in-app surfaces or
// external URLs where applicable.
// ------------------------------------------------------------------------------

enum ProductStatus: String, Sendable {
    case live
    case beta
    case soon

    var label: String {
        switch self {
        case .live: return "Live"
        case .beta: return "Beta"
        case .soon: return "Coming Soon"
        }
    }
}

enum ProductCategory: String, CaseIterable, Sendable {
    case core = "Core"
    case aiAgents = "AI Agents"
    case create = "Create"
    case infrastructure = "Infrastructure"
    case surfaces = "Surfaces"
    case learn = "Learn"
    case ecosystem = "Ecosystem"
}

/// One item in the Products Discovery catalog.
struct ProductDiscoveryItem: Identifiable, Sendable {
    let id: String
    let name: String
    let tagline: String
    let description: String
    let category: ProductCategory
    let status: ProductStatus
    let accentHex: String
    let gradientFromHex: String
    let gradientToHex: String
    let systemImage: String
    /// Optional in-app navigation target. Known values map to `ModeBarItem` or
    /// `AppMode` destinations; unknown values are treated as no-ops in Phase 1.
    let viewType: String?
    /// External URL to open when the item has no in-app surface (e.g. browser
    /// extension store, desktop download).
    let externalURL: String?

    var accentColor: Color { Color(hex: accentHex) }
    var gradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: gradientFromHex), Color(hex: gradientToHex)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

extension ProductDiscoveryItem {
    /// Spotlight hero items — auto-rotating featured products.
    static let spotlight: [ProductDiscoveryItem] = [
        ProductDiscoveryItem(
            id: "cowork",
            name: "Cowork",
            tagline: "AI for Your Whole Team",
            description: "Put Claude to work on tasks while you step away. Collaborate in real-time with AI as a full team member — assign tasks, review outputs, and ship faster together.",
            category: .core,
            status: .live,
            accentHex: "#06b6d4",
            gradientFromHex: "#06b6d4",
            gradientToHex: "#0284c7",
            systemImage: "person.3",
            viewType: "chat",
            externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "chat",
            name: "Allternit Chat",
            tagline: "Conversational AI",
            description: "The thinking layer for everything you do. Stream responses from any model, attach files, search the web, or hand off to an agent — all from one thread.",
            category: .core,
            status: .live,
            accentHex: "#D97757",
            gradientFromHex: "#D97757",
            gradientToHex: "#B08D6E",
            systemImage: "bubble.left",
            viewType: "chat",
            externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "code",
            name: "Allternit Code",
            tagline: "AI-Powered Development",
            description: "Your AI pair programmer across terminal, VS Code, and JetBrains. Understands full repositories — not just snippets. Aider, Goose, Codex, and Claude in one surface.",
            category: .core,
            status: .live,
            accentHex: "#f59e0b",
            gradientFromHex: "#f59e0b",
            gradientToHex: "#d97706",
            systemImage: "terminal",
            viewType: "code",
            externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "computer-use",
            name: "Computer Use",
            tagline: "AI That Sees & Acts",
            description: "Give AI eyes and hands in the browser. Navigate, click, fill forms, extract data — fully automated, fully observable. 44-route ACU gateway, production-grade.",
            category: .aiAgents,
            status: .live,
            accentHex: "#5B8DEF",
            gradientFromHex: "#5B8DEF",
            gradientToHex: "#3b5bdb",
            systemImage: "desktopcomputer",
            viewType: "operator",
            externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "swarm",
            name: "Swarm ADE",
            tagline: "Agent Orchestration at Scale",
            description: "Spin up hundreds of AI agents working in parallel. Route tasks, monitor topology, replay runs, set budgets — all in one real-time dashboard.",
            category: .aiAgents,
            status: .live,
            accentHex: "#10b981",
            gradientFromHex: "#10b981",
            gradientToHex: "#059669",
            systemImage: "network",
            viewType: "swarm",
            externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "local-brain",
            name: "Local Brain",
            tagline: "Private · Offline · Yours",
            description: "Run AI entirely on your machine. No internet, no API keys, no cloud. Powered by Ollama + Llama 3.2. Every conversation stays on your device — permanently.",
            category: .infrastructure,
            status: .live,
            accentHex: "#8b5cf6",
            gradientFromHex: "#8b5cf6",
            gradientToHex: "#6d28d9",
            systemImage: "brain",
            viewType: "models-manage",
            externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "canvas",
            name: "Allternit Canvas",
            tagline: "Documents Built with AI",
            description: "A new kind of document editor. Prompt to draft, refine together, export anywhere. The blank page, replaced.",
            category: .create,
            status: .beta,
            accentHex: "#6366f1",
            gradientFromHex: "#6366f1",
            gradientToHex: "#4f46e5",
            systemImage: "doc.text",
            viewType: "allternit-canvas",
            externalURL: nil
        ),
    ]

    /// Full product catalog, grouped by category.
    static let all: [ProductDiscoveryItem] = [
        ProductDiscoveryItem(
            id: "chat", name: "Chat", tagline: "Conversational AI",
            description: "Conversational AI for everything.",
            category: .core, status: .live,
            accentHex: "#D97757", gradientFromHex: "#D97757", gradientToHex: "#B08D6E",
            systemImage: "bubble.left", viewType: "chat", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "code", name: "Allternit Code", tagline: "AI pair programmer",
            description: "AI pair programmer in your IDE.",
            category: .core, status: .live,
            accentHex: "#f59e0b", gradientFromHex: "#f59e0b", gradientToHex: "#d97706",
            systemImage: "terminal", viewType: "code", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "cowork", name: "Cowork", tagline: "Collaborative AI",
            description: "Collaborative AI for teams.",
            category: .core, status: .live,
            accentHex: "#06b6d4", gradientFromHex: "#06b6d4", gradientToHex: "#0284c7",
            systemImage: "person.3", viewType: "chat", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "computer-use", name: "Computer Use", tagline: "AI that sees and acts",
            description: "AI that sees and controls browsers.",
            category: .aiAgents, status: .live,
            accentHex: "#5B8DEF", gradientFromHex: "#5B8DEF", gradientToHex: "#3b5bdb",
            systemImage: "desktopcomputer", viewType: "operator", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "swarm", name: "Swarm ADE", tagline: "Orchestrate agents",
            description: "Orchestrate hundreds of AI agents.",
            category: .aiAgents, status: .live,
            accentHex: "#10b981", gradientFromHex: "#10b981", gradientToHex: "#059669",
            systemImage: "network", viewType: "swarm", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "agent-hub", name: "Agent Hub", tagline: "Build & deploy agents",
            description: "Build, deploy, and manage agents.",
            category: .aiAgents, status: .live,
            accentHex: "#a78bfa", gradientFromHex: "#a78bfa", gradientToHex: "#7c3aed",
            systemImage: "cpu", viewType: "agent-hub", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "canvas", name: "Canvas", tagline: "Documents built with AI",
            description: "Documents built with AI.",
            category: .create, status: .beta,
            accentHex: "#6366f1", gradientFromHex: "#6366f1", gradientToHex: "#4f46e5",
            systemImage: "doc.text", viewType: "allternit-canvas", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "design", name: "Allternit Design", tagline: "Visual design tools",
            description: "Visual design and creative tools.",
            category: .create, status: .beta,
            accentHex: "#ec4899", gradientFromHex: "#ec4899", gradientToHex: "#be185d",
            systemImage: "paintbrush", viewType: "design", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "workflow", name: "Workflows", tagline: "Visual automation",
            description: "Visual automation and task pipelines.",
            category: .create, status: .beta,
            accentHex: "#14b8a6", gradientFromHex: "#14b8a6", gradientToHex: "#0d9488",
            systemImage: "arrow.branch", viewType: "cowork-runs", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "local-brain", name: "Local Brain", tagline: "Private offline AI",
            description: "Private offline AI on your machine.",
            category: .infrastructure, status: .live,
            accentHex: "#8b5cf6", gradientFromHex: "#8b5cf6", gradientToHex: "#6d28d9",
            systemImage: "brain", viewType: "models-manage", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "cloud-deploy", name: "Cloud Deploy", tagline: "Deploy anywhere",
            description: "Deploy Allternit nodes to any cloud.",
            category: .infrastructure, status: .live,
            accentHex: "#22c55e", gradientFromHex: "#22c55e", gradientToHex: "#16a34a",
            systemImage: "icloud.and.arrow.up", viewType: "deploy", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "browser", name: "Browser Capsule", tagline: "AI in every tab",
            description: "AI assistant in every browser tab.",
            category: .surfaces, status: .live,
            accentHex: "#4285F4", gradientFromHex: "#4285F4", gradientToHex: "#34A853",
            systemImage: "puzzlepiece.extension", viewType: "browser-ext",
            externalURL: "https://chrome.google.com/webstore"
        ),
        ProductDiscoveryItem(
            id: "desktop", name: "Desktop App", tagline: "Native macOS/Windows/Linux",
            description: "Native app for macOS, Windows, Linux.",
            category: .surfaces, status: .live,
            accentHex: "#D4B08C", gradientFromHex: "#D4B08C", gradientToHex: "#B08D6E",
            systemImage: "laptopcomputer", viewType: "desktop-dl",
            externalURL: "https://allternit.com/download"
        ),
        ProductDiscoveryItem(
            id: "labs", name: "A://Labs", tagline: "AI courses",
            description: "AI courses — 7 live in Canvas LMS.",
            category: .learn, status: .live,
            accentHex: "#f59e0b", gradientFromHex: "#f59e0b", gradientToHex: "#b45309",
            systemImage: "graduationcap", viewType: "labs", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "marketplace", name: "Marketplace", tagline: "Plugins & extensions",
            description: "Discover plugins and extensions.",
            category: .ecosystem, status: .beta,
            accentHex: "#10b981", gradientFromHex: "#10b981", gradientToHex: "#059669",
            systemImage: "bag", viewType: "marketplace", externalURL: nil
        ),
        ProductDiscoveryItem(
            id: "dev-portal", name: "Dev Portal", tagline: "APIs & SDKs",
            description: "APIs, SDKs, and documentation.",
            category: .ecosystem, status: .live,
            accentHex: "#6366f1", gradientFromHex: "#6366f1", gradientToHex: "#4338ca",
            systemImage: "arrow.up.forward.square", viewType: "dev-portal",
            externalURL: "https://docs.allternit.com"
        ),
    ]
}
