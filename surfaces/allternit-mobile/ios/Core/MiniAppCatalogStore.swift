import SwiftUI

/// Catalog source for the Mini-apps Store.
///
/// Phase 1 serves the hardcoded community catalog and the public MCP registry.
/// The Allternit signed registry is deferred.
@MainActor
final class MiniAppCatalogStore: ObservableObject {
    static let shared = MiniAppCatalogStore()

    @Published private(set) var apps: [MiniApp] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    /// Public MCP registry endpoint (same as web's use-mini-app-catalog.ts).
    private let mcpRegistryURL = URL(string: "https://registry.modelcontextprotocol.io/v0.1/servers?limit=24")!
    private let pinnedKey = "allternit-mini-apps-pinned"
    private var fetchTask: Task<Void, Never>? = nil

    private init() {}

    // MARK: - Persistence

    private var pinnedIds: Set<String> {
        get {
            Set(UserDefaults.standard.stringArray(forKey: pinnedKey) ?? [])
        }
        set {
            UserDefaults.standard.set(Array(newValue), forKey: pinnedKey)
        }
    }

    func isPinned(id: String) -> Bool {
        pinnedIds.contains(id)
    }

    func setPinned(_ pinned: Bool, for id: String) {
        var ids = pinnedIds
        if pinned {
            ids.insert(id)
        } else {
            ids.remove(id)
        }
        pinnedIds = ids
        if let index = apps.firstIndex(where: { $0.id == id }) {
            apps[index].isPinned = pinned
            apps[index].status = pinned ? .pinned : .available
        }
    }

    // MARK: - Fetch

    func fetchCatalogIfNeeded(force: Bool = false) {
        guard force || apps.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                let mcpApps = try await self.fetchMCPRegistry()
                let combined = Self.communityCatalog + mcpApps
                let pinned = self.pinnedIds
                self.apps = combined.map { app in
                    var copy = app
                    copy.isPinned = pinned.contains(app.id)
                    copy.status = copy.isPinned ? .pinned : app.status
                    return copy
                }
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    private func fetchMCPRegistry() async throws -> [MiniApp] {
        let (data, response) = try await URLSession.shared.data(from: mcpRegistryURL)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let servers = payload?["servers"] as? [[String: Any]] ?? []
        return servers.compactMap(Self.decodeMCPRecord)
    }

    private static func decodeMCPRecord(_ record: [String: Any]) -> MiniApp? {
        guard let server = record["server"] as? [String: Any],
              let name = server["name"] as? String else { return nil }
        let title = server["title"] as? String
        let description = server["description"] as? String ?? "MCP server from the official registry."
        let version = server["version"] as? String
        let remotes = (server["remotes"] as? [[String: Any]]) ?? []
        let remoteURL = remotes.first?["url"] as? String
        let repositoryURL = (server["repository"] as? [String: Any])?["url"] as? String
        let sourceUrl = remoteURL ?? repositoryURL ?? "https://registry.modelcontextprotocol.io"
        let publisher = name.split(separator: "/").first.map(String.init)
        return MiniApp(
            id: "mcp:\(name)",
            name: title ?? name.split(separator: "/").last.map(String.init) ?? name,
            description: description,
            version: version,
            category: .connector,
            url: remoteURL ?? sourceUrl,
            sourceUrl: sourceUrl,
            repo: repositoryURL,
            githubUrl: repositoryURL,
            publisher: publisher,
            capabilities: remoteURL != nil ? ["Remote MCP"] : ["Package MCP"],
            verified: true,
            featured: false,
            catalogSource: .mcp,
            status: .available,
            isPinned: false
        )
    }

    // MARK: - Community catalog (mirrors web's COMMUNITY_CATALOG)

    private static let communityCatalog: [MiniApp] = [
        MiniApp(
            id: "github:activepieces/activepieces",
            name: "Activepieces",
            description: "Open-source automation platform with a visual workflow builder and a large connector ecosystem.",
            version: nil,
            category: .connector,
            url: "https://github.com/activepieces/activepieces",
            sourceUrl: "https://github.com/activepieces/activepieces",
            repo: "activepieces/activepieces",
            githubUrl: "https://github.com/activepieces/activepieces",
            publisher: "Activepieces",
            capabilities: ["Workflow automation", "Connectors", "Self-hosted"],
            verified: false,
            featured: true,
            catalogSource: .github,
            status: .available,
            isPinned: false
        ),
        MiniApp(
            id: "github:n8n-io/n8n",
            name: "n8n",
            description: "Community workflow automation platform for connecting APIs, services, data, and AI tools.",
            version: nil,
            category: .connector,
            url: "https://github.com/n8n-io/n8n",
            sourceUrl: "https://github.com/n8n-io/n8n",
            repo: "n8n-io/n8n",
            githubUrl: "https://github.com/n8n-io/n8n",
            publisher: "n8n",
            capabilities: ["Workflow automation", "Integrations", "Self-hosted"],
            verified: false,
            featured: true,
            catalogSource: .github,
            status: .available,
            isPinned: false
        ),
        MiniApp(
            id: "github:lobehub/lobe-chat",
            name: "LobeChat",
            description: "Open-source AI workspace with model providers, agents, knowledge bases, and plugins.",
            version: nil,
            category: .communication,
            url: "https://github.com/lobehub/lobe-chat",
            sourceUrl: "https://github.com/lobehub/lobe-chat",
            repo: "lobehub/lobe-chat",
            githubUrl: "https://github.com/lobehub/lobe-chat",
            publisher: "LobeHub",
            capabilities: ["AI workspace", "Agents", "Knowledge bases"],
            verified: false,
            featured: false,
            catalogSource: .github,
            status: .available,
            isPinned: false
        ),
        MiniApp(
            id: "github:mintplex-labs/anything-llm",
            name: "AnythingLLM",
            description: "Open-source AI application for document chat, agents, models, and private workspaces.",
            version: nil,
            category: .data,
            url: "https://github.com/Mintplex-Labs/anything-llm",
            sourceUrl: "https://github.com/Mintplex-Labs/anything-llm",
            repo: "Mintplex-Labs/anything-llm",
            githubUrl: "https://github.com/Mintplex-Labs/anything-llm",
            publisher: "Mintplex Labs",
            capabilities: ["Document chat", "Agents", "Local models"],
            verified: false,
            featured: false,
            catalogSource: .github,
            status: .available,
            isPinned: false
        )
    ]
}
