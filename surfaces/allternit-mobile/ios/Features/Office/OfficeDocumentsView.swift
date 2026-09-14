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
    @State private var isSignPDFPresented = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading documents…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error {
                    FriendlyStateView(
                        style: .offline,
                        icon: "wifi.slash",
                        title: "Couldn't load documents",
                        message: FriendlyErrorMessage.from(error),
                        actionTitle: "Retry",
                        action: { Task { await loadArtifacts() } }
                    )
                } else if artifacts.isEmpty {
                    FriendlyStateView(
                        style: .empty,
                        icon: "doc",
                        title: "No documents yet",
                        message: "Documents saved from the Docs, Sheets, Slides, or PDF editors appear here."
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
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { isSignPDFPresented = true }) {
                        Label("Sign PDF", systemImage: "signature")
                    }
                }
            }
            .sheet(isPresented: $isSignPDFPresented) {
                PDFSignView(sourceURL: nil)
            }
            .task {
                await loadArtifacts()
            }
        }
    }

    private func loadArtifacts() async {
        do {
            artifacts = try await OfficeArtifactClient.shared.listArtifacts()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
