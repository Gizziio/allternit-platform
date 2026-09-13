# Session attestation — session/botchatrestyle-0912 (bot bubble restyle) + session/botimage-0912 (macOS provision image)

- **Date:** 2026-09-12 (late night)
- **Agent family:** kimi-code
- **PRs:** #448 (bubble restyle, merge in main) · #452 (image fix, merge `d31dfa65f`, tip `47677bc7b`)
- **Topic:** owner feedback after the bot-mode e2e night — "I don't like the way
  the box text looks in the UI", plus the provisioning default that blocked the
  computer-handoff e2e.

## botchatrestyle-0912 (#448)

Bot replies rendered as a solid accent-fill slab (`bg-[var(--accent-primary)]
text-white`) — in the light shell a heavy brown box. Settled + streaming bot
bubbles now use the neutral surface family (`surface-panel` + `border-subtle` +
primary text), left-aligned with the rounded-bl tail; error streaming keeps
orange text on the neutral panel. The with-artifacts variant already looked
like this — now consistent.

Verified: tsc clean; vitest src/components/bot-chat 56/56.

## botimage-0912 (#452)

Live-diagnosed during the handoff e2e: provisioning a bot computer failed with
503 "the specified VM tart-ubuntu-test does not exist" — the macOS default
`BOT_DESKTOP_IMAGE` named a dev-only VM. The tart host (100.88.98.69:8020)
carries `allternit-desktop` (plus ubuntu base images). Default changed to
`allternit-desktop` (matches the linux path); env override still wins.

Verified: cargo check -p allternit-api clean; bot_desktop_templates suites 21/21.

## Honest e2e deferrals (from the same night)

- **Computer handoff:** provision now resolves the image, but the full
  Observe → Take Over → Hand Back cycle was not completed live — the desktop
  instance wedged twice (30s API-start timeout on cold boot; `open -a` env
  forwarding broke Electron's platform-static detection; a stale pid-376
  instance complicated restarts). Owner then asked for a full clean rebuild
  from main; the handoff cycle should be re-run on that build.
- **Inline artifact render:** the parser/renderer is unit-tested
  (settled-bubble-artifacts.test.tsx) and present in the bundle; a live render
  could not be forced because the model routes document requests to file tools
  instead of emitting `<document>` markup in its reply.
- Environment notes: launching the installed app with TART/BOT_DESKTOP env
  requires direct binary spawn (`open -a` env forwarding breaks packaged
  resource resolution); `/api/status` is 501 in current builds — use `/health`.
