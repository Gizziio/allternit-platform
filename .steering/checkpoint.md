# Session checkpoint — phoneremote-0910

## Goal
Fabric Desktop: PWA at fabrictransport.allternit.com, Termius-shaped machine list, live desktop of any paired runtime. Capture stays on the node.

## Just did
- v0 tailnet PWA accepted (view + type from physical iPhone).
- Desktop drive in Fabric Session + Remote Control dashboard.
- Linux/VPS path: Xvfb+XFCE installer, x11 grab, xdotool input.
- Deployed fabric-session PWA to allternit-remote-control (HTTPS).
- Merged main (bot-mode UI PR #285, SW was v22 → this branch v23).

## Next
- Redeploy PWA after SW v23 bump so installed clients pick up Desktop + bot-mode.
- Virtual desktop on headless VPS boxes (`install-headless-desktop.sh`).

---

# Prior (landed) — fabric-pwa-bot-mode-ui / openbot-policy-gateway

Bot-mode PWA phases 1A–1C merged (#285). OpenBot policy gateway #275 on main.
