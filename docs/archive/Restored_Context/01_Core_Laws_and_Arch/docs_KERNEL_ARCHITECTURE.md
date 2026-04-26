# Kernel Architecture Consolidation Plan

## Current State

### services/orchestration/kernel-service/ (Service Binary - CORRECT LOCATION)
- Main binary that runs on port 3004
- Contains brain/, gateway.rs, providers/, session management
- Imports libraries from domains/kernel/

### domains/kernel/ (Kernel Libraries - CORRECT LOCATION)
- infrastructure/allternit-providers/ - Provider adapters
- infrastructure/allternit-openclaw-host/ - OpenClaw host bridge
- capsule-system/ - Capsule runtime
- support/allternit-kernel-tools-components/ - Tools (used by kernel-service)

## Issue
The kernel-service contains too much implementation code that should be in domains/kernel/ as libraries.

## Consolidation Plan

### Phase 1: Extract Provider System to domains/kernel/
Move brain/providers/ to domains/kernel/infrastructure/allternit-providers/src/runtime/

### Phase 2: Extract ACP Driver to domains/kernel/
Move brain/drivers/acp.rs to domains/kernel/infrastructure/allternit-acp-driver/

### Phase 3: Extract Gateway to domains/kernel/
Move brain/gateway.rs to domains/kernel/control-plane/allternit-gateway/

### Phase 4: Kernel Service becomes thin orchestrator
services/orchestration/kernel-service/ only contains:
- main.rs - Service entry point
- config loading
- Router setup
- Calls into domains/kernel/ libraries

## Dependencies After Consolidation

```
services/kernel-service
  ├── domains/kernel/infrastructure/allternit-providers
  ├── domains/kernel/infrastructure/allternit-acp-driver  
  ├── domains/kernel/control-plane/allternit-gateway
  └── domains/kernel/support/allternit-kernel-tools-components
```
