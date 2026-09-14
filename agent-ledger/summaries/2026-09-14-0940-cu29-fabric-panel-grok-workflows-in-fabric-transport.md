# Attestation — session/cu29-fabric-panel — Workflows panel on live Fabric Transport

Agent: Grok (handoff from kimi-code session_0a6252e4, which died on the
5-hour quota while landing). Spec: cu28 follow-up; joe 2026-09-14:
remote control is retired, live surface is fabric transport; land it.
PR #514, merge `2527471fb`.

## What shipped

- Workflows (record → teach → batch → verify) section now lives in
  `surfaces/ai.allternit.com/src/views/FabricTransportView.tsx` — the panel
  the shell actually renders for the `remote-control` and `fabric-session`
  view ids.
- Typed client moved to `src/lib/browser-skills-api.ts` (same
  `/v1/browser-skills` gateway routes from cu28). Tests moved with it.
- Legacy `src/remote-control/` tree reverted (cu28 had parked the panel
  there by mistake). Contract doc updated:
  `domains/computer-use/docs/network-trace-surfaces.md`.

## Verification

- Desktop CI: unit tests (vitest) pass; typecheck and build desktop pass;
  gitleaks pass (PR-range squash so the original fake `payloadKeysHash`
  hex never appears); sw-cache bump pass.
- `validate-typography` still red on `CoworkRightRail.tsx` — pre-existing
  on main, same class as PR #513 which merged with it failing. Not this
  diff.
- Vercel rate-limit + Cloudflare Pages git-app checks: ignored (joe:
  vercel is gone; same ignore as cu28/cu29 prior PRs).
- Local console vitest for `FabricTransportView.test.tsx` hung on this
  machine (interval poll + known node_modules cold start). Relied on CI
  Desktop unit tests instead.

## Deferrals

- Desktop DMG / binary rebuild: the desktop already spawns the ACU
  gateway and loads the web console; this panel shows after the standard
  post-merge desktop/web rebuild. No Electron-native workflows window
  (would fork the surface).
- Phone-remote verify UI: still no computer-use view there (cu28 deferral).
