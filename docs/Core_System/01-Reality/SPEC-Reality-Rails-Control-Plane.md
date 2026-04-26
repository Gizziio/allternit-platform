# Allternit Reality Spec: Rails Control Plane

**Location:** `domains/kernel/allternit-agent-system-rails/`  
**Status:** ACTIVE / OPERATIONAL  
**Date:** April 14, 2026

## 1. Role
The Rails system is the primary state and orchestration engine for the current kernel implementation. It manages the lifecycle of agents, the storage of evidence (Receipts), and the coordination of work-in-hand (WIH).

## 2. Core Modules (Physical Implementation)
- **Bus (`src/bus/`):** Internal event routing.
- **Gate (`src/gate/`):** Policy and safety enforcement boundary.
- **Ledger (`src/ledger/`):** Source of truth for all events and state changes.
- **Mail (`src/mail/`):** Asynchronous communication between agents.
- **Vault (`src/vault/`):** Secure storage and OAuth management.
- **WIH (`src/wih/`):** "Work-In-Hand" tracking for active tasks and projections.

## 3. Communication
Uses a **JSON Event Envelope** protocol defined in `schemas/v1.0.0/event-envelope.json`. It bridges the gap between the TypeScript gateways and the Rust execution plane.

## 4. Current Gaps vs Target
- **Workflow Compilation:** Currently limited; relies on an external `allternit-workflows` crate that is partially commented out in the gateway.
- **Determinism:** While the spec calls for a scientific loop, the current implementation is more event-driven and linear.
