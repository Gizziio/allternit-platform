import SwiftUI

/// One directory level of the file browser. `path` nil means the project
/// root; the file-tree API is one-level-per-call (not recursive), so a
/// nested directory pushes another instance of this same view with its own
/// `path` rather than expanding inline — matches the API's own contract and
/// keeps memory bounded on deep trees.
struct FileBrowserDirectoryView: View {
    let client: FileClient
    let path: String?
    /// Shown in the nav bar; nil at the root (the sheet supplies its own title there).
    let title: String?

    @State private var nodes: [FileNode] = []
    @State private var loadError: String?
    @State private var isLoading = false

    init(client: FileClient, path: String? = nil, title: String? = nil) {
        self.client = client
        self.path = path
        self.title = title
    }

    var body: some View {
        content
            .navigationTitle(title ?? "Files")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await load()
            }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && nodes.isEmpty && loadError == nil {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let loadError, nodes.isEmpty {
            FriendlyStateView(
                style: .offline,
                icon: "wifi.slash",
                title: "Couldn't load directory",
                message: FriendlyErrorMessage.from(loadError),
                actionTitle: "Retry",
                action: { Task { await load() } }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if nodes.isEmpty {
            FriendlyStateView(
                style: .empty,
                icon: "folder",
                title: "Empty directory",
                message: "This folder has no files."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List(nodes) { node in
                if node.type == .directory {
                    NavigationLink(value: node) {
                        FileNodeRow(node: node)
                    }
                } else {
                    NavigationLink {
                        FileDetailView(client: client, node: node)
                    } label: {
                        FileNodeRow(node: node)
                    }
                }
            }
            .listStyle(.plain)
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        loadError = nil
        do {
            nodes = try await client.tree(path: path)
        } catch is CancellationError {
            // View disappeared mid-flight.
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }
}
