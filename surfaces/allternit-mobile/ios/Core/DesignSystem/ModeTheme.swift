import SwiftUI

/// Per-mode visual theme, ported from the web's mode config
/// (surfaces/ai.allternit.com/src/shell/ModeSwitcher.tsx:24-70) and the
/// per-surface agent-mode palette
/// (surfaces/ai.allternit.com/src/views/chat/agentModeSurfaceTheme.tsx:16-56):
/// `soft` is accent at 14%, `glow` is accent at ~28%, matching the web's
/// rgba treatments of each `--accent-*`.
struct ModeTheme {
    let mode: AppMode

    /// Dark-theme accent (theme.css `--accent-chat/cowork/code/browser`).
    var accent: Color {
        switch mode {
        case .chat: return Theme.accentChat
        case .cowork: return Theme.accentCowork
        case .code: return Theme.accentCode
        case .browser: return Theme.accentBrowser
        }
    }

    /// Soft background tint (web `soft`: accent at 14%).
    var accentSoft: Color { accent.opacity(0.14) }

    /// Glow border/shadow color (web `glow`: accent at ~28%).
    var accentGlow: Color { accent.opacity(0.28) }

    /// SF Symbol standing in for the web's Phosphor mode icon
    /// (ChatText / UsersThree / TerminalWindow / Globe).
    var icon: String {
        switch mode {
        case .chat: return "message"
        case .cowork: return "person.3"
        case .code: return "terminal"
        case .browser: return "globe"
        }
    }
}

/// Agent-mode tiles shown in the composer's bottom deck when agent mode is
/// on. Mirrors `MODE_TABS` + `SURFACE_MODES`
/// (surfaces/ai.allternit.com/src/views/chat/components/ModeDock.tsx:30-48),
/// including the per-tile colors (dark status hues for research/data/slides).
enum AgentModeTile: String, CaseIterable, Sendable {
    case swarms
    case research
    case website
    case docs
    case data
    case slides
    case image
    case video
    case code

    var label: String {
        switch self {
        case .swarms: return "Agent Swarm"
        case .research: return "Deep Research"
        case .website: return "Websites"
        case .docs: return "Docs"
        case .data: return "Sheets"
        case .slides: return "Slides"
        case .image: return "Image"
        case .video: return "Video"
        case .code: return "Code"
        }
    }

    var color: Color {
        switch self {
        case .swarms: return Color(hex: "#14B8A6")
        case .research: return Theme.statusInfo
        case .website: return Color(hex: "#6366F1")
        case .docs: return Color(hex: "#3B82F6")
        case .data: return Theme.statusSuccess
        case .slides: return Theme.statusWarning
        case .image: return Color(hex: "#8B5CF6")
        case .video: return Color(hex: "#EC4899")
        case .code: return Theme.statusWarning
        }
    }

    /// SF Symbols standing in for the web's Phosphor icons (UsersThree,
    /// BookOpen, Globe, FileText, Database, PresentationChart, Image,
    /// VideoCamera, Code).
    var icon: String {
        switch self {
        case .swarms: return "person.3"
        case .research: return "book"
        case .website: return "globe"
        case .docs: return "doc.text"
        case .data: return "cylinder"
        case .slides: return "chart.bar.doc.horizontal"
        case .image: return "photo"
        case .video: return "video"
        case .code: return "chevron.left.forwardslash.chevron.right"
        }
    }

    /// `SURFACE_MODES` from ModeDock.tsx:42-48 — which tiles a surface's
    /// bottom deck offers. Chat and cowork both get the full set.
    static func visibleTiles(for surface: AppMode) -> [AgentModeTile] {
        switch surface {
        case .chat, .cowork:
            return [.swarms, .research, .website, .docs, .data, .slides, .image, .video, .code]
        case .code:
            return [.swarms, .website, .docs]
        case .browser:
            return [.research, .website, .docs, .data]
        }
    }
}
