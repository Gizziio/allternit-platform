# Allternit Desktop: Office-Capable Target Machine Setup

This document is for the machine that will run the packaged Allternit Desktop app and is expected to support real Microsoft Office desktop add-ins.

## Goal

Use the packaged Allternit Desktop app on a Mac that has Microsoft Word, Excel, and/or PowerPoint installed, then verify that:

1. The desktop app boots cleanly.
2. The local backend and Office taskpane runtime are up.
3. The Office add-in is sideloaded into the real Microsoft host.
4. A live Office binding appears in Allternit.

## Required Software

- macOS
- Microsoft 365 desktop apps installed:
  - `Microsoft Word.app`
  - `Microsoft Excel.app`
  - `Microsoft PowerPoint.app`
- A Microsoft 365 account that can load Office add-ins

## What Must Be Present In The Packaged App

Before handoff, the packaged app should include:

- Electron desktop shell from `surfaces/allternit-desktop`
- Bundled Rust backend
- Bundled platform static assets
- Office companion UI

The packaged app does **not** embed Microsoft Office itself. The real Office document still lives in Microsoft Word, Excel, or PowerPoint.

## First Launch Expectations

On first launch:

1. Open Allternit Desktop.
2. Complete desktop sign-in.
3. Wait for the local services to come online.
4. Open `Office & Extensions`.

Expected status in the Office cards:

- `Taskpane ready` if the Office add-in dev/runtime server is reachable
- `Desktop host installed` if Office is present on the machine
- `No live Office binding` until the add-in is opened inside Word/Excel/PowerPoint

## Desktop Host Verification

Allternit now checks actual host availability in Electron.

For a real Office-capable machine, the Office cards should **not** say:

- `Desktop host missing`
- `Microsoft Word is not installed on this machine`

If they do, Office is either not installed or not located in a standard macOS application path.

## Real Add-in Setup

### Option A: Office Desktop

Use the packaged app's companion surface to get the manifest URL, then sideload the add-in into the real desktop Office app.

If you are using a local/dev taskpane runtime:

1. Ensure the Office add-in runtime is serving the taskpane.
2. Copy the generated `manifest.xml`.
3. Sideload the manifest into Word/Excel/PowerPoint.
4. Open the add-in from inside the Office host.

### Option B: Office on the web

Use `Browser mode` in Allternit Desktop to open:

- `https://word.office.com`
- `https://excel.office.com`
- `https://powerpoint.office.com`

This uses the real Microsoft web product inside the Electron `webview`.

## Required Verification Sequence

Run these checks in order:

1. Open Allternit Desktop.
2. Sign in.
3. Open `Office & Extensions`.
4. Confirm the relevant Office host says `installed`.
5. Open the companion view for that host.
6. Open the add-in inside the real Microsoft Office host.
7. Check the backend binding endpoint:

```bash
curl http://127.0.0.1:8013/api/v1/office/bindings
```

Expected result:

- `count` becomes greater than `0`
- a binding exists for `word`, `excel`, or `powerpoint`

8. Return to the companion view and confirm:

- binding is shown
- host is live
- session count is non-zero when active

## Failure Modes

### Desktop host missing

Cause:

- Microsoft Office is not installed on the machine

Fix:

- Install Microsoft 365 desktop apps before retrying

### No live Office binding

Cause:

- The companion is open, but the add-in is not actually launched inside Word/Excel/PowerPoint

Fix:

- Open the add-in from within the Microsoft Office host

### Taskpane offline

Cause:

- The add-in runtime/taskpane server is not reachable

Fix:

- Start the Office add-in runtime and verify the taskpane URL is reachable

### Browser web host blocked

Cause:

- Trying to use Office on the web outside the Electron desktop shell

Fix:

- Use the packaged Allternit Desktop app, not the plain localhost browser build

## Production Readiness Gate

Do not call the Office path production-ready until all of these are true on the target machine:

- Allternit Desktop boots cleanly
- desktop sign-in works
- backend stays up
- Office cards show real installed host state
- Office add-in can be launched in Word/Excel/PowerPoint
- `/api/v1/office/bindings` becomes non-empty
- companion view reflects the live binding
- one real document session can be opened and controlled without fake fallback state
