import SwiftUI

/// One file's before/after diff from `SessionDiffListView`, rendered with
/// the same `DiffRenderer` the permission-approval sheet uses.
struct FileDiffDetailView: View {
    let diff: FileDiff

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            VStack(alignment: .leading, spacing: 16) {
                header
                DiffRenderer(lines: DiffLine.diffLines(before: diff.before, after: diff.after))
            }
            .padding(16)
        }
        .background(Color("BgPrimary"))
        .navigationTitle((diff.file as NSString).lastPathComponent)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(diff.file)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(Color("TextSecondary"))
                .lineLimit(1)
                .truncationMode(.middle)
            HStack(spacing: 10) {
                if diff.additions > 0 {
                    Text("+\(diff.additions)")
                        .foregroundColor(Theme.statusSuccess)
                }
                if diff.deletions > 0 {
                    Text("-\(diff.deletions)")
                        .foregroundColor(.red)
                }
            }
            .font(.system(.caption, design: .monospaced).weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
