import Foundation

/// App-wide cache of the user's self-registered `gizzi serve --tunnel`
/// instances (fetched from the cloud API, see InstancesClient). The terminal
/// resolves its pty host from `preferredInstanceURL` instead of only the
/// static `ALLTERNIT_GIZZI_CODE_URL` build setting.
///
/// With several instances registered, the code thread's instance menu can
/// pin one (`selectedInstanceID`); automatic resolution is first ONLINE,
/// else first, and a pinned id that no longer matches a registered
/// instance falls back to it.
@MainActor
final class InstanceStore: ObservableObject {
    static let shared = InstanceStore()

    /// Registered instances, newest first. Kept stale on refresh failure.
    @Published private(set) var instances: [GizziInstance] = []

    /// Last refresh failure, for diagnostics; nil after a successful refresh.
    @Published private(set) var lastError: String?

    /// The instance the user pinned in the code thread's instance menu
    /// (nil = automatic). Persisted like EnvironmentStore's
    /// `allternit.active-runtime-id`; an id that no longer matches a
    /// registered instance just falls back to automatic resolution.
    @Published private(set) var selectedInstanceID: String? {
        didSet { defaults.set(selectedInstanceID, forKey: Keys.selectedInstanceID) }
    }

    private let client: InstancesClient
    private let defaults: UserDefaults
    private var hasFetched = false

    private enum Keys {
        static let selectedInstanceID = "allternit.selected-gizzi-instance"
    }

    init(client: InstancesClient = InstancesClient(), defaults: UserDefaults = .standard) {
        self.client = client
        self.defaults = defaults
        self.selectedInstanceID = defaults.string(forKey: Keys.selectedInstanceID)
    }

    /// The instance the terminal should attach to: the pinned instance's
    /// URL when `selectedInstanceID` matches a registered instance, else
    /// the first ONLINE instance's URL, else the first instance's URL,
    /// else nil (caller falls back to `AppConfig.gizziCodeBaseURL`).
    var preferredInstanceURL: URL? {
        preferredInstance?.instanceURL
    }

    /// The instance backing `preferredInstanceURL`, for display ("attached
    /// to my-macbook").
    var preferredInstance: GizziInstance? {
        if let selectedInstanceID,
           let selected = instances.first(where: { $0.id == selectedInstanceID }) {
            return selected
        }
        return instances.first(where: { $0.isOnline }) ?? instances.first
    }

    /// Pins the terminal to one instance; nil returns to automatic
    /// resolution (first ONLINE, else first).
    func select(_ id: String?) {
        selectedInstanceID = id
    }

    /// Fetches the instance list once per app run; later calls are no-ops.
    /// Used to warm the cache without hammering the cloud API on every view.
    func refreshIfNeeded() async {
        guard !hasFetched else { return }
        await refresh()
    }

    /// Refetches the instance list. Failures keep the stale list and record
    /// `lastError` — the terminal silently falls back to the static
    /// `AppConfig.gizziCodeBaseURL`, so local dev works with the cloud API
    /// unreachable.
    func refresh() async {
        do {
            instances = try await client.fetchInstances()
            lastError = nil
            hasFetched = true
        } catch is CancellationError {
            // View disappeared mid-flight — keep the current state.
        } catch {
            lastError = error.localizedDescription
        }
    }
}
