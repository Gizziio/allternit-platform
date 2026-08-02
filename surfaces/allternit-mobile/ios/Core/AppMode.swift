import SwiftUI

/// Platform modes, mirroring the web shell's `AppMode`
/// (surfaces/ai.allternit.com/src/shell/ModeSwitcher.tsx:24-70).
///
/// `design` is skipped on iOS — on the web it opens an external window.
/// Cowork is NOT a switcher destination: the platform's primary surface
/// control is the 7-row [Chats | Projects | Artifacts Library | Agents |
/// Automation Tasks | Code | ACI] tab list in the sidebar header
/// (HistorySidebarView — no persistent bottom bar, matching ChatGPT/Claude's
/// iOS apps), and cowork is a composer-level toggle inside Chats
/// (BottomDock.tsx ChatCoworkToggle). Projects, the artifacts library, the
/// Agent Hub, and Automation Tasks are iOS-only tab surfaces layered over
/// the same modes (they don't stamp an `origin_surface` of their own).
enum AppMode: String, CaseIterable, Sendable {
    case chat
    case cowork
    case code
    case browser

    /// `origin_surface` value sent on session create — matches the raw
    /// value the web's mode-session-store uses (mode-session-store.ts:738).
    var originSurface: String { rawValue }

    var label: String {
        switch self {
        case .chat: return "Chat"
        case .cowork: return "Cowork"
        case .code: return "Code"
        case .browser: return "ACI"
        }
    }

    /// Mode-aware theme (accent / soft / glow / icon) — see ModeTheme.swift.
    var theme: ModeTheme { ModeTheme(mode: self) }
}

/// App-wide mode state, injected from AllternitApp as an @EnvironmentObject.
///
/// Persists to UserDefaults under the same key the web uses in localStorage
/// ("allternit-platform-mode", ModeSwitcher.tsx:73), so the contract stays
/// recognizable across surfaces.
@MainActor
final class AppModeStore: ObservableObject {
    static let storageKey = "allternit-platform-mode"

    @Published var mode: AppMode {
        didSet {
            UserDefaults.standard.set(mode.rawValue, forKey: Self.storageKey)
        }
    }

    /// The sidebar tab whose surface fills the content pane. Chats/Code/ACI
    /// track `mode`; Projects, Artifacts Library, Agents, and Automation
    /// Tasks are iOS-only surfaces layered on top (the mode — and so history
    /// filtering, theme accent, and session stamping — stays wherever it was).
    @Published var activeTab: ModeBarItem

    init(defaults: UserDefaults = .standard) {
        let mode: AppMode
        if CommandLine.arguments.contains("-chat") {
            mode = .chat
        } else if CommandLine.arguments.contains("-code") {
            mode = .code
        } else if CommandLine.arguments.contains("-browser") {
            mode = .browser
        } else {
            let saved = defaults.string(forKey: Self.storageKey)
            mode = saved.flatMap(AppMode.init(rawValue:)) ?? .chat
        }
        self.mode = mode
        self.activeTab = ModeBarItem.tab(for: mode)
    }

    /// Both Home surfaces (chat + cowork) live under the Chats tab; selecting
    /// it always lands on plain chat. Projects / Artifacts Library / Agents /
    /// Automation Tasks switch the surface without touching the mode.
    func selectBarItem(_ item: ModeBarItem) {
        activeTab = item
        switch item {
        case .chats: mode = .chat
        case .code: mode = .code
        case .aci: mode = .browser
        case .projects, .artifacts, .agents, .automation: break
        }
    }
}

/// The seven destinations of the sidebar's tab list:
/// Chats / Projects / Artifacts Library / Agents / Automation Tasks / Code /
/// ACI.
enum ModeBarItem: CaseIterable {
    case chats, projects, artifacts, agents, automation, code, aci

    var label: String {
        switch self {
        case .chats: return "Chats"
        case .projects: return "Projects"
        case .artifacts: return "Artifacts Library"
        case .agents: return "Agents"
        case .automation: return "Automation Tasks"
        case .code: return "Code"
        case .aci: return "ACI"
        }
    }

    /// SF Symbols standing in for the web's Phosphor icons.
    var icon: String {
        switch self {
        case .chats: return "bubble.left"
        case .projects: return "folder"
        case .artifacts: return "archivebox"
        case .agents: return "cpu"
        case .automation: return "clock.arrow.circlepath"
        case .code: return "terminal"
        case .aci: return "globe"
        }
    }

    /// The tab a launch-time mode lands on: cowork lives inside Chats;
    /// code/ACI map to themselves.
    static func tab(for mode: AppMode) -> ModeBarItem {
        switch mode {
        case .chat, .cowork: return .chats
        case .code: return .code
        case .browser: return .aci
        }
    }
}
