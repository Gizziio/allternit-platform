# Canonical provider boundary

New browser, native, device, sandbox, and remote computer integrations belong
here or in `core/environment_backends.py`. They must publish truthful capability
manifests and uphold immutable observations, state-scoped references, stale-write
rejection, honest outcomes, policy preflight, and explicit execution modes.

The `adapters/` tree is grandfathered for migration only. New direct adapter
files are rejected by `scripts/check_provider_boundary.py`.
