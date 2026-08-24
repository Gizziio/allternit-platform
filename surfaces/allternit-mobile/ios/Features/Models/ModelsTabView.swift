import SwiftUI

/// Models tab surface (rail item `.models`): the sidebar's Models tab,
/// promoting model management out of a composer dropdown / buried Settings
/// push (per Eoj — models are important enough to be a first-class section).
/// Reuses `ModelManagementListContent` (default model/effort pickers, live
/// provider/engine status) under this tab's own hamburger-menu header,
/// matching AgentHubView's chrome so every tab surface looks consistent.
struct ModelsTabView: View {
    @Binding var isSidebarOpen: Bool

    @ObservedObject private var modelStore = ModelStore.shared
    @StateObject private var store = ProviderManagementStore()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header Bar (matches AgentHubView's/ArtifactsLibraryView's chrome).
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

                    Text("Models")
                        .font(.system(.title3, design: .serif))
                        .fontWeight(.medium)
                        .foregroundColor(Color("TextPrimary"))

                    Spacer()

                    Button(action: {
                        let generator = UIImpactFeedbackGenerator(style: .light)
                        generator.impactOccurred()
                        Task { await store.load() }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextSecondary"))
                            .frame(width: 32, height: 32)
                            .background(Color("BgPanel"))
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Refresh")
                    .disabled(store.isLoading)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)

                ModelManagementListContent(modelStore: modelStore, store: store)
            }
        }
    }
}
