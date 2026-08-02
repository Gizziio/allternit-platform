import Foundation

/// One self-registered `gizzi serve --tunnel` instance, as listed by the
/// cloud API's `GET /api/v1/gizzi-instances` (newest first):
/// `{ "instances": [{ "id", "name", "url", "status", "updated_at" }] }`.
///
/// `status` and `updatedAt` stay raw Strings on purpose: unknown future
/// statuses shouldn't break decoding of the whole list, and the timestamp
/// (RFC-3339 or SQLite datetime depending on the backend) is display-only
/// here — no Date parsing.
struct GizziInstance: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    let url: String
    /// "online" | "stale" (kept as String for forward compatibility).
    let status: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, url, status
        case updatedAt = "updated_at"
    }

    var isOnline: Bool { status == "online" }

    /// The instance's tunnel base URL (e.g. `https://xyz.trycloudflare.com`);
    /// nil if the server sent a malformed URL.
    var instanceURL: URL? { URL(string: url) }

    /// True when the instance registered a mesh URL (100.64.0.0/10) —
    /// reachable only through the embedded mesh node's loopback proxy, never
    /// directly via URLSession.
    var isMeshInstance: Bool { instanceURL?.isMeshAddress == true }
}

extension URL {
    /// True for tailnet IPv4 addresses (100.64.0.0/10: first octet 100,
    /// second 64–127). These route only through the in-process tsnet node.
    var isMeshAddress: Bool {
        guard let host, scheme == "http" || scheme == "https" else { return false }
        let octets = host.split(separator: ".", omittingEmptySubsequences: false)
        guard octets.count == 4,
              let first = Int(octets[0]), first == 100,
              let second = Int(octets[1]), (64...127).contains(second),
              Int(octets[2]) != nil, Int(octets[3]) != nil else { return false }
        return true
    }
}

/// Fetches the signed-in user's registered gizzi instances from the cloud
/// API. Like EnvironmentStore's handoff claim, requests go DIRECT to
/// `AppConfig.cloudAPIBaseURL` — never through the EnvironmentStore relay
/// route, which only proxies runtime-gateway calls.
final class InstancesClient: @unchecked Sendable {
    /// `GET {cloud}/api/v1/gizzi-instances` with the Clerk Bearer
    /// (EnvironmentStore.claimHandoffToken is the template for cloud calls).
    func fetchInstances() async throws -> [GizziInstance] {
        let url = AppConfig.cloudAPIBaseURL.appendingPathComponent("api/v1/gizzi-instances")
        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(InstancesResponse.self, from: data).instances
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private struct InstancesResponse: Decodable {
    let instances: [GizziInstance]
}

// MARK: - Runtime devices & pairing codes

/// One paired runtime device, as listed by the cloud API's
/// `GET /api/v1/runtime-devices`:
/// `{ "runtimes": [{ "id", "name", "runtimeType", "hostname", "status",
/// "lastSeenAt", ... }] }` (runtime_pairing.rs `list_runtime_devices` —
/// camelCase keys, newest first).
///
/// `status` and `lastSeenAt` stay raw Strings on purpose (unknown future
/// statuses shouldn't break decoding of the whole list; the timestamp is
/// display-only here).
struct RuntimeDevice: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    /// "vps" | "desktop" | "hosted" (kept as String for forward compatibility).
    let runtimeType: String
    let hostname: String?
    /// "online" | "offline" (already staleness-adjusted server-side).
    let status: String
    let lastSeenAt: String?

    var isOnline: Bool { status == "online" }

    /// Display label mirroring the web panel (DevicePairingPanel.tsx:503).
    var typeLabel: String { Self.typeLabel(for: runtimeType) }

    static func typeLabel(for runtimeType: String) -> String {
        switch runtimeType {
        case "vps": return "VPS runtime"
        case "hosted": return "Hosted runtime"
        default: return "Desktop runtime"
        }
    }
}

/// A pending pairing request behind a user code, from
/// `GET /api/v1/runtime-pairings/code/:code` (PairingInfoResponse,
/// runtime_pairing.rs:108-121 — camelCase keys).
struct RuntimePairingInfo: Decodable, Sendable {
    let pairingId: String
    let userCode: String
    let name: String
    let runtimeType: String
    let hostname: String?
    let platform: String?
    let status: String
}

/// Cloud-API client for the runtime-device list and the `gizzi pair`
/// approval flow the Code tab's pairing sheet uses. Like InstancesClient,
/// requests go DIRECT to `AppConfig.cloudAPIBaseURL` with the Clerk Bearer —
/// never through the EnvironmentStore relay route.
final class RuntimeDevicesClient: @unchecked Sendable {
    /// `GET {cloud}/api/v1/runtime-devices` — the signed-in user's paired
    /// runtime devices.
    func fetchRuntimes() async throws -> [RuntimeDevice] {
        let url = AppConfig.cloudAPIBaseURL.appendingPathComponent("api/v1/runtime-devices")
        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(RuntimesResponse.self, from: data).runtimes
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `GET {cloud}/api/v1/runtime-pairings/code/:code` — the pending pairing
    /// request behind a user code (404 when the code is invalid or expired).
    func lookupPairing(code: String) async throws -> RuntimePairingInfo {
        let url = AppConfig.cloudAPIBaseURL
            .appendingPathComponent("api/v1/runtime-pairings/code")
            .appendingPathComponent(code)
        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(RuntimePairingInfo.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `POST {cloud}/api/v1/runtime-pairings/code/:code/approve` with an
    /// empty JSON body (DevicePairingPanel.tsx:188-192). The device registers
    /// itself as a runtime device when it next polls the pairing status, so
    /// the response carries only the name (`runtimeName`,
    /// runtime_pairing.rs:412-417) — no device id yet.
    @discardableResult
    func approvePairing(code: String) async throws -> String? {
        let url = AppConfig.cloudAPIBaseURL
            .appendingPathComponent("api/v1/runtime-pairings/code")
            .appendingPathComponent(code)
            .appendingPathComponent("approve")
        let client = APIClient.shared
        var request = try await client.authorizedRequest(url: url, method: "POST")
        request.httpBody = Data("{}".utf8)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        return try? JSONDecoder().decode(ApprovePairingResponse.self, from: data).runtimeName
    }

    /// `POST {cloud}/api/v1/runtime-pairings/code/:code/deny` with an empty
    /// JSON body (DevicePairingPanel.tsx:205-222, runtime_pairing.rs
    /// `deny_pairing`) — marks the pending request denied; 404 if the code
    /// is invalid, expired, or already resolved.
    func denyPairing(code: String) async throws {
        let url = AppConfig.cloudAPIBaseURL
            .appendingPathComponent("api/v1/runtime-pairings/code")
            .appendingPathComponent(code)
            .appendingPathComponent("deny")
        let client = APIClient.shared
        var request = try await client.authorizedRequest(url: url, method: "POST")
        request.httpBody = Data("{}".utf8)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
    }
}

private struct RuntimesResponse: Decodable {
    let runtimes: [RuntimeDevice]
}

private struct ApprovePairingResponse: Decodable {
    let runtimeName: String?
}
