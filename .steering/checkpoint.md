# Steering checkpoint

**Goal:** P3 ao Fabric node (spec: Allternit Brain/Research/specs/ao-fabric-node.md, spike: Research/drafts/spike-p3-clerk-device-auth.md). Make `ao` a Fabric Transport node: `ao fabric pair|serve|status`. Binding: own 3-leg Ed25519 pairing (NOT Clerk OAuth), node never holds Clerk token; loopback axum shim on 127.0.0.1:8014 translating /v1/remote-control/* + /v1/{session,permission,question} to the engine socket API (session `ao`); line-faithful Rust port of cmd/agent-daemon relay client. Worktree allternit-ao-fabric-node, branch ao/fabric-node.

**Just did:** Server enum PR #220 open (ao/runtime-type-ao-enum). Fabric modules implemented + committed (gate-approved 6a5777398) + keep-alive pooling fix (c9aa10578): live pairing proved create works but the first exchange poll died on a reused dead keep-alive connection — `pool_max_idle_per_host(0)` fixed it; poller now runs the full 10-min window. Build clean, 16/16 fabric unit tests, detect::manifest parallel flakes confirmed as the documented pre-existing class (59/59 serial).

**Next:** BLOCKED on human browser approval — five codes expired unapproved 2026-09-10 (798G-BU8F the latest). Do NOT mint more codes until Eoj signals. Node PR #229 open (implementation + honest blocker status); server PR #220 open. When Eoj is at the keyboard: `ao fabric pair --runtime-type desktop --name ao-dev-mac` → approve at https://ai.allternit.com/pair?code=<CODE> → `ao fabric serve` → shim curl → relay connect → PWA hard gate (ao-hardgate-demo session still alive) → finalize NOTES + ledger attestation + cleanup.

**Open questions:** runtimeType "ao" needs PR #220 deployed; until then pair with --runtime-type desktop (D2 fallback).

---

<!-- merged checkpoint from ao/runtime-type-ao-enum + P3 checkpoint above; session/3a37a822 checkpoint below -->

**Goal:** Fix three Allternit Desktop bot-session UI bugs in `surfaces/ai.allternit.com`: (1) nav trap — no way home from a bot session, "New" bounces back; (2) two competing bot session views — route everything to the Gizzi in-chat view (`ChatView` embedded bot session) and decouple `BotChatSessionView` so it can be deleted later; (3) "local-only (backend unavailable) / Cannot stream before a live session exists: temp-…" on send, despite the bundled allternit-api running on :8013.

**Just did:** Branched `session/vnc-readonly-rfb-filter` from origin/main. Added `cmd/allternit-api/src/vnc_readonly.rs` with `RfbReadOnlyFilter` (Version → SecurityChoice → AuthResponse → ClientInit → Normal state machine; forwards SetPixelFormat/SetEncodings/FramebufferUpdateRequest/EnableContinuousUpdates + unknown-type single byte; drops KeyEvent/PointerEvent/ClientCutText; partial-message buffering across feeds; unknown security type or non-RFB bytes degrade to Passthrough with `unfilterable` flag). Wired into `ws_to_tcp` (read_only → filter; full-control unchanged passthrough; warns once on unfilterable). Updated stale doc comments. 9 new unit tests pass; all 18 existing `computer_ws` tests pass; `cargo check` shows no new warnings.

**Next:** Commit + push branch, open PR (no merge), report to parent agent.

**Open questions:** Two spec deviations vs the task brief, both toward real-protocol correctness: SetEncodings parsed as 4+4n bytes (RFC 6143: each encoding is a 32-bit value; brief said 4+2n) and EnableContinuousUpdates as 4 bytes (type+enable+u16 pad; brief said 3). Flagged in PR body.
# Steering checkpoint — session/vnc-readonly-rfb-filter (VNC read-only RFB filter)

**Goal:** Fix confirmed live-smoke defect: the VNC-over-WebSocket proxy's read-only mode (`handle_vnc_socket` `ws_to_tcp` in `cmd/allternit-api/src/computer_ws.rs`) dropped ALL client→TCP binary frames, so a read-only noVNC viewer (embed tokens are always read-only) could never complete the RFB handshake ("RFB 003.889\n" greeting never answered) and the embed viewer showed nothing.
