import SwiftUI

/// Nodes state: compute-node fleet list, connectivity, and join-token generation.
///
/// Data source: `GET/DELETE /api/v1/nodes/*` on the gateway (NodesClient).
@MainActor
final class NodesStore: ObservableObject {
    static let shared = NodesStore()

    @Published private(set) var nodes: [NodeRecord] = []
    @Published private(set) var connectedNodeIDs: [String] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var isDeletingNodeId: String? = nil
    @Published private(set) var isGeneratingToken = false
    @Published private(set) var generatedToken: NodeTokenResponse? = nil

    private let client: NodesClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: NodesClient = NodesClient()) {
        self.client = client
    }

    // MARK: - Fetch

    func fetchIfNeeded(force: Bool = false) {
        guard force || nodes.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                let response = try await self.client.fetchNodes()
                self.nodes = response.allNodes
                self.connectedNodeIDs = response.connected
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    func refresh() async {
        loadError = nil
        do {
            let response = try await client.fetchNodes()
            self.nodes = response.allNodes
            self.connectedNodeIDs = response.connected
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Actions

    func deleteNode(_ nodeId: String) async throws {
        isDeletingNodeId = nodeId
        defer { isDeletingNodeId = nil }
        try await client.deleteNode(nodeId: nodeId)
        await refresh()
    }

    func generateToken() async throws {
        isGeneratingToken = true
        defer { isGeneratingToken = false }
        generatedToken = try await client.generateToken()
    }

    func clearGeneratedToken() {
        generatedToken = nil
    }

    // MARK: - Helpers

    func isConnected(_ nodeId: String) -> Bool {
        connectedNodeIDs.contains(nodeId)
    }

    var onlineCount: Int {
        nodes.filter { isConnected($0.id) }.count
    }

    var offlineCount: Int {
        nodes.count - onlineCount
    }
}
