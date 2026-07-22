import SwiftUI

/// The Artifacts Library tab surface: every artifact seen in chat streams,
/// newest first (ArtifactLibraryStore — the backend has no artifact list
/// endpoint, so the library is collected client-side). Tapping a row opens
/// the same ArtifactDetailsView sheet the in-chat artifact cards use.
struct ArtifactsLibraryView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var store = ArtifactLibraryStore.shared
    @State private var activeArtifact: ArtifactRecord? = nil

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

                Text("Artifacts Library")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))

                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .background(Color("BgPrimary"))

            Divider().background(Color("BorderSubtle"))

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
                        ForEach(store.artifacts) { saved in
                            artifactRow(saved)
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
        .task {
            // Sweep recent sessions' canvases for artifacts created on other
            // surfaces (the web mirrors artifacts there).
            await store.refreshFromBackend()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "archivebox")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("No artifacts yet")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))
            Text("Artifacts created in your chats are saved here.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color("BgSecondary"))
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
                    Text("\(saved.record.fileType.uppercased()) · \(saved.savedAt.formatted(date: .abbreviated, time: .shortened))")
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
}
