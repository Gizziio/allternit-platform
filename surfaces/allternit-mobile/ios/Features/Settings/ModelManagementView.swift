import SwiftUI

/// Model Management parity — lists cloud providers and local engines with their
/// auth/ready status, mirroring the web's `ModelManagementView.tsx`.
struct ModelManagementView: View {
    @ObservedObject private var modelStore = ModelStore.shared
    @StateObject private var store = ProviderManagementStore()

    var body: some View {
        List {
            selectedModelSection
            enginesSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color("BgPrimary"))
        .navigationTitle("Models & Engines")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: { Task { await store.load() } }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.subheadline)
                }
                .disabled(store.isLoading)
            }
        }
        .task {
            modelStore.fetchModelsIfNeeded()
            await store.load()
        }
        .refreshable {
            modelStore.fetchModelsIfNeeded(force: true)
            await store.load()
        }
    }

    // MARK: - Selected model

    @ViewBuilder
    private var selectedModelSection: some View {
        Section {
            if modelStore.isLoading {
                ProgressView()
            } else if let error = modelStore.loadError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
            } else {
                Picker("Default model", selection: Binding(
                    get: { modelStore.selectedModelId },
                    set: { modelStore.userSelectedModel($0) }
                )) {
                    Text("Backend default").tag(String?.none)
                    ForEach(modelStore.models) { model in
                        Text(model.name).tag(model.id as String?)
                    }
                }
                .font(.subheadline)

                Picker("Reasoning effort", selection: $modelStore.selectedEffort) {
                    ForEach(ModelEffort.allCases, id: \.self) { effort in
                        Text(effort.label).tag(effort)
                    }
                }
                .font(.subheadline)
                .disabled(modelStore.selectedModel?.supportsEffort != true)
            }
        } header: {
            Text("Default Model")
        }
    }

    // MARK: - Engines

    @ViewBuilder
    private var enginesSection: some View {
        Section {
            if store.isLoading && store.engines.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
            } else if let error = store.error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
            } else if store.engines.isEmpty {
                Text("No providers configured.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            } else {
                ForEach(store.engines) { engine in
                    EngineRow(engine: engine)
                }
            }
        } header: {
            Text("Engines")
        }
    }
}

// MARK: - Engine row

private struct EngineRow: View {
    let engine: ProviderEngine

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 40, height: 40)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            VStack(alignment: .leading, spacing: 2) {
                Text(engine.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))

                HStack(spacing: 6) {
                    Text(engine.kind)
                        .font(.caption)
                    if engine.modelCount > 0 {
                        Text("·")
                            .font(.caption)
                        Text("\(engine.modelCount) models")
                            .font(.caption)
                    }
                }
                .foregroundColor(Color("TextSecondary"))
            }

            Spacer()

            Text(engine.status.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(engine.isReady ? Color.green : Color.red)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(engine.isReady ? Color.green.opacity(0.1) : Color.red.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
        }
        .padding(.vertical, 4)
    }

    private var iconName: String {
        switch engine.id {
        case "openai", "azure-openai": return "circle.hexagongrid"
        case "anthropic": return "a.circle"
        case "ollama": return "cpu"
        default: return "terminal"
        }
    }
}

// MARK: - Store

@MainActor
final class ProviderManagementStore: ObservableObject {
    @Published private(set) var engines: [ProviderEngine] = []
    @Published private(set) var isLoading = false
    @Published var error: String? = nil

    private let client = ProviderManagementClient.shared

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            async let providersTask = client.listProviders()
            async let authTask = client.listAuthStatus()
            async let ollamaTask = client.ollamaLiveStatus()

            let (providers, authStatuses, ollama) = try await (providersTask, authTask, ollamaTask)

            let authMap = Dictionary(uniqueKeysWithValues: authStatuses.map { ($0.providerId, $0) })

            engines = providers.map { provider in
                let auth = authMap[provider.id]
                let isOllama = provider.id == "ollama"
                let ready: Bool
                let modelCount: Int
                if isOllama {
                    ready = ollama.running
                    modelCount = ollama.models.count
                } else if let auth {
                    ready = auth.authenticated || auth.status == "not_required" || provider.status == "active"
                    modelCount = provider.models.count
                } else {
                    ready = provider.status == "active" || provider.status == "online"
                    modelCount = provider.models.count
                }

                return ProviderEngine(
                    id: provider.id,
                    name: provider.name,
                    kind: provider.kindLabel,
                    status: ready ? "ready" : (provider.status == "missing_key" ? "missing" : "unknown"),
                    modelCount: modelCount,
                    isReady: ready
                )
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ProviderEngine: Identifiable, Sendable {
    let id: String
    let name: String
    let kind: String
    let status: String
    let modelCount: Int
    let isReady: Bool
}
