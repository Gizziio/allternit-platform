# Allternit Architecture — Global System Map (Operational Reality)

**Date:** April 14, 2026  
**Status:** DRAFT (Derived from Code Audit)  

## 1. Overview
The Allternit system is a **Distributed Gateway & Multi-Runtime** platform. It enables agentic execution across diverse environments (Local CLI, Desktop App, Cloud API, Browser Extension) through a unified protocol.

## 2. The Four Gateways (Access Plane)
Communication with the kernel and services occurs through four primary transports:

| Gateway | Location | Target Environment |
|---------|----------|--------------------|
| **Stdio** | `api/gateway/stdio/` | CLI-first (Gizzi) |
| **HTTP** | `api/gateway/http/` | Web & Third-party integrations |
| **AGUI** | `api/gateway/agui/` | Desktop Application (Electron) |
| **Browser** | `api/gateway/browser/` | Browser Extension / WebVM |

## 3. Orchestration & Execution (Control/Execution Plane)
Logic is distributed between orchestration services and physical executors.

*   **Orchestration:** `services/orchestration/` handles lifecycle, workspace management, and policy enforcement.
*   **Executors:** `infrastructure/executor/` and `domains/kernel/` provide the low-level drivers (Firecracker, Apple VF, Process) for running code.
*   **Runtimes:** `services/runtime/` provides the high-level environments (Browser, Node, Rust) for agent tasks.

## 4. The Data Fabric (State Plane)
State is not monolithic but distributed across functional packages.

*   **Registry:** `packages/registry/` - Single source of truth for Agents, Skills, and Tools.
*   **Memory:** `services/memory/` - Handles history, context hydration, and vector search (Ars Contexta).
*   **Contracts:** `platform/` and `sdk/` define the schemas and protocols that bind all layers together.

## 5. Mode Control
Execution behavior is modulated through the **Mode Controller** (`cmd/gizzi-code/packages/sdk/src/harness/modes/`):
- **SAFE:** Read-only / Human-in-the-loop
- **AUTO:** Fully autonomous within bounds
- **PLAN:** Simulation / Task-graph generation
- **CODE:** Specialized IDE-integration mode

---
*Note: This document supersedes the legacy "4-plane" architecture and matches the actual directory structure.*
