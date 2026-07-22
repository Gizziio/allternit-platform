import SwiftUI

/// Runtime execution target — the web shell's `EnvironmentSelector` modes
/// (surfaces/ai.allternit.com/src/shell/EnvironmentSelector.tsx). v1 ships
/// `local` + `cloud` only; `byoc-vps` / `hybrid` are desktop-web modes and
/// intentionally skipped.
enum AppEnvironment: String, CaseIterable, Sendable {
    case local
    case cloud

    /// `getDefaultEnvironment()` names (EnvironmentSelector.tsx:290-345).
    var label: String {
        switch self {
        case .local: return "This Device"
        case .cloud: return "Allternit Cloud"
        }
    }

    var description: String {
        switch self {
        case .local: return "Use the desktop-local backend"
        case .cloud: return "Hosted execution plane"
        }
    }

    /// SF Symbols standing in for the web's Phosphor Desktop / Cloud icons
    /// (EnvironmentSelector.tsx:154-167).
    var icon: String {
        switch self {
        case .local: return "desktopcomputer"
        case .cloud: return "cloud"
        }
    }

    /// `getEnvironmentColor()` (EnvironmentSelector.tsx:169-182):
    /// tailwind emerald-500 / blue-500.
    var color: Color {
        switch self {
        case .local: return Color(hex: "#10B981")
        case .cloud: return Color(hex: "#3B82F6")
        }
    }
}

/// App-wide execution-environment state: which runtime target API calls go to
/// (`environment`) and which runtime device is paired for cloud relay
/// (`pairedRuntimeId`). Both persist, mirroring the web's localStorage keys.
///
/// APIClient resolves `apiRoute()` on EVERY request, so flipping the
/// environment takes effect on the next call — no client rebuilds.
@MainActor
final class EnvironmentStore: ObservableObject {
    static let shared = EnvironmentStore()

    @Published var environment: AppEnvironment {
        didSet { defaults.set(environment.rawValue, forKey: Keys.environment) }
    }

    /// The runtime device cloud requests relay through. Mirrors the web's
    /// `allternit.active-runtime-id` localStorage key (fetch-interceptor.ts:441).
    @Published private(set) var pairedRuntimeId: String? {
        didSet { defaults.set(pairedRuntimeId, forKey: Keys.pairedRuntimeId) }
    }

    private let defaults: UserDefaults

    private enum Keys {
        static let environment = "allternit-environment"
        static let pairedRuntimeId = "allternit.active-runtime-id"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.environment = defaults.string(forKey: Keys.environment)
            .flatMap(AppEnvironment.init(rawValue:)) ?? .local
        self.pairedRuntimeId = defaults.string(forKey: Keys.pairedRuntimeId)
    }

    // MARK: - Routing

    /// How runtime API calls should reach the backend right now.
    ///
    /// - local → direct to the configured gateway (current behavior).
    /// - cloud + paired runtime → relay envelope POST to the runtime's proxy
    ///   URL (fetch-interceptor.ts:441-468).
    /// - cloud + NO paired runtime → unavailable, mirroring the web
    ///   interceptor's 503 `runtime_unavailable` guard
    ///   (fetch-interceptor.ts:470-478).
    func apiRoute() -> APIRoute {
        switch environment {
        case .local:
            return .direct
        case .cloud:
            guard let pairedRuntimeId, !pairedRuntimeId.isEmpty else {
                return .unavailable(reason: "No paired Allternit runtime. Pair a runtime device or switch back to This Device.")
            }
            return .relay(proxyURL: AppConfig.runtimeProxyURL(runtimeId: pairedRuntimeId))
        }
    }

    // MARK: - Pairing

    /// Stores the paired runtime device id and switches to the cloud
    /// environment: on the web, setting `allternit.active-runtime-id` alone
    /// engages the relay (fetch-interceptor.ts:442), so pairing implies cloud.
    func pair(withRuntimeId runtimeId: String) {
        pairedRuntimeId = runtimeId
        environment = .cloud
    }

    /// Drops the pairing and falls back to local — staying on cloud with no
    /// paired runtime would fail every request (503 `runtime_unavailable`).
    func unpair() {
        pairedRuntimeId = nil
        environment = .local
    }

    /// POST /dispatch/handoff/claim on the cloud host — the phone half of the
    /// desktop QR handoff (surfaces/ai.allternit.com/src/lib/dispatch/handoff.ts).
    ///
    /// ⚠️ DEPENDENT ON AN UNIMPLEMENTED ENDPOINT: handoff.ts:1-7,23-27 states
    /// these endpoints are dev-server-only and "in production they must be
    /// implemented by the hosted Allternit backend" — there is no production
    /// implementation in this repo, so expect this call to fail until it
    /// ships. The manual runtime-id entry is the working path.
    ///
    /// Returns the claimed runtime id when the (tolerantly decoded) response
    /// carries one, nil otherwise. The request goes DIRECT to the cloud host —
    /// never through the relay.
    @discardableResult
    func claimHandoffToken(_ token: String) async throws -> String? {
        // Handoff endpoints live OUTSIDE /api on purpose (handoff.ts:23-27).
        let url = AppConfig.cloudAPIBaseURL.appendingPathComponent("dispatch/handoff/claim")
        let client = APIClient.shared
        var request = try await client.authorizedRequest(url: url, method: "POST")
        request.httpBody = try JSONEncoder().encode(["token": token])

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)

        // Tolerant decode: the success shape is undefined (the endpoint is
        // unimplemented), so accept a runtime id under any common key.
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        for key in ["runtimeId", "runtime_id", "runtimeID", "deviceId", "device_id", "id"] {
            if let value = object[key] as? String, !value.isEmpty {
                return value
            }
        }
        return nil
    }
}
