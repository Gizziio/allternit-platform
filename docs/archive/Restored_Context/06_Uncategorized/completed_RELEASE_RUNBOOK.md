# Release Engineering and Production Runbook

## Release Checklist

- Verify workspace builds: `cargo check --workspace`.
- Run test suite for critical paths:
  - `cargo test -p allternit-wasm-runtime --test policy_capsule_execution`
  - Capsule verification tests in `allternit-capsule`.
- Validate capsule signing/verification flow with a real bundle.
- Confirm policy default-deny paths and capability enforcement tests.
- Update version numbers and changelog (if maintained).
- Tag release and produce build artifacts.

## CI Pipeline (Recommended)

1) Lint and format
- `cargo fmt --check`
- `cargo clippy --workspace --all-targets -- -D warnings`

2) Build matrix
- Linux/macOS for core crates
- `wasm32-unknown-unknown` for example tool

3) Tests
- Unit + integration tests
- Capsule verification + policy execution tests

4) Security
- Dependency audit (e.g., `cargo audit`)
- License scan

## Deployment Steps

1) Prepare capsule artifacts
- Build component WASM
- Bundle capsule with signature
- Publish to capsule store or registry

2) Deploy services
- WASM runtime service
- Cloud runner
- Policy engine
- Tool registry
- Python gateway (if needed)

3) Configuration
- Set resource pool limits
- Configure policy defaults and tenant isolation
- Configure audit/log sinks

## Rollback Plan

- Keep previous capsule bundles in storage for immediate rollback.
- Roll back service releases to previous image/tag.
- Revert policy configuration to last-known-good snapshot.

## Observability

- Metrics: Prometheus scrape for cloud-runner and runtime metrics.
- Logs: store execution logs and host events.
- Alerts:
  - Capsule verification failures
  - Policy denial spikes
  - Execution timeouts
  - Resource pool exhaustion

## Operational Runbooks

- **Capsule verification failure**: quarantine bundle, re-sign, re-publish.
- **Policy engine outage**: fail closed; route to fallback policy snapshot.
- **Cloud runner saturation**: increase pool limits or shed low priority tasks.
- **Gateway errors**: disable tool registration endpoint; restrict entrypoints.
