---
status: blocked
files_changed:
  - cmd/allternit-api/src/computer_routes.rs
  - cmd/allternit-api/src/bot_desktop_input.rs
  - cmd/allternit-api/src/bot_desktop_templates.rs
  - cmd/allternit-api/src/bot_desktop_routes.rs
  - cmd/allternit-api/src/bot_desktop_queue.rs
  - surfaces/ai.allternit.com/src/lib/computers-api.ts
  - surfaces/ai.allternit.com/src/lib/bots/vm-operator.ts
  - .steering/checkpoint.md
  - .steering/spec.md
  - .steering/test-command
  - .steering/cloud-computer-phase-1-plan.md
  - .allternit/shared-context.md
  - docs/CLOUD_COMPUTER_PHASE_1_NOTES.md
deviations:
  - "Local supports standalone user/org/session owners; bot-local returns 400. Omitted owner_type still defaults to bot, so local callers must specify a standalone owner. Free local creation skips credits."
  - "Explicit resource/resolution requests bypass account-computer reuse so requested spawn settings are honored; legacy requests retain reuse."
  - "Inherited steering test-command unexpectedly ran unrelated Office build scripts. Its four generated manifest changes were restored; the hook now reads Phase 1 evidence only."
remaining:
  - "Restore steering authentication, obtain approval, then commit and push this branch. No commits or pushes were made."
  - "Real VM screenshot, shell, file transfer, restart, stop and delete remain unverified: cloud create returned 429 credits; local create returned 503 unavailable Tart."
  - "Resolution is passed in SpawnSpec env and echoed only at create. Guest application remains unverified. Existing Tart spawn omits guest env and disk from its host create payload; revisit delivery with templates work."
  - "desktop-cloud-api.ts retains bot/native-sandbox APIs. vm-operator legacy provision/status/observe/take-over/hand-back/start/stop/pause/resume/delete/screenshot helpers retain native-sandbox contracts; these do not have established computer IDs."
  - "Phase 2+ resize/clone/auto-stop/workspaces, PTY/events/proxy, templates-as-code and MCP/CLI distribution were not started."
  - "Rails evidence announcements returned 401; evidence is saved locally."
verification:
  - "cargo check -p allternit-api: passed, existing warnings."
  - "cargo test -p allternit-api computer: 20 passed, 0 failed."
  - "cargo test -p allternit-api bot_desktop_input: 8 passed, 0 failed."
  - "npx --no-install tsc --noEmit --incremental false -p surfaces/ai.allternit.com/tsconfig.json: passed using temporary existing-dependency symlinks, subsequently removed. Initial attempt without dependencies could not locate TypeScript."
  - "git diff --check passed; enforce_control_confirmation is byte-identical to HEAD, with no aci_* changes."
  - "Isolated API on 18113: health 200, user create 429, local user create 503. No VM created; API stopped."
  - "Steering rounds 1 and 2: STEER — Failed to authenticate: OAuth session expired and could not be refreshed."
---

Phase 1 implementation is prepared but blocked at the required steering approval gate. Both recovered Rails/Claude review attempts failed authentication, without a code-review verdict. Per the two-round limit, work stops without a commit or push.

The API adds authenticated owner/session resolution, resource allowlists and template overrides, direct standalone provisioning with transactional row persistence, org visibility, row-based controls, restart and snapshots. Local creation forces Tart/free/local. The bot input routes retain their signatures through shared cores; bot lifecycle cleanup and the ACI confirmation function remain in place. New TS wrappers cover controls, raw-byte uploads, blob downloads and snapshots. Existing computer-ID snapshot/restore/shell calls in vm-operator now use them.

Tests cover sizes/resolutions, owner mapping, in-memory SQLite visibility, restart states, drag/scroll, template overrides and no-bot creation reaching the driver gate. The separate legacy input tests also pass. The live attempt reached the credit and substrate gates only. A default-org credit fixture in the isolated smoke database did not change the runtime tenant's 429 result; no external billing action occurred.

Evidence is in `~/.agent-orchestrator/evidence/cloud-computer-orgo-p1/`: check/test logs, curl transcripts, review failures and the inherited-hook manifest diff. Global Rails/ao-consult symlinks point to missing old paths; an existing Rails executable was recovered without building it, but its Claude backend could not authenticate.

The supplied task/map were already untracked on entry and remain untouched. The linked worktree, branch, implementation, plan and build cache are retained for resumption. No main-checkout git operations occurred. No new commit SHA exists; the branch remains based on `393ed63f0`.
