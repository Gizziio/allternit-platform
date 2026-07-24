import Foundation
import UIKit
import Mesh

/// Wrapper around the embedded tsnet node (Frameworks/Mesh.xcframework —
/// vendored from infrastructure/mesh/tsnet-ios). One node per app process:
/// joins the Headscale tailnet (AppConfig.meshControlURL) with a pre-auth
/// key and exposes `meshGET` for reaching tailnet-only services.
///
/// The gobind entry points (`MeshNode.start`, `get`, `close`) are ordinary
/// blocking C calls into the Go runtime — `start` blocks up to ~60s while
/// the node registers — so they always run off the main actor. tsnet stores
/// its node key in `Application Support/mesh`, so the node keeps the same
/// tailnet identity across launches (and across the background-restart
/// below) as long as the directory survives.
@MainActor
final class MeshClient: ObservableObject {
    static let shared = MeshClient()

    enum State: Equatable {
        case idle
        case starting
        case up(meshIP: String)
        case failed(String)

        /// True when the node was up (or trying) — used by the foreground
        /// restart, which should not resurrect a stopped/failed node.
        var isLive: Bool {
            switch self {
            case .starting, .up: return true
            case .idle, .failed: return false
            }
        }
    }

    @Published private(set) var state: State = .idle

    // `nonisolated(unsafe)`: MeshNode is a gobind Obj-C object (not Sendable)
    // and its methods must run off the main actor — same Swift 6.0 escape
    // hatch PtySession documents for its deinit teardown. Safe by invariant:
    // the reference is only swapped on the main actor (start/stop), and every
    // gobind call just RPCs into the Go runtime, which serializes internally.
    nonisolated(unsafe) private var node: MeshNode?

    /// Last successful start parameters, so the foreground restart can rejoin
    /// without the caller re-supplying the key.
    private var lastStartParams: (controlURL: String, authKey: String)?
    /// Set when the app backgrounds while the node is live; consumed by the
    /// foreground restart.
    private var restartOnForeground = false

    /// Sendable box for handing the (non-Sendable) MeshNode to a detached
    /// task — see the `nonisolated(unsafe)` note on `node`.
    private struct NodeBox: @unchecked Sendable {
        let node: MeshNode
    }

    // `nonisolated(unsafe)` so the (non-isolated, Swift 6.0) deinit can
    // unregister them — same constraint VoiceModeViewModel documents for its
    // interruption observer. MainActor-isolated everywhere else.
    nonisolated(unsafe) private var foregroundObserver: NSObjectProtocol?
    nonisolated(unsafe) private var backgroundObserver: NSObjectProtocol?

    private init() {
        // iOS suspends the process in the background and the tailnet sockets
        // die with it; tsnet can't revive them. On foreground, if the node
        // was live, tear it down and re-start with the same params — the
        // persisted dataDir means the rejoin reuses the same node key, so
        // the mesh IP is stable. Known limitation: anything mid-flight
        // through the old node (e.g. a meshGET) fails across the transition.
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.restartOnForeground = self.state.isLive
            }
        }
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.restartOnForeground,
                      let params = self.lastStartParams else { return }
                self.restartOnForeground = false
                self.start(controlURL: params.controlURL, authKey: params.authKey)
            }
        }
    }

    deinit {
        if let foregroundObserver { NotificationCenter.default.removeObserver(foregroundObserver) }
        if let backgroundObserver { NotificationCenter.default.removeObserver(backgroundObserver) }
    }

    // MARK: - Lifecycle

    /// Brings the node up. No-op while a start is already in flight; any
    /// previous node is closed first. `authKey` is a Headscale pre-auth key
    /// (minted manually via `fly ssh` until platform-side minting lands).
    func start(controlURL: String = AppConfig.meshControlURL, authKey: String) {
        guard state != .starting else { return }

        // Box before crossing: only @unchecked-Sendable values may be
        // captured by the detached (sending) closure below.
        let oldBox = node.map { NodeBox(node: $0) }
        node = nil
        state = .starting
        lastStartParams = (controlURL, authKey)

        let dataDir: String
        do {
            dataDir = try Self.meshDataDir().path
        } catch {
            state = .failed("Couldn't create mesh data directory: \(error.localizedDescription)")
            return
        }

        Task.detached { [weak self] in
            if let oldBox {
                try? oldBox.node.close()
            }
            guard let newNode = MeshNewNode("allternit-ios") else {
                await self?.startDidFail("MeshNewNode returned nil")
                return
            }
            let newBox = NodeBox(node: newNode)
            do {
                // Blocks until the node is online (up to ~60s).
                try newBox.node.start(controlURL, authKey: authKey, dataDir: dataDir)
                let meshIP = newBox.node.meshIP()
                await self?.startDidSucceed(newBox, meshIP: meshIP.isEmpty ? "unknown" : meshIP)
            } catch {
                try? newBox.node.close()
                await self?.startDidFail(error.localizedDescription)
            }
        }
    }

    /// Completion hops from start()'s detached task. Methods (not
    /// `MainActor.run` closures) so `self` crosses as the actor receiver
    /// instead of a task-isolated capture.
    private func startDidSucceed(_ box: NodeBox, meshIP: String) {
        node = box.node
        state = .up(meshIP: meshIP)
    }

    private func startDidFail(_ message: String) {
        state = .failed(message)
    }

    /// Shuts the node down and forgets the start params (no foreground
    /// restart). The node identity on disk is kept — the next start reuses it.
    func stop() {
        let oldBox = node.map { NodeBox(node: $0) }
        node = nil
        lastStartParams = nil
        restartOnForeground = false
        state = .idle
        if let oldBox {
            Task.detached {
                try? oldBox.node.close()
            }
        }
    }

    // MARK: - Traffic

    /// HTTP GET through the tailnet using the node's identity (response body
    /// capped at 4 MiB by the framework). Runs off the calling executor —
    /// the underlying gobind call blocks.
    nonisolated func meshGET(_ url: String) async throws -> String {
        guard let node else { throw MeshClientError.notUp }
        // Box before crossing into the detached (sending) closure.
        let box = NodeBox(node: node)
        return try await Task.detached {
            // `get(_:error:)` returns a nonnull NSString*, so Swift imports
            // the error as an out-parameter instead of `throws`.
            var error: NSError?
            let body = box.node.get(url, error: &error)
            if let error { throw error }
            return body
        }.value
    }

    enum MeshClientError: LocalizedError {
        case notUp

        var errorDescription: String? {
            switch self {
            case .notUp: return "Mesh node is not up"
            }
        }
    }

    // MARK: - DEBUG auth key

    /// Pre-auth key source (v1, DEBUG only): the `-mesh-auth-key <key>`
    /// launch argument, or the hidden Settings debug row — both land in
    /// UserDefaults under `mesh-auth-key` (launch args sit in the arguments
    /// domain, so the flag wins when both are set). Release builds have no
    /// key entry at all; platform-side key minting replaces this later.
    static var debugAuthKey: String? {
        #if DEBUG
        let key = UserDefaults.standard.string(forKey: "mesh-auth-key")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (key?.isEmpty == false) ? key : nil
        #else
        return nil
        #endif
    }

    // MARK: - Data directory

    /// `Application Support/mesh`, created on first use. Keeping a stable
    /// directory is what makes the node identity (and mesh IP) persist
    /// across launches.
    private static func meshDataDir() throws -> URL {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = support.appendingPathComponent("mesh", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
