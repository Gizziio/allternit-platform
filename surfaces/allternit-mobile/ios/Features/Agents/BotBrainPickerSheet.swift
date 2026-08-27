import SwiftUI

/// Model-provider picker surfaced as the Bot Home "pick a brain" action.
///
/// Reads from the shared `ModelStore`, updates the agent via `AgentHubStore`,
/// and refreshes the composer pill cache through `AgentModeStore`.
struct BotBrainPickerSheet: View {
    let agent: AgentRecord

    @StateObject private var hubStore = AgentHubStore.shared
    @StateObject private var modelStore = ModelStore.shared
    @EnvironmentObject private var agentModeStore: AgentModeStore
    @Environment(\.dismiss) private var dismiss

    @State private var selection: String?
    @State private var isSaving = false
    @State private var saveError: String? = nil

    init(agent: AgentRecord) {
        self.agent = agent
        if !agent.model.isEmpty, !agent.provider.isEmpty {
            _selection = State(initialValue: "\(agent.provider)/\(agent.model)")
        } else {
            _selection = State(initialValue: nil)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if modelStore.isLoading && modelStore.models.isEmpty {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    }
                } else if let error = modelStore.loadError, modelStore.models.isEmpty {
                    Section {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(Theme.statusWarning)
                    }
                } else {
                    ForEach(modelStore.providers, id: \.provider) { group in
                        Section(header: Text(group.provider)) {
                            ForEach(group.models) { model in
                                Button(action: { selection = model.id }) {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(model.name)
                                                .font(.subheadline)
                                                .foregroundColor(Color("TextPrimary"))
                                            if let description = model.description {
                                                Text(description)
                                                    .font(.caption)
                                                    .foregroundColor(Color("TextSecondary"))
                                                    .lineLimit(1)
                                            }
                                        }
                                        Spacer()
                                        if selection == model.id {
                                            Image(systemName: "checkmark")
                                                .font(.system(size: 14, weight: .semibold))
                                                .foregroundColor(Color("AccentPrimary"))
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if let saveError {
                    Section {
                        Text(saveError)
                            .font(.caption)
                            .foregroundColor(Theme.statusWarning)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .navigationTitle("Pick a Brain")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: save) {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving || selection == currentModelId)
                }
            }
            .task {
                modelStore.fetchModelsIfNeeded()
            }
        }
    }

    private var currentModelId: String? {
        guard !agent.model.isEmpty, !agent.provider.isEmpty else { return nil }
        return "\(agent.provider)/\(agent.model)"
    }

    private func save() {
        guard let selection, let model = modelStore.models.first(where: { $0.id == selection }) else { return }
        isSaving = true
        saveError = nil
        Task {
            do {
                try await hubStore.updateAgent(
                    id: agent.id,
                    model: model.shortName,
                    provider: model.provider
                )
                agentModeStore.fetchAgentsIfNeeded(force: true)
                dismiss()
            } catch {
                saveError = error.localizedDescription
            }
            isSaving = false
        }
    }
}
