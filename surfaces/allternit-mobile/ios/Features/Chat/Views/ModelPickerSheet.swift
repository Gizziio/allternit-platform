import SwiftUI

/// Model selector bottom sheet, Claude-app style: grouped rows with one-line
/// descriptions (Flagship → Standard → Fast), a "More models" disclosure for
/// legacy entries, and an Effort selector for reasoning-capable models.
/// Metadata (`description`/`tier`/`supports_effort`) comes from the backend
/// catalog (provider_routes.rs).
struct ModelPickerSheet: View {
    @ObservedObject var modelStore: ModelStore
    @Environment(\.dismiss) private var dismiss

    @State private var showMoreModels = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    row(
                        label: "Default Model",
                        subtitle: "The backend's configured default",
                        supportsEffort: false,
                        isSelected: modelStore.selectedModelId == nil
                    ) {
                        modelStore.userSelectedModel(nil)
                        dismiss()
                    }

                    if modelStore.isLoading, modelStore.models.isEmpty {
                        HStack {
                            Spacer()
                            ProgressView().padding(.top, 24)
                            Spacer()
                        }
                    } else if modelStore.models.isEmpty, modelStore.loadError != nil {
                        VStack(spacing: 8) {
                            Text("Couldn't load models")
                                .font(.subheadline)
                                .foregroundColor(Color("TextPrimary"))
                            Button("Retry") { modelStore.fetchModelsIfNeeded(force: true) }
                                .font(.subheadline)
                                .foregroundColor(Color("AccentPrimary"))
                        }
                        .padding(.top, 24)
                    }

                    ForEach(modelStore.tiers, id: \.tier) { group in
                        sectionHeader(group.tier.rawValue.capitalized)
                        ForEach(group.models) { model in
                            modelRow(model)
                        }
                    }

                    if !modelStore.legacyModels.isEmpty {
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) { showMoreModels.toggle() }
                        }) {
                            HStack {
                                Text("More models")
                                    .font(.subheadline)
                                    .foregroundColor(Color("TextPrimary"))
                                Spacer()
                                Image(systemName: showMoreModels ? "chevron.up" : "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(Color("TextSecondary"))
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if showMoreModels {
                            ForEach(modelStore.legacyModels) { model in
                                modelRow(model)
                            }
                        }
                    }

                    // Effort selector — visible only when the selected model
                    // is reasoning-capable (Claude's Low/Medium/High row).
                    if modelStore.selectedModel?.supportsEffort == true {
                        sectionHeader("Effort")
                        HStack(spacing: 8) {
                            ForEach(ModelEffort.allCases, id: \.self) { effort in
                                Button(action: {
                                    let generator = UIImpactFeedbackGenerator(style: .light)
                                    generator.impactOccurred()
                                    modelStore.selectedEffort = effort
                                }) {
                                    Text(effort.label)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(modelStore.selectedEffort == effort ? .black : Color("TextPrimary"))
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 34)
                                        .background(modelStore.selectedEffort == effort ? Color("AccentPrimary") : Color("BgSecondary"))
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 12)
                    }

                    if let loadError = modelStore.loadError, !modelStore.models.isEmpty {
                        Text(loadError)
                            .font(.caption2)
                            .foregroundColor(Color("TextSecondary"))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                    }
                }
                .padding(.vertical, 8)
            }
            .background(Color("BgPrimary"))
            .navigationTitle("Select model")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(Color("TextSecondary"))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 4)
    }

    private func modelRow(_ model: RuntimeModel) -> some View {
        row(
            label: model.shortName,
            subtitle: model.description,
            supportsEffort: model.supportsEffort,
            isSelected: modelStore.selectedModelId == model.id
        ) {
            modelStore.userSelectedModel(model.id)
            dismiss()
        }
    }

    private func row(label: String, subtitle: String?, supportsEffort: Bool, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                            .lineLimit(1)
                    }
                }
                Spacer()
                if supportsEffort, isSelected {
                    Text(modelStore.selectedEffort.label)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("TextSecondary"))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color("BgSecondary"))
                        .clipShape(Capsule())
                }
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.subheadline)
                        .foregroundColor(Color("AccentPrimary"))
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
