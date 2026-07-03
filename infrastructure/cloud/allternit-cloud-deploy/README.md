# allternit-cloud-deploy

Deployment automation and orchestration for the Allternit platform.

## Purpose

This crate coordinates the full lifecycle of deploying Allternit to a cloud
provider:

1. Preflight validation of credentials and configuration.
2. Provisioning a VM instance via a `CloudProvider` implementation.
3. Waiting for the instance to be ready.
4. Installing the Allternit runtime over SSH.
5. Configuring networking and firewall rules.
6. Running health checks and returning access credentials.

## Architecture

- `orchestrator.rs` — `DeploymentOrchestrator` drives the deployment phases.
- `installer.rs` — SSH-based installation of the Allternit runtime.
- `scripts.rs` — Shell scripts used during installation.
- `health.rs` — Post-install health checks.
- `status.rs` — Deployment status tracking.

## Usage

```rust
use std::sync::Arc;
use allternit_cloud_deploy::DeploymentOrchestrator;
use allternit_cloud_core::{CloudProvider, DeploymentConfig, ProviderCredentials};

async fn deploy(
    provider: Arc<dyn CloudProvider>,
    credentials: ProviderCredentials,
    config: DeploymentConfig,
) -> Result<allternit_cloud_deploy::DeploymentResult, allternit_cloud_core::CloudError> {
    let orchestrator = DeploymentOrchestrator::new(provider, credentials);
    orchestrator.deploy(config).await
}
```

## Build

```bash
cargo check -p allternit-cloud-deploy
cargo test -p allternit-cloud-deploy
```

## Integration

Concrete provider implementations live in
`infrastructure/providers/`, e.g. `allternit-cloud-hetzner`.
