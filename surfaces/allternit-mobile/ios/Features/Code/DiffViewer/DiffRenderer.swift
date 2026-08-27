import SwiftUI

/// One rendered row of a diff, monospaced with added/removed lines tinted.
/// Two sources feed this shape: a unified-diff string (`+`/`-`/` `-prefixed
/// content lines, e.g. `createTwoFilesPatch` output, `edit.ts:48-149`) via
/// `parse(unifiedDiff:)`, and a raw before/after content pair (e.g.
/// `GET /v1/session/:id/diff`'s `FileDiff.before`/`after`) via
/// `diffLines(before:after:)`.
struct DiffLine: Identifiable {
    enum Kind {
        case added, removed, context, header

        var background: Color {
            switch self {
            case .added: return Theme.statusSuccess.opacity(0.15)
            case .removed: return Theme.statusError.opacity(0.15)
            case .context, .header: return .clear
            }
        }
    }

    let id: Int
    let kind: Kind
    let text: String

    static func parse(unifiedDiff diff: String) -> [DiffLine] {
        diff.split(separator: "\n", omittingEmptySubsequences: false).enumerated().map { index, raw in
            let line = String(raw)
            let kind: Kind
            if line.hasPrefix("+++") || line.hasPrefix("---") || line.hasPrefix("@@") || line.hasPrefix("Index:") || line.hasPrefix("===") {
                kind = .header
            } else if line.hasPrefix("+") {
                kind = .added
            } else if line.hasPrefix("-") {
                kind = .removed
            } else {
                kind = .context
            }
            return DiffLine(id: index, kind: kind, text: line)
        }
    }

    /// Line-based diff over two full content strings (not a unified-diff
    /// string) — a longest-common-subsequence walk over lines, so unchanged
    /// lines render as context and only the changed runs are tinted. No
    /// external dependency; adequate for typical source-file sizes.
    static func diffLines(before: String, after: String) -> [DiffLine] {
        let beforeLines = before.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let afterLines = after.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)

        let m = beforeLines.count
        let n = afterLines.count

        // The LCS table below is O(m*n) ints — fine for typical source
        // files, but a pathologically large one (generated/binary-ish text
        // slipping through) could blow past a reasonable memory budget.
        // Past that, skip the alignment and just show a flat
        // remove-everything/add-everything diff.
        guard m * n <= 4_000_000 else {
            var lines: [DiffLine] = []
            for line in beforeLines { lines.append(DiffLine(id: lines.count, kind: .removed, text: line)) }
            for line in afterLines { lines.append(DiffLine(id: lines.count, kind: .added, text: line)) }
            return lines
        }

        // lcs[i][j] = length of the LCS of beforeLines[i...] and afterLines[j...]
        var lcs = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)
        if m > 0 && n > 0 {
            for i in stride(from: m - 1, through: 0, by: -1) {
                for j in stride(from: n - 1, through: 0, by: -1) {
                    if beforeLines[i] == afterLines[j] {
                        lcs[i][j] = lcs[i + 1][j + 1] + 1
                    } else {
                        lcs[i][j] = max(lcs[i + 1][j], lcs[i][j + 1])
                    }
                }
            }
        }

        var lines: [DiffLine] = []
        var i = 0, j = 0
        while i < m && j < n {
            if beforeLines[i] == afterLines[j] {
                lines.append(DiffLine(id: lines.count, kind: .context, text: beforeLines[i]))
                i += 1
                j += 1
            } else if lcs[i + 1][j] >= lcs[i][j + 1] {
                lines.append(DiffLine(id: lines.count, kind: .removed, text: beforeLines[i]))
                i += 1
            } else {
                lines.append(DiffLine(id: lines.count, kind: .added, text: afterLines[j]))
                j += 1
            }
        }
        while i < m {
            lines.append(DiffLine(id: lines.count, kind: .removed, text: beforeLines[i]))
            i += 1
        }
        while j < n {
            lines.append(DiffLine(id: lines.count, kind: .added, text: afterLines[j]))
            j += 1
        }
        return lines
    }
}

/// Reusable line-by-line diff view — the visual body extracted from
/// `ChangesetReviewSheet`'s former inline `diffView(_:)` so both the
/// permission-approval sheet and the standalone session diff viewer render
/// identically.
struct DiffRenderer: View {
    let lines: [DiffLine]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(lines) { line in
                Text(line.text.isEmpty ? " " : line.text)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(Color("TextPrimary"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 2)
                    .background(line.kind.background)
            }
        }
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }
}
