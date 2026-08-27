import SwiftUI

/// VPS & Servers state: SSH connection list and connection actions.
///
/// Data source: `/api/v1/ssh-connections/*` on the gateway (SSHConnectionsClient).
@MainActor
final class SSHConnectionsStore: ObservableObject {
    static let shared = SSHConnectionsStore()

    @Published private(set) var connections: [SSHConnection] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var isCreating = false
    @Published private(set) var createError: String? = nil
    @Published private(set) var isDeletingId: String? = nil
    @Published private(set) var isConnectingId: String? = nil
    @Published private(set) var isDisconnectingId: String? = nil
    @Published private(set) var isTesting = false
    @Published private(set) var testResult: SSHConnectionTestResponse? = nil

    private let client: SSHConnectionsClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: SSHConnectionsClient = SSHConnectionsClient()) {
        self.client = client
    }

    // MARK: - Fetch

    func fetchIfNeeded(force: Bool = false) {
        guard force || connections.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.connections = try await self.client.listConnections()
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
            self.connections = try await client.listConnections()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Actions

    func createConnection(_ request: SSHConnectionCreateRequest) async throws {
        isCreating = true
        createError = nil
        defer { isCreating = false }
        let connection = try await client.createConnection(request)
        connections.append(connection)
    }

    func testConnection(_ request: SSHConnectionCreateRequest) async throws -> SSHConnectionTestResponse {
        isTesting = true
        defer { isTesting = false }
        let result = try await client.testConnection(request)
        testResult = result
        return result
    }

    func clearTestResult() {
        testResult = nil
    }

    func clearCreateError() {
        createError = nil
    }

    func deleteConnection(_ id: String) async throws {
        isDeletingId = id
        defer { isDeletingId = nil }
        try await client.deleteConnection(id: id)
        connections.removeAll { $0.id == id }
    }

    func connect(_ id: String) async throws {
        isConnectingId = id
        defer { isConnectingId = nil }
        let updated = try await client.connect(id: id)
        replace(updated)
    }

    func disconnect(_ id: String) async throws {
        isDisconnectingId = id
        defer { isDisconnectingId = nil }
        let updated = try await client.disconnect(id: id)
        replace(updated)
    }

    private func replace(_ connection: SSHConnection) {
        if let index = connections.firstIndex(where: { $0.id == connection.id }) {
            connections[index] = connection
        }
    }
}
