# API Servers

`api/` is being dissolved into `services/` (see [REPO_STRUCTURE.md](../REPO_STRUCTURE.md)).

Remaining live packages:

- `gateway/routing` — request routing and protocol gateways
- `services/workspace-service` — workspace management
- `core/cloud-backend` — WebSocket bridge (browser extension ↔ agent session relay)
- `services/ssh-bridge` — SSH bridging
- `services/replies-runtime` — replies runtime
