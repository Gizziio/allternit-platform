# Steering checkpoint — session/vnc-readonly-rfb-filter (VNC read-only RFB filter)

**Goal:** Fix confirmed live-smoke defect: the VNC-over-WebSocket proxy's read-only mode (`handle_vnc_socket` `ws_to_tcp` in `cmd/allternit-api/src/computer_ws.rs`) dropped ALL client→TCP binary frames, so a read-only noVNC viewer (embed tokens are always read-only) could never complete the RFB handshake ("RFB 003.889\n" greeting never answered) and the embed viewer showed nothing.

**Just did:** Branched `session/vnc-readonly-rfb-filter` from origin/main. Added `cmd/allternit-api/src/vnc_readonly.rs` with `RfbReadOnlyFilter` (Version → SecurityChoice → AuthResponse → ClientInit → Normal state machine; forwards SetPixelFormat/SetEncodings/FramebufferUpdateRequest/EnableContinuousUpdates + unknown-type single byte; drops KeyEvent/PointerEvent/ClientCutText; partial-message buffering across feeds; unknown security type or non-RFB bytes degrade to Passthrough with `unfilterable` flag). Wired into `ws_to_tcp` (read_only → filter; full-control unchanged passthrough; warns once on unfilterable). Updated stale doc comments. 9 new unit tests pass; all 18 existing `computer_ws` tests pass; `cargo check` shows no new warnings.

**Next:** Commit + push branch, open PR (no merge), report to parent agent.

**Open questions:** Two spec deviations vs the task brief, both toward real-protocol correctness: SetEncodings parsed as 4+4n bytes (RFC 6143: each encoding is a 32-bit value; brief said 4+2n) and EnableContinuousUpdates as 4 bytes (type+enable+u16 pad; brief said 3). Flagged in PR body.
