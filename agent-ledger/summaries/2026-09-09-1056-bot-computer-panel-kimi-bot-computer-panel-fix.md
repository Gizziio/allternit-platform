# Attestation — session/bot-computer-panel (kimi-code, 2026-09-09)

## What was done
Owner-reported bug: the bot computer right-side panel in the Allternit desktop app
(1) entered the screen on startup, (2) had wrong polish/spacing with a hard-coded
tan in it, (3) was basically blank — the computer never landed, and (4) should be
bots-only, opened via the icon in the bot chat top-right.

Root causes (all in `surfaces/ai.allternit.com`):
- `browserAgent.store.ts` persisted `connectedBotId` (zustand persist, key
  `allternit.browser.agent-sessions`) and defaulted `aciSidecarExpanded: true`.
  The globally-mounted `ACIComputerUseSidecar` (`ShellOverlayLayer`) treats
  `Boolean(connectedBot)` as active, so the restored bot id re-opened the panel
  on every launch — and when the bot had no VM (or was deleted) it rendered the
  ACI branch: tan `rgba(212,176,140,…)` CONNECTING spinner → "NO SIGNAL" → blank.
- `BotChatSessionView.tsx` force-opened its chat-side computer pane whenever
  `computerLive` flipped true.
- `BotComputerViewport` compact layouts (`pane`/`aci`) had no provision/start
  affordance: "No virtual computer yet." was dead text and off/stopped rendered
  a bare black box.

Changes (PR #213 → merge 86f60d076):
- Store: `aciSidecarExpanded` defaults false; `connectedBotId` removed from
  `partialize`; persist `version: 1` + `migrate` strips stale stored
  `connectedBotId` once.
- `BotChatSessionView`: auto-open effect deleted (pane opens only via the
  top-right "Computer" toggle); connects `connectedBotId` only when the bot has
  a VM capability (`vmOperator.enabled || activeVM`) and clears it on unmount.
- `ACIComputerUseSidecar`: `botComputerActive` gated on
  `connectedBot && (vmOperator.enabled || botVm)`; bot-mode header is now
  BotAvatar + bot name + running dot + close button; ACI mono chrome, ACI
  toggles, and `ACIEngineBar` hidden in bot mode; tan `rgba(212,176,140,…)`
  replaced with `var(--accent-primary)` / `var(--text-tertiary)` /
  `var(--status-error)` tokens in the sidecar screen states.
- `BotComputerViewport` compact mode: "Provision computer" CTA when no sandbox,
  provisioning spinner state, and Start/Resume actions when off/stopped.

Plan file: `docs/plans/plan-bot-computer-panel-fix.md` (merged with PR).

## Verification
- `pnpm run typecheck` in `surfaces/ai.allternit.com` — clean.
- `vitest run src/views/bots src/capsules/browser` — 19/19 passed.
- `vite build` — green (10.9s).
- Live desktop-app smoke (launch → no panel; bot chat → toggle → provision →
  desktop lands) DEFERRED to owner: requires the packaged app + a provisionable
  bot against the live API.

## Incidents / notes
- `pnpm install` in the fresh worktree dirtied `pnpm-lock.yaml` (a
  `src/generated/prisma` importer line vanished because the generated dir does
  not exist in a clean checkout); reverted, not part of the change.
- PR merge conflict on `.steering/checkpoint.md` with the concurrent
  `session/office-agent-ui` attestation — resolved with `checkout --ours` per
  repo convention.
- ACI (non-bot) computer-use sidecar still auto-opens while an ACI task runs —
  deliberate, out of scope. Desktop release path untouched (no
  `release-preflight.mjs` run needed per the release-lock path list).
