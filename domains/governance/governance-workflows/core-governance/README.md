# Core Governance Engine

The core governance engine provides the central decision-making capabilities for the Allternit platform. This component is part of the Governance Workflows system within the 2-governance layer.

**Status:** Implemented baseline

Core governance capabilities:
- Identity registry for humans, agents, services, devices, nodes
- Organizations, roles, and groups with scoped permissions
- Scoped token issuance/verification with expiry and revocation
- mTLS peer verification for service/device identities
- Optional two-man rule approvals for destructive tiers
- Audit ledger integration with event emission
- Decision workflow management
- Stakeholder notification systems
- Compliance checking mechanisms

Governance workflows:
- Decision workflow engine: Manages governance workflows
- Approval system: Handles approval processes
- Stakeholder notification: Notifies stakeholders of governance events
- Compliance checker: Verifies compliance with governance rules

## Location in Architecture

This component is located at:
`2-governance/governance-workflows/core-governance/`

It is part of the Governance Workflows subsystem of the 2-governance layer.
