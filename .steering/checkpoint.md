# Session checkpoint — cloud-computer-orgo-p3 (Phase 3 real-time plane)

Goal: Execute docs/CLOUD_COMPUTER_PHASE_3_TASK.md exactly (spec rq-20260909-004
Phase 3). Design ref: docs/CLOUD_COMPUTER_PHASE_3_DESIGN.md (verified vs main
08ecef8ac). Do NOT start Phase 4. Deliverables: ws tokens + pty ws + events
stream + in-VM proxy + V137 audit/proxy migration + tests + sentinel notes,
commit, push, report branch SHA. Branch: ao/cloud-computer-orgo-p3.

Just did:
- V137 migration: computer_access_logs table (+computer_id index) and
  computer_cloud_desktop + proxy_port/proxy_paths columns.
- driver-interface: guest_service_url(handle, guest_port) default NotSupported.
- Incus impl: reuse existing proxy device for guest_port via get_config scan
  (parse_proxy_port_for_guest), else allocate via expose_port_on on the
  handle's own host; returns http://{vnc_host}:{port}. Mock HTTP tests for
  reuse + allocation paths.
- bot_desktop_stream: DesktopTokenClaims + computer_id/purpose (serde
  default, bot tokens unchanged); sign_computer_token /
  verify_computer_token (+ComputerMismatch/PurposeMismatch); helpers now
  pub(crate); tests incl. legacy-payload back-compat.
- computer_control: ProxyEnable{port}/ProxyDisable variants, descriptors,
  classified Risky (reversible state-changing); tool-surface arms reject.
- computer_audit: fire-and-forget computer_access_logs inserts (+in-memory
  sqlite test).
- computer_ws (new): PTY bridge + events collector embedded python, lazy
  nohup bootstrap with per-computer in-memory bridge tokens (AppState
  computer_guest_tokens, ECONNREFUSED → re-bootstrap once), /ws/computers/:id/pty
  (resize control messages), /ws/computers/:id/events (tail loop + ping +
  last_activity touch), GET history (limit≤500, 501 NotSupported), ws-token
  issue POST (300s, purpose pty|events, audited), proxy enable/disable (ACI
  gated) + GET config + ANY /proxy/{*path} forwarder (10MB cap, hop-by-hop
  filter, 30s reqwest, audit per request). Pure fns + tests.
- Wiring: lib.rs mods + AppState.computer_guest_tokens; main.rs mounts
  /ws/computers + /api/v1 computer_ws router; test_helpers updated.

Next:
1. cargo check -p allternit-api green (running), fix loop.
2. cargo test -p allternit-api computer + computer_audit + computer_ws +
   bot_desktop_stream; cargo test -p allternit-computer-cloud.
3. Evidence → ~/.agent-orchestrator/evidence/cloud-computer-orgo-p3/;
   .allternit/shared-context.md milestone append.
4. Sentinel docs/CLOUD_COMPUTER_PHASE_3_NOTES.md, commit feat(computers),
   push, report SHA.

STATUS (final):
- cargo check -p allternit-api -p allternit-computer-cloud -p allternit-driver-interface: PASS
- cargo test -p allternit-api computer: 41/41 PASS
- cargo test -p allternit-api bot_desktop_stream (tokens): 11/11 PASS
- cargo test -p allternit-api computer_ws: 8/8 PASS; computer_audit: 1/1 PASS
- cargo test -p allternit-computer-cloud: 96/96 + 6/6 PASS (guest_service_url reuse + alloc)
- py_compile both embedded guest scripts: OK
- Fixed en route: 19 literal AppState test constructors needed the new
  computer_guest_tokens field; incus mock tests derive vnc_host from the
  substrate URL (spec behavior); allowlist test documents naive prefix
  semantics; proxy config test seeds the parent computers row (FK).
- Live smoke: deferred (no Incus here); 501/503 paths unit-tested.
- Evidence: ~/.agent-orchestrator/evidence/cloud-computer-orgo-p3/verification.txt
- Next: sentinel notes written; commit feat(computers), push, report SHA.
