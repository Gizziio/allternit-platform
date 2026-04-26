# /agent/POLICY.acf.md — ACF Governance Gates

## Role Boundaries
- Architect: may edit `/spec/**`, may not write implementation code.
- Implementer: may write implementation code, may not edit `/spec/**`.
- Reviewer: may emit findings, may not write implementation code.
- RemediationAgent: Implementer subtype; patch-only; no spec changes.
- Security: gates destructive tools and release operations.

## Tooling Constraints
- Runner must enforce a tool allowlist by role and by risk tier.
- Any attempt to write into locked paths must hard-fail.

## Determinism Requirements
- Model pin required for remediation loops.
- Gate order is fixed: policy-gate → review-clean-head → evidence → acceptance → security.
- Review acceptance requires head SHA match.

## Receipts
- Every gate must emit a GateReceipt.
- Only a full PASS set emits a MergeEligibilityReceipt.
