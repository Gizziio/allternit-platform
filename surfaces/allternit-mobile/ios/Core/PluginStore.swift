import SwiftUI

// -----------------------------------------------------------------------------
// PluginStore — local enabled-state catalog for the iOS plugin marketplace.
//
// iOS does not execute plugin code; this store mirrors the web plugin registry
// surface by persisting which bundled plugins the user has enabled.
// -----------------------------------------------------------------------------

@MainActor
final class PluginStore: ObservableObject {
    static let shared = PluginStore()
    private static let enabledKey = "allternit.plugin.enabled"

    @Published private(set) var plugins: [MarketplacePlugin] = MarketplacePlugin.bundledCatalog
    @Published private(set) var enabledIds: Set<String> = []

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.enabledIds = Self.loadEnabled(defaults: defaults)
    }

    func isEnabled(pluginId: String) -> Bool {
        enabledIds.contains(pluginId)
    }

    func toggle(pluginId: String) {
        if enabledIds.contains(pluginId) {
            enabledIds.remove(pluginId)
        } else {
            enabledIds.insert(pluginId)
        }
        Self.saveEnabled(enabledIds, defaults: defaults)
    }

    func filtered(category: PluginCategory, query: String) -> [MarketplacePlugin] {
        plugins.filter { plugin in
            let matchesCategory = category == .all || plugin.category == category
            guard matchesCategory else { return false }
            let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if q.isEmpty { return true }
            return plugin.name.localizedCaseInsensitiveContains(q)
                || plugin.description.localizedCaseInsensitiveContains(q)
                || plugin.author.localizedCaseInsensitiveContains(q)
                || plugin.capabilities.contains { $0.localizedCaseInsensitiveContains(q) }
        }
    }

    private static func loadEnabled(defaults: UserDefaults) -> Set<String> {
        guard let array = defaults.stringArray(forKey: enabledKey) else { return [] }
        return Set(array)
    }

    private static func saveEnabled(_ enabled: Set<String>, defaults: UserDefaults) {
        defaults.set(Array(enabled), forKey: enabledKey)
    }
}
