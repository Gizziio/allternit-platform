import SwiftUI

/// Office documents list — artifact-service documents browsable on iOS,
/// each opening the read-only `OfficeDocumentView`.
///
/// Presented from the Artifacts library toolbar; kept separate from the
/// stream-frame artifact library (SavedArtifact) because office artifacts
/// live in the artifact service (`/api/v1/artifacts`), not the reply stream.
struct OfficeDocumentsView: View {
    @State private var artifacts: [OfficeArtifactSummary] = []
    @State private var error: String?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading documents…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error {
                    ContentUnavailableView(
                        "Couldn't load documents",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else if artifacts.isEmpty {
                    ContentUnavailableView(
                        "No documents yet",
                        systemImage: "doc",
                        description: Text("Documents saved from the Docs, Sheets, Slides, or PDF editors appear here.")
                    )
                } else {
                    List(artifacts) { artifact in
                        NavigationLink(destination: OfficeDocumentView(artifactId: artifact.id)) {
                            Label {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(artifact.title)
                                        .font(.body.bold())
                                        .foregroundColor(Color("TextPrimary"))
                                    if let updatedAt = artifact.updatedAt {
                                        Text(updatedAt)
                                            .font(.caption2)
                                            .foregroundColor(Color("TextSecondary"))
                                    }
                                }
                            } icon: {
                                Image(systemName: "doc.text")
                                    .foregroundColor(Color("AccentPrimary"))
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Office documents")
            .background(Color("BgPrimary").ignoresSafeArea())
            .task {
                do {
                    artifacts = try await OfficeArtifactClient.shared.listArtifacts()
                    isLoading = false
                } catch {
                    self.error = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
