import SwiftUI

/// Webhook triggers state: the org's trigger list backing the Webhooks
/// settings panel and the bot detail's read-only card.
///
/// Data source: `GET /api/v1/webhook-triggers` on allternit-api
/// (WebhookTriggersClient; cmd/allternit-api/src/webhook_trigger_routes.rs).
/// On failure the store keeps whatever it last had and exposes `loadError`
/// so views render an error state instead of spinning forever
/// (CronJobStore/ProjectStore convention). Delivery logs are cached
/// per trigger and fetched on demand when a row expands.
@MainActor
final class WebhookTriggersStore: ObservableObject {
    static let shared = WebhookTriggersStore()

    @Published private(set) var triggers: [WebhookTrigger] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    /// Delivery logs keyed by trigger id — populated on row expansion
    /// (`refreshDeliveries`), evicted with their trigger on delete.
    @Published private(set) var deliveries: [String: [WebhookTriggerDelivery]] = [:]
    /// Trigger ids whose deliveries request is in flight.
    @Published private(set) var loadingDeliveries: Set<String> = []

    private let client: WebhookTriggersClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: WebhookTriggersClient = WebhookTriggersClient()) {
        self.client = client
    }

    func trigger(withId id: String) -> WebhookTrigger? {
        triggers.first { $0.id == id }
    }

    /// Triggers targeting one bot — the bot detail card's "N triggers wake
    /// this bot" (BotHomeView.tsx `WebhooksCard` parity).
    func triggers(forBotId botId: String) -> [WebhookTrigger] {
        triggers.filter { $0.targetBotId == botId }
    }

    // MARK: - Fetch

    /// Fetches the trigger list once per launch unless forced; concurrent
    /// callers share the in-flight request (CronJobStore's
    /// `fetchJobsIfNeeded` pattern).
    func fetchTriggersIfNeeded(force: Bool = false) {
        guard force || triggers.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.triggers = try await self.client.listTriggers()
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    /// Unconditional refresh (pull-to-refresh, post-mutation resync).
    func refresh() async {
        loadError = nil
        do {
            triggers = try await client.listTriggers()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Mutations

    /// Creates a trigger and prepends it locally (the list is newest-first).
    /// The server generates the signing secret; it is never returned.
    @discardableResult
    func createTrigger(name: String, targetBotId: String) async throws -> WebhookTrigger {
        let trigger = try await client.createTrigger(name: name, targetBotId: targetBotId)
        triggers.insert(trigger, at: 0)
        return trigger
    }

    /// Applies a partial update and splices the server-returned row back in
    /// (the PATCH answers `{ trigger }`, so no resync round trip is needed).
    @discardableResult
    func updateTrigger(id: String, name: String? = nil, targetBotId: String? = nil,
                       active: Bool? = nil) async throws -> WebhookTrigger {
        var body = UpdateWebhookTriggerBody()
        body.name = name
        body.targetBotId = targetBotId
        body.active = active
        let trigger = try await client.updateTrigger(id: id, body: body)
        if let index = triggers.firstIndex(where: { $0.id == id }) {
            triggers[index] = trigger
        } else {
            triggers.insert(trigger, at: 0)
        }
        return trigger
    }

    /// Active-toggle convenience (PATCH `{ active }` only).
    func setActive(id: String, active: Bool) async throws {
        try await updateTrigger(id: id, active: active)
    }

    /// Deletes a trigger and removes it (and its cached deliveries) locally.
    func deleteTrigger(id: String) async throws {
        try await client.deleteTrigger(id: id)
        triggers.removeAll { $0.id == id }
        deliveries[id] = nil
        loadingDeliveries.remove(id)
    }

    // MARK: - Deliveries

    /// (Re)fetches a trigger's recent deliveries (last 100, newest first).
    /// Duplicate in-flight requests for the same trigger are dropped.
    func refreshDeliveries(forTriggerId id: String) async {
        guard !loadingDeliveries.contains(id) else { return }
        loadingDeliveries.insert(id)
        defer { loadingDeliveries.remove(id) }
        do {
            deliveries[id] = try await client.listDeliveries(triggerId: id)
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            // Deliveries are supplementary; a failed fetch leaves the row's
            // previous cache (or the empty state) in place, matching the web
            // panel's `.catch(() => setDeliveries([]))`.
            deliveries[id] = deliveries[id] ?? []
        }
    }
}
