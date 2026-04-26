# Plugin Manager Electron E2E

This script runs desktop-level smoke coverage for critical Plugin Manager flows using `agent-browser` over Electron CDP.

## Covered flows

1. Open Plugin Manager from shell rail.
2. Verify 3-pane Plugin Manager shell controls render.
3. Switch to `Connectors` and verify connector actions/settings controls.
4. Switch to `Plugins`, open `Browse plugins` overlay.
5. Verify `Marketplace` + `Personal` tabs and personal source actions:
   - `Add from GitHub`
   - `Add by URL`
   - `Upload plugin`
   - `Sync personal sources`

## Prerequisites

1. Electron app running with remote debugging enabled (default port `9222`):

```bash
open -a "Allternit" --args --remote-debugging-port=9222
```

2. `agent-browser` installed and available in PATH.

## Run

```bash
cd 6-ui/allternit-platform
./scripts/plugin-manager-electron-e2e.sh
```

Custom CDP port:

```bash
./scripts/plugin-manager-electron-e2e.sh 9333
```
