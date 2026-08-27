import SwiftUI

/// Reads and renders one file (`FileClient.read(path:)`). Binary files get a
/// placeholder; text files render as plain monospaced lines (no syntax
/// highlighting in v1 — see the file browser's plan notes on `Highlightr`).
/// When the server reports an uncommitted diff for this file, a "Modified"
/// pill opens it using the same `DiffRenderer` the permission-approval sheet
/// and session diff viewer use.
struct FileDetailView: View {
    let client: FileClient
    let node: FileNode

    @State private var result: FileReadResult?
    @State private var loadError: String?
    @State private var isLoading = false
    @State private var isDiffPresented = false

    var body: some View {
        content
            .navigationTitle(node.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if let diff = result?.diff, !diff.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            isDiffPresented = true
                        } label: {
                            Label("Modified", systemImage: "plus.forwardslash.minus")
                                .font(.caption)
                        }
                    }
                }
            }
            .sheet(isPresented: $isDiffPresented) {
                if let diff = result?.diff {
                    NavigationStack {
                        ScrollView([.horizontal, .vertical]) {
                            DiffRenderer(lines: DiffLine.parse(unifiedDiff: diff))
                                .padding(16)
                        }
                        .background(Color("BgPrimary"))
                        .navigationTitle(node.name)
                        .navigationBarTitleDisplayMode(.inline)
                    }
                }
            }
            .task {
                await load()
            }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && result == nil {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let loadError, result == nil {
            VStack(spacing: 12) {
                Text("Couldn't load file")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") { Task { await load() } }
                    .font(.subheadline)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let result {
            if result.type == .binary {
                VStack(spacing: 8) {
                    Image(systemName: "doc")
                        .font(.title2)
                        .foregroundColor(Color("TextSecondary"))
                    Text("Binary file")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    if let mimeType = result.mimeType {
                        Text(mimeType)
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView([.horizontal, .vertical]) {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(result.content.split(separator: "\n", omittingEmptySubsequences: false).enumerated()), id: \.offset) { _, line in
                            Text(line.isEmpty ? " " : String(line))
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(Color("TextPrimary"))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        loadError = nil
        do {
            result = try await client.read(path: node.path)
        } catch is CancellationError {
            // View disappeared mid-flight.
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }
}
