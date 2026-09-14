# Steering checkpoint — session/cloudcont-0914

## Goal
Cloud continuation (Cowork E6): work keeps going after the laptop worker
dies. Jobs that opt in require `compute.cloud` and are claimable only by
the always-on `gizzi-cloud` principal — not the laptop `gizzi` worker.

## Just did
Session worktree from origin/main. Designing: store-level handoff
(release local lease, drop `compute.local`, add `compute.cloud`),
preference + Al/routine compute policy, desktop quit handoff, ingest
for a remote always-on API.

## Next
Implement store + tests, API, prefs, worker mode, desktop quit, UI, docs.

## Open questions
- Local granted folders cannot follow the job into the cloud (no upload
  in v0). Cloud worker uses its host workspace.
- Laptop-closed schedules still need an always-on API (paired VPS /
  provisioned data-plane, or ALLTERNIT_CONTINUATION_API_URL ingest).
