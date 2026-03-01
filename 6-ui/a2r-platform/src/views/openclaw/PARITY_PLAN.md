# OpenClaw Parity DAG

This file tracks the parity DAG agreed for Shell OpenClaw integration.

## Nodes

1. `N0` Define parity contract from vendor UI (routes, RPC methods, tab surface)
2. `N1` Switch active Shell OpenClaw view to quarantine host (real OpenClaw UI via iframe)
3. `N2` Normalize gateway auth/config (token/password, ws/http URL handling)
4. `N3` Add parity smoke tests for baseline routes and methods
5. `N4` Build native Gateway client adapter behind `openclaw_native_ui` flag
6. `N5` Implement native chat + stream + abort + inject
7. `N6` Implement native channels + QR + config patch
8. `N7` Implement native sessions + instances + cron
9. `N8` Implement native skills + nodes + exec approvals
10. `N9` Implement native config get/set/apply + schema + base-hash guard
11. `N10` Implement native debug + logs + update/restart
12. `N11` A/B parity harness and rollout gate
13. `N12` Gradual cutover by tab and remove quarantine fallback

## Current status

- `N0` complete: `parity-contract.ts` defines vendor baseline routes and RPC checks.
- `N1` complete: active `a2r-platform` OpenClaw view now hosts vendored control-ui via iframe.
- `N2` complete (quarantine phase): runtime config supports gateway HTTP/WS URL + token/password injection without `/api/v1` path coupling.
- `N3` complete: `pnpm --dir 7-apps/shell-ui openclaw:parity-smoke` validates baseline route/method tokens from served control-ui bundle.
