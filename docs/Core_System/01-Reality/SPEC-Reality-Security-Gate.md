# Allternit Reality Spec: Governance & Security (The Gate)

**Location:** `domains/kernel/allternit-agent-system-rails/` & `services/orchestration/`  
**Status:** ACTIVE / OPERATIONAL  
**Date:** April 14, 2026

## 1. Role
Governance and Security in Allternit are enforced through a strictly gated execution model. Every action taken by an agent must pass through the **Gate**, which validates the request against active policies, provenance requirements, and safety tiers.

## 2. The Gate (Enforcement Boundary)
Implementation: `domains/kernel/allternit-agent-system-rails/src/gate/`
The Gate coordinates several key security subsystems:
- **Ledger:** Ensures every event is recorded and cannot be tampered with (Immutable audit trail).
- **Leases:** Manages temporary permissions for resources and tool execution.
- **Vault:** Provides secure, encrypted storage for API keys, OAuth tokens, and sensitive actor data.
- **Visual Verification:** Optional provider for human-in-the-loop verification of agent actions.

## 3. Policy Enforcement
Implementation: `services/orchestration/orchestration/policy-service/`
Logic is decoupled from the kernel and managed by a dedicated Policy Service. Policies define:
- **Identity & Auth:** Who the actor is (Human, Agent, System).
- **Tool Access:** Which tools an actor is allowed to use based on their Safety Tier.
- **Path Restrictions:** Filesystem boundaries for agent operations.

## 4. System Law
Implementation: `domains/kernel/drivers/system-law/`
A low-level driver that enforces hard-coded invariants that cannot be overridden by higher-level policies (e.g., Kernel integrity checks).

## 5. Current Gaps vs Target
- **RLM Policy Integration:** The Recursive Language Model (RLM) promotion pipeline mentioned in the target specs is still being integrated with the primary Gate logic.
- **Cross-Cutting Enforcement:** While the Gate is mature, ensuring consistent enforcement across the diverse set of gateways (Stdio, HTTP, AGUI) is an ongoing hardening effort.
