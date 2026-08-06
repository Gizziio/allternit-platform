import SwiftUI

/// Sheet listing the active terminal pty's currently-detected dev-server
/// ports. Resolves a `DevPreviewClient` against the paired instance the
/// same way `FileBrowserView`/`SessionDiffListView` resolve theirs, then
/// polls (~4s, matching `CodeThreadChatView.pollPendingPermissions()`'s
/// cadence) only while this sheet is on screen. Tapping a port mints a
/// preview token and pushes `DevServerPreviewView`.
struct DevServerPortsView: View {
    let ptyID: String
    @ObservedObject var instanceStore: InstanceStore

    @State private var client: DevPreviewClient?
    @State private var ports: [DevServerPort] = []
    @State private var isResolving = true
    @State private var loadError: String? = nil
    @State private var mintingPort: Int? = nil
    @State private var mintError: String? = nil
    @State private var previewTarget: PreviewTarget? = nil

    struct PreviewTarget: Identifiable {
        let port: Int
        let token: String
        var id: Int { port }
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Dev Servers")
                .navigationBarTitleDisplayMode(.inline)
                .background(Color("BgPrimary"))
        }
        .task {
            await resolve()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                if Task.isCancelled { break }
                await refresh()
            }
        }
        .fullScreenCover(item: $previewTarget) { target in
            if let client {
                DevServerPreviewView(client: client, ptyID: ptyID, port: target.port, token: target.token)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isResolving {
            ProgressView("Connecting…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if client == nil {
            noInstanceView
        } else if let loadError, ports.isEmpty {
            VStack(spacing: 12) {
                Text("Couldn't load ports")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") { Task { await refresh() } }
                    .font(.subheadline)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if ports.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "globe")
                    .font(.title2)
                    .foregroundColor(Color("TextSecondary"))
                Text("No dev servers detected")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text("Start something like `npm run dev` in the terminal — it'll show up here.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List(ports) { port in
                Button {
                    Task { await openPreview(port: port.port) }
                } label: {
                    row(for: port)
                }
                .disabled(mintingPort != nil)
            }
            .listStyle(.plain)
            .overlay(alignment: .bottom) {
                if let mintError {
                    Text(mintError)
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(8)
                        .background(Color("BgPanel"))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.bottom, 12)
                }
            }
        }
    }

    private func row(for port: DevServerPort) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "globe")
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(port.command ?? "Unknown process")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(":\(port.port)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(Color("TextSecondary"))
            }
            Spacer()
            if mintingPort == port.port {
                ProgressView()
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundColor(Color("TextSecondary"))
            }
        }
        .padding(.vertical, 4)
    }

    private var noInstanceView: some View {
        VStack(spacing: 12) {
            Image(systemName: "globe")
                .font(.title2)
                .foregroundColor(Color("TextSecondary"))
            Text("No instance available")
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
            Button("Retry") { Task { await resolve() } }
                .font(.subheadline)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @MainActor
    private func resolve() async {
        isResolving = true
        await instanceStore.refreshIfNeeded()
        if let baseURL = await InstanceConnection.resolveBaseURL(from: instanceStore) {
            client = DevPreviewClient(baseURL: baseURL)
        }
        isResolving = false
        await refresh()
    }

    @MainActor
    private func refresh() async {
        guard let client else { return }
        do {
            ports = try await client.ports(ptyID: ptyID)
            loadError = nil
        } catch is CancellationError {
            // View disappeared mid-flight.
        } catch {
            loadError = error.localizedDescription
        }
    }

    @MainActor
    private func openPreview(port: Int) async {
        guard let client else { return }
        mintingPort = port
        mintError = nil
        do {
            let minted = try await client.mintPreviewToken(ptyID: ptyID, port: port)
            previewTarget = PreviewTarget(port: port, token: minted.token)
        } catch {
            mintError = error.localizedDescription
        }
        mintingPort = nil
    }
}
