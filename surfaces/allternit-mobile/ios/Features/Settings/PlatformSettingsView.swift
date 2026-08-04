import SwiftUI

/// Settings > Platform parity — General, Appearance, Models, API Keys,
/// Shortcuts, Permissions, Dispatch, Devices, Cloud Instances, Diagnostics.
///
/// Phase 1 wires the user-facing controls that map to web's platform group:
/// local preferences persist through `SettingsStore`, model selection reuses
/// `ModelStore`, cloud instances reuse `InstanceStore`, and the rest show
/// static/read-only info where a mobile equivalent isn't meaningful yet.
struct PlatformSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared
    @ObservedObject private var modelStore = ModelStore.shared
    @ObservedObject private var instanceStore = InstanceStore.shared
    @ObservedObject private var mesh = MeshClient.shared

    var body: some View {
        List {
            generalSection
            appearanceSection
            modelsSection
            apiKeysSection
            shortcutsSection
            permissionsSection
            dispatchSection
            devicesSection
            cloudInstancesSection
            diagnosticsSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color("BgPrimary"))
        .navigationTitle("Platform")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            modelStore.fetchModelsIfNeeded()
            await instanceStore.refreshIfNeeded()
        }
    }

    // MARK: - General

    private var generalSection: some View {
        Section {
            Picker("Language", selection: $settings.displayLanguage) {
                ForEach(SettingsStore.displayLanguages, id: \.self) { language in
                    Text(language).tag(language)
                }
            }
            .font(.subheadline)

            Picker("Timezone", selection: $settings.timezone) {
                ForEach(SettingsStore.timezones, id: \.self) { tz in
                    Text(tz).tag(tz)
                }
            }
            .font(.subheadline)

            Toggle(isOn: $settings.showSystemMessages) {
                Text("Show system messages")
                    .font(.subheadline)
            }
            .tint(Color("AccentPrimary"))

            Toggle(isOn: $settings.enableTelemetry) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Telemetry")
                        .font(.subheadline)
                    Text("Send anonymized usage data to improve Allternit.")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
            }
            .tint(Color("AccentPrimary"))

            Toggle(isOn: $settings.autoSave) {
                Text("Auto-save drafts")
                    .font(.subheadline)
            }
            .tint(Color("AccentPrimary"))
        } header: {
            Text("General")
        }
    }

    // MARK: - Appearance

    private var appearanceSection: some View {
        Section {
            Toggle(isOn: $settings.compactDensity) {
                Text("Compact density")
                    .font(.subheadline)
            }
            .tint(Color("AccentPrimary"))

            Toggle(isOn: $settings.showSidebarLabels) {
                Text("Show sidebar labels")
                    .font(.subheadline)
            }
            .tint(Color("AccentPrimary"))
        } header: {
            Text("Appearance")
        }
    }

    // MARK: - Models

    private var modelsSection: some View {
        Section {
            Toggle(isOn: $settings.streamingEnabled) {
                Text("Streaming responses")
                    .font(.subheadline)
            }
            .tint(Color("AccentPrimary"))

            if modelStore.isLoading {
                HStack {
                    Text("Loading models…")
                        .font(.subheadline)
                        .foregroundColor(Color("TextSecondary"))
                    Spacer()
                    ProgressView()
                }
            } else if let error = modelStore.loadError {
                Text("Couldn't load models: \(error)")
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
            Text("Models")
        } footer: {
            Text("Effort only applies to models that support it.")
                .font(.caption)
        }
    }

    // MARK: - API Keys

    private var apiKeysSection: some View {
        Section {
            Text("Provider secrets, local models, and tool credentials stay on the runtime that owns them. The cloud stores runtime identity and audit metadata — not provider tokens.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        } header: {
            Text("API Keys")
        }
    }

    // MARK: - Shortcuts

    private var shortcutsSection: some View {
        Section {
            ForEach(KeyboardShortcutItem.allCases, id: \.self) { item in
                HStack {
                    Text(item.action)
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Text(item.shortcut)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(Color("TextSecondary"))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color("BgSecondary"))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
                }
            }
        } header: {
            Text("Keyboard Shortcuts")
        }
    }

    // MARK: - Permissions

    private var permissionsSection: some View {
        Section {
            Text("iOS permissions (microphone, speech recognition, photo library) are requested in context when a feature needs them. Open system Settings to revoke access.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))

            Button(action: {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }) {
                HStack {
                    Text("Open System Settings")
                        .font(.subheadline)
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
                .foregroundColor(Color("TextPrimary"))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } header: {
            Text("Permissions")
        }
    }

    // MARK: - Dispatch

    private var dispatchSection: some View {
        Section {
            Toggle(isOn: $settings.dispatchEnabled) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Enable dispatch")
                        .font(.subheadline)
                    Text("Route cowork tasks through Allternit's dispatch layer.")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
            }
            .tint(Color("AccentPrimary"))
        } header: {
            Text("Dispatch")
        }
    }

    // MARK: - Devices

    private var devicesSection: some View {
        Section {
            HStack {
                Text("Mesh node")
                    .font(.subheadline)
                Spacer()
                switch mesh.state {
                case .idle:
                    Text("Idle").font(.caption).foregroundColor(Color("TextSecondary"))
                case .starting:
                    HStack(spacing: 6) {
                        ProgressView()
                        Text("Joining…").font(.caption)
                    }
                case .up(let ip):
                    Text(ip).font(.caption).foregroundColor(Color("TextPrimary"))
                case .failed(let message):
                    Text(message).font(.caption).foregroundColor(.red).lineLimit(1)
                }
            }

            Text("Runtime device pairing and management are available from the Code thread's runtime menu.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        } header: {
            Text("Devices")
        }
    }

    // MARK: - Cloud Instances

    private var cloudInstancesSection: some View {
        Section {
            if let error = instanceStore.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
            }

            if instanceStore.instances.isEmpty {
                Text("No registered instances.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            } else {
                ForEach(instanceStore.instances) { instance in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(instance.name)
                                .font(.subheadline)
                                .foregroundColor(Color("TextPrimary"))
                            Text(instance.url)
                                .font(.caption)
                                .foregroundColor(Color("TextSecondary"))
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(instance.status)
                            .font(.caption)
                            .foregroundColor(instance.isOnline ? Color.green : Color("TextSecondary"))
                    }
                }
            }
        } header: {
            Text("Cloud Instances")
        }
    }

    // MARK: - Diagnostics

    private var diagnosticsSection: some View {
        Section {
            HStack {
                Text("App version")
                    .font(.subheadline)
                Spacer()
                Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
            HStack {
                Text("Build")
                    .font(.subheadline)
                Spacer()
                Text(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
            HStack {
                Text("API base")
                    .font(.subheadline)
                Spacer()
                Text(AppConfig.apiBaseURL.absoluteString)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        } header: {
            Text("Diagnostics")
        }
    }
}

// MARK: - Shortcuts data

private enum KeyboardShortcutItem: String, CaseIterable {
    case newChat = "New chat"
    case search = "Search history"
    case toggleSidebar = "Toggle sidebar"
    case codeMode = "Code mode"
    case coworkMode = "Cowork mode"
    case settings = "Settings"

    var action: String { rawValue }

    var shortcut: String {
        switch self {
        case .newChat: return "⌘ N"
        case .search: return "⌘ K"
        case .toggleSidebar: return "⌘ ["
        case .codeMode: return "⌘ 2"
        case .coworkMode: return "⌘ 1"
        case .settings: return "⌘ ,"
        }
    }
}
