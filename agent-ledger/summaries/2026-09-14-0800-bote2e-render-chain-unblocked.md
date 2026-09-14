# Bot-mode render chain — unblocked end-to-end (session bote2e-0913, contd.)

2026-09-14 ~05:15–08:00 CT · Kimi · companion to `2026-09-14-0600-bote2e-incus-substrate-switch.md`

## The question that started this stretch
"Why is the agent's computer coming from the other MacBook? Isn't it supposed to come from
the contabot box?" — and later: "when are we going to show the computer actually rendering?
it hasn't worked at all."

## Root causes found (each was a real, separate bug)

1. **Wrong substrate (config).** The api only had `TART_HOST_URL` (second MacBook, load
   ~110–250 from parallel cargo builds, wedging every cold start). The dedicated Incus box
   (`mail.news.allternit.com:8443`, the "contabot box") was healthy but never wired in.
   → **PR #502** `loadIncusHostEnv` reads `~/.allternit/incus-host.env` into the child api
   (same operator-file pattern as `tart-host.env`). Router prefers Incus when configured.
2. **Incus instance-name 400.** Driver names instances `allternit-{kind}-{owner15}-{uuid32}`;
   owner id comes from the Clerk user id (`user_2kQ…`), the suffix carried underscores, Incus
   rejected every create.
   → **PR #506** sanitize the suffix (non-alnum/non-hyphen → hyphen).
3. **The actual "computer never renders" wall — VNC auth.** Guest x11vnc offers ONLY VNC
   password auth (type 2, password `allternit`); browser viewers behind the authenticated
   ws proxy can never answer the DES challenge, so every RFB handshake stalled after the
   greeting — on BOTH substrates, from the beginning. (`let _vnc_token = endpoint.token;`
   in the ws proxy — the intended wiring was never built.)
   → **PR #510** runs the RFB handshake inline through the existing `VncAuthInterceptor`
   (offer None to the viewer, answer the DES challenge server-side, then transparent pipe),
   **PR #511** fast-follow: handshake bytes must go directly to the split ws sink — the
   channel's draining forwarder only spawns after the handshake (deadlock, 15s deadline).
4. **Unsigned ws tokens on plain launches.** `ALLTERNIT_DESKTOP_WS_SECRET` only reached the
   child api when the launcher happened to have it in its environment — a plain Dock launch
   had none → unsigned ws_url → `/ws/*` auth 401 → noVNC never connected.
   → **PR #513** BackendManager generates a per-boot secret by default (env export wins).

## Verified end-to-end (live, this machine, box sandbox
`allternit-user-user-3J98Yz8K5m-ac28f11b5a9d4290b5beee5bec65b0a4` on the Incus box)

- Provision: 200, `provider: "incus"`, `status: "running"`, `ws_url` signed.
- Api screenshot endpoint: full 1280×720 XFCE desktop PNG (panel, icons, clock — the guest
  renders).
- External no-password RFB client through the api ws proxy: offered None (rewritten),
  handshake completes, **full 1280×720 raw framebuffer (3.6 MB) streamed and decoded to a
  PNG of the live desktop** — `/tmp/rfb.png` on the operator machine.
- UI state machine in the pane: `Provision computer` → `Running / Bot is driving` →
  `Observe` → `Observing — bot is still running` → `Take over` → `You are driving` →
  `Hand back` → `Bot is driving`. Control states confirmed via api (`bot_controls` /
  `human_controls` / `human_observing`).
- Owner-observed: pixels now show in the pane ("almost see the screen") — remaining
  blank-out/glitching is the noVNC perf defect (below), separate session, fix in flight.

## In flight / deferred (other sessions, honestly)

- **noVNC perf (separate session, PR pending):** live VNC decode at full res in the renderer
  (~475% CPU, 30% GC from framebuffer realloc; watch strip decoding 1080p into a 140×88
  thumb; ACI sidecar polling while minimized) → machine load 123 → Fabric terminal relay
  starves → "terminal glitching when you open the bot's computer". Fix: pause streams when
  hidden, throttle watch strip to screenshot poll, kill resizeSession churn.
- **Owner request: pop the computer view into a separate full Electron window** (not the
  half-width ACI pane). Not started here — queue after the perf PR lands to avoid
  overlapping the same desktop UI surfaces.

## Operator state on the machine (persistent facts)

- `~/.allternit/incus-host.env` — box URL + client certs + `INCUS_VNC_HOST`; read by the
  app per PR #502 (patched into the installed asar until the next desktop build).
- `~/.allternit/tart-host.env` → renamed `.disabled-macbook-overloaded` — restores the
  MacBook as fallback substrate; also removes the 2–5 min Tart-health-check startup wedge.
- App cold start on this loaded machine can exceed the default 90s health budget; env
  override `ALLTERNIT_API_HEALTH_TIMEOUT_MS=300000` exists for that.
- `ALLTERNIT_DESKTOP_WS_SECRET` now self-generated per boot (PR #513) — no launch env needed.
- Stale tart sandbox `allternit-bot-0bd4…` still exists on the second MacBook (host
  unreachable while disabled) — destroy when the host is calm.

## Session PRs (all merged, Gizziio/allternit-platform): #502 #506 #510 #511 #513
