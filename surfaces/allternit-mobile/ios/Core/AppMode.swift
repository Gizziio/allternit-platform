import SwiftUI

/// Platform modes, mirroring the web shell's `AppMode`
/// (surfaces/ai.allternit.com/src/shell/ModeSwitcher.tsx:24-70).
///
/// `design` is skipped on iOS — on the web it opens an external window.
/// Cowork is NOT a switcher destination: the platform's primary surface
HEAD
HEAD
HEAD
/// control is the 9-row [Chats | Projects | Artifacts Library | Agents |
HEAD
/// Automation Tasks | Code | ACI | Research | Documents] tab list in the
/// sidebar header (HistorySidebarView — no persistent bottom bar, matching
/// ChatGPT/Claude's iOS apps), and cowork is a composer-level toggle inside
/// Chats (BottomDock.tsx ChatCoworkToggle). Projects, the artifacts library,
/// the Agent Hub, Automation Tasks, Research, and Documents are iOS-only tab
/// surfaces layered over the same modes (they don't stamp an `origin_surface`
/// of their own)./// Automation Tasks | Plugins | Code | ACI | Research] tab list in the sidebar header
/// (HistorySidebarView — no persistent bottom bar, matching ChatGPT/Claude's
/// iOS apps), and cowork is a composer-level toggle inside Chats
/// (BottomDock.tsx ChatCoworkToggle). Projects, the artifacts library, the
/// Agent Hub, Automation Tasks, Plugins, and Research are iOS-only tab surfaces layered/// control is the 10-row [Chats | Projects | Artifacts Library | Agents |
/// Automation Tasks | Swarm | Code | ACI | Research] tab list in the sidebar header
/// (HistorySidebarView — no persistent bottom bar, matching ChatGPT/Claude's
/// iOS apps), and cowork is a composer-level toggle inside Chats
/// (BottomDock.tsx ChatCoworkToggle). Projects, the artifacts library, the
/// Agent Hub, Automation Tasks, Swarm, and Research are iOS-only tab surfaces layered
>>>>>>> origin/feat/ios-swarm-ade
/// over the same modes (they don't stamp an `origin_surface` of their own).
>>>>>>> origin/feat/ios-plugin-marketplace/// control is the 8-row [Chats | Projects | Artifacts Library | Agents |
/// Automation Tasks | Team Skills | Code | ACI] tab list in the sidebar header
/// (HistorySidebarView — no persistent bottom bar, matching ChatGPT/Claude's
/// iOS apps), and cowork is a composer-level toggle inside Chats
/// (BottomDock.tsx ChatCoworkToggle). Projects, the artifacts library, the
/// Agent Hub, Automation Tasks, Team Skills, and Research are iOS-only tab
/// surfaces layered over the same modes (they don't stamp an `origin_surface`
/// of their own).
>>>>>>> origin/feat/ios-team-skills/// control is the tab list in the sidebar header
/// [Chats | Projects | Artifacts Library | Agents | Automation Tasks |
/// Products | Code | ACI | Research] (HistorySidebarView — no persistent
/// bottom bar, matching ChatGPT/Claude's iOS apps), and cowork is a
/// composer-level toggle inside Chats (BottomDock.tsx ChatCoworkToggle).
/// Projects, the artifacts library, the Agent Hub, Automation Tasks,
/// Products Discovery, and Research are iOS-only tab surfaces layered over
/// the same modes (they don't stamp an `origin_surface` of their own).
>>>>>>> origin/feat/products-discovery
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
    /// track `mode`; Projects, Artifacts Library, Agents, Automation Tasks,
HEAD
HEAD
HEAD
HEAD
    /// Research, and Documents are iOS-only surfaces layered on top (the mode
    /// — and so history filtering, theme accent, and session stamping — stays
    /// wherever it was).    /// Plugins, and Research are iOS-only surfaces layered on top (the mode — and so history    /// and Swarm are iOS-only surfaces layered on top (the mode — and so history
>>>>>>> origin/feat/ios-swarm-ade
    /// filtering, theme accent, and session stamping — stays wherever it was).
>>>>>>> origin/feat/ios-plugin-marketplace    /// Team Skills, and Research are iOS-only surfaces layered on top (the
    /// mode — and so history filtering, theme accent, and session stamping —
    /// stays wherever it was).
>>>>>>> origin/feat/ios-team-skills    /// Products Discovery, and Research are iOS-only surfaces layered on top
    /// (the mode — and so history filtering, theme accent, and session
    /// stamping — stays wherever it was).
>>>>>>> origin/feat/products-discovery
    @Published var activeTab: ModeBarItem

    /// Which sub-surface the Automation Tasks tab shows: cron jobs
    /// (`/v1/cron`, Phase 1), routines (`/v1/automations/routines`, Phase 2),
    /// or loops (`/v1/automations/loops`, Phase 3). All three list views
    /// read/write this via a shared segmented control so any one is
    /// reachable from the same tab rather than needing a separate nav item.
    @Published var automationKind: AutomationKind = .cron

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
HEAD
HEAD
HEAD
HEAD
    /// Automation Tasks / Research / Documents switch the surface without
    /// touching the mode.    /// Automation Tasks / Plugins / Research switch the surface without touching the mode.
>>>>>>> origin/feat/ios-plugin-marketplace    /// Automation Tasks / Swarm / Research switch the surface without touching the mode.
>>>>>>> origin/feat/ios-swarm-ade    /// Automation Tasks / Team Skills / Research switch the surface without
    /// touching the mode.
>>>>>>> origin/feat/ios-team-skills    /// Automation Tasks / Products / Research switch the surface without
    /// touching the mode.
>>>>>>> origin/feat/products-discovery
    func selectBarItem(_ item: ModeBarItem) {
        activeTab = item
        switch item {
        case .chats: mode = .chat
        case .code: mode = .code
        case .aci: mode = .browser
HEAD
HEAD
HEAD
HEAD
        case .projects, .artifacts, .agents, .automation, .research, .documents: break        case .projects, .artifacts, .agents, .automation, .plugins, .research: break
>>>>>>> origin/feat/ios-plugin-marketplace        case .projects, .artifacts, .agents, .automation, .swarm, .research: break
>>>>>>> origin/feat/ios-swarm-ade        case .projects, .artifacts, .agents, .automation, .teamSkills, .research: break
>>>>>>> origin/feat/ios-team-skills        case .projects, .artifacts, .agents, .automation, .products, .research: break
>>>>>>> origin/feat/products-discovery
        }
    }
}

HEAD
HEAD
/// The nine destinations of the sidebar's tab list:
HEAD
HEAD
/// Chats / Projects / Artifacts Library / Agents / Automation Tasks / Code /
/// ACI / Research / Documents.
enum ModeBarItem: CaseIterable {
    case chats, projects, artifacts, agents, automation, code, aci, research, documents/// Chats / Projects / Artifacts Library / Agents / Automation Tasks / Plugins /
/// Code / ACI / Research.
enum ModeBarItem: CaseIterable {
    case chats, projects, artifacts, agents, automation, plugins, code, aci, research
>>>>>>> origin/feat/ios-plugin-marketplace/// Chats / Projects / Artifacts Library / Agents / Automation Tasks / Swarm /
/// Code / ACI / Research.
enum ModeBarItem: CaseIterable {
    case chats, projects, artifacts, agents, automation, swarm, code, aci, research
>>>>>>> origin/feat/ios-swarm-ade/// The eight destinations of the sidebar's tab list:
/// Chats / Projects / Artifacts Library / Agents / Automation Tasks / Team
/// Skills / Code / ACI / Research.
enum ModeBarItem: CaseIterable {
    case chats, projects, artifacts, agents, automation, teamSkills, code, aci, research
>>>>>>> origin/feat/ios-team-skills/// The nine destinations of the sidebar's tab list:
/// Chats / Projects / Artifacts Library / Agents / Automation Tasks /
/// Products / Code / ACI / Research.
enum ModeBarItem: CaseIterable {
    case chats, projects, artifacts, agents, automation, products, code, aci, research
>>>>>>> origin/feat/products-discovery

    var label: String {
        switch self {
        case .chats: return "Chats"
        case .projects: return "Projects"
        case .artifacts: return "Artifacts Library"
        case .agents: return "Agents"
        case .automation: return "Automation Tasks"
HEAD
HEAD
HEAD
        case .plugins: return "Plugins"        case .swarm: return "Swarm"
>>>>>>> origin/feat/ios-swarm-ade        case .teamSkills: return "Team Skills"
>>>>>>> origin/feat/ios-team-skills        case .products: return "Products"
>>>>>>> origin/feat/products-discovery
        case .code: return "Code"
        case .aci: return "ACI"
        case .research: return "Research"
        case .documents: return "Documents"
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
HEAD
HEAD
HEAD
        case .plugins: return "puzzlepiece"        case .swarm: return "person.3"
>>>>>>> origin/feat/ios-swarm-ade        case .teamSkills: return "puzzlepiece.extension"
>>>>>>> origin/feat/ios-team-skills        case .products: return "square.grid.2x2"
>>>>>>> origin/feat/products-discovery
        case .code: return "terminal"
        case .aci: return "globe"
        case .research: return "book.closed"
        case .documents: return "doc.text"
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

/// The sub-surfaces of the Automation Tasks tab (`ModeBarItem.automation`).
enum AutomationKind: String, CaseIterable {
    case cron = "Cron"
    case routines = "Routines"
    case loops = "Loops"
}
