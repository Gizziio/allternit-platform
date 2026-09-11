# Bot mode live e2e (web/PWA) + gizzi 2.0.8 — session/botmode-group-e2e-0910

- **Date:** 2026-09-10 21:26 CDT
- **Agent:** grok (picked up Kimi session `session_6f5d4729` after 5-hour quota death)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/288 · merge commit `3d0459f2fb2284ac47721d5dacc752cc1f979708`
- **Stacked-in:** #272 and #273 (closed as superseded)

## What landed

Finish the live bot-mode prove-it-works sweep on web + PWA, and ship `gizzi bot` in the production binary.

- Virtual catalog ids `allternit/<model>` mapped onto a real local gizzi brain (`kimi-cli/kimi-k3`). Without this, `/api/agent-chat` returned `ProviderModelNotFoundError` after `message_start` and group replies never appeared.
- Group member turns stream on ephemeral sessions (not the 1:1 canonical chat).
- Vite `/api/agent-chat` goes through allternit-api (Clerk proxy issuer `https://allternit.com/__clerk`).
- Mention handles match slugified display names (`Echo Alpha` → `@echo-alpha`).
- Rail group rows expose `data-rail-item=group-<id>`.
- PWA harness emulates `display-mode: standalone` via `matchMedia`.
- Production build aliases `@allternit/gizzi-sdk` → `packages/sdk` so the compiled darwin binary includes `gizzi bot`. Version **2.0.8**.

## Verification

| Surface | Result | Evidence |
|---|---|---|
| Web `bot-e2e-live.cjs` | ✅ PASS | Hub + 1:1 + group (both bots) + rail. `/tmp/bot-e2e-live-result.png` |
| PWA `bot-e2e-pwa.cjs` | ✅ PASS | standalone + 1:1 |
| Worktree CLI `gizzi bot` | ✅ PASS | create/chat (`BOTMODE-OK`)/delete with `--model kimi-cli/kimi-k3` |
| Packaged gizzi 2.0.8 (local) | ✅ PASS | Homebrew cellar + Desktop sidecar; `gizzi bot --help` |
| Release preflight | ✅ 35/0 | `node scripts/release-preflight.mjs` |
| Desktop-UI e2e | ⏳ after rebuild | Harness needs a dedicated app launch |
| `gizzi-code/v2.0.8` GitHub release / tap | ⏳ after this attestation | Tag + workflow + homebrew-tap sha256s |

Unit: runtime-model, bot-runtime-env, mention-handoff, startBotGroupChat.

CI on #288: Gizzi Code Quality + Desktop CI green. Vercel fail is account rate-limit (not this PR). Cloudflare Pages was still pending at merge.

## Incidents

- Kimi session died on 5-hour quota mid-group-e2e. Grok resumed from the clerk worktree.
- Group SSE diagnosis: `allternit/kimi-k3` is not a gizzi provider. Local default is `kimi-cli/kimi-k3`.
- Production `bun install` inside `cmd/gizzi-code` cannot see pnpm workspace packages; build-production.js now aliases gizzi-sdk and stubs optional OTel exporters.

## Honest deferrals (at attestation time)

- Desktop-UI e2e and full electron-builder rebuild: next steps in the same landing (AGENTS.md steps 8–9).
- Official `brew upgrade gizzi-code` still 2.0.7 until the GitHub release + tap bump.
- Running Allternit Desktop process may still hold the old gizzi inode until restart.
- Homebrew / packaged 2.0.7 did not include `gizzi bot`; 2.0.8 does (local install already replaced).
