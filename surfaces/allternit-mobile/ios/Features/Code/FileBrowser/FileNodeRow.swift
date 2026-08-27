import SwiftUI

/// One row in the file browser — a folder (chevron, pushes a nested
/// directory level) or a file (pushes the read view). Git-ignored entries
/// are dimmed but still tappable.
struct FileNodeRow: View {
    let node: FileNode

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: node.type == .directory ? "folder" : "doc.text")
                .font(.subheadline)
                .foregroundColor(node.type == .directory ? Color("AccentPrimary") : Color("TextSecondary"))
                .frame(width: 20)
            Text(node.name)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .lineLimit(1)
            Spacer()
            if node.type == .directory {
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundColor(Color("TextSecondary"))
            }
        }
        .opacity(node.ignored ? 0.5 : 1)
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
