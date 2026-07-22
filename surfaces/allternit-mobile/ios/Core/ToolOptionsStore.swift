import SwiftUI

/// Composer "+" sheet tool-access options (Claude iOS parity): when agent
/// tools load for a conversation. `auto` is the default — the agent decides.
enum ToolAccess: String, CaseIterable, Sendable {
    case auto
    case onDemand = "on_demand"
    case always

    var label: String {
        switch self {
        case .auto: return "Auto"
        case .onDemand: return "On demand"
        case .always: return "Always"
        }
    }

    /// One-line explainer under the segmented control (Claude's sheet copy:
    /// "Load when needed" vs "Ready from start").
    var explainer: String {
        switch self {
        case .auto: return "The agent decides which tools to load, when."
        case .onDemand: return "Load when needed"
        case .always: return "Ready from start"
        }
    }
}

/// Composer tool options behind the "+" sheet's toggles — Web search,
/// Research, and the Tool access mode. Persisted app-wide (UserDefaults),
/// mirroring AgentModeStore's persistence pattern. Sent on every agent-chat
/// request as `metadata.tools` (see AgentChatClient.AgentChatRequest).
@MainActor
final class ToolOptionsStore: ObservableObject {
    static let shared = ToolOptionsStore()

    @Published var webSearch: Bool {
        didSet { defaults.set(webSearch, forKey: Keys.webSearch) }
    }
    @Published var research: Bool {
        didSet { defaults.set(research, forKey: Keys.research) }
    }
    @Published var toolAccess: ToolAccess {
        didSet { defaults.set(toolAccess.rawValue, forKey: Keys.toolAccess) }
    }

    private let defaults: UserDefaults

    private enum Keys {
        static let webSearch = "allternit-tool-web-search"
        static let research = "allternit-tool-research"
        static let toolAccess = "allternit-tool-access"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        // Unset compositor toggle seeds from the Settings → Capabilities
        // "Web search" default; once the user touches the "+" sheet toggle
        // its own stored value wins.
        self.webSearch = defaults.object(forKey: Keys.webSearch) as? Bool
            ?? SettingsStore.shared.webSearchDefault
        self.research = defaults.bool(forKey: Keys.research)
        self.toolAccess = defaults.string(forKey: Keys.toolAccess)
            .flatMap(ToolAccess.init(rawValue:)) ?? .auto
    }

    /// Wire shape for the agent-chat request body's `metadata.tools`.
    var optionsForSend: ToolOptions {
        ToolOptions(webSearch: webSearch, research: research, toolAccess: toolAccess.rawValue)
    }
}
