# Visual Verification Quickstart Runbook

## Overview

Visual verification ensures UI changes meet quality standards before autoland.
It captures screenshots, coverage data, console logs, and diffs, then calculates
a confidence score. Scores below threshold block autoland.

---

## 1. Local Development

### Start the verification service

```bash
# Terminal 1: Start the gRPC verification service
cd cmd/gizzi-code
npm run verify:server

# Or use file-based mode (no server needed)
export VERIFICATION_MODE=file
```

### Run verification on a WIH

```bash
# Capture evidence for a specific WIH
npx allternit verify-visual --wih-id wih_abc123

# With verbose output
npx allternit verify-visual --wih-id wih_abc123 --verbose

# Specify output directory
npx allternit verify-visual --wih-id wih_abc123 --output ./my-evidence/
```

### View results

```bash
# List captured evidence
ls .allternit/evidence/

# View JSON result
cat .allternit/evidence/wih_abc123.json | jq

# Open screenshots
open .allternit/evidence/wih_abc123_ui_state.png
```

---

## 2. Check Confidence Score

### Via CLI

```bash
# Get confidence for a WIH
npx allternit verify-visual --wih-id wih_abc123 --check-only

# Output: Confidence: 0.85 (threshold: 0.80) - PASSED
```

### Via API

```bash
# Query the verification service
curl http://localhost:50052/health

# Get evidence for a WIH
curl http://localhost:50052/evidence/wih_abc123
```

---

## 3. Troubleshooting Low Confidence

### Diagnose issues

```bash
# Check what artifacts were captured
npx allternit verify-visual --wih-id wih_abc123 --diagnose

# Expected output:
# ✓ UI State: 0.95 confidence
# ✓ Coverage Map: 0.88 confidence
# ⚠ Console Output: 0.45 confidence (warnings detected)
# ✗ Visual Diff: 0.30 confidence (significant changes)
```

### Common fixes

| Issue | Fix |
|-------|-----|
| Console errors | Fix JavaScript errors in browser console |
| Low coverage | Add tests for changed code paths |
| Visual diffs | Review UI changes, update baseline if expected |
| Timeout | Increase VERIFICATION_TIMEOUT in env |
| Browser not found | Install Playwright: `npx playwright install` |

---

## 4. CI/CD Integration

### GitHub Actions

Visual verification runs automatically on PRs with UI changes.

```yaml
# Already configured in .github/workflows/visual-verification.yml
```

### Required status check

1. Go to Settings → Branches → main
2. Add "Visual Verification" as required status check
3. Save changes

### Skip verification (emergency)

```bash
# Add [skip-visual] to commit message
# OR set bypass approval
governance set-verification-policy --bypass-approval admin@example.com
```

---

## 5. Emergency Procedures

### Bypass verification (requires approval)

```bash
# 1. Request bypass
governance request-bypass --wih-id wih_abc123 --reason "Hotfix, verified manually"

# 2. Get approval from authorized user
governance approve-bypass --wih-id wih_abc123 --approver admin@example.com

# 3. Proceed with autoland
allternit autoland --wih-id wih_abc123 --force
```

### Disable verification (system-wide)

```bash
# ⚠️ Use with caution - disables for all WIHs
governance set-verification-policy --enabled false

# Re-enable
governance set-verification-policy --enabled true
```

---

## 6. Configuration

### Environment variables

```bash
# Provider mode
export VERIFICATION_MODE=grpc        # or 'file' for local dev

# Timeouts
export VERIFICATION_TIMEOUT=60000    # 60 seconds
export VERIFICATION_RETRY_ATTEMPTS=3

# Thresholds
export VERIFICATION_MIN_CONFIDENCE=0.8

# gRPC server
export VERIFICATION_GRPC_PORT=50052
export VERIFICATION_GRPC_HOST=localhost
```

### Policy configuration

```bash
# View current policy
governance get-verification-policy

# Update policy
governance set-verification-policy \
  --min-confidence 0.85 \
  --required-artifacts "ui_state,coverage_map,console_output" \
  --timeout 45
```

---

## 7. Monitoring

### Check verification metrics

```bash
# View Prometheus metrics
curl http://localhost:9090/metrics | grep visual_verification

# Key metrics:
# - visual_verification_latency_seconds
# - visual_verification_confidence
# - visual_verification_failures_total
```

### View audit log

```bash
# Recent verification events
governance audit-log --type GateVisualVerified --limit 10

# Failed verifications
governance audit-log --type GateAutolandFailed --reason "visual" --limit 10
```

---

## 8. Quick Commands Reference

```bash
# Full verification flow
npx allternit verify-visual --wih-id <id> --verbose

# Check health
curl http://localhost:50052/health

# View policy
governance get-verification-policy

# Request bypass
governance request-bypass --wih-id <id> --reason "<reason>"

# View audit
governance audit-log --type GateVisualVerified
```

---

## Support

- Slack: #allternit-visual-verification
- Docs: https://docs.allternit.io/visual-verification
- Issues: https://github.com/allternit/allternit/issues
