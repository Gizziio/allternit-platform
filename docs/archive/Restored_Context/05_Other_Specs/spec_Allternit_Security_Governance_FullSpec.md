# /spec/SecurityGovernance.md
# Allternit Security & Governance Specification

Status: Canonical  
Layer: L2 Governance + Cross-Cutting Enforcement  
Scope: Humans, Agents, Skills, Memory, Devices, Providers

---

## 1. Purpose
Security and governance in Allternit are foundational control planes enabling no-HITL autonomy.

## 2. Core Principles
- Zero implicit trust
- Least privilege
- Explicit scope
- Policy-gated side effects
- Full auditability
- Immediate revocation
- Local sovereignty

## 3. Identity Model (AuthN)
Identity types:
- HumanUser
- AgentIdentity
- ServiceAccount
- DeviceIdentity
- SkillPublisherIdentity
- NodeIdentity

Auth methods:
- OS-bound local auth
- Keypairs
- mTLS
- Signed session tokens
- Hardware-backed keys

## 4. Authorization Model (AuthZ)
Hybrid RBAC + ABAC.
Evaluates identity, role, scope, tier, risk, environment, history.

## 5. Safety Tiers
T0 Read-only  
T1 Compute  
T2 Write  
T3 Destructive  
T4 Actuation  

## 6. Policy Engine
Central decision authority. Outputs allow/deny/constraint.

## 7. Tool Gateway
Only side-effect path. Mandatory policy checks.

## 8. Defense-in-Depth
Seven-layer security stack.

## 9. Audit Ledger
Append-only, replayable, tamper-evident.

## 10. Revocation
Immediate termination and rollback.

## 11. Multi-Tenancy
Strict isolation guarantees.

## 12. Governance as Organization
Enterprise-style AI org model.

## 13. Non-Goals
No implicit trust or silent escalation.

---
End of Specification
