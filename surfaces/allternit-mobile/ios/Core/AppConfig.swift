import Foundation

/// Runtime configuration, sourced from Info.plist so environments can be
/// swapped via build settings / xcconfig without code changes.
///
/// - `ALLTERNIT_API_BASE_URL` — Allternit gateway base URL (no trailing slash).
/// - `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (`pk_test_…` / `pk_live_…`).
///
/// Unset or unresolved `$(VAR)` values fall back to the dev defaults below.
/// There is intentionally no hardcoded production URL (the public gateway host
/// for mobile is still an open Phase-0 question).
enum AppConfig {
    /// Default: the local dev gateway.
    static let apiBaseURL: URL = {
        if let value = infoPlistValue("ALLTERNIT_API_BASE_URL"),
           let url = URL(string: value) {
            return url
        }
        return URL(string: "http://127.0.0.1:8013/api/v1")!
    }()

    /// Full URL of the agent-chat streaming endpoint (`POST /api/agent-chat`).
    ///
    /// agent-chat is mounted directly under `/api` on allternit-api
    /// (cmd/allternit-api/src/main.rs: `.nest("/api", agent_chat_router())`) —
    /// NOT under the `/api/v1` router like every other endpoint — so it can't
    /// be reached by appending a path to `apiBaseURL`. Derived by stripping a
    /// trailing `v1` path component when present, then appending `agent-chat`.
    static let agentChatURL: URL = {
        let apiBase = apiBaseURL.lastPathComponent == "v1"
            ? apiBaseURL.deletingLastPathComponent()
            : apiBaseURL
        return apiBase.appendingPathComponent("agent-chat")
    }()

    /// Base URL of the ACI (Agent-Computer-Interface) endpoints —
    /// `POST /api/aci/run`, `GET /api/aci/stream/:id`, `POST /api/aci/stop/:id`,
    /// `POST /api/aci/approve/:id`.
    ///
    /// Like agent-chat, the ACI router is mounted directly under `/api` on
    /// allternit-api (cmd/allternit-api/src/main.rs: `.nest("/api", aci_router())`)
    /// — NOT under the `/api/v1` router — so it can't be reached by appending
    /// a path to `apiBaseURL`. Derived the same way as `agentChatURL`.
    static let aciBaseURL: URL = {
        let apiBase = apiBaseURL.lastPathComponent == "v1"
            ? apiBaseURL.deletingLastPathComponent()
            : apiBaseURL
        return apiBase.appendingPathComponent("aci")
    }()

    /// Empty until a real publishable key is provided — AuthManager treats an
    /// empty key as "Clerk not configured" instead of crashing.
    static let clerkPublishableKey: String = infoPlistValue("CLERK_PUBLISHABLE_KEY") ?? ""

    /// Allternit Cloud API host — the runtime-device registry and the relay
    /// entry point. Default mirrors the web's `cloudApiBaseUrl()` fallback
    /// (surfaces/ai.allternit.com/src/lib/fetch-interceptor.ts:85-87);
    /// overridable via `ALLTERNIT_CLOUD_API_URL` in Info.plist.
    static let cloudAPIBaseURL: URL = {
        #if DEBUG
        // `-cloud-url <url>` (DEBUG only): point cloud calls (handoff claim,
        // runtime relay) at a locally running allternit-cloud-api.
        if let override = UserDefaults.standard.string(forKey: "cloud-url"),
           let url = URL(string: override) {
            return url
        }
        #endif
        if let value = infoPlistValue("ALLTERNIT_CLOUD_API_URL"),
           let url = URL(string: value) {
            return url
        }
        return URL(string: "https://allternit-cloud-api.fly.dev")!
    }()

    /// Relay proxy URL for a paired runtime device:
    /// `{cloud}/api/v1/runtime-devices/<id>/proxy`
    /// (fetch-interceptor.ts:450-453).
    ///
    /// NOTE: the original request path is NOT appended after `/proxy` — the
    /// relay is always a POST whose JSON body carries the original call as
    /// `{ method, path, headers, body, bodyEncoding }`
    /// (fetch-interceptor.ts:454-463). See APIClient.relayRequest(for:proxyURL:).
    static func runtimeProxyURL(runtimeId: String) -> URL {
        let escaped = runtimeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? runtimeId
        return cloudAPIBaseURL.appendingPathComponent("api/v1/runtime-devices/\(escaped)/proxy")
    }

    /// Returns nil for missing, empty, or unresolved-`$(VARIABLE)` values.
    private static func infoPlistValue(_ key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty,
              !value.hasPrefix("$(") else {
            return nil
        }
        return value
    }
}
