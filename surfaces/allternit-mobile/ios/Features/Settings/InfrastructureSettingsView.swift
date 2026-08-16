import SwiftUI

/// Settings > Infrastructure parity — Environment, VPS & servers, Enterprise BYOC,
/// Security, and Agents.
///
/// Phase 1 wires the environment selector (already functional via EnvironmentStore),
/// shows mesh + cloud-instance state, and links to the Agent Hub. Full VPS/BYOC
/// provisioning flows are deferred to a later phase.
struct InfrastructureSettingsView: View {
    @EnvironmentObject private var modeStore: AppModeStore
    @ObservedObject private var environment = EnvironmentStore.shared
    @ObservedObject private var mesh = MeshClient.shared
    @ObservedObject private var instanceStore = InstanceStore.shared

    var body: some View {
        List {
            environmentSection
            meshSection
            cloudInstancesSection
            byocSection
            securitySection
            agentsSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color("BgPrimary"))
        .navigationTitle("Infrastructure")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await instanceStore.refreshIfNeeded()
        }
    }

    // MARK: - Environment

    private var environmentSection: some View {
        Section {
            Picker("Execution target", selection: $environment.environment) {
                ForEach(AppEnvironment.allCases, id: \.self) { env in
                    HStack {
                        Image(systemName: env.icon)
                        Text(env.label)
                    }
                    .tag(env)
                }
            }
            .font(.subheadline)
            .pickerStyle(.inline)

            if environment.environment == .cloud {
                HStack {
                    Text("Paired runtime")
                        .font(.subheadline)
                    Spacer()
                    if let runtimeId = environment.pairedRuntimeId {
                        Text(runtimeId)
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                            .lineLimit(1)
                    } else {
                        Text("None")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                Button("Unpair runtime") {
                    environment.unpair()
                }
                .font(.subheadline)
                .foregroundColor(.red)
                .disabled(environment.pairedRuntimeId == nil)
            }
        } header: {
            Text("Environment")
        } footer: {
            Text(environment.environment.description)
                .font(.caption)
        }
    }

    // MARK: - Mesh

    private var meshSection: some View {
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

            if case .up = mesh.state {
                Button("Stop mesh node") { mesh.stop() }
                    .font(.subheadline)
            } else {
                Button("Start mesh node") { Task { await mesh.startWithPlatformAuth() } }
                    .font(.subheadline)
                    .disabled(mesh.state == .starting)
            }
        } header: {
            Text("Mesh")
        } footer: {
            Text("Embedded tsnet node → \(AppConfig.meshControlURL).")
                .font(.caption)
        }
    }

    // MARK: - Cloud instances

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

    // MARK: - BYOC / VPS

    private var byocSection: some View {
        Section {
            Text("Enterprise BYOC and VPS provisioning are managed through the web dashboard.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        } header: {
            Text("Enterprise BYOC & VPS")
        }
    }

    // MARK: - Security

    private var securitySection: some View {
        Section {
            Text("Security policies, audit logs, and access controls are configured per-organization in the web dashboard.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        } header: {
            Text("Security")
        }
    }

    // MARK: - Agents

    private var agentsSection: some View {
        Section {
            Button(action: {
                modeStore.selectBarItem(.agents)
            }) {
                HStack {
                    Text("agent | bot hub")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color("TextSecondary"))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } header: {
            Text("agent | bot")
        }
    }
}
