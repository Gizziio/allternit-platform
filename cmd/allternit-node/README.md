# allternit-node — always-on `node.core` daemon

`allternit-node` is a Rust daemon that keeps a paired Mac present on the
Allternit cloud runtime relay even when Allternit Desktop is quit. Fabric
Transport can then use the machine as a node for `node.core` surfaces:
health, exec, fs, processes, metrics, launch, and PTY-backed terminal
sessions.

- **Pairing**: none of its own. The daemon adopts the runtime identity that
  Allternit Desktop already persists (see "Identity" below). Pair with the
  desktop app first, then `sudo allternit-node install`.

## Commands

| Command | Purpose |
|---|---|
| `allternit-node run` | Foreground run (service entry point). |
| `allternit-node install` | Install the LaunchDaemon (macOS) / systemd unit (Linux), start at boot. Requires root. |
| `allternit-node uninstall [--purge]` | Remove the service. `--purge` also removes the shared pairing identity (unpairs the desktop) and node config. The desktop app is never touched. |
| `allternit-node status` | Service status + log location. |
| `allternit-node logs` | Tail the daemon log. |

## Identity

The desktop app is the **single writer** of the daemon identity. On
pair/rotate, `surfaces/allternit-desktop/src/main/auth-manager.ts` writes a
plain-JSON copy (mode 0600) to `~/.config/allternit/runtime-identity.json`:

```json
{ "runtimeId": "rt_…", "deviceToken": "…", "userId": "…", "expiresAt": "RFC3339" }
```

`expiresAt` must be RFC3339 — a numeric epoch is rejected. On unpair/revoke
(`clearSession`) the desktop deletes the file.

**Rotation flow**: the desktop rotates the device token with the cloud →
rewrites both its own encrypted identity and this file → the daemon re-reads
the file before every relay connect attempt and adopts the rotated
credential (logged as `adopted rotated identity`). If the file is missing or
unreadable at reconnect time, the daemon keeps serving with its last-known
identity and logs a warning; transient disk issues never kill a healthy
relay.

## No competition with the desktop app

The daemon and the desktop are designed to coexist without overlap:

- **Outbound-only**: the daemon binds zero listening ports. It holds one
  outbound WSS connection to the cloud runtime relay; every `node.core`
  request arrives over that socket.
- **Port ownership**: the desktop app owns `:8013` (the local gateway /
  allternit-api sidecar) and `:8477` (phone-remote / screen-capture
  surfaces). The daemon never binds either port.
- **Surface ownership**: the desktop serves the full capability set
  (screen capture, ACI/browser, voice, providers, phone remote). The daemon
  advertises only `node.core` + `runtime:connect/execute/terminal/files` —
  explicitly *not* `runtime:remote_control` or provider capabilities — so a
  request that needs the GUI session routes to whichever runtime is the
  desktop, and everything else can be served by the daemon.
- **`node.launch restart` is surgical**: it only signals processes whose
  exact name is `Allternit Desktop` (via `pgrep -x`), then relaunches the
  app. Nothing else on the machine is touched.
- **Single writer**: the desktop app writes the identity file (see above);
  the daemon only reads it.

## Lifecycle cleanliness

- SIGTERM (launchd shutdown) and SIGINT kill and reap every tracked PTY
  child before exit — no zombie terminal sessions across restarts.
- `node.exec` waits for and reaps what it spawns; on timeout the child is
  killed and reaped, never orphaned.
- `node.launch` uses `open -na "Allternit Desktop"` on macOS: the launcher
  resolves immediately and the desktop is not a child process the daemon
  owns.

## Service user (macOS)

When the pairing user is known (`$SUDO_USER` at install time, else the owner
of the identity file), the LaunchDaemon runs as that user via a `UserName`
key and logs to `~/Library/Logs/allternit/node.log` (a non-root daemon
cannot write `/Library/Logs`); `install` creates and chowns that directory.
Otherwise the daemon runs as root with logs at
`/Library/Logs/allternit/node.log` (headless installs).
