import SwiftUI

/// Phase-1 Enterprise BYOC panel for iOS.
///
/// Mirrors the web's EnterpriseByocPanel: org-gated overview, cloud-credential
/// list/add/revoke, and metered usage summary. Credential live-testing and
/// CSV export are deferred.
struct EnterpriseBYOCPanelView: View {
    @StateObject private var store = BYOCStore.shared
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: Tab = .overview
    @State private var isCreateSheetPresented = false
    @State private var credentialToRevoke: CloudCredential? = nil
    @State private var actionError: String? = nil

    private enum Tab: String, CaseIterable, Identifiable {
        case overview
        case accounts
        case usage

        var id: String { rawValue }

        var label: String {
            switch self {
            case .overview: return "Overview"
            case .accounts: return "Cloud accounts"
            case .usage: return "Usage"
            }
        }

        var icon: String {
            switch self {
            case .overview: return "shield.checkerboard"
            case .accounts: return "cloud"
            case .usage: return "doc.text"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().background(Color("BorderSubtle"))
            tabBar
            content
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .task {
            store.fetchIfNeeded()
        }
        .sheet(isPresented: $isCreateSheetPresented) {
            BYOCCredentialCreateSheet()
        }
        .confirmationDialog(
            "Revoke credential?",
            isPresented: Binding(
                get: { credentialToRevoke != nil },
                set: { if !$0 { credentialToRevoke = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Revoke", role: .destructive) {
                if let credential = credentialToRevoke {
                    revoke(credential)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            if let credential = credentialToRevoke {
                Text("Revoke \(credential.provider.rawValue.uppercased()) credential '\(credential.label)'? Future BYOC provisioning will be blocked.")
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Enterprise BYOC")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Text("Bring your own cloud accounts")
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
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        HStack(spacing: 4) {
            ForEach(Tab.allCases) { tab in
                Button(action: { selectedTab = tab }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 12))
                        Text(tab.label)
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(selectedTab == tab ? Color("TextPrimary") : Color("TextSecondary"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(selectedTab == tab ? Color("BgPanel") : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoadingProfile && store.profile == nil {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.profile == nil {
            Spacer()
            VStack(spacing: 12) {
                Text("Failed to load BYOC profile")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    store.fetchIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else if store.profile == nil {
            Spacer()
            Text("Sign in to manage Enterprise BYOC.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
            Spacer()
        } else if !store.canManageBilling {
            Spacer()
            VStack(spacing: 12) {
                Image(systemName: "shield.checkerboard")
                    .font(.system(size: 36))
                    .foregroundColor(Color("TextSecondary").opacity(0.5))
                Text("Owner or admin access required")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                Text("Only organization owners and admins can manage cloud credentials or view metered billing.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 20)
            Spacer()
        } else {
            ScrollView {
                VStack(spacing: 16) {
                    if let actionError {
                        errorBanner(actionError)
                    }
                    switch selectedTab {
                    case .overview:
                        overviewTab
                    case .accounts:
                        accountsTab
                    case .usage:
                        usageTab
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
        }
    }

    // MARK: - Overview

    private var overviewTab: some View {
        VStack(spacing: 12) {
            requirementRow(
                ready: store.profile?.organizationId != nil,
                title: "Organization selected",
                detail: "Your organization is the active security and billing boundary."
            )
            requirementRow(
                ready: store.canManageBilling,
                title: "Admin billing permission",
                detail: "Your organization role can manage credentials and metered usage."
            )
            requirementRow(
                ready: store.isRuntimeAvailable,
                title: "Runtime connected",
                detail: store.isRuntimeAvailable
                    ? "Credential encryption and provisioning services are reachable."
                    : "Register a gizzi serve instance before connecting a cloud account."
            )
            requirementRow(
                ready: store.activeCredentialCount > 0,
                title: "Cloud account",
                detail: store.activeCredentialCount > 0
                    ? "\(store.activeCredentialCount) active provider connection\(store.activeCredentialCount == 1 ? "" : "s") ready for enterprise environments."
                    : "Connect a scoped provider identity, then use it for enterprise environments."
            )

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: "hard.drive")
                        .font(.system(size: 18))
                        .foregroundColor(Color("AccentPrimary"))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Customer-cloud deployment boundary")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                        Text("The runtime encrypts the provider credential before storage, resolves it only for this organization, and reports measured environment runtime when the workload stops.")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                HStack {
                    Spacer()
                    Button(action: { selectedTab = .accounts }) {
                        HStack(spacing: 6) {
                            Image(systemName: "cloud")
                                .font(.system(size: 12))
                            Text("Connect cloud account")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundColor(Color("AccentPrimary"))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color("AccentPrimary").opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    }
                    .buttonStyle(.plain)
                    .disabled(!store.isRuntimeAvailable)
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
    }

    private func requirementRow(ready: Bool, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: ready ? "checkmark.circle.fill" : "exclamationmark.circle")
                .font(.system(size: 17))
                .foregroundColor(ready ? Theme.statusSuccess : Theme.statusWarning)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                Text(detail)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(12)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    // MARK: - Accounts

    private var accountsTab: some View {
        VStack(spacing: 12) {
            HStack {
                Spacer()
                Button(action: { isCreateSheetPresented = true }) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Add account")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(Color("AccentPrimary"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color("AccentPrimary").opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .buttonStyle(.plain)
            }

            if store.credentials.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "cloud")
                        .font(.system(size: 36))
                        .foregroundColor(Color("TextSecondary").opacity(0.5))
                    Text("No cloud accounts")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                    Text("Connect a scoped AWS, GCP, or Azure identity for enterprise BYOC environments.")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            } else {
                VStack(spacing: 12) {
                    ForEach(store.credentials) { credential in
                        credentialRow(credential)
                    }
                }
            }
        }
    }

    private func credentialRow(_ credential: CloudCredential) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(credential.label)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                    Text("\(credential.provider.rawValue.uppercased())\(credential.region.map { " · \($0)" } ?? "")")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
                Spacer(minLength: 8)
                credentialStatusBadge(credential.status)
            }

            if let externalId = credential.externalId {
                Text("External ID: \(externalId)")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            HStack {
                Spacer()
                Button(action: { credentialToRevoke = credential }) {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Revoke")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(Theme.statusError)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Theme.statusError.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .buttonStyle(.plain)
                .disabled(store.isRevokingId == credential.id)
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

    private func credentialStatusBadge(_ status: String) -> some View {
        let color: Color = status == "active" ? Theme.statusSuccess : (status == "error" ? Theme.statusError : Color("TextSecondary"))
        return Text(status.capitalized)
            .font(.system(size: 10, weight: .bold))
            .tracking(0.8)
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    // MARK: - Usage

    private var usageTab: some View {
        VStack(spacing: 12) {
            HStack {
                Spacer()
                Button(action: { Task { await store.refreshUsage() } }) {
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
                .disabled(store.isLoadingUsage)
            }

            if store.isLoadingUsage {
                ProgressView()
                    .padding(.vertical, 40)
            } else if let summary = store.usageSummary {
                if summary.lineItems.isEmpty {
                    Text("No metered usage this month.")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .padding(.vertical, 20)
                } else {
                    VStack(spacing: 8) {
                        ForEach(summary.lineItems, id: \.description) { item in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.description)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(Color("TextPrimary"))
                                    Text("\(item.resourceType) · \(Int(item.quantity)) \(item.unit)")
                                        .font(.caption)
                                        .foregroundColor(Color("TextSecondary"))
                                }
                                Spacer()
                                Text("$\(String(format: "%.2f", Double(item.subtotalCents) / 100))")
                                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                                    .foregroundColor(Color("TextPrimary"))
                            }
                            .padding(12)
                            .background(Color("BgPanel"))
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        }
                    }

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Draft total · \(summary.paymentTerms)")
                                .font(.caption)
                                .foregroundColor(Color("TextSecondary"))
                            Text(summary.sellerLegalName)
                                .font(.system(size: 10))
                                .foregroundColor(Color("TextSecondary"))
                        }
                        Spacer()
                        Text("$\(String(format: "%.2f", Double(summary.totalCents) / 100))")
                            .font(.system(size: 18, weight: .heavy, design: .monospaced))
                            .foregroundColor(Color("TextPrimary"))
                    }
                    .padding(12)
                    .background(Color("BgPanel"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusLG)
                            .stroke(Theme.borderWarmDefault, lineWidth: 1)
                    )
                }
            } else {
                VStack(spacing: 12) {
                    Text("Load this billing period to see metered usage.")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .multilineTextAlignment(.center)
                    Button("Load usage") {
                        Task { await store.refreshUsage() }
                    }
                    .font(.subheadline)
                    .foregroundColor(Color("AccentPrimary"))
                }
                .padding(.vertical, 40)
            }
        }
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

    private func revoke(_ credential: CloudCredential) {
        actionError = nil
        Task {
            do {
                try await store.revokeCredential(credential.id)
            } catch {
                actionError = error.localizedDescription
            }
        }
    }
}

// MARK: - Create credential sheet

struct BYOCCredentialCreateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = BYOCStore.shared

    @State private var provider: CloudProvider = .aws
    @State private var label = ""
    @State private var region = ""
    @State private var externalId = ""
    @State private var secretJson = ""
    @State private var sheetError: String? = nil

    private var isValid: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty
            && !secretJson.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Text("Paste a scoped provider identity. The secret is sealed server-side and never persisted on the device.")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Provider")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                        Picker("Provider", selection: $provider) {
                            ForEach(CloudProvider.allCases) { provider in
                                Text(provider.rawValue.uppercased()).tag(provider)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    formField("Label", text: $label, placeholder: "Production AWS")
                    formField("Region (optional)", text: $region, placeholder: "us-east-1")
                    formField("External ID (optional)", text: $externalId, placeholder: "allternit-byoc")
                    textArea("Secret JSON", text: $secretJson)

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
            .navigationTitle("Add Cloud Account")
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
                store.createError = nil
            }
        }
    }

    private func formField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
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

    private func parseSecret() -> [String: String]? {
        let data = Data(secretJson.trimmingCharacters(in: .whitespacesAndNewlines).utf8)
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return nil
        }
        return object
    }

    private func buildCreateRequest() -> CloudCredentialCreateRequest? {
        guard let secret = parseSecret() else { return nil }
        return CloudCredentialCreateRequest(
            provider: provider,
            label: label.trimmingCharacters(in: .whitespaces),
            region: region.trimmingCharacters(in: .whitespaces).presence,
            externalId: externalId.trimmingCharacters(in: .whitespaces).presence,
            secret: secret
        )
    }

    private func buildTestRequest() -> CloudCredentialTestRequest? {
        guard let secret = parseSecret() else { return nil }
        return CloudCredentialTestRequest(
            provider: provider,
            region: region.trimmingCharacters(in: .whitespaces).presence,
            externalId: externalId.trimmingCharacters(in: .whitespaces).presence,
            secret: secret
        )
    }

    private func test() {
        sheetError = nil
        guard let request = buildTestRequest() else {
            sheetError = "Secret must be a valid JSON object with string values."
            return
        }
        Task {
            do {
                _ = try await store.testCredential(request)
            } catch {
                sheetError = error.localizedDescription
            }
        }
    }

    private func save() {
        sheetError = nil
        guard let request = buildCreateRequest() else {
            sheetError = "Secret must be a valid JSON object with string values."
            return
        }
        Task {
            do {
                try await store.createCredential(request)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                sheetError = error.localizedDescription
            }
        }
    }
}

private extension String {
    var presence: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
