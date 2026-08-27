import SwiftUI

#if DEBUG
/// String wrapper for `.sheet(item:)` debug deep-links.
private struct IdentifiableString: Identifiable {
    var wrappedValue: String
    var id: String { wrappedValue }
}
#endif

/// The Artifacts Library tab surface: every artifact seen in chat streams,
/// newest first (ArtifactLibraryStore — the backend has no artifact list
/// endpoint, so the library is collected client-side). Tapping a row opens
/// the same ArtifactDetailsView sheet the in-chat artifact cards use.
struct ArtifactsLibraryView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var store = ArtifactLibraryStore.shared
    @State private var activeArtifact: ArtifactRecord? = nil
    @State private var showingOfficeDocuments = false
    @State private var searchText = ""
    #if DEBUG
    @State private var debugOfficeDocumentId: IdentifiableString? = nil
    #endif

    private var visibleArtifacts: [SavedArtifact] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return store.artifacts }
        return store.artifacts.filter {
            $0.record.title.localizedCaseInsensitiveContains(query)
                || $0.record.fileType.localizedCaseInsensitiveContains(query)
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
            TextField("Search artifacts", text: $searchText)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.subheadline)
                        .foregroundColor(Color("TextSecondary"))
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color("BgSecondary"))
        .cornerRadius(10)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header Bar (matches ChatView's chrome).
            HStack {
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0)) {
                        isSidebarOpen.toggle()
                    }
                }) {
                    Image(systemName: "line.3.horizontal")
                        .font(.title3)
                        .foregroundColor(Color("TextPrimary"))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Open sidebar")

                Text("Artifacts Library")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))

                Spacer()

                // Office documents saved by the Docs/Sheets/Slides/PDF editors
                // (artifact service, read-only native rendering).
                Button(action: { showingOfficeDocuments = true }) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.title3)
                        .foregroundColor(Color("TextPrimary"))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Office documents")
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .background(Color("BgPrimary"))

            Divider().background(Color("BorderSubtle"))

            searchBar
                .padding(.horizontal, 20)
                .padding(.vertical, 12)

            if store.artifacts.isEmpty {
                if store.isRefreshing {
                    VStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                    .background(Color("BgSecondary"))
                } else {
                    emptyState
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(visibleArtifacts) { saved in
                            artifactRow(saved)
                        }
                        if visibleArtifacts.isEmpty {
                            VStack(spacing: 10) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 20, weight: .medium))
                                    .foregroundColor(Color("TextSecondary"))
                                Text("No artifacts match.")
                                    .font(.subheadline)
                                    .foregroundColor(Color("TextSecondary"))
                            }
                            .padding(.top, 24)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }
                .background(Color("BgSecondary"))
                .refreshable {
                    await store.refreshFromBackend()
                }
            }
        }
        .background(Color("BgPrimary"))
        .sheet(item: $activeArtifact) { artifact in
            ArtifactDetailsView(artifact: artifact)
        }
        .sheet(isPresented: $showingOfficeDocuments) {
            OfficeDocumentsView()
        }
        #if DEBUG
        .sheet(item: $debugOfficeDocumentId) { id in
            NavigationStack {
                OfficeDocumentView(artifactId: id.wrappedValue)
            }
        }
        .task {
            // `-open-office-documents` / `-open-office-document-id <id>`
            // (DEBUG only): drive the Office surfaces without tap injection
            // for simulator regression runs (same pattern as -open-settings).
            let args = CommandLine.arguments
            if args.contains("-open-office-documents") {
                showingOfficeDocuments = true
            }
            if let idx = args.firstIndex(of: "-open-office-document-id"),
               args.indices.contains(idx + 1) {
                debugOfficeDocumentId = .init(wrappedValue: args[idx + 1])
            }
        }
        #endif
        .task {
            // List the user's canvases for artifacts created on other
            // surfaces (the web and gizzi-code mirror artifacts there).
            await store.refreshFromBackend()
        }
    }

    private var emptyState: some View {
        FriendlyStateView(
            style: .empty,
            icon: "archivebox",
            title: "No artifacts yet",
            message: "Artifacts created in your chats are saved here."
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color("BgPrimary"))
    }

    private func artifactRow(_ saved: SavedArtifact) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            activeArtifact = saved.record
        }) {
            HStack(spacing: 12) {
                Image(systemName: saved.record.isPreviewable ? "safari" : "doc.text")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Color("AccentPrimary"))
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(saved.record.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)
                    Text(rowMetadata(saved))
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
                Spacer()
            }
            .padding(.horizontal, 14)
            .frame(height: 56)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive, action: {
                store.remove(id: saved.record.id)
            }) {
                Label("Remove from library", systemImage: "trash")
            }
        }
    }

    private func rowMetadata(_ saved: SavedArtifact) -> String {
        let type = saved.record.fileType.uppercased()
        let version = saved.record.version.map { " · V\($0)" } ?? ""
        return "\(type)\(version) · \(saved.savedAt.formatted(date: .abbreviated, time: .shortened))"
    }
}
