# Allternit Reality Spec: Skills & Tools System (ToolABI)

**Location:** `domains/kernel/core/kernel-contracts/` & `services/tools/`  
**Status:** ACTIVE / OPERATIONAL  
**Date:** April 14, 2026

## 1. Role
The Skills & Tools system defines how agents interact with the world. It uses a strictly typed **ToolABI** (Application Binary Interface) to ensure that tool calls and responses are deterministic and policy-gated.

## 2. The ToolABI Contract
Defined in `domains/kernel/core/kernel-contracts/src/lib.rs`, the `ToolABI` is the normative contract for:
- **Tool Discovery:** How the registry describes a tool's capabilities.
- **Request/Response:** The exact schema for invoking a tool and receiving results.
- **Idempotency & Safety:** Metadata describing if a tool has side effects and its required safety tier.

## 3. Distributed Execution
Tools are executed based on their domain:
- **Kernel Tools (Rust):** Filesystem, Terminal, and OS-level operations (`services/tools/kernel-tools/`).
- **Gateway Tools (TypeScript):** Browser automation and UI rendering (`services/tools/gateway-tools/`).
- **Capsules:** Interactive UI-returning tools that use the `allternit-capsule-sdk`.

## 4. Skill Portability & Adapters
The system includes a **Skill Portability** engine (`packages/@allternit/sdk/allternit-skill-portability`) that allows skills written for other platforms (Claude, Kimi, OpenCode) to be bridged into the Allternit runtime.

## 5. Current Gaps vs Target
- **RL Hooks:** While the target spec mentions Reinforcement Learning (RL) hooks for skill optimization, the current implementation is focused primarily on deterministic execution and portability.
- **Unified Manifest:** The gap between the `SkillSchema.md` in the target and the actual `allternit-skill-portability` drivers needs reconciliation.
