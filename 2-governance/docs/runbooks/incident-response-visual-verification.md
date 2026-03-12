# Incident Response: Visual Verification Failures

## Overview

This runbook covers responding to visual verification system failures that
block the autoland pipeline.

---

## Severity Levels

### P1 - Critical (All autolands blocked)
- Verification service completely down
- All WIHs failing with same error
- gRPC connection failures across all providers

### P2 - High (Significant percentage blocked)
- >25% of WIHs failing verification
- Confidence scores consistently below threshold
- Provider performance degraded

### P3 - Medium (Intermittent failures)
- Sporadic timeouts
- Individual WIHs failing retry
- False positives in confidence scoring

### P4 - Low (Minor issues)
- Single WIH bypass needed
- Documentation gaps
- Non-blocking warnings

---

## Incident Response Playbooks

### P1: All Autolands Blocked

#### Immediate Actions (< 5 min)

1. **Acknowledge incident**
   ```bash
   # In incident channel
   /incident create visual-verification-down P1
   ```

2. **Check service health**
   ```bash
   # Verify gRPC service status
   curl http://localhost:50052/health
   
   # Check substrate logs
   kubectl logs -n a2r deployment/substrate --tail=100 | grep -i verification
   
   # Check provider registry
   a2r provider-status verification
   ```

3. **Escalate if needed**
   - Page on-call if not already done
   - Notify #incidents channel

#### Short-term Mitigation (< 15 min)

1. **Switch to file-based provider (emergency)**
   ```bash
   # Emergency fallback to file-based
   governance set-verification-policy --provider file
   
   # Verify switch worked
   a2r provider-status verification
   ```

2. **OR disable verification (last resort)**
   ```bash
   # ⚠️ Requires emergency approval
   governance set-verification-policy --enabled false --reason "P1 incident"
   ```

3. **Verify autoland resumes**
   ```bash
   # Check recent autoland attempts
   a2r gate-status --last 5
   ```

#### Root Cause Investigation (< 1 hour)

1. **Collect logs**
   ```bash
   # gRPC server logs
   kubectl logs -n gizzi deployment/verification-server --since=1h
   
   # Substrate verification logs
   kubectl logs -n a2r deployment/substrate --since=1h | grep verification
   
   # Network connectivity
   kubectl exec -it deployment/substrate -- nc -zv verification-server 50052
   ```

2. **Check for recent changes**
   ```bash
   # Recent deployments
   kubectl rollout history deployment/verification-server
   
   # Policy changes
   governance audit-log --type PolicyChanged --since "1 hour ago"
   ```

#### Resolution

1. **Fix root cause**
   - Deploy fix for identified issue
   - Verify fix in staging

2. **Restore normal operation**
   ```bash
   # Switch back to gRPC
   governance set-verification-policy --provider grpc
   
   # Re-enable if disabled
   governance set-verification-policy --enabled true
   ```

3. **Verify system health**
   ```bash
   # Run smoke test
   a2r verify-visual --wih-id smoke-test --dry-run
   
   # Check metrics
   curl http://localhost:9090/metrics | grep visual_verification
   ```

---

### P2: High Failure Rate

#### Diagnosis

1. **Analyze failure patterns**
   ```bash
   # Get recent failure stats
   governance audit-log --type GateAutolandFailed --since "1 hour ago" | \
     jq -r '.reason' | sort | uniq -c | sort -rn
   
   # Check confidence distribution
   curl http://localhost:9090/metrics | grep visual_verification_confidence
   ```

2. **Identify affected WIHs**
   ```bash
   # List recent failures
   a2r list-wihs --status failed --since "1 hour ago"
   
   # Check common patterns
   a2r analyze-failures --since "1 hour ago"
   ```

#### Mitigation

1. **Adjust thresholds temporarily**
   ```bash
   # Lower threshold to reduce false negatives
   governance set-verification-policy --min-confidence 0.65
   
   # Note: Revert after fixing root cause
   ```

2. **Increase timeouts**
   ```bash
   # If timeouts are causing failures
   governance set-verification-policy --timeout 60
   ```

#### Investigation

1. **Check provider performance**
   ```bash
   # Latency metrics
   curl http://localhost:9090/metrics | grep visual_verification_latency
   
   # Provider health
   a2r provider-health verification
   ```

2. **Review artifact capture**
   ```bash
   # Check artifact success rates
   a2r verify-stats --since "1 hour ago"
   ```

---

### P3/P4: Individual Failures

#### Diagnosis

```bash
# Get detailed failure info
a2r verify-visual --wih-id <id> --diagnose

# Check specific artifact
a2r get-artifact --wih-id <id> --type console_output
```

#### Resolution

1. **If legitimate issue**: Fix the underlying problem
2. **If false positive**: Request bypass
   ```bash
   governance request-bypass --wih-id <id> --reason "False positive: <explanation>"
   ```

---

## Communication Templates

### Status Page Update (P1)

```
[Investigating] Visual verification system degraded

We are investigating an issue with the visual verification system that is 
blocking autoland operations. Engineers are engaged and working on a resolution.

Impact: All autolands temporarily blocked
Workaround: File-based provider fallback deployed

Updated: <timestamp>
```

### Post-Incident Summary Template

```markdown
## Incident: Visual Verification <Brief Description>

**Date**: <date>
**Severity**: P1/P2/P3
**Duration**: <X> minutes
**Impact**: <description>

### Timeline
- HH:MM - Issue detected
- HH:MM - Mitigation deployed
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

### Root Cause
<description>

### Resolution
<steps taken>

### Follow-up Actions
- [ ] <action item>
```

---

## Escalation Contacts

| Level | Contact | When |
|-------|---------|------|
| L1 | On-call engineer | P1/P2 incidents |
| L2 | Verification team lead | P1, >30 min duration |
| L3 | Engineering manager | P1, >1 hour duration |
| L4 | VP Engineering | Service unavailable >2 hours |

---

## Recovery Verification Checklist

- [ ] gRPC health check passes
- [ ] File-based provider responds
- [ ] Test WIH passes verification
- [ ] Metrics showing normal confidence scores
- [ ] No recent errors in logs
- [ ] Autoland queue processing normally
- [ ] Incident closed in tracking system
- [ ] Post-mortem scheduled (if P1/P2)
