import SwiftUI

/// Cloud Instances state: wizard deployment sessions on the cloud API.
///
/// Data source: `/api/v1/cloud/wizard/deployments*` on
/// `AppConfig.cloudAPIBaseURL` (CloudInstancesClient).
@MainActor
final class CloudInstancesStore: ObservableObject {
    static let shared = CloudInstancesStore()

    @Published private(set) var sessions: [CloudWizardSession] = []
    @Published private(set) var activeSession: CloudWizardSession? = nil
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var isStarting = false
    @Published private(set) var startError: String? = nil
    @Published private(set) var isAdvancing = false
    @Published private(set) var isBootstrapping = false
    @Published private(set) var bootstrapResult: CloudBootstrapResult? = nil
    @Published private(set) var isCancelling = false
    @Published private(set) var isDeletingId: String? = nil

    private let client: CloudInstancesClient
    private var fetchTask: Task<Void, Never>? = nil
    private var pollTask: Task<Void, Never>? = nil

    init(client: CloudInstancesClient = CloudInstancesClient()) {
        self.client = client
    }

    // MARK: - Fetch

    func fetchIfNeeded(force: Bool = false) {
        guard force || sessions.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.sessions = try await self.client.listSessions()
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
            self.sessions = try await client.listSessions()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Actions

    func startManualSession(_ request: CloudWizardStartRequest) async throws {
        isStarting = true
        startError = nil
        defer { isStarting = false }
        let session = try await client.startSession(request)
        activeSession = session
        sessions.insert(session, at: 0)
        startPolling()
    }

    func advanceActiveSession() async throws {
        guard let session = activeSession else { return }
        isAdvancing = true
        defer { isAdvancing = false }
        let updated = try await client.advanceSession(id: session.id)
        activeSession = updated
        replaceSession(updated)
        if updated.currentStep == "Bootstrap" || updated.currentStep == "Complete" || updated.currentStep == "Failed" {
            pollTask?.cancel()
        }
    }

    func bootstrapActiveSession() async throws {
        guard let session = activeSession else { return }
        isBootstrapping = true
        defer { isBootstrapping = false }
        let result = try await client.bootstrapSession(id: session.id)
        bootstrapResult = result
        if let wizard = result.wizard {
            activeSession = wizard
            replaceSession(wizard)
        }
    }

    func cancelActiveSession() async throws {
        guard let session = activeSession else { return }
        isCancelling = true
        defer { isCancelling = false }
        try await client.cancelSession(id: session.id)
        pollTask?.cancel()
        let updated = try await client.fetchSession(id: session.id)
        activeSession = updated
        replaceSession(updated)
    }

    func deleteSession(_ id: String) async throws {
        isDeletingId = id
        defer { isDeletingId = nil }
        try await client.deleteSession(id: id)
        sessions.removeAll { $0.id == id }
        if activeSession?.id == id {
            activeSession = nil
            bootstrapResult = nil
            pollTask?.cancel()
        }
    }

    func setActiveSession(_ session: CloudWizardSession?) {
        activeSession = session
        bootstrapResult = nil
        startError = nil
        pollTask?.cancel()
        if session != nil {
            startPolling()
        }
    }

    func clearErrors() {
        loadError = nil
        startError = nil
    }

    // MARK: - Polling

    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            guard let self else { return }
            for _ in 0..<60 {
                guard !Task.isCancelled, let id = self.activeSession?.id else { return }
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                guard !Task.isCancelled, self.activeSession?.id == id else { return }
                let terminal = ["Complete", "Failed", "Cancelled"]
                guard !(self.activeSession.map { terminal.contains($0.currentStep) } ?? true) else { return }
                do {
                    let updated = try await self.client.fetchSession(id: id)
                    self.activeSession = updated
                    self.replaceSession(updated)
                } catch {
                    // Best-effort polling.
                }
            }
        }
    }

    private func replaceSession(_ session: CloudWizardSession) {
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        }
    }
}
