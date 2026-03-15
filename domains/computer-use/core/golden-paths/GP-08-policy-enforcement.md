# GP-08: Policy Enforcement Path

## Purpose
Verify that the policy engine correctly blocks, gates, or allows
actions before they reach any adapter.

## Preconditions
- PolicyEngine loaded with default rules (P-001 through P-007)

## Policy Rules Exercised
| Rule  | Trigger                        | Decision          |
|-------|--------------------------------|-------------------|
| P-001 | Domain on denylist             | deny              |
| P-002 | Destructive action keywords    | require_approval  |
| P-003 | Desktop + high risk            | require_headed    |
| P-004 | Cross-session auth_ref leak    | deny              |
| P-005 | Experimental adapter, no opt-in| deny              |
| P-006 | Artifact path outside root     | deny              |
| P-007 | Cross-session data access      | deny              |

## Execution Flow
```
# Blocked: destructive action
PolicyEngine.evaluate(action_type="act",
    action_description="confirm purchase and submit payment")
→ decision: require_approval (P-002)

# Blocked: experimental adapter
PolicyEngine.evaluate(adapter_conformance_grade="experimental",
    explicit_opt_in=False)
→ decision: deny (P-005)

# Allowed: normal navigation
PolicyEngine.evaluate(target="https://example.com",
    action_type="goto")
→ decision: allow

# Blocked: cross-session access
PolicyEngine.evaluate(cross_session_access=True)
→ decision: deny (P-007)
```

## Evidence Requirements
- Every policy decision has a decision_id
- rules_applied lists which rules fired
- Overrides captured when policy modifies adapter behavior

## Receipt Requirements
- Policy decisions attached to route decision receipts
- Blocked actions produce receipts (action never reaches adapter)

## Conformance
- Suite F: F-01 through F-06
