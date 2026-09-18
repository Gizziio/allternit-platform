# Computer Use Private Alpha Readiness

**Date:** 2026-07-15  
**Scope:** Allternit harness use; no publishing or public certification  
**Verdict:** **READY for packaging and use as a macOS/browser private alpha**

## Proven locally

- A wheel builds from the computer-use package and installs into a clean virtual environment.
- Installed `allternit-computer` and `allternit-computer-mcp` entry points import successfully.
- The installed daemon starts on loopback, stops cleanly, restarts against the same state directory, and returns canonical health.
- macOS Accessibility and Screen Recording permissions are granted.
- Canonical Playwright and macOS accessibility providers are available and report their limitations honestly.
- Cua Driver 0.8.2 is installed as a signed app with telemetry disabled; Accessibility and Screen Recording are granted under the daemon identity.
- The harness registers `desktop.cua-driver` as active, and a daemon-owned 1920×1080 desktop capture succeeds.
- A real Chromium workflow completed navigation, inspection, form fill, click, accessible result verification, and screenshot capture: 6/6 actions.
- Five isolated browser sessions completed 15/15 concurrent actions.
- Every successful browser action emitted a receipt; screenshot emitted an artifact.
- Malformed navigation, click, and fill requests were rejected before delivery: 3/3.
- Approval replay, approval mutation, risky-action approval, read-only allowance, and sandbox-to-host denial invariants passed: 5/5.
- SDK compatibility transports passed mocked runtime checks; SDK and both Summit bridges typecheck.
- HTTP/MCP plugin connectors pass 18/18 tests.

## Defects found and fixed during certification

1. The wheel omitted the observability package and the installed daemon could not start.
2. Observability imports depended on source-tree path mutation rather than package imports.
3. `/v1/execute` rejected the documented top-level `text` compatibility field.
4. Targeted accessibility inspection called the removed Playwright `page.accessibility` API.

All four fixes were included in the rebuilt wheel and exercised through the installed daemon.

## Truthful support boundary

| Capability cell | Result |
|---|---|
| macOS packaged daemon | Passed |
| Chromium/Playwright browser actions | Passed |
| macOS permission discovery | Passed |
| SDK, CLI, REST, MCP packaging/import | Passed |
| Five-session browser concurrency | Passed |
| Approval/policy safety primitives | Passed |
| Daemon stop/restart | Passed |
| CDP attachment | Unavailable in this run; no CDP endpoint configured |
| Browser extension canonical provider | Unavailable in installed-daemon run; no relay configured for that process |
| Cua Driver native macOS route | Passed; installed, permissioned, captured, and registered |
| Windows, Linux, Android | Not tested on this macOS host |
| Docker/QEMU/Firecracker/Lume environments | Excluded from this package boundary by owner decision because local VM images exceed available storage |
| Long autonomous model-planned tasks | Not certified; requires configured model credentials and a task corpus |

## Shipping decision

Package this implementation into the Allternit harness with all host-native and
browser cells enabled. Display non-bundled guest routes with their setup/storage
diagnostics rather than silently hiding or falsely activating them.
Treat it as a private alpha: suitable for internal and controlled user workflows,
but do not claim cross-platform or Claude/Codex reliability parity from this run.

The harness provider catalog displays every known route, including setup reasons,
instead of hiding unavailable routes. The storage-constrained distribution is
host-native/browser-first: Playwright, accessibility, and Cua Driver are active;
large guest images are not bundled or downloaded.

Wheel produced during the run:
`allternit_computer_use-0.1.0-py3-none-any.whl`  
SHA-256: `79a315a5e91a657c6875d9af05578abe4c1395c87b98cd8e0d17e5e652a8b0dd`
# Packaged desktop integration update

The standalone `CuaDriver.app` installation was used only for host validation.
The production desktop path now packages a pinned, checksum-verified driver,
signs it as nested Allternit code, and spawns it directly from the Electron main
process with `CUA_DRIVER_EMBEDDED=1`. macOS therefore attributes Accessibility
and Screen Recording to `com.allternit.desktop`; customers do not install or
approve a separate CuaDriver application. The backend reaches the app-owned
driver over a private per-user Unix socket, and upstream telemetry is disabled.
