import Foundation
import CoreGraphics

// -----------------------------------------------------------------------------
// ACIEvent — wire frames of `GET /api/aci/stream/:id` (Server-Sent Events).
//
// The endpoint streams SSE `data: {json}\n\n` lines; each frame is an envelope
// `{ "type": ..., "data": ..., "ts": <millis> }` parsed by the web store at
// surfaces/ai.allternit.com/src/capsules/browser/browserAgent.store.ts:576-650:
//
//   {"type":"state",      data: RunState (lib/aci/types.ts), ts}
//   {"type":"screenshot", data: { screenshot: <base64 PNG> }, ts}
//   {"type":"trace",      data: { message?, adapterId? }, ts}
//   {"type":"done"}       — terminal; the web closes the EventSource on it.
//
// RunState (the fields the web reads):
//   { status?, lastMessage?, adapterId?, stepIndex?, totalSteps?,
//     currentAction?: { type?, label?, selector?, x?, y?, risk? } | null }
//
// Like the web parser (`catch { /* ignore malformed events */ }`), unknown
// frame types map to `.ignored` and undecodable payloads are skipped by the
// client instead of failing the stream.
// -----------------------------------------------------------------------------

/// A single parsed frame from the ACI run stream.
enum ACIEvent: Decodable, Sendable {
    /// Run lifecycle/state update (`{"type":"state"}`).
    case state(ACIStateFrame)

    /// Live viewport frame (`{"type":"screenshot"}`) — base64-encoded PNG,
    /// no `data:` prefix (the web prepends `data:image/png;base64,`).
    case screenshot(String)

    /// Human-readable progress line (`{"type":"trace"}`).
    case trace(ACITraceFrame)

    /// Terminal frame (`{"type":"done"}`) — the run is over; the web closes
    /// the EventSource here, so the client finishes the stream.
    case done

    /// Unknown frame type or missing payload — parser tolerance.
    case ignored

    // MARK: - Payloads

    /// `state` payload — mirrors the fields the web store reads from the
    /// backend's RunState (browserAgent.store.ts:584-635).
    struct ACIStateFrame: Sendable {
        /// Raw status string; map through `ACIRunStatus.init(_:)`.
        let status: String?
        let lastMessage: String?
        let adapterId: String?
        let stepIndex: Int?
        let totalSteps: Int?
        /// Whether the `currentAction` key was present at all — the web tests
        /// `'currentAction' in s`, where present-but-null CLEARS the action
        /// while absent LEAVES it. Codable collapses absent and null into
        /// `nil`, so the key's presence is captured separately.
        let hasCurrentAction: Bool
        let currentAction: ACIAction?
    }

    /// The agent's in-flight action (`state.currentAction`).
    struct ACIAction: Decodable, Sendable {
        /// Lowercase kind on the wire ("click", "type", …); the web lowercases
        /// before mapping to a highlight color, so do the same at the call site.
        let type: String?
        let label: String?
        let selector: String?
        let x: Double?
        let y: Double?
        /// Policy risk tier 0-4 (PolicyTiers.md); `nil` treated as 3 by the web.
        let risk: Int?
        /// Not sent by the current runner — the web synthesizes 40×20 from
        /// x/y (browserAgent.store.ts:619-622). Decoded tolerantly so a future
        /// `OverlayHighlightEvent`-style rect (browserAgent.types.ts:385-392)
        /// is honored when present.
        let width: Double?
        let height: Double?

        /// Element highlight rect in SCREENSHOT PIXEL space; nil when the
        /// action carries no coordinates. Size defaults to the web's
        /// synthesized 40×20 when the frame omits width/height.
        var boundingBox: CGRect? {
            guard let x, let y else { return nil }
            return CGRect(x: x, y: y, width: width ?? 40, height: height ?? 20)
        }
    }

    /// `trace` payload (browserAgent.store.ts:640-643).
    struct ACITraceFrame: Decodable, Sendable {
        let message: String?
        let adapterId: String?
    }

    // MARK: - Decoding

    private enum CodingKeys: String, CodingKey {
        case type, data
    }

    private enum StateKeys: String, CodingKey {
        case status, lastMessage, adapterId, stepIndex, totalSteps, currentAction
    }

    private enum ScreenshotKeys: String, CodingKey {
        case screenshot
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        guard let type = try container.decodeIfPresent(String.self, forKey: .type) else {
            self = .ignored
            return
        }

        switch type {
        case "state":
            let data = try container.nestedContainer(keyedBy: StateKeys.self, forKey: .data)
            // `decodeIfPresent` returns nil for BOTH absent and explicit null;
            // `contains` reproduces the web's `'currentAction' in s` check.
            let hasAction = data.contains(.currentAction)
            self = .state(ACIStateFrame(
                status: try data.decodeIfPresent(String.self, forKey: .status),
                lastMessage: try data.decodeIfPresent(String.self, forKey: .lastMessage),
                adapterId: try data.decodeIfPresent(String.self, forKey: .adapterId),
                stepIndex: try data.decodeIfPresent(Int.self, forKey: .stepIndex),
                totalSteps: try data.decodeIfPresent(Int.self, forKey: .totalSteps),
                hasCurrentAction: hasAction,
                currentAction: try data.decodeIfPresent(ACIAction.self, forKey: .currentAction)
            ))

        case "screenshot":
            let data = try container.nestedContainer(keyedBy: ScreenshotKeys.self, forKey: .data)
            if let screenshot = try data.decodeIfPresent(String.self, forKey: .screenshot) {
                self = .screenshot(screenshot)
            } else {
                self = .ignored
            }

        case "trace":
            self = .trace(try container.decode(ACITraceFrame.self, forKey: .data))

        case "done":
            self = .done

        default:
            // Unknown frame — skip-and-continue (web parser tolerance).
            self = .ignored
        }
    }
}

/// Run lifecycle status (browserAgent.types.ts:400-405 plus the `Error` value
/// the web viewport tolerates at ACIComputerUseView.tsx:232).
enum ACIRunStatus: Sendable, Equatable {
    case idle
    case running
    case waitingApproval
    case blocked
    case done
    case error
    /// A status string this client doesn't know — tolerated like the web,
    /// which stores unknown statuses verbatim.
    case unknown

    /// Tolerant mapping of the wire string (`Idle` | `Running` |
    /// `WaitingApproval` | `Blocked` | `Done` | `Error`).
    init(_ raw: String?) {
        switch raw {
        case "Idle": self = .idle
        case "Running": self = .running
        case "WaitingApproval": self = .waitingApproval
        case "Blocked": self = .blocked
        case "Done": self = .done
        case "Error": self = .error
        default: self = .unknown
        }
    }
}
