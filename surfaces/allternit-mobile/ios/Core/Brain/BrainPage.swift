import Foundation

/// What a captured note becomes under `ideas/` (frontmatter `type:` —
/// canonical layout v1, lib.ts ideaTemplate). Intake for the taste engine:
/// `idea` = something you might build, `pain` = something that repeatedly
/// costs you time or annoyance.
enum BrainCaptureType: String, CaseIterable, Sendable {
    case idea
    case pain

    var label: String { rawValue.capitalized }
}

/// Pure helpers for building brain pages (Track D, phase D3 capture).
/// Foundation-only — no Clibgit2, no UIKit — so the logic compiles
/// standalone (swiftc harness; no XCTest target exists in the app).
enum BrainPage {
    /// One built page: path relative to the brain root + full content.
    typealias Page = (filename: String, content: String)

    /// Lowercase slug of alphanumerics and dashes: every other character
    /// becomes a dash, runs collapse, edges trimmed. Empty input → "note".
    static func slugify(_ text: String) -> String {
        var result = ""
        var lastWasDash = false
        for scalar in text.lowercased().unicodeScalars {
            if CharacterSet.alphanumerics.contains(scalar) {
                result.append(Character(scalar))
                lastWasDash = false
            } else if !result.isEmpty && !lastWasDash {
                result.append("-")
                lastWasDash = true
            }
        }
        while result.hasSuffix("-") { result.removeLast() }
        return result.isEmpty ? "note" : result
    }

    /// An ideas/ intake page for a captured note:
    /// filename `ideas/<slug>-<yyyyMMdd-HHmmss>.md` (timestamp suffix keeps
    /// same-slug captures distinct — the queue never overwrites a page),
    /// content = YAML frontmatter (canonical convention: `type: idea|pain`,
    /// `status: new`, `domain: meta`, plus `created:`) + `# <title>` + body.
    static func ideaPage(title: String, body: String, type: BrainCaptureType, now: Date) -> Page {
        let stampFormatter = DateFormatter()
        stampFormatter.locale = Locale(identifier: "en_US_POSIX")
        stampFormatter.dateFormat = "yyyyMMdd-HHmmss"
        let stamp = stampFormatter.string(from: now)
        let created = ISO8601DateFormatter().string(from: now)

        let filename = "ideas/\(slugify(title))-\(stamp).md"
        let content = """
        ---
        type: \(type.rawValue)
        status: new
        domain: meta
        created: "\(created)"
        ---

        # \(title)

        \(body)
        """
        // Swift multiline literals drop the newline before the closing
        // delimiter; lib.ts's template literals keep it. Restore the single
        // trailing newline so the page matches the canonical convention.
        return (filename: filename, content: content + "\n")
    }
}
