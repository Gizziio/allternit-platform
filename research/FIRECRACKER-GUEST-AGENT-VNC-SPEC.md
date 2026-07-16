# Firecracker Guest Agent + VNC Bridge — Design Spec

## Update: a second, verified path now exists (`ContainerGuiBackend`)

After this spec was written, we checked what Anthropic actually ships for
computer-use isolation (`anthropics/anthropic-quickstarts/computer-use-demo`)
rather than assuming a microVM was the only option. Their real Dockerfile and
`tools/computer.py` confirm: **Xvfb + a lightweight WM + x11vnc/noVNC for
human viewing only — agent control goes through `docker exec` running
`xdotool`/`scrot`, never VNC/RFB.** That's a container, not a microVM, and a
container needs no hardware virtualization at all, nested or otherwise.

We built `ContainerGuiBackend` (`core/environment_backends.py`) mirroring
this exactly — `sandbox/container/{Dockerfile,entrypoint.sh}` — and, unlike
everything else in this document, **verified it end-to-end on real
hardware**: installed Colima (open-source Docker runtime) on this Apple
Silicon Mac, built the image, ran a container, and drove it through the
actual `ContainerGuiBackend` Python class — `provision()` → `mouse_action()`
(move/click) → `keyboard_action()` (type) → `screenshot()` → `stop()` — with
the resulting PNG inspected and the cursor confirmed at the exact
commanded coordinates. Caught and fixed one real bug this way (`scrot -o` vs
`-p` — without `-p` the cursor never appeared in screenshots, which no
amount of code review would have caught).

This is now the **primary, verified GUI backend**; the isolation tradeoff is
explicit, not hidden: containers share the host kernel (weaker boundary than
a microVM's separate guest kernel), which is exactly the tradeoff Anthropic
made deliberately for this use case. `VmGuiBackend`/the Firecracker guest
agent below remain as the stronger-isolation option for when that tradeoff
matters, but everything below this point is still unverified pending real
KVM hardware, while `ContainerGuiBackend` is not.

## Status (original Firecracker/VNC spec, below)

Design spec. **Correction after starting implementation**: a real, matching
guest agent already existed in this monorepo at
`archive/rust-orphans/firecracker-guest-agent/` — length-prefixed JSON over a
vsock-backed Unix socket, with `Execute`/`GetLogs`/`GetArtifacts`/
`GetMetrics`/`Ping` request types that already match the host-side
`GuestAgentRequest`/`GuestAgentResponse` enums in
`drivers/firecracker/src/lib.rs:1355-1400` almost field-for-field. It was
moved to `archive/rust-orphans/` during a consolidation pass (git log:
"integrate orphan SDK crates, archive dead stubs, fix session routes") —
disconnected from the build, not broken by design. Nothing in
`drivers/firecracker/src/rootfs.rs` installs it into any rootfs image either,
so today **neither** consumer of this protocol — gizzi-code's VM sessions
(`vm_session_routes.rs` → `exec_in_vm`) nor ACU's `FirecrackerSandbox` — has a
real guest to talk to. Both get fixed by un-orphaning this one agent rather
than building a second, competing protocol.

Sections below are marked `[BUILT]` as pieces land, `[TODO]` otherwise.
Nothing has been boot-tested against a real Firecracker microVM in this
environment (no KVM host available here). Treat `[BUILT]` as "written and
internally consistent," not "verified working," until someone runs it on
real hardware.

## Problem

Two related gaps, found while auditing ACU's sandboxing against industry
practice (Firecracker/gVisor/Claude Code/E2B):

1. `FirecrackerSandbox.run()` (`sandbox/firecracker_sandbox.py:204-233`) does
   not execute inside the guest at all. With `allow_process_fallback: False`
   (how `AllternitSandboxBackend.provision()` configures it, per
   `core/environment_backends.py:80`) it raises. With fallback allowed, it
   silently runs the command on a bare local `ProcessSandbox` and stamps the
   VM's `sandbox_id` onto the result. There is no guest command-execution
   transport of any kind today — no vsock agent, no serial-console protocol.
2. There is no display virtualization anywhere in this codebase, so
   `pyautogui_adapter.py`/`accessibility_adapter.py` can only run against the
   real host screen (`HostAdapterGate`, an audit gate, not isolation) or —
   since Phase 7a — a Cua-backed environment where the `trycua/cua` SDK
   already solves this. This spec covers the case Cua doesn't: a
   Firecracker-only environment.

## Reference architectures (researched, not guessed)

- **Kata Containers' `kata-agent`**: a daemon inside the guest, ttrpc
  (a gRPC reimplementation for low-memory environments) over `AF_VSOCK`. The
  most mature, production, real-world reference for "guest daemon reachable
  from the host over vsock." We borrow the *shape* (ttrpc/vsock, Rust agent)
  without borrowing Kata's OCI/container-lifecycle scope — we only need
  `run_command`, not namespace/cgroup/image management.
- **E2B's `envd`** (`e2b-dev/infra`, open source): the exact tier we're at —
  Firecracker microVM + per-VM guest daemon reachable over vsock, gRPC for
  filesystem/command/terminal operations, REST for lifecycle. Confirms the
  pattern is right for this specific hypervisor.
- **Anthropic's `computer-use-demo`** (`anthropics/anthropic-quickstarts`):
  Xvfb + x11vnc + noVNC as the reference display stack for a computer-use
  agent. We use `Xvnc` (TigerVNC) instead of separate Xvfb+x11vnc — it's both
  the X server and the VNC server in one process, one fewer moving part for
  the same result — and tunnel the RFB bytes over vsock instead of TCP, so
  the guest needs no network device for this at all.

## Transport: extend the existing agent, add a second vsock port for VNC

The existing agent already listens on one vsock-backed Unix socket
(`/tmp/vsock-{vm_id}.sock` on the host side, per `drivers/firecracker/src/
lib.rs:1235`) speaking length-prefixed JSON. We extend that enum with two new
variants rather than inventing a new protocol, and add a **second** vsock
port dedicated to raw VNC/RFB bytes:

| Port/socket | Purpose | Protocol |
|------|---------|----------|
| existing (`/tmp/vsock-{id}.sock`) | Agent RPC — `Execute`/`GetLogs`/`GetArtifacts`/`GetMetrics`/`Ping`, now also `StartDisplay`/`StopDisplay` | length-prefixed JSON (existing) |
| new, allocated via the driver's existing `allocate_vsock_port()` (`lib.rs:352`, already starts at 10000 and increments) | Raw VNC/RFB tunnel | raw bytes, no framing — passthrough to Xvnc's own socket |

Keeping VNC on its own port means the host-side VNC client is a completely
standard RFB client pointed at a vsock-backed stream — no custom framing to
strip, so a mature host library can be used unmodified (see Phase 7c).

## Agent RPC schema — extend the existing enums, don't replace them

`GuestAgentRequest`/`GuestAgentResponse` (`drivers/firecracker/src/
lib.rs:1355-1400`) and their guest-side mirrors `HostRequest`/`GuestResponse`
(`archive/rust-orphans/firecracker-guest-agent/main.rs:27-72`) already match
almost field-for-field for `Execute`/`ExecuteResult`. Add, on both sides:

```rust
// Request
#[serde(rename = "start_display")]
StartDisplay { width: u32, height: u32 },
#[serde(rename = "stop_display")]
StopDisplay,

// Response
#[serde(rename = "display_started")]
DisplayStarted { vnc_vsock_port: u32 },
#[serde(rename = "display_stopped")]
DisplayStopped,
```

`vnc_vsock_port` is returned dynamically (not hardcoded) because the driver
already allocates vsock ports per-VM via `allocate_vsock_port()` — the guest
agent requests one more port allocation the same way the existing exec
channel got its port, rather than assuming a fixed number.

Framing is unchanged: `[4-byte big-endian length][JSON bytes]`, exactly what
`exec_in_vm` (`lib.rs:1258-1266`) and the archived agent's `send_response`
(`main.rs:175-184`) already do.

## Guest agent (Rust) — un-archive and extend, don't rewrite

`[BUILT]` Moved `archive/rust-orphans/firecracker-guest-agent/` back into the
active workspace at `drivers/firecracker-guest-agent/`, added it to the root
`Cargo.toml` workspace `members`. The existing `Execute`/`GetLogs`/
`GetArtifacts`/`GetMetrics`/`Ping` handling is kept as-is (it's already
correct: spawns via `std::process::Command`, captures stdout/stderr, measures
duration). Added:

1. `StartDisplay { width, height }` handler: launches `Xvnc :0
   -SecurityTypes None -rfbport 0 -localhost` bound to a guest-local port,
   plus `fluxbox` if present in the rootfs (matching Anthropic's own demo's
   choice of a lightweight WM over a full desktop environment). On success,
   spawns a raw byte-forwarding task bridging a newly-opened `AF_VSOCK` port
   to Xvnc's local port, and returns `DisplayStarted { vnc_vsock_port }`. On
   failure (Xvnc missing, display already running), returns an `Error` —
   fail closed, matching the philosophy of every other phase in this project.
2. `StopDisplay`: tears down the forwarding task and kills Xvnc/WM.

The guest binds a fixed vsock port (`10001`, `DISPLAY_VNC_VSOCK_PORT` in
`main.rs`) for the display tunnel rather than dynamically negotiating one —
there's exactly one display session per VM, so there's nothing to
disambiguate, and it keeps the host and guest sides from needing an
additional coordination round-trip.

## Host-side changes

`[BUILT]` `sandbox/firecracker_sandbox.py`: `start()` now performs a `Ping`
over the guest-agent socket with bounded retries (guest agent needs a moment
to boot after the kernel is up) instead of assuming readiness. `run()` now
sends a real `Execute` request and returns real `ExecuteResult` data — the
entire local-`ProcessSandbox`-with-stamped-id fallback is gone; a connection
or protocol failure now raises instead of silently executing unsandboxed.
Added `start_display()`/`stop_display()` methods sending `StartDisplay`/
`StopDisplay` and returning the guest-reported vsock port, exposed through
`AllternitSandboxBackend` for Phase 7c.

## Rootfs build

`[BUILT]` — turned out a real, sophisticated rootfs builder already existed
(`drivers/firecracker/src/rootfs.rs`, `RootfsBuilder`): it builds real ext4
images from OCI images via skopeo+umoci/buildah/podman/docker, with a
minimal-rootfs fallback. Its own code comment on the empty-rootfs path
literally said "guest agent will need to be added separately" — confirming
this, not a from-scratch build, was the actual remaining gap.

Added `RootfsBuilder::install_guest_agent()`, called from both
`copy_to_ext4()` (the OCI-image path) and `extract_minimal_rootfs()` (the
pre-built-minimal-tar path): copies the guest agent binary from
`ALLTERNIT_GUEST_AGENT_BINARY` (a new env var, following the same
pre-built-artifact convention `ALLTERNIT_VM_DIR` already used for packaged
VM images) to `/usr/local/bin/allternit-guest-agent` in the mounted rootfs,
adds an `/etc/rc.local` start-on-boot line (the most broadly-supported
zero-assumptions boot hook across minimal Debian/Ubuntu/Alpine-derived
images), and best-effort `chroot`-installs `tigervnc-standalone-server` +
`fluxbox` via apt-get when the rootfs has one (skipped, not fatal, on
non-Debian bases — `StartDisplay` fails closed later if these are missing,
consistent with the rest of this project).

Not covered: actually building the guest agent binary for the guest's target
architecture (`cargo build --release -p allternit-guest-agent --target
x86_64-unknown-linux-musl` or equivalent) and setting
`ALLTERNIT_GUEST_AGENT_BINARY` to point at it -- that's a CI/build-pipeline
step, not something this method does inline, matching how `ALLTERNIT_VM_DIR`
packaged images are already assumed pre-built rather than built on demand.
Also not covered: the `create_minimal_rootfs`'s bare-`mkfs.ext4`-with-nothing-
mounted fallback (when no `minimal-rootfs.tar.gz` cache exists at all) has no
files of any kind, not even a kernel-bootable userland -- a separate,
pre-existing gap unrelated to the guest agent, out of scope here.

## Host-side VNC client + backend wiring (Phase 7c)

`[BUILT]` A Python RFB client (surveyed `asyncvnc` — pure-Python, asyncio-native,
no C extension to cross-compile for exotic guest kernels, a good fit here)
connects through the guest agent's vsock display tunnel. New `VmGuiBackend`
in `core/environment_backends.py` (same shape as `HostEnvironmentBackend`)
wraps it, exposing `gui_action` the same way `CuaSandboxBackend`'s methods do
(Phase 7a). `pyautogui_adapter.py`'s backend selector now tries
`CuaSandboxBackend` first, falls back to `VmGuiBackend` for Firecracker-only
environments, and only reaches `HostAdapterGate` when `isolation="host"` is
explicit.

## What a team needs to verify on real hardware before trusting this

- `ALLTERNIT_GUEST_AGENT_BINARY` must be set to a real cross-compiled binary
  before any rootfs build picks up the agent — nothing in this codebase
  builds it automatically; a CI step producing it is a hard prerequisite.
- Guest agent actually binds/listens on vsock inside a real Firecracker
  microVM (vsock device must be configured in the `SpawnSpec`/machine config
  — check whether `PolicySpec`/`ResourceSpec` in `vm_session_routes.rs`'s
  `SpawnSpec` even wires a vsock device today; the Python side now does via
  `_configure_vm()`'s new `PUT /vsock` call, but the Rust driver's own
  `spawn()` path wasn't audited for the equivalent in this session).
- `/etc/rc.local` actually runs in whatever base OCI image is chosen for the
  rootfs — some minimal/hardened images disable or don't ship it; if so, the
  guest agent never starts and `start()`'s `Ping` retry loop will time out
  and fail closed (safe, but worth knowing why in advance rather than
  discovering it at deploy time).
- `RunCommand`/`Execute` round-trip latency and correctness under real load
  and timeouts.
- Xvnc actually renders and accepts input inside the minimal rootfs (font
  packages, WM dependencies — headless X stacks are notoriously fiddly about
  missing shared libraries); confirm `apt-get install` inside the `chroot`
  call in `install_guest_agent()` actually has network access at build time.
- Boot time impact of adding the agent + Xvnc + WM to the rootfs — Firecracker's
  whole pitch is ~125ms boots; a heavier rootfs erodes that.
- The vsock CONNECT handshake (`_vsock_connect` in `firecracker_sandbox.py`)
  against a real Firecracker vsock UDS — implemented per Firecracker's
  documented protocol, but the sibling Rust driver's `guest_agent_request`
  skips this handshake entirely, which is either a latent bug there or a sign
  the handshake isn't needed for this Firecracker version/config. Reconcile
  before trusting both paths simultaneously.
