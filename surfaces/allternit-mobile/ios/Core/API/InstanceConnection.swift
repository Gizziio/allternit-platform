import Foundation

/// Shared "resolve a base URL for the paired gizzi-code instance" helper —
/// factored out of `CodeThreadChatView`'s former `makeTerminalSession`/
/// `resolveMeshProxyBaseURL` so every gizzi-code REST client (pty, file
/// browser, session diff, …) attaches through the same mesh-aware path
/// instead of duplicating the mesh-proxy dance.
@MainActor
enum InstanceConnection {
    /// A resolved connection target: the base URL to talk to (already
    /// mesh-proxied if needed) plus the display name of the instance it
    /// actually came from — which can differ from `store.preferredInstance`
    /// when resolution fell back to a non-mesh instance or the static
    /// default.
    struct Resolved {
        let baseURL: URL
        let instanceName: String?
    }

    /// Resolves where to talk to: the preferred registered instance, proxied
    /// through `MeshClient` when it's a mesh address. In DEBUG builds with an
    /// explicit `-gizzi-url` override or a baked `ALLTERNIT_GIZZI_CODE_URL`,
    /// falls back to that static URL. In release builds there is no silent
    /// static fallback — callers must have a registered instance or they get
    /// `nil` and should show a "no harness" state.
    static func resolve(from store: InstanceStore) async -> Resolved? {
        if let instance = store.preferredInstance, let url = instance.instanceURL {
            if !url.isMeshAddress {
                return Resolved(baseURL: url, instanceName: instance.name)
            }
            if let proxyURL = await resolveMeshProxyBaseURL(for: url) {
                return Resolved(baseURL: proxyURL, instanceName: instance.name)
            }
            // Mesh instance preferred but unreachable. Do not silently fall back
            // to a different instance; the user must pick another or fix mesh.
            return nil
        }
        // Static gizzi URL is only usable when explicitly configured (DEBUG
        // launch arg or baked Info.plist). Release builds without a registered
        // instance resolve to nil.
        guard AppConfig.hasUsableGizziCodeURL else { return nil }
        return Resolved(baseURL: AppConfig.gizziCodeBaseURL, instanceName: nil)
    }

    /// Convenience resolver using the shared instance store.
    static func resolve() async -> Resolved? {
        await resolve(from: InstanceStore.shared)
    }

    /// Tunnels a localhost URL (e.g. `http://localhost:3000`) to the active
    /// mesh instance's loopback port (e.g. target `100.64.0.2:3000`) and
    /// returns the rewritten local proxy URL (e.g. `http://127.0.0.1:51234`).
    /// Returns the original URL if the host is not localhost or the mesh is not up.
    static func tunnelLocalhost(url: URL) async -> URL {
        guard let host = url.host, (host == "localhost" || host == "127.0.0.1") else {
            return url
        }
        guard let resolved = await resolve() else {
            return url
        }
        let targetInstanceURL = resolved.baseURL

        // Check if the resolved base URL is a mesh address, or if we need to retrieve
        // the original mesh host from the preferredInstance (if already loopback proxied).
        let meshHost: String
        if targetInstanceURL.isMeshAddress {
            guard let h = targetInstanceURL.host else { return url }
            meshHost = h
        } else if let host = targetInstanceURL.host, (host == "127.0.0.1" || host == "localhost"),
                  let preferred = InstanceStore.shared.preferredInstance,
                  let prefURL = preferred.instanceURL,
                  prefURL.isMeshAddress,
                  let h = prefURL.host {
            meshHost = h
        } else {
            return url
        }

        let port = url.port ?? 80
        guard let meshTargetURL = URL(string: "http://\(meshHost):\(port)") else {
            return url
        }
        do {
            let localPort = try await MeshClient.shared.proxyPort(forMeshURL: meshTargetURL)
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.host = "127.0.0.1"
            components?.port = localPort
            return components?.url ?? url
        } catch {
            print("Localhost tunneling failed: \(error.localizedDescription)")
            return url
        }
    }

    /// Convenience for callers that only need the base URL (file browser,
    /// diff viewer REST clients — no display-name requirement).
    static func resolveBaseURL(from store: InstanceStore) async -> URL? {
        await resolve(from: store)?.baseURL
    }

    /// Resolves the loopback base URL (`http://127.0.0.1:<port>`) for a mesh
    /// instance: with the node already up, straight to the proxy; otherwise
    /// starts it via platform enrollment (a DEBUG auth key takes precedence
    /// inside MeshClient) and waits for the join (enroll plus the Go-side
    /// start, which blocks up to ~60s — callers should show a "Connecting…"
    /// state while this runs). nil when the mesh can't be used: a failed
    /// enroll or start leaves state `.failed`.
    private static func resolveMeshProxyBaseURL(for url: URL) async -> URL? {
        let mesh = MeshClient.shared
        if !mesh.state.isUp {
            await mesh.startWithPlatformAuth()
            // start() is fire-and-forget; poll the published state until
            // the join settles.
            while mesh.state == .starting {
                try? await Task.sleep(for: .milliseconds(250))
                if Task.isCancelled { return nil }
            }
            guard mesh.state.isUp else { return nil }
        }
        return try? await mesh.localProxyBaseURL(forMeshURL: url)
    }
}
