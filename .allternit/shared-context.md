
2026-09-09 cloud-computer-orgo-p2: Scoped Phase 2 from verified task/design in dedicated ao/cloud-computer-orgo-p2 worktree. Includes substrate-router forwarding; no Phase 3 or merge. Required checks explicitly authorized by task.

2026-09-09 cloud-computer-orgo-p2 implementation milestone: Added resize/clone contracts and Incus/router implementations, idle/group migrations and APIs, activity writes/sweeper, typed client. Tests cover resize/status/idle boundaries, clone rows, scoped groups/moves/FK deletion, idle SQL/human skip. First verification found and fixed sweeper startup ordering; focused TS uses existing desktop ambient declarations. No Phase 3.

2026-09-09 cloud-computer-orgo-p2 verification finding: supplied design's V133/V134-free assertion is false on this branch. HEAD already contains V133__llm_provider_routing_policies.sql and V134__user_route_credentials.sql. Initial required API tests failed refinery UNIQUE(version). New Phase 2 migrations moved to V135/V136; original migrations untouched. This necessary compatibility deviation will be recorded in NOTES.

2026-09-09 cloud-computer-orgo-p2 verification milestone: cargo check passed; required API computer tests 28/28; Computer Cloud 100/100; focused tsc passed. ACI gate and bot-facing start/stop unchanged. Live smoke deferred: no Phase 2 API or Incus config; existing Tart host health alone is not lifecycle evidence. Preparing NOTES and gated commit/push; no Phase 3 or merge.
