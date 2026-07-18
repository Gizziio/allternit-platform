import SwiftUI

/// Platform modes, mirroring the web shell's `AppMode`
/// (surfaces/ai.allternit.com/src/shell/ModeSwitcher.tsx:24-70).
///
/// `design` is skipped on iOS — on the web it opens an external window.
/// Cowork is NOT a bottom-bar destination: the platform's primary mode
/// control is the 3-way [Home | Code | ACI] segmented control
/// (ShellRail.tsx:542-593), and cowork is a composer-level toggle inside
/// Home (BottomDock.tsx ChatCoworkToggle).
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

    init(defaults: UserDefaults = .standard) {
        let saved = defaults.string(forKey: Self.storageKey)
        self.mode = saved.flatMap(AppMode.init(rawValue:)) ?? .chat
    }

    /// The 3-way segmented control maps both Home surfaces (chat + cowork)
    /// onto one item; selecting it always lands on plain chat.
    func selectBarItem(_ item: ModeBarItem) {
        switch item {
        case .home: mode = .chat
        case .code: mode = .code
        case .aci: mode = .browser
        }
    }
}

/// The three destinations of the bottom mode bar (ShellRail's segmented
/// control: Home / Code / ACI).
enum ModeBarItem: CaseIterable {
    case home, code, aci

    var label: String {
        switch self {
        case .home: return "Home"
        case .code: return "Code"
        case .aci: return "ACI"
        }
    }

    /// SF Symbols standing in for the web's Phosphor House / TerminalWindow /
    /// Globe icons.
    var icon: String {
        switch self {
        case .home: return "house"
        case .code: return "terminal"
        case .aci: return "globe"
        }
    }

    /// Which bar item is highlighted for a given app mode: cowork lives
    /// inside Home; code/ACI map to themselves.
    static func activeItem(for mode: AppMode) -> ModeBarItem {
        switch mode {
        case .chat, .cowork: return .home
        case .code: return .code
        case .browser: return .aci
        }
    }
}
