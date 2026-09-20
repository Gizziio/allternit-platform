# Session mlxauto (Kimi Code) — gizzi-code 2.1.0 release (local model servers)

**PRs:** #723 (feature), #724 (version bump), #725 (served-id resolve fix) | **Tag:** gizzi-code/v2.1.0 | **Brew:** gizziio/tap 2.0.8 → 2.1.0

## What shipped
- Auto-managed local model servers (PR #723): spawn/adopt/kill mlx_lm.server
  per local-mlx model via options.modelPath; orphan reconciliation via state
  file; ProcessRegistry reaping; refuses unidentified foreign port owners.
- Fix (PR #725): ink-app local streaming resolved the served model id from
  /v1/models data[0] — mlx_lm.server lists the whole HF cache there, so gizzi
  sent a random cached repo name and the server crashed trying to download it
  (503 "Unable to connect"). Now prefers the absolute-path entry, mirroring
  the runtime loader.
- Release: tap formula at 2.1.0 with verified SHA256s (matched release
  checksums.txt). Installed on this machine and verified (binary contains
  local-model-server code; port 8081 free, no stray mlx processes).

## Incidents
- v2.1.0 tag was pushed once without the resolve fix; run cancelled in
  quality gates, fix merged, tag moved, single rerun — all jobs green.
- Known upstream flake: v2.0.9 publish failed at npm platform-package verify
  (linux-arm64); brew path unaffected (formula consumes GitHub assets).
