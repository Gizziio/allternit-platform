# Merge attestation — desktop-cloud-mvp

**Date:** 2026-09-03
**Branch:** `session/desktop-cloud-mvp` → merged into `main` (`ea89a5fdb`, residue fixed in `4a3fa8a23`)
**Final state:** Merged ✅ (was: 46 commits ahead, 13 unpushed before merge; branch pushed first)

## What was done

The big one. Unified `computers` domain with `/api/v1/computers` API,
`allternit_computer_cloud` crate (fabric providers: Runpod/Vast.ai/private
fabric node, scheduler with cost engine + credit holds, price cache,
os-control-plane client), bot-desktop fleet modules (input, mux, mesh,
snapshots, capacity, queue, billing, admin, quotas, audit, stream, templates,
windows), desktop host admin/provisioner/registry, agent-cloud routes, group
chat sessions (`chat-group-session` view, GroupChatSessionView), bot desktop
lifecycle routes, iOS runtime-type migration, Clerk env config.

## Conflict resolution policy

- Model catalogs (provider_routes, subprocess detector, brain models): kept
  main's newer curated lists (kimi-k3, claude-sonnet-5, gpt-5, Groq work).
- Inference router: kept the newer discovery-first version; the session's old
  full router depended on config types removed from main.
- Remote-control infra (push worker, PWA, service worker, dispatch components):
  kept main's newer hardened versions (JWT auth, Clerk-proxy cache fixes,
  runtimeId-aware notifications).
- Session-start flow: kept desktop-cloud's cowork-agent-session +
  chat-group-session routing (respects main's newest cowork decision; omb's
  bot-chat-session view remains registered and reachable).
- ShellRail: restored the coherent omb-merge version (desktop delta superseded).
- AppState: union of main's passkey_state and session's fabric fields.

## Verification

- `cargo check -p allternit-api -p allternit-cloud-api`: clean.
- `tsc --noEmit` ai.allternit.com + allternit-desktop: clean except errors that
  pre-date this merge (`src/lib/env.ts:88`, DispatchView's
  DispatchOptionsMenu/TimestampSeparator/codePermission — never committed
  anywhere, broken on main before the merge).

## Outstanding work

- Pre-existing breakage to fix on main: env.ts:88 type error; DispatchView
  references uncommitted components (DispatchOptionsMenu, TimestampSeparator)
  and an undeclared codePermission state.
- pnpm-lock.yaml took main's side; run `pnpm install --lockfile-only` if the
  desktop session added workspace deps that surface later.
- AgentHub session starts route to cowork-agent-session (desktop flow); omb's
  bot-chat-session is reachable from the rail. Pick one canonical flow later.
