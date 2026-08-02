import SwiftUI

/// Review sheet for a single pending permission request from a gizzi-code
/// coding session (`PermissionNext.Request`, `next.ts:71-88`). Presented from
/// `CodeThreadChatView`'s pending-approval banner.
///
/// When `metadata.diff` is present (file edit/write/patch/multiedit —
/// `edit.ts:48-149`, `createTwoFilesPatch`) it's rendered line-by-line,
/// monospaced, with added/removed lines tinted; otherwise (e.g. a `bash`
/// permission) it falls back to a plain `permission` + `patterns` summary.
///
/// Approve / Always Allow / Reject map straight to `PermissionReply.once` /
/// `.always` / `.reject` and call `PermissionClient.shared.reply`
/// (`permission.ts:42-71`).
struct ChangesetReviewSheet: View {
    let request: PermissionRequest
    /// Invoked after a successful reply so the host view can drop this
    /// request from its pending list immediately, ahead of the next poll.
    var onResolved: (PermissionRequest) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var diffLines: [DiffLine]? {
        guard let diff = request.metadata.diff, !diff.isEmpty else { return nil }
        return DiffLine.parse(diff)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if let diffLines {
                        diffView(diffLines)
                    } else {
                        fallbackView
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                .padding(16)
            }
            .background(Color("BgPrimary"))
            .navigationTitle("Review Change")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSubmitting)
                }
            }
            .safeAreaInset(edge: .bottom) {
                actionBar
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(request.permission.capitalized)
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))
            if let path = request.patterns.first {
                Text(path)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            if let counts = request.metadata.filediff, (counts.additions ?? 0) > 0 || (counts.deletions ?? 0) > 0 {
                HStack(spacing: 10) {
                    if let additions = counts.additions, additions > 0 {
                        Text("+\(additions)")
                            .foregroundColor(Theme.statusSuccess)
                    }
                    if let deletions = counts.deletions, deletions > 0 {
                        Text("-\(deletions)")
                            .foregroundColor(.red)
                    }
                }
                .font(.system(.caption, design: .monospaced).weight(.semibold))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func diffView(_ lines: [DiffLine]) -> some View {
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

    /// Non-file-edit permissions (e.g. `bash`) carry no `diff` — just show
    /// what's being requested.
    private var fallbackView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No diff preview for this permission.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
            ForEach(request.patterns, id: \.self) { pattern in
                Text(pattern)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(Color("TextPrimary"))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button {
                Task { await submit(.reject) }
            } label: {
                Text("Reject")
                    .frame(maxWidth: .infinity)
            }
            .foregroundColor(.red)

            Button {
                Task { await submit(.always) }
            } label: {
                Text("Always Allow")
                    .frame(maxWidth: .infinity)
            }
            .foregroundColor(Color("TextPrimary"))

            Button {
                Task { await submit(.once) }
            } label: {
                Text("Approve")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .foregroundColor(Theme.statusSuccess)
        }
        .buttonStyle(.bordered)
        .disabled(isSubmitting)
        .padding(16)
        .background(Color("BgPrimary"))
    }

    @MainActor
    private func submit(_ reply: PermissionReply) async {
        guard !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        do {
            try await PermissionClient.shared.reply(requestID: request.id, reply: reply)
            onResolved(request)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }
}

/// One rendered row of a unified diff (`createTwoFilesPatch` output,
/// `edit.ts:48-149`): `+`/`-`/` `-prefixed content lines plus the `---`/`+++`
/// file headers and `@@` hunk headers, all rendered as plain context.
private struct DiffLine: Identifiable {
    enum Kind {
        case added, removed, context, header

        var background: Color {
            switch self {
            case .added: return Theme.statusSuccess.opacity(0.15)
            case .removed: return Color.red.opacity(0.15)
            case .context, .header: return .clear
            }
        }
    }

    let id: Int
    let kind: Kind
    let text: String

    static func parse(_ diff: String) -> [DiffLine] {
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
}
