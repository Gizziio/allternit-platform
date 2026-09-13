# Session attestation — session/bote2e-0913 (bot desktop action URL 405 fix)

- **Session:** `session/bote2e-0913`
- **PR:** #475 (merge `363b53488`, commit `f3ca76226`)
- **Date:** 2026-09-13
- **Agent:** kimi-code (interactive, owner-driven)

## What was done

Second fix from the live bot computer handoff-cycle run on the installed
desktop (b2517, built from PR #470's merge earlier today).

**Live repro:** Bot Hub → Gizzi → Chat → Computer → "Provision computer"
(worked — Tart spawned `allternit-desktop` from `http://100.88.98.69:8020`
via the #455 auto-config; #452's image default held) → "Start" →
`Platform returned 405`.

**Root cause:** `botDesktopUrl()` in
`surfaces/ai.allternit.com/src/lib/bots/vm-operator.ts` returns
`{API}/bots/:id/desktop?sandbox_id=…` and every action call appended its
segment after the query string
(`botDesktopUrl(botId, sandboxId) + '/start'`), producing
`POST /bots/:id/desktop?sandbox_id=X/start`. Axum routes that to
`/bots/:bot_id/desktop`, which is registered GET/DELETE only → 405. All
eight actions had the bug: `start`, `stop`, `pause`, `resume`, `observe`,
`take-over`, `hand-back`, `screenshot`. The API routes are
`/bots/:bot_id/desktop/{action}` with `?sandbox_id=` as a query param
(`cmd/allternit-api/src/bot_desktop_routes.rs:108-116`). This is why the
Observe → Take Over → Hand Back cycle could never complete from the UI.

**Fix:** `botDesktopUrl(botId, sandboxId, action?)` puts the action in
the path before the query string; all 8 call sites updated. Status GET
and DELETE keep the bare path.

## Verification evidence

- New `src/lib/bots/__tests__/vm-operator-url.test.ts` — 6/6: path,
  `sandbox_id` query value, and method asserted for observe / take-over /
  hand-back / start / stop plus the bare status GET.
- `pnpm typecheck` (ai.allternit.com): green.
- Live verification of the full handoff cycle with the fixed bundle was
  still in progress at attestation time; outcome is recorded in the
  session summary / checkpoint (this fix unblocked Start/Observe/Take
  Over/Hand Back — each had been 405ing).

## Incidents / notes

- Sub-PR of the same live e2e pass that produced #470 (bot-chat
  jump-to-latest, user bubble visibility, `[]` tool summaries). The
  desktop app binary installed at the time of this fix was b2517
  (built from #470's merge); this renderer-only change was repacked
  into the installed app right after merge to continue the cycle.
