# Allternit Reality Spec: Infrastructure & Operations

**Location:** `api/cloud/` & `infrastructure/`  
**Status:** ACTIVE / MULTI-CLOUD  
**Date:** April 14, 2026

## 1. Role
The Infrastructure system provides the physical and virtual environments for agent execution. It supports a hybrid model of local execution and remote scaling across multiple cloud providers.

## 2. Multi-Provider Orchestration
Implementation: `api/cloud/allternit-node/allternit-infrastructure/src/providers/`
Allternit can provision and manage resources across:
- **AWS:** Enterprise-scale infrastructure.
- **DigitalOcean & Hetzner:** High-performance VPS nodes for edge execution.
- **Cloud Wizard:** A bootstrap service (`api/cloud/allternit-cloud-wizard`) that automates provider setup and preflight checks.

## 3. Remote Node Execution (allternit-node)
Implementation: `api/cloud/allternit-node/`
Remote execution occurs on specialized nodes that provide:
- **Runtime Templates:** Docker-based environments for specific tasks (Nix, Python ML, Rust Systems).
- **Environment Engine:** Manages sandboxing and resource isolation via Docker and DevContainers.
- **WebSocket Gateway:** Bidirectional communication for real-time tool execution and PTY access.

## 4. Cloud Backend
Implementation: `api/core/cloud-backend/`
A centralized WebSocket server that coordinates:
- **Browser Extensions:** Routes `BROWSER.*` tool calls to remote nodes.
- **Thin Clients:** Manages real-time chat and session continuity.
- **Authentication:** Validates tokens across JWT and opaque auth modes.

## 5. Current Gaps vs Target
- **Multi-Region Sync:** While the database migrations include `multi_region` support, the depth of swarm coordination across these regions needs further verification in the `scheduler` logic.
- **Automated Scaling:** The system provides the primitives for scaling (Providers + Node installers), but the policy-driven auto-scaling mentioned in the target specs is in progress.
