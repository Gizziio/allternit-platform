import SwiftUI

/// Phase-1 VPS & Servers manager for iOS.
///
/// Mirrors the web's VPSConnectionsPanel: list SSH connections, add, test,
/// connect/disconnect, and delete. Agent install and provider deploy are deferred.
struct VPSServersManagerView: View {
    @StateObject private var store = SSHConnectionsStore.shared
    @Environment(\.dismiss) private var dismiss
    @State private var isCreateSheetPresented = false
    @State private var connectionToDelete: SSHConnection? = nil
    @State private var actionError: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().background(Color("BorderSubtle"))
            content
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .task {
            store.fetchIfNeeded()
        }
        .sheet(isPresented: $isCreateSheetPresented) {
            VPSServersCreateSheet()
        }
        .confirmationDialog(
            "Delete connection?",
            isPresented: Binding(
                get: { connectionToDelete != nil },
                set: { if !$0 { connectionToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let connection = connectionToDelete {
                    performDelete(connection)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            if let connection = connectionToDelete {
                Text("Remove the saved connection for \(connection.name) (\(connection.host)).")
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("VPS & Servers")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Text("Manage SSH connections to your infrastructure")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            Spacer()

            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.connections.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.connections.isEmpty {
            Spacer()
            let offline = isConnectionFailure(loadError)
            FriendlyStateView(
                style: offline ? .offline : .error,
                icon: offline ? "wifi.slash" : "exclamationmark.triangle",
                title: "Failed to load connections",
                message: FriendlyErrorMessage.from(loadError),
                actionTitle: "Retry",
                action: { store.fetchIfNeeded(force: true) }
            )
            Spacer()
        } else {
            ScrollView {
                VStack(spacing: 16) {
                    actionBar
                    if let actionError {
                        errorBanner(actionError)
                    }
                    connectionList
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
            .refreshable {
                await store.refresh()
            }
        }
    }

    // MARK: - Action bar

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button(action: { store.fetchIfNeeded(force: true) }) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Refresh")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundColor(Color("TextPrimary"))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Refresh")

            Button(action: { isCreateSheetPresented = true }) {
                HStack(spacing: 6) {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Add Connection")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundColor(Color("AccentPrimary"))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color("AccentPrimary").opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(Color("AccentPrimary").opacity(0.25), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            Spacer()
        }
    }

    // MARK: - Connection list

    @ViewBuilder
    private var connectionList: some View {
        if store.connections.isEmpty {
            emptyState
        } else {
            VStack(spacing: 12) {
                ForEach(store.connections) { connection in
                    connectionRow(connection)
                }
            }
        }
    }

    private var emptyState: some View {
        FriendlyStateView(
            style: .empty,
            icon: "server.rack",
            title: "No SSH connections",
            message: "Add a VPS or server to connect via SSH.",
            actionTitle: "Add Connection",
            action: { isCreateSheetPresented = true }
        )
        .padding(.vertical, 24)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private func connectionRow(_ connection: SSHConnection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(connection.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                    Text("\(connection.username)@\(connection.host):\(connection.port)")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                statusBadge(connection.status)
            }

            HStack(spacing: 10) {
                if let os = connection.os, let arch = connection.architecture {
                    infoPill("\(os) / \(arch)")
                }
                if connection.dockerInstalled == true {
                    infoPill("Docker")
                }
                if connection.allternitInstalled == true {
                    infoPill("Allternit")
                }
            }

            if let error = connection.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(Theme.statusError)
                    .lineLimit(2)
            }

            HStack {
                Spacer()
                if connection.status == .connected {
                    Button(action: { disconnect(connection.id) }) {
                        actionLabel("Disconnect", icon: "xmark", loading: store.isDisconnectingId == connection.id)
                    }
                    .buttonStyle(.plain)
                    .disabled(store.isDisconnectingId == connection.id)
                } else {
                    Button(action: { connect(connection.id) }) {
                        actionLabel("Connect", icon: "link", loading: store.isConnectingId == connection.id)
                    }
                    .buttonStyle(.plain)
                    .disabled(store.isConnectingId == connection.id)
                }

                Button(action: { connectionToDelete = connection }) {
                    actionLabel("Delete", icon: "trash", color: Theme.statusError)
                }
                .buttonStyle(.plain)
                .disabled(store.isDeletingId == connection.id)
            }
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private func isConnectionFailure(_ error: String) -> Bool {
        let lowered = error.lowercased()
        return lowered.contains("could not connect")
            || lowered.contains("failed to connect")
            || lowered.contains("offline")
            || lowered.contains("no network")
            || lowered.contains("network connection was lost")
    }

    private func statusBadge(_ status: SSHConnectionStatus) -> some View {
        let (label, color) = statusInfo(status)
        return Text(label)
            .font(.system(size: 10, weight: .bold))
            .tracking(0.8)
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    private func statusInfo(_ status: SSHConnectionStatus) -> (label: String, color: Color) {
        switch status {
        case .connected: return ("Connected", Theme.statusSuccess)
        case .disconnected: return ("Disconnected", Color("TextSecondary"))
        case .connecting: return ("Connecting", Theme.statusWarning)
        case .error: return ("Error", Theme.statusError)
        }
    }

    private func infoPill(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .foregroundColor(Color("TextSecondary"))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color("BgSecondary"))
            .clipShape(Capsule())
    }

    private func actionLabel(_ title: String, icon: String, color: Color? = nil, loading: Bool = false) -> some View {
        HStack(spacing: 4) {
            if loading {
                ProgressView()
                    .scaleEffect(0.6)
            } else {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
            }
            Text(title)
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundColor(color ?? Color("AccentPrimary"))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background((color ?? Color("AccentPrimary")).opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14))
                .foregroundColor(Theme.statusError)
            Text(message)
                .font(.caption)
                .foregroundColor(Color("TextPrimary"))
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Button(action: { actionError = nil }) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Theme.statusError.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.statusError.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Actions

    private func performDelete(_ connection: SSHConnection) {
        actionError = nil
        Task {
            do {
                try await store.deleteConnection(connection.id)
            } catch {
                actionError = error.localizedDescription
            }
        }
    }

    private func connect(_ id: String) {
        actionError = nil
        Task {
            do {
                try await store.connect(id)
            } catch {
                actionError = error.localizedDescription
            }
        }
    }

    private func disconnect(_ id: String) {
        actionError = nil
        Task {
            do {
                try await store.disconnect(id)
            } catch {
                actionError = error.localizedDescription
            }
        }
    }
}

// MARK: - Create sheet

struct VPSServersCreateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = SSHConnectionsStore.shared

    @State private var name = ""
    @State private var host = ""
    @State private var port = "22"
    @State private var username = ""
    @State private var authType = "key"
    @State private var privateKey = ""
    @State private var password = ""
    @State private var sheetError: String? = nil

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !host.trimmingCharacters(in: .whitespaces).isEmpty
            && !username.trimmingCharacters(in: .whitespaces).isEmpty
            && (Int(port) != nil)
            && (authType == "key" ? !privateKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty : !password.isEmpty)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    formField("Name", text: $name, placeholder: "Production VPS")
                    formField("Host", text: $host, placeholder: "203.0.113.10")
                    formField("Port", text: $port, placeholder: "22", keyboard: .numberPad)
                    formField("Username", text: $username, placeholder: "root")

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Authentication")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                        Picker("Authentication", selection: $authType) {
                            Text("SSH Key").tag("key")
                            Text("Password").tag("password")
                        }
                        .pickerStyle(.menu)
                    }

                    if authType == "key" {
                        textArea("Private Key", text: $privateKey)
                    } else {
                        SecureField("Password", text: $password)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .frame(height: 44)
                            .background(Color("BgPanel"))
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.radiusMD)
                                    .stroke(Color("BorderSubtle"), lineWidth: 1)
                            )
                    }

                    if let result = store.testResult {
                        HStack(spacing: 8) {
                            Image(systemName: result.success ? "checkmark.circle" : "exclamationmark.triangle")
                                .foregroundColor(result.success ? Theme.statusSuccess : Theme.statusError)
                            Text(result.message)
                                .font(.caption)
                                .foregroundColor(Color("TextPrimary"))
                            Spacer()
                        }
                        .padding(12)
                        .background((result.success ? Theme.statusSuccess : Theme.statusError).opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    }

                    if let error = sheetError ?? store.createError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(Theme.statusError)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(20)
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .navigationTitle("Add SSH Connection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button("Test") { test() }
                            .disabled(!isValid || store.isTesting)
                        Button("Save") { save() }
                            .disabled(!isValid || store.isCreating)
                    }
                }
            }
            .onDisappear {
                store.clearTestResult()
                store.clearCreateError()
            }
        }
    }

    private func formField(_ label: String, text: Binding<String>, placeholder: String, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextPrimary"))
            TextField(placeholder, text: text)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(Color("BorderSubtle"), lineWidth: 1)
                )
                .keyboardType(keyboard)
        }
    }

    private func textArea(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextPrimary"))
            TextEditor(text: text)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(Color("TextPrimary"))
                .frame(minHeight: 120)
                .padding(8)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(Color("BorderSubtle"), lineWidth: 1)
                )
        }
    }

    private func buildRequest() -> SSHConnectionCreateRequest? {
        guard let port = Int(port) else { return nil }
        return SSHConnectionCreateRequest(
            name: name.trimmingCharacters(in: .whitespaces),
            host: host.trimmingCharacters(in: .whitespaces),
            port: port,
            username: username.trimmingCharacters(in: .whitespaces),
            authType: authType,
            privateKey: authType == "key" ? privateKey.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            password: authType == "password" ? password : nil
        )
    }

    private func test() {
        sheetError = nil
        guard let request = buildRequest() else { return }
        Task {
            do {
                _ = try await store.testConnection(request)
            } catch {
                sheetError = error.localizedDescription
            }
        }
    }

    private func save() {
        sheetError = nil
        guard let request = buildRequest() else { return }
        Task {
            do {
                try await store.createConnection(request)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                sheetError = error.localizedDescription
            }
        }
    }
}
