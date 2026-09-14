import Foundation

// -----------------------------------------------------------------------------
// Bot desktop REST models — base path /api/v1/bots/:bot_id/desktop on
// allternit-api.
//
// Mirrors the Rust producers in cmd/allternit-api/src/bot_desktop_routes.rs
// (`DesktopStatusResponse`, `ProvisionDesktopResponse`, and the control
// actions' `{control_state, sandbox_id}` answers) and the web client shapes
// in surfaces/ai.allternit.com/src/lib/bots/vm-operator.ts
// (`BotDesktopStatus`, `BotDesktopSandbox`). The API emits snake_case keys
// on the wire; Swift properties stay camelCase via explicit CodingKeys.
// Timestamps stay Strings (`taken_over_at` is RFC 3339); views parse them at
// render time, never via a global date strategy.
//
// Control state is held in memory server-side (it does not survive API
// restarts, bot_desktop_routes.rs:433-444) — these models simply carry
// whatever the server last said; nothing is cached or inferred client-side.
// -----------------------------------------------------------------------------

/// Snapshot of one bot's persistent desktop sandbox (`DesktopStatusResponse`,
/// bot_desktop_routes.rs:46-54).
struct BotDesktopStatus: Decodable, Sendable, Equatable {
    /// Whether the sandbox currently exposes a desktop stream. The server
    /// emits only "running"/"off" today; anything else decodes to `.unknown`
    /// rather than failing the response (repo tolerant-decoding convention).
    let status: Status
    /// Who drives the desktop right now (`BotDesktopControlState`,
    /// bot_desktop_routes.rs:446-452).
    let controlState: ControlState
    /// VNC-over-WebSocket path (`/ws/bots/:id/desktop/vnc?…`), present only
    /// when the sandbox exposes a raw VNC stream AND it is tunnelled through
    /// the platform API (bot_desktop_routes.rs:100-107). Live viewing is
    /// web-only; iOS shows a note instead of connecting.
    let wsURL: String?
    /// Wire key `protocol` ("vnc" | "novnc" | "none") — named
    /// `streamProtocol` here to dodge the Swift keyword.
    let streamProtocol: StreamProtocol
    let sandboxId: String
    let takenOverByUserId: String?
    let takenOverAt: String?

    /// Desktop reachability (`status` field). The web type also lists
    /// "error" (vm-operator.ts:365) but the Rust producer never emits it.
    enum Status: String, Sendable {
        case running, off, unknown
    }

    /// Who holds the desktop (`control_state` field).
    enum ControlState: String, Sendable {
        case botControls = "bot_controls"
        case humanControls = "human_controls"
        case humanObserving = "human_observing"
        case unknown

        /// Status-pill label (UI), parity with the web header copy
        /// (BotDesktopView.tsx:386).
        var label: String {
            switch self {
            case .botControls: return "Bot controls"
            case .humanControls: return "You control"
            case .humanObserving: return "You're observing"
            case .unknown: return "Unknown"
            }
        }
    }

    /// Desktop stream flavor (`protocol` field,
    /// bot_desktop_routes.rs:122-127).
    enum StreamProtocol: String, Sendable {
        case vnc, novnc, none, unknown
    }

    enum CodingKeys: String, CodingKey {
        case status
        case controlState = "control_state"
        case wsURL = "ws_url"
        case streamProtocol = "protocol"
        case sandboxId = "sandbox_id"
        case takenOverByUserId = "taken_over_by_user_id"
        case takenOverAt = "taken_over_at"
    }

    /// Tolerant decoding per repo model convention: a missing field degrades
    /// to a default, an unknown enum string decodes to `.unknown` rather than
    /// failing the whole response.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawStatus = try container.decodeIfPresent(String.self, forKey: .status) ?? ""
        status = Status(rawValue: rawStatus) ?? .unknown
        let rawControlState = try container.decodeIfPresent(String.self, forKey: .controlState) ?? ""
        controlState = ControlState(rawValue: rawControlState) ?? .unknown
        wsURL = try container.decodeIfPresent(String.self, forKey: .wsURL)
        let rawProtocol = try container.decodeIfPresent(String.self, forKey: .streamProtocol) ?? ""
        streamProtocol = StreamProtocol(rawValue: rawProtocol) ?? .unknown
        sandboxId = try container.decodeIfPresent(String.self, forKey: .sandboxId) ?? ""
        takenOverByUserId = try container.decodeIfPresent(String.self, forKey: .takenOverByUserId)
        takenOverAt = try container.decodeIfPresent(String.self, forKey: .takenOverAt)
    }

    /// Memberwise init for fixtures and local edits.
    init(status: Status, controlState: ControlState, wsURL: String?,
         streamProtocol: StreamProtocol, sandboxId: String,
         takenOverByUserId: String?, takenOverAt: String?) {
        self.status = status
        self.controlState = controlState
        self.wsURL = wsURL
        self.streamProtocol = streamProtocol
        self.sandboxId = sandboxId
        self.takenOverByUserId = takenOverByUserId
        self.takenOverAt = takenOverAt
    }
}

/// Answer of `POST /api/v1/bots/:bot_id/desktop/provision`
/// (`ProvisionDesktopResponse`, bot_desktop_routes.rs:57-62; web
/// `BotDesktopSandbox`, vm-operator.ts:372-377). Idempotent: an existing
/// active sandbox is returned as-is, so `status` may be "creating" or
/// "running" — kept as a plain String, it is not the same enum as
/// `BotDesktopStatus.Status`.
struct BotDesktopProvisionResponse: Decodable, Sendable, Equatable {
    let sandboxId: String
    let status: String
    /// Always "opensandbox" today (bot_desktop_routes.rs:263).
    let provider: String
    let host: String?

    enum CodingKeys: String, CodingKey {
        case status, provider, host
        case sandboxId = "sandbox_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sandboxId = try container.decodeIfPresent(String.self, forKey: .sandboxId) ?? ""
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? ""
        provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? ""
        host = try container.decodeIfPresent(String.self, forKey: .host)
    }
}

/// Answer of the control actions (`observe` / `take-over` / `hand-back`):
/// `{control_state, sandbox_id}` (bot_desktop_routes.rs:319-322, 358-361,
/// 397-400). The new control state is the only payload; callers refetch
/// `BotDesktopStatus` for the full snapshot.
struct BotDesktopControlResponse: Decodable, Sendable, Equatable {
    let controlState: BotDesktopStatus.ControlState
    let sandboxId: String

    enum CodingKeys: String, CodingKey {
        case controlState = "control_state"
        case sandboxId = "sandbox_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawControlState = try container.decodeIfPresent(String.self, forKey: .controlState) ?? ""
        controlState = BotDesktopStatus.ControlState(rawValue: rawControlState) ?? .unknown
        sandboxId = try container.decodeIfPresent(String.self, forKey: .sandboxId) ?? ""
    }
}
