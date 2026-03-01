# Security Policy Controls

Security policy controls implement a defense-in-depth model for the A2R platform. This component is part of the Security Controls system within the 2-governance layer.

**Status:** Implemented baseline

Defense-in-depth model:
1) Settings hardening (allowlists, path restrictions)
2) Constitutional defense (command authority boundaries)
3) Pre-execution validation (hook-based policy checks before every tool)
4) Safe execution primitives (typed APIs, no shell injection, domain allowlists)
5) SSRF/egress control (block metadata IPs, private ranges)
6) Secret scoping (least privilege, short-lived tokens)
7) Audit chain (tamper-evident history events)

Multi-tenancy:
- data isolation
- execution isolation
- secret isolation
- audit isolation

Baseline governance capabilities implemented:
- Identity registry for humans, agents, services, devices, nodes
- Organizations, roles, and groups with scoped permissions
- Scoped token issuance/verification with expiry and revocation
- mTLS peer verification for service/device identities
- Optional two-man rule approvals for destructive tiers
- Audit ledger integration with event emission

## Location in Architecture

This component is located at:
`2-governance/security-policy-controls/`

It is part of the Security Controls subsystem of the 2-governance layer.