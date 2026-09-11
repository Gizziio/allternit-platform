
2026-09-09 cloud-computer-orgo-p2: Scoped Phase 2 from verified task/design in dedicated ao/cloud-computer-orgo-p2 worktree. Includes substrate-router forwarding; no Phase 3 or merge. Required checks explicitly authorized by task.

2026-09-09 cloud-computer-orgo-p2 implementation milestone: Added resize/clone contracts and Incus/router implementations, idle/group migrations and APIs, activity writes/sweeper, typed client. Tests cover resize/status/idle boundaries, clone rows, scoped groups/moves/FK deletion, idle SQL/human skip. First verification found and fixed sweeper startup ordering; focused TS uses existing desktop ambient declarations. No Phase 3.

2026-09-09 cloud-computer-orgo-p2 verification finding: supplied design's V133/V134-free assertion is false on this branch. HEAD already contains V133__llm_provider_routing_policies.sql and V134__user_route_credentials.sql. Initial required API tests failed refinery UNIQUE(version). New Phase 2 migrations moved to V135/V136; original migrations untouched. This necessary compatibility deviation will be recorded in NOTES.

2026-09-09 cloud-computer-orgo-p2 verification milestone: cargo check passed; required API computer tests 28/28; Computer Cloud 100/100; focused tsc passed. ACI gate and bot-facing start/stop unchanged. Live smoke deferred: no Phase 2 API or Incus config; existing Tart host health alone is not lifecycle evidence. Preparing NOTES and gated commit/push; no Phase 3 or merge.

2026-09-09 cloud-computer-orgo-p3 implementation milestone: Phase 3 real-time plane implemented on branch ao/cloud-computer-orgo-p3 (base 08ecef8ac). Computer-scoped ws tokens (computer_id+purpose claims, bot validation unchanged), driver guest_service_url with Incus proxy-device reuse/allocation, embedded python PTY bridge + events collector with lazy nohup bootstrap and in-memory bridge tokens, /ws/computers/:id/pty + /ws/computers/:id/events (live tail loop + ping + last_activity touch), events history GET (limit<=500, 501 NotSupported), ACI-gated proxy enable/disable + GET config + ANY /proxy/{*path} forwarder (10MB cap, hop-by-hop header filter, 30s reqwest, per-request audit), V137 computer_access_logs + proxy columns, computer_audit module. No new deps. No Phase 4.

### ba-0b-commrails 2026-09-10T00:00:00Z
BA-0b done: rails/ renamed to commrails/ (package allternit-commrails, bins allternit-commrails/-service/commrails; old names are one-release shims). HTTP /api/commrails added with /api/rails alias; env reads ALLTERNIT_COMMRAILS_* first; compat crate keeps allternit-agent-system-rails linking. cargo test -p allternit-commrails 5/5 + doc-test pass. NOTES: docs/BA_0B_COMMRAILS_NOTES.md.

### ba-1-commrails-rail 2026-09-10T19:20:00Z
BA-1 live rail: seed bots dropped; GET /api/commrails/visibility (+ /api/rails alias) from PeerRegistry; Sessions + Needs you RecentsPanels in ShellRail. NOTES: docs/BA_1_COMMRAILS_RAIL_NOTES.md.
