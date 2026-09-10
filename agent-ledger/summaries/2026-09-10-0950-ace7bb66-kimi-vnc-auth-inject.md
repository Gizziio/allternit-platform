# Session attestation — session/ace7bb66 (kimi) — VNC data plane for cloud computers

Date: 2026-09-10 ~09:50 UTC. Spec: rq-20260909-004 (`Research/specs/cloud-computer-orgo-parity.md`), registered deferrals.
Continuation of session `2026-09-10-0207-live-smokes-rq-20260909-004` (PRs #225–#235); builds directly on the golden-snapshot work (#240/#241).

## What was done

### Deferral #2 (VNC data plane) — RESOLVED, merged as PR #242 → 292a556f4

**Branch `session/vnc-auth-inject`** (commits 9d9b2f3c4, 0eb0d182a):

1. **NEW `cmd/allternit-api/src/vnc_auth.rs`** — `VncAuthInterceptor`: RFB 3.3/3.8
   handshake rewriter for the authenticated ws VNC proxy. The guest's
   password (VNC auth type 2, DES challenge-response) is completed INSIDE the
   proxy using `endpoint.token` (`BOT_DESKTOP_VNC_PASSWORD`, default
   `allternit`); viewers are offered None-auth and never see the password.
   DES via `des` + `cipher` crates; test vector cross-checked against OpenSSL
   `vncpasswd`. Tart desktops (`token=None`) get a fully transparent pipe.
2. **`cmd/allternit-api/src/computer_ws.rs`** — `VncCodec` puts the
   interceptor and the existing read-only filter in ONE mutex. CRITICAL: the
   read-only filter must also see proxy-INJECTED bytes or its client-message
   state machine desyncs and swallows real client messages (this killed
   ClientInit before the fix). Regression test:
   `chained_with_readonly_filter_clientinit_survives`.

**Verification:** 7/7 vnc_auth, 18/18 computer_ws, 9/9 vnc_readonly unit
tests. Live end-to-end against an Incus clone on the VPS
(`computer-aa078ac7bfb44d949046903465fef618`, x11vnc `-passwd allternit`):
greeting → None-auth offer rewritten by the interceptor → SecurityResult 0
(injected DES accepted) → ServerInit 1280x720 → **FramebufferUpdate with real
pixels** → KeyEvent swallowed by the read-only filter, connection healthy.
tcpdump on the VPS confirmed the injected `02` + 16-byte DES response on the
wire. Same framebuffer delivery proven through (a) raw TCP to the incus proxy
device port 45.84.138.187:30006 and (b) an SSH tunnel bypassing the incus
proxy entirely.

**The investigation's twist (root cause of the apparent "x11vnc is broken"
block):** the smoke harness sent FramebufferUpdateRequest with message type
**0** (SetPixelFormat). Client→server RFB types are 0=SetPixelFormat,
2=SetEncodings, 3=FramebufferUpdateRequest. Type 0 + 9 trailing bytes made
x11vnc block in a 19-byte read forever (strace smoking gun: `read(10,"\0",1)=1`,
`read(10,...,19)=9`, EAGAIN; padded-to-20B variant logged "SetPixelFormat: 2").
With the correct type 3, x11vnc 0.9.16 in the golden image answers in ~1s at
every layer. **No guest image change needed; the substrate and proxy are both
exonerated.**

### Deferral #1 context (golden build / fast boot) — verified earlier in session
#240 (golden snapshot stateless) and #241 (clone-from-golden, 2:01 min incus
fast boot) were already merged; the clone used as the live target above.

### VPS substrate work
- Incus server TLS cert reissued on the VPS (backups
  `/root/incus-server.{crt,key}.bak-20260910`); client certs at
  `~/.allternit/incus-client/`; smoke API on :18013 ran the Incus(VPS)+Tart(local)
  router with `ALLTERNIT_SELF_HOSTED=1` + local-dev bypass.

## Incidents / gotchas worth keeping
- Running-binary staleness: verify `lsof -p <pid> | grep txt` size against the
  rebuilt binary before believing symptoms (cost ~1h earlier in session).
- tcpdump on the VPS: `tcpdump -i any 'tcp port 30006 and tcp[13] & 8 != 0'`;
  `lo` does not carry the proxy→guest leg.
- x11vnc scrubs `-passwd` from argv in `ps`; check
  `/opt/allternit-desktop/run.sh` in the guest.
- A leftover `qemu-system-x86` was squatting on guest :5900 (backlog 1) plus 9
  stray x11vnc processes from earlier experiments — killed; clean x11vnc
  started manually for the smokes.

## Honest deferrals (not done, with reasons)
1. **Proxy leaks the server-side TCP connection to the guest VNC port on ws
   close** (lingering ESTABLISHED to :30006 observed). Cosmetic resource
   leak; separate fix.
2. **Desktop bundle rebuild (ritual step 8) DEFERRED**: this PR changes
   `allternit-api`, which the desktop bundles, but the change is additive
   (new module + codec wiring) with no schema/DB change; the installed
   Allternit-Desktop-fresh.app (b1750) keeps working, and the wizard-e2e
   harness using it was not to be disturbed. Rebuild before the next desktop
   preview cut so the bundled API carries the VNC auth injection.
3. **Tart-only deferrals stand**: Tart snapshot unsupported (golden needs
   Incus — now proven working); Tart guest-VNC forward absent in tart-host
   (#231 fail-closed stands).
4. Smoke API process (:18013), tart-host (:8020), SSH tunnels, and the two
   session-created Incus containers on the VPS were cleaned up at session end.

## Evidence
`~/.agent-orchestrator/evidence/cloud-computer-orgo-smokes/STATUS-vnc-dataplane-2026-09-10.md`
(updated with resolution), smoke scripts `/tmp/rfb_smoke.py` (corrected FUR
type), `/tmp/rfb_direct.py`, guest `/tmp/x11vnc.log` + `/tmp/strace.log`
(strace capture of the misparse).
