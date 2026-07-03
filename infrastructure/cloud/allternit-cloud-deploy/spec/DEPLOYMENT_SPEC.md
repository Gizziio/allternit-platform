# Allternit Cloud Deployment Specification

## Overview

The deployment orchestrator automates installation of the Allternit platform on
a remote cloud instance.

## Phases

| Phase | Progress | Description |
|-------|----------|-------------|
| Pending | 0 | Deployment initialized |
| Validating | 10 | Preflight checks |
| Provisioning | 30 | VM provisioned by provider |
| Installing | 50-60 | Runtime installed over SSH |
| Configuring | 75 | Networking and firewall |
| HealthChecking | 90 | Health checks |
| Complete | 100 | Deployment finished |
| Failed | 100 | Deployment failed |

## Inputs

- `DeploymentConfig` — provider, region, instance type, SSH key, etc.
- `ProviderCredentials` — API token, project ID, etc.
- `Arc<dyn CloudProvider>` — provider implementation.

## Outputs

- `DeploymentResult` — instance ID, public IP, access URL, admin email,
  temporary password, final status.

## Error Handling

Failures are returned as `CloudError`:
- `PreflightFailed` — validation errors.
- `ProvisionFailed` — provider could not create instance.
- `SshFailed` — SSH connection or command error.
- `HealthCheckFailed` — post-install checks failed.

## Tests

Unit tests use a mock `CloudProvider` to verify phase progression and error
paths without making real API calls.
