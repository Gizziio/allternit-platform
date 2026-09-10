# Session attestation — session/ace7bb66 (kimi) — rq-20260909-004 Phases 4+5 swarm + deferral fixes

Date: 2026-09-10 ~14:50 UTC. Spec: rq-20260909-004 (`Research/specs/cloud-computer-orgo-parity.md`). Direct continuation of `2026-09-10-0950-ace7bb66-kimi-vnc-auth-inject.md` (PR #242).

Method: 4 parallel coder subagents in own linked worktrees (phases 4, 5a, 5b+5c, 5d) + parent-handled deferral fixes. Parent reviewed, merged serially, attests once here.

## Merged (all merge commits, order: #243, #245, #248, #246, #251)

- **PR #243 (parent)** — `fix(api)`: ws VNC/PTY proxies leaked the server-side upstream TCP socket: `tokio::select!` returned when the first forwarder finished but the surviving spawned tasks were never aborted; a task parked on the TCP read half held the split stream open as a lingering ESTABLISHED conn. Now JoinHandles are selected by `&mut` and survivors `abort()`ed in both proxies. 18/18 computer_ws tests.
- **PR #245 (agent)** — Phase 5b+5c: `sdk/computers` TS+Python twins closed to full route parity (`updateComputer`/`sessionEnd`/`getTemplate`, `session` owner_type), `computers-api.ts` exports aligned, CLI gained `drive screenshot` alias, one-shot input flags (`--click/--double-click/--right-click`, `--type`, `--key`, `--approval-id`), global `--api` alias. Finding: most of Phase 5 CLI/SDK had pre-landed on main. 33/33 TS, 23/23 Python, 40/40 CLI tests; live smoke create→shell→download→restart→stop→delete on real Tart.
- **PR #248 (agent)** — Phase 5a: computers MCP server completed — 41 vitest tool-mapping tests for all 22 tools (mock-fetch recorder), `executeToolCall` extracted for testability, fixed pre-existing `pnpm build` redness (BlobPart/@types/node). **Live-smoke-found real bug, fixed in-route**: `create_standalone_desktop` returned a freshly generated throwaway id in the 201 response while the row persisted under `spawn_desktop_for_owner`'s id — get/start/stop/delete by returned id all 404'd. Now returns `spawned.computer_id`. Live stdio smoke: initialize → create (real Tart VM) → get → stop → start → delete. cargo 64/64.
- **PR #246 (agent)** — Phase 5d: `surfaces/computer-embed/` standalone package (plain npm, pnpm-excluded like mailflare): framework-free RFB-over-WS client matching the frozen proxy wire exactly (None-auth; raw+copyrect+desktop-size decode; client sends only types {0,2,3} — read-only by construction), `<allternit-computer>` web component with host allowlist, iframe-able page, committed dist/ for zero-build static serving, Register-1 README with token hygiene. 13/13 vitest (incl. fragmented-delivery parse and never-sends-input proof). Honest deferrals: no live smoke vs running API (mock-verified on documented wire); hextile/tight omitted (advertise-only-what-you-decode).
- **PR #251 (agent, parent amended)** — Phase 4: in-repo curated `templates/system/{base-desktop,node-dev}.yaml` catalog (include_str!, idempotent startup sync, `catalog_ref` on create); format additions `installScripts` + `hooks.preBuild` (additive, still `allternit.ai/v1`); Tier C gate rejecting PEM material in env/scripts/hooks; idempotent import (`unchanged` flag preserves ready-golden state). **Two live defects fixed that meant golden provisioning NEVER worked**: (1) `find_golden_holder` passed `None` into `select_provision_source` → always `Image` → computers silently booted stock image despite a ready golden; (2) Incus 6.0 rejects `source.type:"snapshot"` — correct clone body is `source:{type:"copy",source:"<holder>/<snap>"}` (verified vs Incus 6.0 source + raw API probes). Live smoke on VPS Incus: template (3 apt pkgs + service + all hook types) → import → idempotent re-import → ACI-gated build ready ~2min → clone running immediately → ground truth via incus exec: packages + service active. cargo 822 pass / 4 pre-existing env fails (identical on main); template-scoped 29/29; computer-cloud 102/102. Parent amended the single commit to add a `gitleaks:allow` pragma on the deliberately-fake PEM test fixture (gitleaks private-key rule tripped; fixture is truncated non-key material).

## CI note
Vercel project checks are red across all these PRs for infra reasons (deployment rate-limited — retry in 24h); unrelated to the diffs. gitleaks green after the pragma amend.

## Cleanup
VPS final state verified by agent-9: exactly the 8 pre-existing containers; golden image `allternit-desktop` (86552d91ffc0) preserved. Smoke APIs/sidecars stopped by agents. Session worktrees + branches removed (see git worktree list).

## Honest deferrals carried forward
1. **Desktop bundle rebuild** before next desktop preview cut (now carries #242 + #243) — additive API changes, installed b1750 app unaffected.
2. **Tart snapshots unsupported** (golden = Incus, now proven working end-to-end via #251); **Tart guest-VNC forward absent** — #231 fail-closed stands; needs a tart-host forward PR when the local-kind VNC story becomes a priority.
3. Embed widget live smoke against a running API before publicizing (mock-verified on the documented wire).
4. Phase 3 remainder note: PTY/event-stream/in-VM-proxy routes exist in `computer_ws.rs` (merged earlier); audio stream is spec-optional stretch.
5. Steering observation for a later sweep: the un-aborted-forwarder pattern may exist in other proxies in the repo.

Ledger entries merged earlier today cover #242; this entry covers #243–#251.
