# craft-host — host-page bridge protocol (craft:1)

One embedding protocol for all three craft editors (image / pdf / video). The WASM apps
run sandboxed in a cross-origin iframe served from `office.allternit.com/craft/<app>/`;
the Allternit workspace (or any host page) drives them over `postMessage`. FilmCraft's
existing `window.filmcraft` object is the upstream reference shape; this protocol
generalizes it and adds the security model embedding requires.

## Goals
- Open a document (bytes), let the user edit, stream saves back to the host.
- Let an agent (or host UI) drive the app's existing engine command registry live —
  the same visible editor, not a headless clone.
- Zero trust in the parent: the app validates origin + a per-session token before
  accepting any command.

## Roles
- **Host**: the Allternit workspace page holding the iframe (ArtifactWindow's editor
  pane). Generates the session token, owns persistence (`/api/v2/artifacts`).
- **App**: the craft WASM editor inside the iframe. Stateless about where bytes go;
  asks the host to save.
- **Agent**: optional; speaks to the app *through the host* (host forwards
  `command` messages; the app never has a second channel).

## Handshake
1. Host loads iframe: `https://office.allternit.com/craft/<app>/?embed=1&origin=<urlencoded parent origin>`.
2. App posts `ready {app, version, protocol: "craft:1"}` (wire type names are the
   crate's bare kebab-case variants — `ready`, `hello`, `open`, `command`, `save-ack`,
   `theme`, `ping` host→app and `ready`, `hello-ack`, `open-ack`, `save-request`,
   `command-result`, `command-event`, `document-changed`, `error` app→host; NO
   `craft:` prefix on the wire — `protocol.rs` is the source of truth). The app does
   not know the parent origin yet; it replies to whoever loaded it — safe because it
   was loaded with `sandbox` and no credentials, and it will validate the token.
   NOTE: the sandboxed iframe has an OPAQUE origin, so the parent receives these with
   `event.origin === 'null'` — hosts must accept 'null' AND pin `event.source` to
   their own iframe. Host→app messages must be posted with target `'*'` — an explicit
   target origin is never delivered to an opaque-origin window.
3. Host posts `hello {protocol: "craft:1", token, theme, chrome, capabilities}`.
4. App validates token (random ≥128-bit, host-generated per editor session) and origin
   (the `origin` query param must equal `event.origin` of the `hello` message), then
   enters embedded mode: chrome hidden (no menu bar/window chrome per `chrome` value),
   theme applied, and acknowledges `hello-ack {ok: true}`. Until a valid hello,
   commands are rejected and the app shows its normal standalone UI.
   `command` ids are NUMBERS (u64) on the wire, not strings.

## Messages (host → app)
| type | payload | meaning |
|---|---|---|
| `open` | `{name, bytes: ArrayBuffer (transferred), format?}` | replace current document / import media |
| `command` | `{id: u64, cmd, params}` | run an engine command (the agent lane); see Command channel |
| `theme` | `{theme: {dark, accent?, scale?}}` | live theme update |
| `ping` | `{}` | keepalive / liveness |

## Messages (app → host)
| type | payload | meaning |
|---|---|---|
| `ready` | `{app, version, protocol}` | step 2 of handshake |
| `hello-ack` | `{ok, error?}` | step 4; `ok:false` = host must show an error surface |
| `open-ack` | `{ok, error?, warnings?}` | document loaded (or parse errors, warnings) |
| `document-changed` | `{dirty}` | dirty flag for the host header |
| `save-request` | `{name, format?, bytes: ArrayBuffer (transferred), meta}` | user (or command) initiated save; host persists, then MUST reply `save-ack` |
| `command-result` | `{id: u64, ok, result?, error?}` | response to `command` |
| `command-event` | `{event, data}` | async engine events (progress, fatal panics, selection changed, etc.) |
| `error` | `{message}` | unrecoverable editor failure; host shows its error surface |

## Command channel
Each app already has a JSON command registry (PhotoCraft 500+, PdfCraft, FilmCraft 650+)
used by its CLI/MCP/control channel. `craft:command` reuses the *same* registry — the
bridge maps `cmd`/`params` onto it. The host allow-lists which command ids each kind
may run (image editor ≠ pdf editor surface); unknown ids return
`{ok:false, error:"unknown/disallowed command"}`. The app MUST rate-limit command
execution to one in flight per session unless the registry documents re-entrancy.

## Security model
- App iframe: `sandbox="allow-scripts allow-downloads"` (no `allow-same-origin` in v1 —
  opaque origin, storage partitioned; OPFS use is verified in the build phase, and if a
  hard blocker appears we revisit with `allow-same-origin` + same-site serving).
- Token: host-generated per session, passed only via `hello`, validated by the app
  before accepting `open`/`command`. Wrong/missing token → ignore + log.
- Origin: app was loaded with `?origin=`; an incoming message whose `event.origin`
  differs is ignored (the host's origin; the app's own origin is opaque 'null'). The served `index.html` carries no credentials, cookies, or tokens of its
  own (static hosting only).
- Serving headers on `/craft/*` (live-verified 2026-10-10 — the sandboxed iframe's
  opaque origin makes these load-bearing, and the editors silently fail to boot without
  them): CSP `default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:;
  font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:` (unsafe-inline:
  the vendored index.html boots from inline scripts; connect-src 'self': the same-origin
  .wasm fetch), `Access-Control-Allow-Origin: *` + `Cross-Origin-Resource-Policy:
  cross-origin` (module scripts/wasm load cross-origin from the opaque-origin document),
  COOP same-origin + COEP require-corp retained. The office origin carries no
  credentials and third-party connections stay cut (no telemetry path).
- Bytes travel as `ArrayBuffer` via `postMessage` transferables (no base64 copies of
  multi-MB documents).

## Failure modes (host UI)
- iframe load error / no `ready` in N seconds → error surface with retry.
- `hello-ack {ok:false}` → "editor refused this embed" (version/protocol mismatch).
- No ack to `save-request` in 30s → app keeps document dirty and shows its own
  "host unreachable — keep editing" state; nothing is lost.

## Per-app adapter mapping (from the 2026-10-09 audits)
`audit/{pdf,video}.md` §D/E established the concrete wiring; image follows the same shape
once its audit lands.

**video (has `window.filmcraft` already)** — smallest adapter. A wasm-side gate shim is
loaded with the embed page: it performs the `craft:1` handshake (token + parent-origin
validation) and only then exposes the existing object to the parent:
- `craft:open` → bytes → `File` → `filmcraft.importFiles(...)` / `openProject`
- `craft:command` → `filmcraft.execute(cmd, params)` / `filmcraft.request(...)`
- save → after `file.save` completes, `filmcraft.files()` + `filmcraft.readFile(path)` →
  `save-request` to parent (bytes as transferables)
- ready → `window.filmcraftLoad.readyMs`; fatal → the `error {message}` app→host type (adapters may also surface it via a
  `command-event {event:"fatal"}`)

**pdf (no JS object; in-process APIs)** — adapter inside `apps/pdfcraft-web` (~150 lines,
`embed` feature): bridge init on canvas start; `open` → existing public
`open_bytes()`; `command` → in-process `execute(command_id)`; **new save-bytes
write-back callback** hooked where saves today become Blob downloads
(`editing.rs:659`) — in embed mode bytes post to parent instead of (or in addition to)
the download.

**image (PhotoCraft)** — audit pending; expected same class as pdf (control protocol +
`apps/photocraft-web`). Adapter written after its `audit/image.md` §D lands.

**Host side (one shared implementation)** — `allternit-ai/src/components/craft/bridge.ts`:
session token, iframe lifecycle, protocol client, ArrayBuffer transfers, timeout/retry,
error surfaces. Kind editors (PDF/Image/Video) are thin wrappers over it.

## Crate layout (to implement)
`vendor/craft/craft-host/` — one Rust crate, `embed` feature:
- `protocol.rs`: serde types for every message above (shared with hosts in TS later).
- `bridge.rs`: wasm-bindgen `HostBridge` — init(origin, token), `on_message` handler
  dispatching to app-provided callbacks: `open_cb(bytes, name) -> Result<warnings>`,
  `save_cb() -> SaveRequest`, `command_cb(cmd, params) -> Result<json>`,
  `theme_cb(theme)`, plus `post_*` helpers for the app→host messages.
- Each app's `apps/<app>-web` gets a thin adapter (≤150 lines) wiring its engine session
  + document IO onto those callbacks, behind `#[cfg(feature = "embed")]`.

Versioning: protocol is versioned (`craft:1`); bump on breaking shape changes; apps
advertise the versions they speak in `craft:ready`.
