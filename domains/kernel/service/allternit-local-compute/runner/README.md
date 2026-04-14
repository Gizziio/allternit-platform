# Runner Service

Purpose
- Executes capsules on cloud runners (local runner first).
- Interfaces with control-plane-service for run lifecycle and events.

Planned integration
- `apps/api` delegates run requests to runner service.
- Runner publishes EventEnvelope stream + artifact outputs.

Targets
- Local runner (MVP-1)
- Nomad-backed runner (upgrade)

Spec
- `services/runner/RUNNER_API.md`
