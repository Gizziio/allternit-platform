# Allternit Reality Spec: Unified Data Fabric

**Location:** `services/orchestration/control-plane/unified-registry/`  
**Status:** ACTIVE / OPERATIONAL  
**Date:** April 14, 2026

## 1. Role
The Data Fabric is the central orchestration layer for all registry data in the Allternit system. It provides a unified API for the `routing-gateway` to discover and manage Agents, Skills, Tools, and UI Frameworks.

## 2. Orchestration Model
The `DataFabric` struct (`src/fabric/fabric.rs`) coordinates across multiple backend stores:
- **SQL (SQLite):** Primary storage for structured metadata (Agents, Tools, Servers) via the `server-registry`.
- **In-Memory Cache:** Fast lookup for active UI templates and frameworks via `framework-registry`.
- **JSON Manifests:** Static definitions for Capsules and built-in Tools.

## 3. Integration Path
The `api/gateway/routing/` system initializes a shared `Arc<DataFabric>` and uses it to satisfy:
- `/api/v1/agents/list`
- `/api/v1/skills/list`
- `/api/v1/mcp/bridge` (Coordination through unified bridge methods)

## 4. Current Gaps vs Target
- **Vector Integration:** While referenced in the spec, the actual `DataFabric` implementation's depth in vector storage (Ars Contexta) needs to be verified against the `services/memory/` logic.
- **Unified Schema:** Different registries still use slightly different JSON/SQL models, which are mapped at the orchestrator level rather than being natively unified.
