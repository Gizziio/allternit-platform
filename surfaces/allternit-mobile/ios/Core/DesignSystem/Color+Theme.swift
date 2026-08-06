import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 1)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// Global Theme Colors matching surfaces/ai.allternit.com design system.
// All values are taken from theme.css light (:root) and dark ([data-theme='dark'])
// ramps. Asset-catalog colors (Color("…")) adapt automatically; the static
// constants below are for code-path fallbacks and non-adaptive contexts.
struct Theme {
    // MARK: - Legacy statics (dark values kept for call-sites that haven't
    // migrated to asset-catalog colors yet).
    static let bgPrimary = Color(hex: "#1A1612")
    static let bgSecondary = Color(hex: "#2A211A")
    static let accentPrimary = Color(hex: "#D97757")
    static let textPrimary = Color(hex: "#ECECEC")
    static let textSecondary = Color(hex: "#9B9B9B")
    static let borderSubtle = Color(hex: "#2C2621")

    // MARK: - Design tokens v2 (theme.css values)

    /// `--bg-secondary` — raised panel surface.
    static let bgPanel = Color(hex: "#2A211A")
    /// `--bg-tertiary`.
    static let bgTertiary = Color(hex: "#362B22")

    /// `--glass-bg` — dark: rgba(28, 22, 17, 0.74), light: rgba(253, 248, 243, 0.75).
    static let glassBg = Color(.sRGB, red: 28 / 255, green: 22 / 255, blue: 17 / 255, opacity: 0.74)
    /// `--glass-bg-thick` — dark: rgba(33, 26, 20, 0.94), light: rgba(253, 248, 243, 0.95).
    static let glassBgThick = Color(.sRGB, red: 33 / 255, green: 26 / 255, blue: 20 / 255, opacity: 0.94)

    /// Warm sand border ramp — dark: rgba(212, 176, 140, …).
    /// `--border-subtle` (.10), `--border-default` (.16), `--border-strong` (.24).
    static let borderWarmSubtle = Color(.sRGB, red: 212 / 255, green: 176 / 255, blue: 140 / 255, opacity: 0.10)
    static let borderWarmDefault = Color(.sRGB, red: 212 / 255, green: 176 / 255, blue: 140 / 255, opacity: 0.16)
    static let borderWarmStrong = Color(.sRGB, red: 212 / 255, green: 176 / 255, blue: 140 / 255, opacity: 0.24)
    /// `--shadow-glow` — 0 0 20px rgba(212, 176, 140, 0.2).
    static let shadowGlow = Color(.sRGB, red: 212 / 255, green: 176 / 255, blue: 140 / 255, opacity: 0.2)

    /// Per-mode accents (theme.css `--accent-*`).
    /// These are adaptive via Color("AccentChat") etc.; statics are dark fallbacks.
    static let accentChat = Color(hex: "#D97757")
    static let accentCowork = Color(hex: "#B08BC0")
    static let accentCode = Color(hex: "#7BB08B")
    static let accentBrowser = Color(hex: "#69A8C8")

    /// Status hues used by agent-mode tiles (theme.css:437-443).
    static let statusSuccess = Color(hex: "#4ADE80")
    static let statusWarning = Color(hex: "#FBBF24")
    static let statusInfo = Color(hex: "#60A5FA")
    static let statusError = Color(hex: "#F87171")

    // MARK: - Radius scale (theme.css:35-42)

    static let radiusSM: CGFloat = 8
    static let radiusMD: CGFloat = 12
    static let radiusLG: CGFloat = 16
    static let radiusXL: CGFloat = 20
}

// SwiftUI Asset Catalog Color Adaptations — these automatically resolve
// light/dark appearance via the asset catalog.
extension Color {
    static var themeBgPrimary: Color { Color("BgPrimary") }
    static var themeBgSecondary: Color { Color("BgSecondary") }
    static var themeBgPanel: Color { Color("BgPanel") }
    static var themeAccentPrimary: Color { Color("AccentPrimary") }
    static var themeTextPrimary: Color { Color("TextPrimary") }
    static var themeTextSecondary: Color { Color("TextSecondary") }
    static var themeBorderSubtle: Color { Color("BorderSubtle") }
}
