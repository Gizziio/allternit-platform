# Steering Checkpoint — rq-20260909-004 deferral closure (VNC data plane)

## Goal
Close the two registered substrate deferrals from the cloud-computer live
smokes using the VPS (45.84.138.187, Incus): (1) golden snapshot build +
fast-boot clone — DONE earlier (#240 wait-loop, #241 stateless snapshot,
template ready, clone 201). (2) VNC data plane through the authenticated ws
proxy — IN PROGRESS.

## Just did
- Diagnosed the VNC stall: guest x11vnc runs `-passwd allternit` (driver-shared
  password, `BOT_DESKTOP_VNC_PASSWORD`), so the server offers ONLY RFB security
  type 2 (VNC password auth). The ws proxy was a blind pipe and never used
  `endpoint.token` → anonymous embed viewers could never complete a handshake.
- Restarted guest x11vnc cleanly on the clone sandbox
  (allternit-user-local-dev-user-0c7d417c…, host port 30006 → guest 5900,
  reachable from the Mac; ufw inactive).
- Implemented `cmd/allternit-api/src/vnc_auth.rs`: `VncAuthInterceptor` —
  RFB 3.3/3.8 handshake state machine that rewrites the server's security
  offer to None-auth for the viewer, chooses type 2 upstream, answers the
  16-byte DES challenge server-side (bit-reversed-password DES-ECB, `des` +
  `cipher` crates), then goes transparent. Wired into `handle_vnc_socket`
  (both forwarders; tcp_write half shared via tokio Mutex so injected bytes
  flush immediately — queueing them on the next client message deadlocks the
  handshake).
- Unit tests: OpenSSL cross-checked DES vector, 3.8 injection, 3.3 injection,
  passthrough-when-None, key derivation. 6/6 pass; computer_ws 18/18,
  vnc_readonly 9/9 unaffected.

## Next
1. Release build → restart smoke API → live RFB handshake through
   `/ws/computers/:id/vnc` with an embed token: expect None-auth offered,
   SecurityResult 0, ServerInit, real FramebufferUpdate, read-only KeyEvent
   swallowed.
2. PR + merge, ledger attestation, brain draft (no confirm), cleanup
   (worktree, branches, VPS containers I created, smoke API).

## Open questions
- Tart desktops set endpoint.token=None → transparent pipe (unchanged). If
  Tart guests ever gain a VNC password, injection kicks in automatically.
- Non-read-only KeyEvent guest-side effect is not verified (proxy-level
  passthrough only) — same limitation as earlier smokes.
