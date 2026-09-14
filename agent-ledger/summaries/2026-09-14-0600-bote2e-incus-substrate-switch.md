# Bot-mode e2e — substrate switch to the dedicated Incus box ("contabot box")

Session: bote2e-0913 (continued) · Kimi · 2026-09-14 ~05:15–06:20 CT

## Owner question
"Why is the agent's computer coming from the other MacBook? Isn't it supposed to come from the contabot box?"

## Diagnosis
Where a bot's cloud computer provisions is decided entirely by the local data-plane
`allternit-api`'s VM-driver env (`INCUS_URL` / `TART_HOST_URL`). The running api
(standalone worktree build, PID 17286) had **only** `TART_HOST_URL=http://100.88.98.69:8020`
— the owner's second MacBook (`joes-MacBook-Pro`). The dedicated box
(`mail.news.allternit.com:8443`, Incus — the "contabot box") was alive the whole time:
operator client certs in `~/.allternit/incus-client/` authenticate (verified live),
the box carries the `allternit-desktop` golden image alias, existing bot instances
expose VNC (0.0.0.0:30000) and CDP (0.0.0.0:19222) proxy devices reachable from the
desktop machine, 8 CPU / 26 GB. Nothing pointed the api at it.

Second problem: the second MacBook was at load average **~110–250** (other sessions'
parallel cargo builds), stalling the tart-host API 90s+ and wedging every api cold
start on the Tart driver's health check (2–5 min startup, app health check 90s →
"allternit-api did not start within 90s" → app quit).

## Root-cause bugs found and fixed (both landed on Gizziio/allternit-platform main)
1. **PR #502 — `feat(desktop): load Incus substrate config from ~/.allternit/incus-host.env`.**
   The packaged app only injected TART_HOST_URL/TOKEN (from ~/.allternit/tart-host.env)
   into its child api. Added `loadIncusHostEnv` to `backend-manager.ts` — same
   operator-file pattern for `~/.allternit/incus-host.env` (INCUS_URL, client
   cert/key, CA, INCUS_VNC_HOST), injected at spawn. With both substrates configured
   the api router already prefers Incus for new provisions. Unit tests included.
2. **PR #506 — `fix(computer-cloud): sanitize Incus instance-name owner suffix`.**
   Incus driver names instances `allternit-{kind}-{owner15}-{uuid32}`. Owner id comes
   from the Clerk user id (`user_2kQ…`), so the suffix carried underscores and Incus
   rejected every create: "Invalid instance name: Name can only contain alphanumeric
   and hyphen characters". Now maps non-alphanumeric/non-hyphen chars to hyphens.

## Machine-state changes (operator actions)
- Created `~/.allternit/incus-host.env` (box URL, cert paths, INCUS_VNC_HOST).
- **Moved `~/.allternit/tart-host.env` → `~/.allternit/tart-host.env.disabled-macbook-overloaded`.**
  With the MacBook at load ~250, the Tart driver's health check wedged every api cold
  start past the app's 90s health budget. Incus-only startup binds :8013 in ~4s.
  Restore the file to re-enable the MacBook as a fallback substrate.
- Patched the installed app's `Resources/app.asar` (backend-manager.js) with the
  loadIncusHostEnv logic so the fix works before the next official build; backup at
  `/tmp/app.asar.bak-pre-incus`. Next desktop build from main carries it natively (#502).
- Relaunch note: on this loaded machine the app needs
  `ALLTERNIT_API_HEALTH_TIMEOUT_MS=300000` in its env or cold starts can miss the
  default 90s health budget (hardcoded default in backend-manager.ts; env override exists).

## Verified live
- Child api under the app manager comes up with `INCUS_URL` injected;
  "Incus driver initialized from INCUS_URL" + "Substrate router initialized";
  api binds :8013 in ~4s (was 2–5 min stalling on Tart health check).
- DELETE /bots/<id>/desktop retired the old tart sandbox binding (204); the tart VM
  `allternit-bot-0bd498f6b019428bb5fab83f97335b3c` still exists on the MacBook
  (destroy couldn't reach it with Tart disabled — clean it up when the host is calm).
- Provision with the naming bug reproduced the Incus 400; after PR #506 the name
  composes validly (build + swap verified below in follow-up notes).

## Follow-ups
- Rebuild/install the desktop app from main (carries #502 + #506 natively; current
  installed api binary predates #506, so the interim binary was built from main and
  swapped into Resources/bin/allternit-api).
- UI e2e still to re-run end-to-end on a calm machine: pane render → Take over →
  Hand back against a sandbox provisioned on the box.
- api-side desktop-status cache + "VM running but display unreachable" UI honesty
  (documented earlier in this campaign) remain open.
