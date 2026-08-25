# Deep Analysis: Google Antigravity Remote Control

Source: [Remote Control for Antigravity — Google Antigravity Blog](https://antigravity.google/blog/remote-control-for-antigravity)

---

## 1. The problem they are solving

Agentic coding tasks run for extended periods: full-subsystem refactors, large test suites, build breakages, dependency migrations, version-control operations. The developer faces an **attention-management trap**:

- Waste time staring at agent logs hoping it finishes faster.
- Step away "blind," not knowing if the agent finished 5 seconds or 20 minutes after leaving.
- Recreating the local environment on another machine is wasteful.

Remote Control is Google's answer: carry the agent session with you, keep it running on the original host, and interact with it from any browser.

---

## 2. What Remote Control actually is

- **Browser-based**, not a native app. Any modern browser on laptop/phone/tablet.
- **Multi-instance.** Register several machines (laptop, desktop, cloud server) and switch between them from one dashboard.
- **Same session, not a copy.** Connect into the Antigravity 2.0 session already running on that host.
- **Full local context retained.** Files, workspaces, build tools, credentials, environment variables stay on the host.
- **Proactive push notifications.** Alert when an agent finishes a turn and needs input.
- **Headless support.** Install a daemon (`agy-daemon`) for servers or machines without the GUI app.

---

## 3. Full user flow

### Desktop app machine

1. Open **Settings** (`Cmd/Ctrl + ,`) → **Account**.
2. Toggle **Enable Remote Control** On.
3. Optionally set a nickname, e.g. `workstation-primary`.
4. On another device, open the Remote Control dashboard in a browser.
5. Sign in with the same Google Account used on the desktop app.
6. Select the machine from the instance switcher.
7. View conversations, start agent tasks, review plans, inspect artifacts, send messages.
8. Receive push notification when the agent needs input (if PWA installed).

### Headless server

1. Run the daemon installer:
   ```bash
   curl -fsSL https://antigravity.google/cli/agy-daemon.sh | bash
   ```
2. Complete OAuth device-flow sign-in in the terminal.
3. Daemon starts as a service:
   - Linux: at boot, survives logout, auto-restarts on crash.
   - macOS: starts at login, does **not** survive logout.
   - Windows: at boot, survives logout, does **not** auto-restart after crash.
4. Machine appears in the web dashboard by instance name.

---

## 4. Technical architecture

Google has not published the wire protocol, so the transport layer is inferred from the product shape and community reverse-engineering.

### Components

| Layer | Role |
|-------|------|
| **Host agent** | Antigravity 2.0 desktop app or `agy-daemon`. Owns the session, files, credentials, shell. |
| **Google Hub / Relay** | Cloud service mapping Google Account → registered machines; handles discovery, auth, NAT traversal. |
| **Browser client** | Remote Control dashboard; renders session UI and forwards input. |
| **Push service** | Web Push API tied to the installed PWA for "agent needs input" alerts. |

### Connection model

The host maintains a persistent outbound connection to Google's relay. The browser dashboard authenticates, asks the Hub for instances, and the Hub coordinates a connection to the selected host. The docs say you can "view active conversations, start new agent tasks, review implementation plans, and inspect artifacts" — implying a **structured application protocol** rather than raw video streaming.

Plausible transport: **WebRTC data channels** with **WebSocket fallback** through the relay.

### Security model

- Same Google Account for browser and desktop.
- **Separate OAuth sign-in for the headless daemon** (device flow).
- Host must stay awake and online.
- By design exposes live files, credentials, and shell access.

---

## 5. How to replicate

### Strategy A: Structured remote client

Build a real remote UI that talks to the agent's internal state.

- **Host service:** lightweight daemon next to the agent; reads/writes session state; exposes WebSocket/gRPC stream to relay.
- **Relay / signaling server:** authenticates users, maps users to hosts, forwards messages.
- **Browser client:** React/Vue dashboard rendering chat, files, artifacts; sends input events.
- **Push notifications:** Web Push API via Service Worker.

### Strategy B: Full desktop streaming

Run the agent inside a Docker container/VM with a desktop and stream it.

- Use **Selkies-GStreamer** (WebRTC) or **noVNC** (WebSocket/VNC).
- Add HTTP Basic Auth or OAuth in front.
- Simpler but heavier; worse mobile experience; no structured notifications.

### Strategy C: CDP-based bridge

If the agent is an Electron app, attach via Chrome DevTools Protocol:

- Read DOM/state of the agent panel.
- Inject messages and clicks programmatically.
- Stream state to phone/web UI over WebSocket.
- Fragile across app updates.

---

## 6. Minimal DIY reference architecture

| Piece | Recommendation |
|-------|---------------|
| Host service | Go or Node.js, runs next to the agent |
| Session state | SQLite or JSON file watched by host |
| Transport to relay | WebSocket with TLS, or WebRTC data channels |
| Relay | Socket.io server or Cloudflare Durable Objects |
| Auth | OAuth2/OIDC + short-lived tokens |
| Browser UI | React + Tailwind |
| Notifications | Web Push API via Service Worker |
| File sync | Stream diffs; browser does not download whole repo |
| Local-only mode | Tailscale or Cloudflare Tunnel instead of public relay |

---

## 7. Security caveats

- Full workspace access = high trust.
- Host must stay awake.
- Separate daemon auth is critical.
- Do not leave dashboard signed in on shared devices.
- Third-party CDP bridges are reverse-engineered and may break or violate ToS.

---

## 8. Competitive comparison

- **Claude Code remote control:** native mobile app, local-only connection, device cards.
- **Cursor for iOS:** native app with cloud agents.
- **Antigravity:** browser-first, multi-machine, Google Account + daemon auth.

Google's package is not the first remote-agent feature, but it packages the multi-machine browser experience cleanly.

---

## Bottom line

Google solved the **agent-session continuity problem**: the agent stays on the host, the human can leave and re-engage from anywhere, and the system interrupts the human only when necessary. The minimum viable replication needs a host daemon, a relay, a browser dashboard, and push notifications.
